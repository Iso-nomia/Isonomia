export const dynamic = "force-dynamic";

// app/api/arguments/[id]/scheme-net/steps/route.ts
/**
 * Phase 5B: Individual Scheme Net Step Management
 * 
 * Endpoints for managing individual steps in a scheme net
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/arguments/[id]/scheme-net/steps
 * Add a new step to an existing scheme net
 * 
 * Body:
 * {
 *   schemeId: string;
 *   stepOrder: number;
 *   label?: string;
 *   inputFromStep?: number;
 *   inputSlotMapping?: Record<string, string>;
 *   stepText?: string;
 *   confidence?: number;
 * }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: argumentId } = await context.params;
    const body = await request.json();

    // Find existing net
    const net = await prisma.schemeNet.findUnique({
      where: { argumentId },
      include: {
        steps: {
          select: { stepOrder: true, confidence: true },
        },
      },
    });

    if (!net) {
      return NextResponse.json(
        { error: "Scheme net not found. Create a net first." },
        { status: 404 }
      );
    }

    // Validate schemeId exists
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: body.schemeId },
      select: { id: true, key: true, name: true },
    });

    if (!scheme) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404 }
      );
    }

    // Check if stepOrder already exists
    const existingStep = net.steps.find((s: any) => s.stepOrder === body.stepOrder);
    if (existingStep) {
      return NextResponse.json(
        { error: `Step order ${body.stepOrder} already exists. Use PUT to update.` },
        { status: 400 }
      );
    }

    // Validate inputFromStep
    if (body.inputFromStep !== null && body.inputFromStep !== undefined) {
      if (body.inputFromStep >= body.stepOrder) {
        return NextResponse.json(
          { error: `Step ${body.stepOrder} cannot reference a later or same step (${body.inputFromStep})` },
          { status: 400 }
        );
      }
      const refExists = net.steps.some((s: any) => s.stepOrder === body.inputFromStep);
      if (!refExists) {
        return NextResponse.json(
          { error: `Referenced step ${body.inputFromStep} does not exist` },
          { status: 400 }
        );
      }
    }

    // Create new step
    const step = await prisma.schemeNetStep.create({
      data: {
        netId: net.id,
        schemeId: body.schemeId,
        stepOrder: body.stepOrder,
        label: body.label || null,
        inputFromStep: body.inputFromStep || null,
        inputSlotMapping: body.inputSlotMapping || null,
        stepText: body.stepText || null,
        confidence: body.confidence ?? 1.0,
      },
      include: {
        scheme: {
          select: {
            id: true,
            key: true,
            name: true,
            summary: true,
          },
        },
      },
    });

    // Recalculate overall confidence (weakest link)
    const allSteps = [...net.steps.map((s: any) => s.confidence), step.confidence];
    const overallConfidence = Math.min(...allSteps);

    await prisma.schemeNet.update({
      where: { id: net.id },
      data: { overallConfidence },
    });

    return NextResponse.json({
      success: true,
      step: {
        id: step.id,
        stepOrder: step.stepOrder,
        label: step.label,
        schemeId: step.schemeId,
        schemeName: step.scheme.name || step.scheme.key,
        confidence: step.confidence,
      },
      overallConfidence,
    });
  } catch (error: any) {
    console.error("[POST /api/arguments/[id]/scheme-net/steps] Error:", error);
    return NextResponse.json(
      { error: "Failed to add step", details: error.message },
      { status: 500 }
    );
  }
}
