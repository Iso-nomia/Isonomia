/**
 * GET /api/v3/deliberations/[id]/chains
 *
 * Track AI-EPI Pt. 4 §4 — ChainExposure endpoint.
 *
 * Surfaces ArgumentChain records as first-class deliberation-scope
 * objects: ordered argument traversals with chainStanding,
 * chainFitness, and weakestLink annotations. Plus uncoveredClaims —
 * top-level conclusions with no chain reaching them.
 */
import { NextRequest, NextResponse } from "next/server";
import { computeChainExposure } from "@/lib/deliberation/chainExposure";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const exposure = await computeChainExposure(id);
    if (!exposure) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(exposure, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    });
  } catch (err: any) {
    if (err?.code === "P1001" || err?.code === "P1002" || err?.code === "P1017") {
      return NextResponse.json(
        { error: "upstream unavailable", code: err.code },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    throw err;
  }
}
