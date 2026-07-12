export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { z } from "zod";

// Validation schema
const CreateStepSchema = z.object({
  stepOrder: z.number().int().positive(),
  schemeId: z.string(),
  label: z.string().optional(),
  stepText: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  inputFromStep: z.number().int().positive().nullable().optional(),
  inputSlotMapping: z.record(z.string()).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const netId = params.id;

    // Parse and validate body
    const body = await request.json();
    const validatedData = CreateStepSchema.parse(body);
    const {
      stepOrder,
      schemeId,
      label,
      stepText,
      confidence,
      inputFromStep,
      inputSlotMapping,
    } = validatedData;

    // Check if SchemeNet exists and user is the author
    const schemeNet = await prisma.schemeNet.findUnique({
      where: { id: netId },
      include: {
        argument: {
          select: { authorId: true },
        },
      },
    });

    if (!schemeNet) {
      return NextResponse.json({ error: "SchemeNet not found" }, { status: 404 });
    }

    if (String(schemeNet.argument.authorId) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the argument author can add steps" },
        { status: 403 }
      );
    }

    // Check if scheme exists
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      select: { id: true, name: true },
    });

    if (!scheme) {
      return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
    }

    // Check if step order already exists
    const existingStep = await prisma.schemeNetStep.findUnique({
      where: {
        netId_stepOrder: {
          netId,
          stepOrder,
        },
      },
    });

    if (existingStep) {
      return NextResponse.json(
        { error: `Step order ${stepOrder} already exists` },
        { status: 400 }
      );
    }

    // If inputFromStep specified, validate it exists
    if (inputFromStep !== null && inputFromStep !== undefined) {
      const previousStep = await prisma.schemeNetStep.findUnique({
        where: {
          netId_stepOrder: {
            netId,
            stepOrder: inputFromStep,
          },
        },
      });

      if (!previousStep) {
        return NextResponse.json(
          { error: `Referenced step ${inputFromStep} does not exist` },
          { status: 400 }
        );
      }
    }

    // Create SchemeNetStep
    const step = await prisma.schemeNetStep.create({
      data: {
        netId,
        schemeId,
        stepOrder,
        label: label || null,
        stepText: stepText || null,
        confidence,
        inputFromStep: inputFromStep || null,
        inputSlotMapping: inputSlotMapping ? JSON.parse(JSON.stringify(inputSlotMapping)) : null,
      },
      include: {
        scheme: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    // Update SchemeNet overall confidence (weakest link)
    const allSteps = await prisma.schemeNetStep.findMany({
      where: { netId },
      select: { confidence: true },
    });
    const weakestConfidence = Math.min(...allSteps.map((s) => s.confidence));
    
    await prisma.schemeNet.update({
      where: { id: netId },
      data: { overallConfidence: weakestConfidence },
    });

    console.log("[POST /api/nets/[id]/steps] Created step:", step.id);

    return NextResponse.json({
      id: step.id,
      netId: step.netId,
      schemeId: step.schemeId,
      schemeName: step.scheme.name,
      stepOrder: step.stepOrder,
      label: step.label,
      stepText: step.stepText,
      confidence: step.confidence,
      inputFromStep: step.inputFromStep,
      inputSlotMapping: step.inputSlotMapping,
      createdAt: step.createdAt,
    });
  } catch (error) {
    console.error("[POST /api/nets/[id]/steps] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create step" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const netId = params.id;

    // Fetch all steps for this net
    const steps = await prisma.schemeNetStep.findMany({
      where: { netId },
      include: {
        scheme: {
          select: { id: true, name: true, description: true },
        },
      },
      orderBy: { stepOrder: "asc" },
    });

    return NextResponse.json({
      steps: steps.map((step) => ({
        id: step.id,
        netId: step.netId,
        schemeId: step.schemeId,
        schemeName: step.scheme.name,
        stepOrder: step.stepOrder,
        label: step.label,
        stepText: step.stepText,
        confidence: step.confidence,
        inputFromStep: step.inputFromStep,
        inputSlotMapping: step.inputSlotMapping,
        createdAt: step.createdAt,
      })),
    });
  } catch (error) {
    console.error("[GET /api/nets/[id]/steps] Error:", error);
    return NextResponse.json({ error: "Failed to fetch steps" }, { status: 500 });
  }
}
