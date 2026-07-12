/**
 * GET /api/v3/deliberations/[id]/exposure-map
 *
 * Cluster A — `get_exposure_map`
 *
 * Returns the stratified opposition space E(D_P) for a deliberation,
 * partitioned into walked / witnessable / latent strata with optional
 * topology annotation (hub set, load-bearing ranking) and cascade
 * propagation.
 *
 * Query params:
 *   claimId         string   (optional — scope to sub-design rooted at claim)
 *   stratifyDepth   integer  (optional, default 1, max 5)
 *   includeCascade  boolean  (optional, default false)
 *   includeTopology boolean  (optional, default true)
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError, enforceTokenScope } from "@/server/ludics/auth";
import { computeExposureMap } from "@/server/ludics/exposureMap";

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

  const claimId = searchParams.get("claimId") ?? undefined;
  const rawDepth = parseInt(searchParams.get("stratifyDepth") ?? "1", 10);
  const stratifyDepth = Number.isNaN(rawDepth) ? 1 : Math.min(Math.max(rawDepth, 0), 5);
  const includeCascade = searchParams.get("includeCascade") === "true";
  const includeTopology = searchParams.get("includeTopology") !== "false";

  const result = await computeExposureMap(deliberationId, {
    claimId,
    stratifyDepth,
    includeCascade,
    includeTopology,
  });

  return NextResponse.json({ ok: true, deliberationId, ...result });
}
