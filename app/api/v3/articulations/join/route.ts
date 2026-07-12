/**
 * POST /api/v3/articulations/join
 *
 * Cluster B — `compute_articulation_join`
 *
 * Computes D1 ∨_⊥⊥ D2 := (D1 ∪ D2)^⊥⊥ — the smallest behaviour-closed
 * design containing all supplied designs. Creates a new Design row with
 * derivedBy: "join" when none exists.
 *
 * Body: { "designIds": string[] }
 *
 * Auth: session cookie | MCP_API_TOKEN bearer (legacy) | scoped Ludics JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveLudicsReadCaller } from "@/server/ludics/readRouteAuth";
import { LudicsAuthError } from "@/server/ludics/auth";
import { computeArticulationJoin } from "@/server/ludics/articulationLattice";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).designIds)
  ) {
    return NextResponse.json(
      { ok: false, error: "Body must include designIds: string[]" },
      { status: 400 },
    );
  }

  const designIds: string[] = (body as Record<string, unknown>).designIds as string[];
  if (designIds.length < 2) {
    return NextResponse.json(
      { ok: false, error: "designIds must contain at least 2 ids" },
      { status: 400 },
    );
  }

  const result = await computeArticulationJoin(designIds);

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "No designs found for the given ids" },
      { status: 404 },
    );
  }

  // Phase 2e/2f: cross-cone is a value, not an error. Return 200 with the
  // discriminator so callers can branch on `result.kind`.
  return NextResponse.json({ ok: true, ...result });
}
