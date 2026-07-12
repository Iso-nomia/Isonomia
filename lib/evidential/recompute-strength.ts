/**
 * Phase 3: Strength Recomputation
 * 
 * Recomputes ArgumentSupport.strength values for composed arguments based on:
 * - Base confidence (ArgumentSupport.base)
 * - Premise strengths (from ArgumentEdge type='support')
 * - Assumption weights (from DerivationAssumption)
 * 
 * Formula: strength = base × ∏(premise_strengths) × ∏(assumption_weights)
 */

import { prisma } from "@/lib/prismaclient";

const DEFAULT_STRENGTH = 0.6;

export interface StrengthRecomputationResult {
  newStrength: number;
  baseStrength: number;
  premiseFactor: number;
  assumptionFactor: number;
  premiseCount: number;
  assumptionCount: number;
}

/**
 * Recompute the evidential strength for a single argument
 * @param argumentId - The argument to recompute strength for
 * @returns New strength value and computation breakdown
 */
export async function recomputeArgumentStrength(
  argumentId: string
): Promise<StrengthRecomputationResult> {
  // 1. Get the ArgumentSupport record
  const support = await prisma.argumentSupport.findFirst({
    where: { argumentId },
  });

  if (!support) {
    throw new Error(`No ArgumentSupport found for argument ${argumentId}`);
  }

  const baseStrength = support.base ?? DEFAULT_STRENGTH;

  // 2. Fetch all premise arguments via ArgumentEdge (type='support')
  const premiseEdges = await prisma.argumentEdge.findMany({
    where: {
      toArgumentId: argumentId,
      type: "support",
    },
  });

  // 3. Fetch ArgumentSupport records for premise arguments
  const premiseArgumentIds = premiseEdges.map(e => e.fromArgumentId);
  const premiseSupports = await prisma.argumentSupport.findMany({
    where: {
      argumentId: { in: premiseArgumentIds },
    },
  });

  // Create map of argument ID to strength
  const premiseStrengthMap = new Map<string, number>();
  for (const support of premiseSupports) {
    premiseStrengthMap.set(support.argumentId, support.strength ?? DEFAULT_STRENGTH);
  }

  // 4. Also check ArgumentPremise records (alternative tracking)
  // ArgumentPremise links argumentId to claimId, need to find arguments supporting those claims
  const argumentPremises = await prisma.argumentPremise.findMany({
    where: { argumentId },
  });

  if (argumentPremises.length > 0) {
    const premiseClaimIds = argumentPremises.map(ap => ap.claimId);
    const claimArguments = await prisma.argument.findMany({
      where: {
        claimId: { in: premiseClaimIds },
      },
    });

    // Get ArgumentSupport for these arguments
    const claimArgIds = claimArguments.map(a => a.id);
    const claimSupports = await prisma.argumentSupport.findMany({
      where: {
        argumentId: { in: claimArgIds },
      },
    });

    // Add strengths from claim arguments
    for (const support of claimSupports) {
      if (!premiseStrengthMap.has(support.argumentId)) {
        premiseStrengthMap.set(support.argumentId, support.strength ?? DEFAULT_STRENGTH);
      }
    }
  }

  // Calculate premise factor: ∏(premise_strengths)
  let premiseFactor = 1.0;
  for (const strength of premiseStrengthMap.values()) {
    premiseFactor *= strength;
  }

  // 4. Fetch assumption weights
  const assumptions = await prisma.derivationAssumption.findMany({
    where: { derivationId: support.id },
  });

  // Calculate assumption factor: ∏(assumption_weights)
  let assumptionFactor = 1.0;
  for (const assumption of assumptions) {
    assumptionFactor *= assumption.weight ?? 1.0;
  }

  // 5. Compute final strength
  const newStrength = baseStrength * premiseFactor * assumptionFactor;

  return {
    newStrength,
    baseStrength,
    premiseFactor,
    assumptionCount: assumptions.length,
    premiseCount: premiseStrengthMap.size,
    assumptionFactor,
  };
}

/**
 * Recompute and update strength for a single argument
 * @param argumentId - The argument to recompute
 * @returns The updated ArgumentSupport record
 */
export async function recomputeAndUpdateStrength(argumentId: string) {
  const result = await recomputeArgumentStrength(argumentId);

  const updated = await prisma.argumentSupport.updateMany({
    where: { argumentId },
    data: {
      strength: result.newStrength,
      rationale: `Recomputed: base=${result.baseStrength.toFixed(2)} × premises(${result.premiseCount})=${result.premiseFactor.toFixed(2)} × assumptions(${result.assumptionCount})=${result.assumptionFactor.toFixed(2)}`,
      updatedAt: new Date(),
    },
  });

  return { ...result, updated };
}

/**
 * Recompute strength in a transaction (for use in API routes)
 * @param tx - Prisma transaction client
 * @param argumentId - The argument to recompute
 */
export async function recomputeAndUpdateStrengthInTx(
  tx: any,
  argumentId: string
) {
  // Note: This is a simplified version for transactions
  // Fetches data within the transaction context
  const support = await tx.argumentSupport.findFirst({
    where: { argumentId },
  });

  if (!support) {
    return; // Skip if no support record
  }

  const baseStrength = support.base ?? DEFAULT_STRENGTH;

  // Fetch premise edges
  const premiseEdges = await tx.argumentEdge.findMany({
    where: {
      toArgumentId: argumentId,
      type: "support",
    },
  });

  // Get ArgumentSupport for premise arguments
  const premiseArgIds = premiseEdges.map((e: any) => e.fromArgumentId);
  const premiseSupports = await tx.argumentSupport.findMany({
    where: {
      argumentId: { in: premiseArgIds },
    },
  });

  // Calculate premise factor
  let premiseFactor = 1.0;
  let premiseCount = 0;
  for (const support of premiseSupports) {
    const premiseStrength = support.strength ?? DEFAULT_STRENGTH;
    premiseFactor *= premiseStrength;
    premiseCount++;
  }

  // Fetch assumptions
  const assumptions = await tx.derivationAssumption.findMany({
    where: { derivationId: support.id },
  });

  // Calculate assumption factor
  let assumptionFactor = 1.0;
  for (const assumption of assumptions) {
    assumptionFactor *= assumption.weight ?? 1.0;
  }

  // Compute and update
  const newStrength = baseStrength * premiseFactor * assumptionFactor;

  await tx.argumentSupport.updateMany({
    where: { argumentId },
    data: {
      strength: newStrength,
      rationale: `Recomputed: base=${baseStrength.toFixed(2)} × premises(${premiseCount})=${premiseFactor.toFixed(2)} × assumptions(${assumptions.length})=${assumptionFactor.toFixed(2)}`,
      updatedAt: new Date(),
    },
  });
}
