export const dynamic = "force-dynamic";

// app/api/arguments/[id]/scheme-net/route.ts
/**
 * Phase 5B: Scheme Net CRUD Endpoints
 * 
 * Manages sequential composition of argumentation schemes (Nets)
 * Based on Macagno & Walton Section 7: "Using Argumentation Schemes: Nets of Argumentation Schemes"
 * 
 * Endpoints:
 * - GET    /api/arguments/[id]/scheme-net - Retrieve scheme net for argument
 * - POST   /api/arguments/[id]/scheme-net - Create or update scheme net
 * - DELETE /api/arguments/[id]/scheme-net - Delete scheme net
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/arguments/[id]/scheme-net
 * Retrieve the scheme net for an argument, including all steps and scheme details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: argumentId } = await context.params;

    const net = await prisma.schemeNet.findUnique({
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
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!net) {
      return NextResponse.json(
        { error: "Scheme net not found for this argument" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      net: {
        id: net.id,
        argumentId: net.argumentId,
        description: net.description,
        overallConfidence: net.overallConfidence,
        createdAt: net.createdAt,
        updatedAt: net.updatedAt,
        steps: net.steps.map((step) => ({
          id: step.id,
          stepOrder: step.stepOrder,
          label: step.label,
          schemeId: step.schemeId,
          schemeName: step.scheme.name || step.scheme.key,
          schemeKey: step.scheme.key,
          schemeSummary: step.scheme.summary,
          premises: step.scheme.premises,
          conclusion: step.scheme.conclusion,
          materialRelation: step.scheme.materialRelation,
          reasoningType: step.scheme.reasoningType,
          inputFromStep: step.inputFromStep,
          inputSlotMapping: step.inputSlotMapping,
          stepText: step.stepText,
          confidence: step.confidence,
          createdAt: step.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/arguments/[id]/scheme-net] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve scheme net" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arguments/[id]/scheme-net
 * Create or update a scheme net for an argument
 * 
 * Body:
 * {
 *   description?: string;
 *   steps: Array<{
 *     schemeId: string;
 *     stepOrder: number;
 *     label?: string;
 *     inputFromStep?: number;
 *     inputSlotMapping?: Record<string, string>;
 *     stepText?: string;
 *     confidence?: number;
 *   }>;
 * }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: argumentId } = await context.params;
    const body = await request.json();

    // Validate argument exists
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }

    // Validate steps
    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json(
        { error: "At least one scheme step is required" },
        { status: 400 }
      );
    }

    // Validate step ordering (must be sequential 1, 2, 3...)
    const stepOrders = body.steps.map((s: any) => s.stepOrder).sort((a: number, b: number) => a - b);
    for (let i = 0; i < stepOrders.length; i++) {
      if (stepOrders[i] !== i + 1) {
        return NextResponse.json(
          { error: `Step orders must be sequential starting from 1. Found: ${stepOrders.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate inputFromStep references
    for (const step of body.steps) {
      if (step.inputFromStep !== null && step.inputFromStep !== undefined) {
        if (step.inputFromStep >= step.stepOrder) {
          return NextResponse.json(
            { error: `Step ${step.stepOrder} cannot reference a later or same step (${step.inputFromStep})` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate overall confidence (weakest link in chain)
    const overallConfidence = Math.min(...body.steps.map((s: any) => s.confidence ?? 1.0));

    // Upsert SchemeNet (create or update)
    const net = await prisma.schemeNet.upsert({
      where: { argumentId },
      create: {
        argumentId,
        description: body.description || null,
        overallConfidence,
      },
      update: {
        description: body.description || null,
        overallConfidence,
        updatedAt: new Date(),
      },
    });

    // Delete existing steps and recreate (simpler than update logic)
    await prisma.schemeNetStep.deleteMany({
      where: { netId: net.id },
    });

    // Create new steps
    const steps = await Promise.all(
      body.steps.map((step: any) =>
        prisma.schemeNetStep.create({
          data: {
            netId: net.id,
            schemeId: step.schemeId,
            stepOrder: step.stepOrder,
            label: step.label || null,
            inputFromStep: step.inputFromStep || null,
            inputSlotMapping: step.inputSlotMapping || null,
            stepText: step.stepText || null,
            confidence: step.confidence ?? 1.0,
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
        })
      )
    );

    return NextResponse.json({
      success: true,
      net: {
        id: net.id,
        argumentId: net.argumentId,
        description: net.description,
        overallConfidence: net.overallConfidence,
        steps: steps.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          label: s.label,
          schemeId: s.schemeId,
          schemeName: s.scheme.name || s.scheme.key,
          schemeKey: s.scheme.key,
          confidence: s.confidence,
        })),
      },
    });
  } catch (error: any) {
    console.error("[POST /api/arguments/[id]/scheme-net] Error:", error);
    return NextResponse.json(
      { error: "Failed to create/update scheme net", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/arguments/[id]/scheme-net
 * Delete the scheme net for an argument
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: argumentId } = await context.params;

    const net = await prisma.schemeNet.findUnique({
      where: { argumentId },
      select: { id: true },
    });

    if (!net) {
      return NextResponse.json(
        { error: "Scheme net not found" },
        { status: 404 }
      );
    }

    // Delete net (cascade will delete steps)
    await prisma.schemeNet.delete({
      where: { id: net.id },
    });

    return NextResponse.json({
      success: true,
      message: "Scheme net deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/arguments/[id]/scheme-net] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete scheme net" },
      { status: 500 }
    );
  }
}
