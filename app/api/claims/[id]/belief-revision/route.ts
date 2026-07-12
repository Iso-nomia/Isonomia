// app/api/claims/[id]/belief-revision/route.ts
// Sprint D2 — read open `BeliefRevisionProposal` rows for a claim.
// Used by the "Suggested retractions" panel on the claim detail.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;
  const proposals = await prisma.beliefRevisionProposal.findMany({
    where: { claimId, status: "OPEN" },
    orderBy: { computedAt: "desc" },
    select: {
      id: true,
      argumentId: true,
      candidatesJson: true,
      computedAt: true,
    },
  });
  if (proposals.length === 0) {
    return NextResponse.json({ ok: true, claimId, proposals: [], assumptions: [] });
  }

  // Hydrate each candidate's assumption ids so the UI can show readable
  // labels and direct retract links.
  const allAssumptionIds = Array.from(
    new Set(
      proposals.flatMap((p) => {
        const cands = (p.candidatesJson as any[]) ?? [];
        return cands.flatMap((c) => c.assumptionIds ?? []);
      })
    )
  );
  const assumptions = allAssumptionIds.length
    ? await prisma.assumptionUse.findMany({
        where: { id: { in: allAssumptionIds } },
        select: {
          id: true,
          argumentId: true,
          status: true,
          role: true,
          assumptionText: true,
          assumptionClaimId: true,
        },
      })
    : [];

  return NextResponse.json(
    { ok: true, claimId, proposals, assumptions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
