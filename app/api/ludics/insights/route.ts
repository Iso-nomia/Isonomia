export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { getCachedInsights, getCachedLocusInsights } from "@/lib/ludics/insightsCache";

/**
 * GET /api/ludics/insights
 * Returns aggregated Ludics metrics for a deliberation
 * 
 * Query params:
 * - deliberationId: string (required)
 * - locusPath: string (optional) - filter to specific locus subtree
 * 
 * Phase 1: Task 1.5
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const locusPath = searchParams.get("locusPath");

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

    // TODO: Phase 1.6 - Check cache first
    // const cached = await getCachedInsights(deliberationId, locusPath);
    // if (cached) return NextResponse.json(cached);

    // Compute insights (with caching)
    const insights = locusPath
      ? await getCachedLocusInsights(deliberationId, locusPath)
      : await getCachedInsights(deliberationId);

    if (!insights) {
      return NextResponse.json(
        { error: "No Ludics data found for this deliberation" },
        { status: 404 }
      );
    }

    // TODO: Phase 1.6 - Cache the result
    // await cacheInsights(deliberationId, locusPath, insights);

    return NextResponse.json({
      ok: true,
      insights,
      cached: false, // getOrSet handles caching transparently
    });
  } catch (error) {
    console.error("[ludics] Failed to compute insights:", error);
    return NextResponse.json(
      { error: "Failed to compute insights" },
      { status: 500 }
    );
  }
}
