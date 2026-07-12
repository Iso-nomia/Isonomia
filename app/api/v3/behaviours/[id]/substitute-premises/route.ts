/**
 * GET /api/v3/behaviours/[id]/substitute-premises
 *
 * Cluster B — `find_substitute_premises`
 *
 * Given a behaviour and a list of premise claim ids to drop, returns
 * incarnations D' ∈ Inc(B) that defend the same position without those
 * premises.
 *
 * Query params:
 *   drop  string  Comma-separated premise claim ids to exclude (required).
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError } from "@/server/ludics/auth";
import { findSubstitutePremises } from "@/server/ludics/articulationLattice";

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
  const { searchParams } = new URL(request.url);
  const dropParam = searchParams.get("drop");
  if (!dropParam) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: drop" },
      { status: 400 },
    );
  }

  const drop = dropParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (drop.length === 0) {
    return NextResponse.json(
      { ok: false, error: "drop must contain at least one claim id" },
      { status: 400 },
    );
  }

  const result = await findSubstitutePremises(behaviourId, drop);
  return NextResponse.json({ ok: true, ...result });
}
