/**
 * GET /api/deliberations/:deliberationId/citation-graph
 * Get citation graph for entire deliberation (Phase 3.2)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildDeliberationCitationGraph,
  getDeliberationCitationStats,
} from "@/lib/citations/citationGraphService";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET - Get citation graph for a deliberation
 * Query params:
 *   - includeExternal: Whether to include citations from/to other deliberations (default true)
 *   - includeStats: Whether to include citation statistics (default false)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const { searchParams } = new URL(req.url);

    const includeExternalParam = searchParams.get("includeExternal");
    const includeStatsParam = searchParams.get("includeStats");

    const includeExternal = includeExternalParam !== "false";
    const includeStats = includeStatsParam === "true";

    const graph = await buildDeliberationCitationGraph(
      deliberationId,
      includeExternal
    );

    let stats = null;
    if (includeStats) {
      stats = await getDeliberationCitationStats(deliberationId);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          graph,
          stats,
        },
      },
      NO_STORE
    );
  } catch (error: any) {
    console.error("[GET /api/deliberations/[id]/citation-graph] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get citation graph" },
      { status: 500, ...NO_STORE }
    );
  }
}
