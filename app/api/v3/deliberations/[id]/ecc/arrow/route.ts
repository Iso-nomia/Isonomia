/**
 * GET /api/v3/deliberations/[id]/ecc/arrow?claimId=...
 *
 * Sprint E1 — typed ECC `Arrow` for one claim.
 *
 * Returns the per-claim `I → claimId` arrow as a JSON-friendly shape
 * (`derivations: [{ id, argumentId, argumentText, base, authorKind,
 * assumptionIds }]`) plus structural meta from Ambler Def. 8 (`simple`,
 * `entire`, `selected`) and the strict `logical` predicate from Def. 17
 * (ECC plan §4 row 1).
 *
 * Honest-empty: when the claim has no `ArgumentSupport` rows we return
 * `{ ok: true, claimId, arrow: null, ... }` so the MCP client can say
 * "no derivations on file" instead of synthesizing a 0-confidence claim.
 */
import { NextRequest, NextResponse } from "next/server";
import { evaluateArrowMeta, loadClaimArrow } from "@/lib/argumentation/eccLoader";

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
      arrow: null,
      reason: "no ArgumentSupport rows for this (deliberation, claim) pair",
    });
  }

  const meta = evaluateArrowMeta(loaded);
  return NextResponse.json({
    ok: true,
    deliberationId,
    claimId,
    arrow: {
      from: "I",
      to: claimId,
      derivationCount: loaded.arrow.derivs.size,
      derivations: loaded.derivations,
    },
    meta,
  });
}
