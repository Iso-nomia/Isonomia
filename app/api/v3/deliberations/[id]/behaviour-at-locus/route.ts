/**
 * GET /api/v3/deliberations/[id]/behaviour-at-locus
 *
 * Cluster F — `get_behaviour_at_locus`
 *
 * Returns the behaviour B_ℓ at a given locus in the deliberation:
 * all incarnations (Designs) spanning that locus, with stratum labels
 * and WitnessRecord-coverage fitness.
 *
 * Query params:
 *   locus  string  (required)
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError, enforceTokenScope } from "@/server/ludics/auth";
import { getBehaviourAtLocus } from "@/server/ludics/behaviourAtLocus";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;

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
  try {
    enforceTokenScope(caller, deliberationId);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: err.status });
    }
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const locus = searchParams.get("locus");
  if (!locus) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: locus" },
      { status: 400 },
    );
  }

  const result = await getBehaviourAtLocus(deliberationId, locus);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "No behaviour found at the given locus" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
