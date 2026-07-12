export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { invalidateInsightsCache } from "@/lib/ludics/insightsCache";

/**
 * POST /api/ludics/insights/invalidate
 * 
 * Invalidates the insights cache for a deliberation.
 * Call this after dialogue moves or compilation to force fresh insights computation.
 * 
 * Body: { deliberationId: string }
 * 
 * Phase 1: Ludics Insights Caching
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

    // Invalidate cache
    await invalidateInsightsCache(deliberationId);

    return NextResponse.json({
      ok: true,
      message: "Insights cache invalidated",
    });
  } catch (error) {
    console.error("[ludics/insights/invalidate] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
