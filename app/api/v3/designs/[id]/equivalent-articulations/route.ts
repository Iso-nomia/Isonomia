/**
 * GET /api/v3/designs/[id]/equivalent-articulations
 *
 * Cluster B — `find_equivalent_articulations`
 *
 * Returns the ~_⊥⊥ equivalence class of the given design: other designs in
 * the same behaviour that articulate the same position with different
 * premise/move configurations.
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError } from "@/server/ludics/auth";
import { findEquivalentArticulations } from "@/server/ludics/articulationLattice";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let caller;
  try {
    caller = await resolveLudicsReadCaller(request);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: err.status });
    }
    throw err;
  }
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: designId } = await ctx.params;
  const result = await findEquivalentArticulations(designId);

  return NextResponse.json({ ok: true, ...result });
}
