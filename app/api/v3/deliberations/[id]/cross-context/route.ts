/**
 * GET /api/v3/deliberations/[id]/cross-context
 *
 * AI-EPI Pt. 4 §7. Cross-deliberation projection: canonical-claim
 * families, plexus-edge counts, sibling-room scheme reuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeCrossDeliberationContext } from "@/lib/deliberation/crossContext";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const ctx_ = await computeCrossDeliberationContext(id);
    if (!ctx_) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(ctx_, {
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
