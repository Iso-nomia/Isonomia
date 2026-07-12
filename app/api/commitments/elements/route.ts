export const dynamic = "force-dynamic";

/**
 * GET /api/commitments/elements
 * 
 * Fetch raw LudicCommitmentElement records (with IDs) for a given dialogue/owner.
 * Similar to /api/commitments/state but returns full database records instead of simplified facts/rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dialogueId = searchParams.get("dialogueId");
    const ownerId = searchParams.get("ownerId");

    if (!dialogueId || !ownerId) {
      return NextResponse.json(
        { ok: false, error: "Missing dialogueId or ownerId parameter" },
        { status: 400 }
      );
    }

    // Get all elements for this dialogueId and ownerId
    // Filter by dialogueId through the baseLocus relation
    const elements = await prisma.ludicCommitmentElement.findMany({
      where: {
        ownerId,
        baseLocus: {
          dialogueId,
        },
      },
      include: {
        baseLocus: {
          select: {
            path: true,
          },
        },
      },
      orderBy: [
        { basePolarity: "asc" }, // pos before neg
        { label: "asc" },
      ],
    });

    // Map to simplified structure
    const mapped = elements.map(el => ({
      id: el.id,
      label: el.label,
      basePolarity: el.basePolarity,
      entitled: el.entitled,
      locusPath: el.baseLocus?.path || "0",
      extJson: el.extJson,
    }));

    return NextResponse.json({
      ok: true,
      elements: mapped,
    });
  } catch (error) {
    console.error("[commitments/elements] Error fetching elements:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
