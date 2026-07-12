/**
 * GET /api/v3/behaviours/[id]/minimal-incarnations
 *
 * Cluster B — `find_minimal_incarnations`
 *
 * Returns the minimal element(s) of Inc(B) — the Girard incarnation |B| and,
 * if the poset has co-equal minima, all of them.
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError } from "@/server/ludics/auth";
import { findMinimalIncarnations } from "@/server/ludics/articulationLattice";

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

  const { id: behaviourId } = await ctx.params;
  const result = await findMinimalIncarnations(behaviourId);

  return NextResponse.json({ ok: true, ...result });
}
