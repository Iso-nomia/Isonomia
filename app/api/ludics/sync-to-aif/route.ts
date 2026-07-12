export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { syncLudicsToAif } from "@/lib/ludics/syncToAif";

/**
 * POST /api/ludics/sync-to-aif
 * 
 * Synchronizes LudicAct rows to AifNode/AifEdge rows for a deliberation.
 * Creates AifNodes for acts that don't have them, and CA-nodes for ASPIC+ attacks.
 * 
 * Body: { deliberationId: string }
 * 
 * Phase 1: Ludics-AIF Integration
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { deliberationId } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Check deliberation access
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: {
        id: true,
        roles: {
          where: { userId: userId.toString() },
          select: { id: true },
        },
      },
    });

    if (!delib) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // Sync Ludics to AIF
    const result = await syncLudicsToAif(deliberationId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[ludics/sync-to-aif] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
