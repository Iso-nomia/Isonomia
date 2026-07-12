export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

/**
 * GET /api/scheme-nets/[id]
 * Fetch a single SchemeNet with full details including steps, schemes, and argument info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const netId = params.id;

    if (!netId) {
      return NextResponse.json(
        { error: "Net ID is required" },
        { status: 400 }
      );
    }

    // Fetch net with all related data
    const net = await prisma.schemeNet.findUnique({
      where: { id: netId },
      include: {
        argument: {
          select: {
            id: true,
            conclusion: { select: { text: true } },
            authorId: true,
          },
        },
        steps: {
          include: {
            scheme: {
              select: {
                id: true,
                name: true,
                description: true,
                cqs: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!net) {
      return NextResponse.json(
        { error: "Net not found" },
        { status: 404 }
      );
    }

    // Argument has no direct author relation (only authorId), so resolve the
    // author User record separately for the response payload.
    const authorId = net.argument?.authorId;
    const author = authorId
      ? await prisma.user.findUnique({
          where: { id: BigInt(authorId) },
          select: { username: true, name: true },
        })
      : null;

    // Infer net type from structure
    let netType: "serial" | "convergent" | "divergent" | "hybrid" = "serial";
    const independentSteps = net.steps.filter(s => !s.inputFromStep);
    
    if (independentSteps.length > 1) {
      netType = "convergent";
    } else if (net.steps.some(s => {
      const feedsFrom = s.inputFromStep;
      return feedsFrom && net.steps.filter(s2 => s2.inputFromStep === feedsFrom).length > 1;
    })) {
      netType = "divergent";
    }

    // Transform response
    const response = {
      id: net.id,
      argumentId: net.argumentId,
      description: net.description,
      overallConfidence: net.overallConfidence,
      netType,
      argument: {
        conclusion: net.argument?.conclusion?.text || "Untitled Argument",
        author: {
          username: author?.username ?? "",
          name: author?.name ?? "",
        },
      },
      steps: net.steps.map(step => ({
        id: step.id,
        stepOrder: step.stepOrder,
        label: step.label,
        stepText: step.stepText,
        confidence: step.confidence,
        inputFromStep: step.inputFromStep,
        inputSlotMapping: step.inputSlotMapping,
        scheme: {
          id: step.scheme.id,
          name: step.scheme.name,
          description: step.scheme.description,
          criticalQuestions: step.scheme.cqs || [],
        },
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/scheme-nets/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scheme-nets/[id]
 * Update an existing SchemeNet
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const netId = params.id;
    const body = await request.json();
    const { description, overallConfidence } = body;

    // Check if net exists and user is authorized
    const existingNet = await prisma.schemeNet.findUnique({
      where: { id: netId },
      include: {
        argument: {
          select: { authorId: true },
        },
      },
    });

    if (!existingNet) {
      return NextResponse.json(
        { error: "Net not found" },
        { status: 404 }
      );
    }

    if (String(existingNet.argument.authorId) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the argument author can edit this net" },
        { status: 403 }
      );
    }

    // Update net
    const updatedNet = await prisma.schemeNet.update({
      where: { id: netId },
      data: {
        description: description !== undefined ? description : existingNet.description,
        overallConfidence: overallConfidence !== undefined ? overallConfidence : existingNet.overallConfidence,
      },
    });

    return NextResponse.json({
      success: true,
      net: updatedNet,
    });
  } catch (error) {
    console.error("[PATCH /api/scheme-nets/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
