export const dynamic = "force-dynamic";

/**
 * GET /api/ludics/loci
 * 
 * Fetch all loci for a given dialogue/deliberation.
 * Used by CommitmentsPanel to populate locus selector dropdown.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dialogueId = searchParams.get("dialogueId");

    if (!dialogueId) {
      return NextResponse.json(
        { ok: false, error: "Missing dialogueId parameter" },
        { status: 400 }
      );
    }

    // Fetch all loci for this dialogue, ordered by path
    const loci = await prisma.ludicLocus.findMany({
      where: {
        dialogueId,
      },
      select: {
        id: true,
        path: true,
        parentId: true,
      },
      orderBy: {
        path: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      loci,
    });
  } catch (error) {
    console.error("[ludics/loci] Error fetching loci:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
