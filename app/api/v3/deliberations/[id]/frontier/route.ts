/**
 * GET /api/v3/deliberations/[id]/frontier
 *
 * Track AI-EPI Pt. 4 §2 — ContestedFrontier endpoint.
 *
 * Returns the set of dialectical *open edges* in a deliberation: the
 * unanswered undercuts, undermines, CQs, and terminal leaves that would
 * actually shift the graph if engaged. Plus a `loadBearingnessRanking`
 * over arguments. This is the anti-centrist substrate.
 *
 * Query params:
 *   sortBy = loadBearingness | recency | severity (default: loadBearingness)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  computeContestedFrontier,
  type FrontierSortBy,
} from "@/lib/deliberation/frontier";

export const dynamic = "force-dynamic";

const VALID: FrontierSortBy[] = ["loadBearingness", "recency", "severity"];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const raw = (sp.get("sortBy") ?? "loadBearingness").trim() as FrontierSortBy;
  const sortBy: FrontierSortBy = VALID.includes(raw) ? raw : "loadBearingness";

  try {
    const frontier = await computeContestedFrontier(id, sortBy);
    if (!frontier) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(frontier, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
      },
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
