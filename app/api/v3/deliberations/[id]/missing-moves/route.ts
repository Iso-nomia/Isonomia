/**
 * GET /api/v3/deliberations/[id]/missing-moves
 *
 * Track AI-EPI Pt. 4 §3 — MissingMoveReport endpoint.
 *
 * Returns the diff between the scheme-typical-move catalog and the moves
 * actually present in the argument graph. Names absent
 * scheme-typical undercuts and unused schemes; flags missing
 * meta-arguments and cross-scheme mediators.
 */
import { NextRequest, NextResponse } from "next/server";
import { computeMissingMoves } from "@/lib/deliberation/missingMoves";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const report = await computeMissingMoves(id);
    if (!report) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(report, {
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
