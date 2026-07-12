/**
 * GET /api/v3/deliberations/[id]/ecc/culprits?claimId=...
 *
 * Sprint E1 — Ambler §4 belief-revision: "what would I have to retract
 * to reject claim X?" The MCP demo question.
 *
 * Returns the ranked culprit sets for the per-claim arrow, hydrated with
 * `AssumptionUse` text + status so the answer is human-readable without
 * an extra round-trip. Honest-empty when the claim has no derivations or
 * none of its derivations carry assumptions.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  culpritSetsFor,
  hydrateCulpritSets,
  loadClaimArrow,
} from "@/lib/argumentation/eccLoader";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const claimId = new URL(req.url).searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json(
      { ok: false, error: "claimId query parameter is required" },
      { status: 400 },
    );
  }

  const loaded = await loadClaimArrow(deliberationId, claimId);
  if (!loaded) {
    return NextResponse.json({
      ok: true,
      deliberationId,
      claimId,
      culprits: [],
      reason: "no ArgumentSupport rows for this (deliberation, claim) pair",
    });
  }

  const sets = culpritSetsFor(loaded);
  const hydrated = await hydrateCulpritSets(loaded, sets);

  return NextResponse.json({
    ok: true,
    deliberationId,
    claimId,
    derivationCount: loaded.arrow.derivs.size,
    culprits: hydrated,
  });
}
