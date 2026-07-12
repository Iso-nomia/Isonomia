/**
 * GET /api/v3/behaviours/[id]/articulation-lattice
 *
 * Cluster B — `get_articulation_lattice`
 *
 * Returns the articulation lattice Art(B) = (Inc(B), ≤_⊆, ∨_⊥⊥) for the
 * behaviour identified by [id], as a navigable poset of incarnations.
 *
 * Query params:
 *   representatives  "incarnations" | "raw"  (default: "incarnations")
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError } from "@/server/ludics/auth";
import { getArticulationLattice } from "@/server/ludics/articulationLattice";

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
  const rep = searchParams.get("representatives") ?? "incarnations";
  if (rep !== "incarnations" && rep !== "raw") {
    return NextResponse.json(
      { ok: false, error: "representatives must be 'incarnations' or 'raw'" },
      { status: 400 },
    );
  }

  const result = await getArticulationLattice(behaviourId, rep);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Behaviour not found or has no designs" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
