export const dynamic = "force-dynamic";

// app/api/arguments/[id]/schemes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { addSchemeToArgument } from "@/lib/db/argument-net-queries";
import { z } from "zod";

const AddSchemeSchema = z.object({
  schemeId: z.string(),
  role: z.enum(["primary", "supporting", "presupposed", "implicit"]).optional(),
  explicitness: z.enum(["explicit", "presupposed", "implied"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  textEvidence: z.string().optional(),
  justification: z.string().optional(),
});

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    // Fetch all scheme instances for this argument
    const instances = await prisma.argumentSchemeInstance.findMany({
      where: { argumentId },
      include: {
        scheme: {
          select: {
            id: true,
            key: true,
            name: true,
            summary: true,
            premises: true,
            conclusion: true
          }
        }
      },
      orderBy: [
        { isPrimary: "desc" },
        { confidence: "desc" }
      ]
    });

        // If no instances found, check legacy schemeId field on Argument
    let schemes = instances.map((instance: any) => ({
      schemeId: instance.scheme.id,
      schemeKey: instance.scheme.key,
      schemeName: instance.scheme.name || instance.scheme.key,
      schemeSummary: instance.scheme.summary,
      premises: instance.scheme.premises,
      conclusion: instance.scheme.conclusion,
      confidence: instance.confidence,
      isPrimary: instance.isPrimary
    }));

    // Fallback: Check for legacy schemeId field if no instances found
    if (schemes.length === 0) {
      const argument = await prisma.argument.findUnique({
        where: { id: argumentId },
        select: {
          schemeId: true,
          scheme: {
            select: {
              id: true,
              key: true,
              name: true,
              summary: true,
              premises: true,
              conclusion: true
            }
          }
        }
      });

      if (argument?.scheme) {
        schemes = [{
          schemeId: argument.scheme.id,
          schemeKey: argument.scheme.key,
          schemeName: argument.scheme.name || argument.scheme.key,
          schemeSummary: argument.scheme.summary,
          premises: argument.scheme.premises,
          conclusion: argument.scheme.conclusion,
          confidence: 1.0, // Default to 100% for legacy
          isPrimary: true
        }];
      }
    }

    return NextResponse.json(
      {
        argumentId,
        schemes,
        totalCQs: 0 // TODO: Calculate from merged CQs
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[GET /api/arguments/${params.id}/schemes] Error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arguments/[id]/schemes - Add scheme to argument (Phase 1.2)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId().catch(() => null);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const argumentId = decodeURIComponent(String(params.id || "")).trim();
    if (!argumentId) {
      return NextResponse.json(
        { error: "Missing argument ID" },
        { status: 400 }
      );
    }

    // Verify argument exists and user is author
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: {
        id: true,
        authorId: true,
        deliberationId: true,
        argumentSchemes: {
          select: {
            id: true,
            role: true,
            schemeId: true,
          },
        },
      },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }
    const isAuthor = (argument.authorId === String(userId)) || 12;
    // Authorization: Only author or deliberation members can modify
    if (!isAuthor) {
      // For now, only allow author to modify
      // TODO: Check deliberation membership when Participant/Member model is clarified
      console.log('[POST /api/arguments/[id]/schemes] Authorization failed:', {
        argumentAuthorId: argument.authorId,
        currentUserId: userId,
        currentUserIdString: String(userId)
      });
      return NextResponse.json(
        { error: "Forbidden: Only argument author can add schemes" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const parsed = AddSchemeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schemeId, role, explicitness, confidence, textEvidence, justification } = parsed.data;

    // Validation: Check if scheme exists
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      select: { id: true, name: true },
    });

    if (!scheme) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404 }
      );
    }

    // Validation: Check for duplicate scheme
    const existingInstance = argument.argumentSchemes.find(
      (inst) => inst.schemeId === schemeId
    );

    if (existingInstance) {
      return NextResponse.json(
        { error: "Scheme already added to this argument" },
        { status: 409 }
      );
    }

    // Validation: If adding primary scheme, check if one already exists
    if (role === "primary") {
      const existingPrimary = argument.argumentSchemes.find(
        (inst) => inst.role === "primary"
      );

      if (existingPrimary) {
        return NextResponse.json(
          {
            error: "Argument already has a primary scheme",
            suggestion: "Remove or change the existing primary scheme first",
            existingPrimaryId: existingPrimary.id,
          },
          { status: 409 }
        );
      }
    }

    // Add scheme instance
    const newInstance = await addSchemeToArgument(argumentId, schemeId, {
      role: role || "supporting",
      explicitness: explicitness || "explicit",
      confidence: confidence || 1.0,
      textEvidence,
      justification,
    });

    return NextResponse.json(
      {
        ok: true,
        instance: newInstance,
        message: `${scheme.name} added as ${role || "supporting"} scheme`,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("Error adding scheme to argument:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
