/**
 * GET /api/v3/deliberations/[id]/ecc/belief-revision?claimId=...
 *
 * Sprint E1 — read `BeliefRevisionProposal` rows from Sprint D1, scoped
 * to one claim. The same data the in-app `SuggestedRetractionsPanel`
 * reads, exposed under the v3 ECC namespace so MCP tools answer the
 * "what would I have to retract to reject claim X?" question with the
 * cached, deterministic, grounded-recompute-driven proposals (rather
 * than re-running `culpritSets` on the fly — for that, use
 * `/ecc/culprits`).
 *
 * Honest-empty: no OPEN proposals returns `{ proposals: [] }` rather
 * than synthesizing one.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

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

  const proposals = await prisma.beliefRevisionProposal.findMany({
    where: { deliberationId, claimId, status: "OPEN" },
    select: {
      id: true,
      argumentId: true,
      candidatesJson: true,
      computedAt: true,
    },
    orderBy: { computedAt: "desc" },
  });

  // Hydrate referenced AssumptionUse rows in one pass.
  const allAssumptionIds = new Set<string>();
  for (const p of proposals) {
    const cands: any[] = Array.isArray(p.candidatesJson) ? p.candidatesJson : [];
    for (const c of cands) {
      const ids: string[] = Array.isArray(c?.assumptionIds) ? c.assumptionIds : [];
      for (const id of ids) allAssumptionIds.add(id);
    }
  }

  const assumptionRows = allAssumptionIds.size
    ? await prisma.assumptionUse.findMany({
        where: { id: { in: Array.from(allAssumptionIds) } },
        select: {
          id: true,
          status: true,
          role: true,
          assumptionText: true,
          assumptionClaimId: true,
        },
      })
    : [];

  return NextResponse.json({
    ok: true,
    deliberationId,
    claimId,
    proposals,
    assumptions: assumptionRows,
  });
}
