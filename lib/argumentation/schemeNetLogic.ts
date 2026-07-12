// lib/argumentation/schemeNetLogic.ts
/**
 * Phase 5: Scheme Net Logic
 * 
 * Business logic for managing and validating Nets of Argumentation Schemes
 * Based on Macagno & Walton Section 7: Sequential composition of schemes
 * 
 * Key Principles:
 * - Chain confidence = weakest link (minimum of all step confidences)
 * - Steps must be sequential (1, 2, 3...)
 * - inputFromStep must reference an earlier step
 * - Variable mapping validates premise-conclusion connections
 */

import { prisma } from "@/lib/prismaclient";

export type SchemeNetStep = {
  id?: string;
  schemeId: string;
  stepOrder: number;
  label?: string | null;
  inputFromStep?: number | null;
  inputSlotMapping?: Record<string, string> | null;
  stepText?: string | null;
  confidence?: number;
};

export type SchemeNetData = {
  description?: string | null;
  steps: SchemeNetStep[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Calculate overall confidence for a scheme net using the "weakest link" principle.
 * The confidence of a chain is only as strong as its weakest inferential step.
 * 
 * @param steps - Array of scheme net steps with confidence scores
 * @returns Minimum confidence across all steps (0.0-1.0)
 */
export function calculateNetConfidence(steps: SchemeNetStep[]): number {
  if (steps.length === 0) return 1.0;
  
  const confidences = steps.map((s) => s.confidence ?? 1.0);
  return Math.min(...confidences);
}

/**
 * Validate scheme net structure before creation/update.
 * Checks:
 * - At least one step exists
 * - Step orders are sequential (1, 2, 3...)
 * - inputFromStep references are valid (earlier steps only)
 * - No circular references
 * 
 * @param netData - Scheme net data to validate
 * @returns Validation result with error messages
 */
export function validateSchemeNet(netData: SchemeNetData): ValidationResult {
  const errors: string[] = [];

  // Check at least one step
  if (!netData.steps || netData.steps.length === 0) {
    errors.push("Scheme net must have at least one step");
    return { valid: false, errors };
  }

  // Check step ordering is sequential
  const stepOrders = netData.steps.map((s) => s.stepOrder).sort((a, b) => a - b);
  for (let i = 0; i < stepOrders.length; i++) {
    if (stepOrders[i] !== i + 1) {
      errors.push(
        `Step orders must be sequential starting from 1. Found: ${stepOrders.join(", ")}`
      );
      break;
    }
  }

  // Check inputFromStep references
  for (const step of netData.steps) {
    if (step.inputFromStep !== null && step.inputFromStep !== undefined) {
      // Must reference an earlier step
      if (step.inputFromStep >= step.stepOrder) {
        errors.push(
          `Step ${step.stepOrder} cannot reference a later or same step (${step.inputFromStep})`
        );
      }

      // Referenced step must exist
      const refExists = netData.steps.some((s) => s.stepOrder === step.inputFromStep);
      if (!refExists) {
        errors.push(
          `Step ${step.stepOrder} references non-existent step ${step.inputFromStep}`
        );
      }
    }
  }

  // Check for duplicate step orders
  const orderSet = new Set(stepOrders);
  if (orderSet.size !== stepOrders.length) {
    errors.push("Duplicate step orders detected");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Retrieve a scheme net with full details including scheme information.
 * Returns null if no net exists for the argument.
 * 
 * @param argumentId - Database ID of the argument
 * @returns Scheme net with steps and scheme details, or null
 */
export async function getSchemeNetForArgument(argumentId: string) {
  return await prisma.schemeNet.findUnique({
    where: { argumentId },
    include: {
      steps: {
        include: {
          scheme: {
            select: {
              id: true,
              key: true,
              name: true,
              summary: true,
              premises: true,
              conclusion: true,
              materialRelation: true,
              reasoningType: true,
              source: true,
              purpose: true,
            },
          },
        },
        orderBy: { stepOrder: "asc" },
      },
    },
  });
}

/**
 * Create or update a scheme net for an argument.
 * Validates structure before persisting.
 * 
 * @param argumentId - Database ID of the argument
 * @param netData - Scheme net data (description and steps)
 * @returns Created/updated scheme net
 * @throws Error if validation fails
 */
export async function upsertSchemeNet(
  argumentId: string,
  netData: SchemeNetData
) {
  // Validate structure
  const validation = validateSchemeNet(netData);
  if (!validation.valid) {
    throw new Error(`Invalid scheme net: ${validation.errors.join("; ")}`);
  }

  // Verify argument exists
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { id: true },
  });

  if (!argument) {
    throw new Error(`Argument ${argumentId} not found`);
  }

  // Verify all schemes exist
  const schemeIds = netData.steps.map((s) => s.schemeId);
  const uniqueSchemeIds = [...new Set(schemeIds)]; // Remove duplicates for validation
  
  const schemes = await prisma.argumentScheme.findMany({
    where: { id: { in: uniqueSchemeIds } },
    select: { id: true },
  });

  if (schemes.length !== uniqueSchemeIds.length) {
    const foundIds = schemes.map((s) => s.id);
    const missingIds = uniqueSchemeIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Schemes not found: ${missingIds.join(", ")}`);
  }

  // Calculate overall confidence (weakest link)
  const overallConfidence = calculateNetConfidence(netData.steps);

  // Upsert net
  const net = await prisma.schemeNet.upsert({
    where: { argumentId },
    create: {
      argumentId,
      description: netData.description || null,
      overallConfidence,
    },
    update: {
      description: netData.description || null,
      overallConfidence,
      updatedAt: new Date(),
    },
  });

  // Delete existing steps and recreate (simpler than complex update logic)
  await prisma.schemeNetStep.deleteMany({
    where: { netId: net.id },
  });

  // Create new steps
  const steps = await Promise.all(
    netData.steps.map((step) =>
      prisma.schemeNetStep.create({
        data: {
          netId: net.id,
          schemeId: step.schemeId,
          stepOrder: step.stepOrder,
          label: step.label || null,
          inputFromStep: step.inputFromStep || null,
          inputSlotMapping: step.inputSlotMapping ?? undefined,
          stepText: step.stepText || null,
          confidence: step.confidence ?? 1.0,
        },
      })
    )
  );

  return { net, steps };
}

/**
 * Delete a scheme net and all its steps.
 * 
 * @param argumentId - Database ID of the argument
 * @returns True if deleted, false if net didn't exist
 */
export async function deleteSchemeNet(argumentId: string): Promise<boolean> {
  const net = await prisma.schemeNet.findUnique({
    where: { argumentId },
    select: { id: true },
  });

  if (!net) {
    return false;
  }

  await prisma.schemeNet.delete({
    where: { id: net.id },
  });

  return true;
}

/**
 * Get CQs for all schemes in the net, grouped by step.
 * Each step's CQs are labeled with the step number for clarity.
 * 
 * @param argumentId - Database ID of the argument
 * @returns Array of steps with their associated CQs
 */
export async function getCQsForSchemeNet(argumentId: string) {
  const net = await getSchemeNetForArgument(argumentId);

  if (!net) {
    return [];
  }

  const stepsWithCQs = await Promise.all(
    net.steps.map(async (step) => {
      const cqs = await prisma.criticalQuestion.findMany({
        where: { schemeId: step.schemeId },
        select: {
          id: true,
          cqKey: true,
          text: true,
          attackType: true,
          targetScope: true,
        },
      });

      return {
        stepOrder: step.stepOrder,
        stepLabel: step.label || `Step ${step.stepOrder}`,
        schemeId: step.schemeId,
        schemeName: step.scheme.name || step.scheme.key,
        cqs: cqs.map((cq) => ({
          ...cq,
          // Prefix CQ text with step label for clarity
          displayText: `[Step ${step.stepOrder}] ${cq.text}`,
        })),
      };
    })
  );

  return stepsWithCQs;
}
