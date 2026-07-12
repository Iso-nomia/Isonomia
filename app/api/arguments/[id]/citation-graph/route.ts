/**
 * GET /api/arguments/:argumentId/citation-graph
 * Get citation graph centered on an argument (Phase 3.2)
 */

import { NextRequest, NextResponse } from "next/server";
import { buildArgumentCitationGraph } from "@/lib/citations/citationGraphService";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * GET - Get citation graph for an argument
 * Query params:
 *   - depth: Number of levels to include (default 2, max 4)
 *   - includeIndirect: Whether to include indirect citations (default true)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const depthParam = searchParams.get("depth");
    const includeIndirectParam = searchParams.get("includeIndirect");

    // Parse and validate depth (1-4)
    let depth = depthParam ? parseInt(depthParam, 10) : 2;
    if (isNaN(depth) || depth < 1) depth = 2;
    depth = Math.min(depth, 4); // Cap at 4 to prevent huge graphs

    // Parse includeIndirect
    const includeIndirect = includeIndirectParam !== "false";

    const graph = await buildArgumentCitationGraph(
      params.id,
      depth,
      includeIndirect
    );

    return NextResponse.json({ ok: true, data: graph }, NO_STORE);
  } catch (error: any) {
    console.error("[GET /api/arguments/[id]/citation-graph] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get citation graph" },
      { status: 500, ...NO_STORE }
    );
  }
}
