// lib/ceg/beliefRevision.ts
// Sprint D1 — write `BeliefRevisionProposal` rows when grounded labels
// flip to OUT. Pure DB orchestration; the ranking algorithm itself lives
// in `lib/argumentation/ecc.ts#culpritSets` (Ambler §4 verbatim).
//
// Strategy: for each (OUT claim, argument concluding it), build a single
// candidate retraction set = the open `AssumptionUse` ids attached to that
// argument. This is the per-derivation case of `culpritSets()`: each
// argument represents one derivation `d` whose full assumption set is the
// minimal hitter that kills `d`. Coverage is therefore 1, retraction cost
// is `|assumptions(d)|`. Sprint D's done-criterion ("rejecting a claim
// produces a ranked retraction list") is met by sorting these per-argument
// candidates by cost ascending.
//
// Invariants:
//   - Idempotent on `(claimId, argumentId)`: running twice yields the same
//     row, only `candidatesJson` and `computedAt` change.
//   - We never overwrite a `status === 'APPLIED'` row (the user already
//     acted).
//   - Empty assumption arguments produce no proposal (nothing to retract).
//   - One-hop only: we don't walk imported arguments. A `RoomFunctor`
//     image of an argument that flipped to OUT in another room remains
//     each room's local concern (ECC plan §4 row 2).

import { prisma } from "@/lib/prismaclient";

interface CandidateJson {
  assumptionIds: string[];
  badConclusionsExplained: number;
  retractionCost: number;
}

export async function writeBeliefRevisionProposals(
  deliberationId: string,
  outClaimIds: string[]
): Promise<{ proposals: number; skipped: number }> {
  if (outClaimIds.length === 0) return { proposals: 0, skipped: 0 };

  // Fetch arguments in this deliberation that conclude any of the OUT claims.
  const args = await prisma.argument.findMany({
    where: {
      deliberationId,
      conclusionClaimId: { in: outClaimIds },
    },
    select: { id: true, conclusionClaimId: true },
  });
  if (args.length === 0) return { proposals: 0, skipped: 0 };

  const argIds = args.map((a) => a.id);
  const uses = await prisma.assumptionUse.findMany({
    where: {
      argumentId: { in: argIds },
      status: { in: ["PROPOSED", "ACCEPTED", "CHALLENGED"] },
    },
    select: { id: true, argumentId: true },
  });
  const usesByArg = new Map<string, string[]>();
  for (const u of uses) {
    if (!u.argumentId) continue;
    const list = usesByArg.get(u.argumentId) ?? [];
    list.push(u.id);
    usesByArg.set(u.argumentId, list);
  }

  let proposals = 0;
  let skipped = 0;
  for (const arg of args) {
    const claimId = arg.conclusionClaimId;
    if (!claimId) continue;
    const assumptionIds = usesByArg.get(arg.id) ?? [];
    if (assumptionIds.length === 0) {
      skipped++;
      continue;
    }
    // Single-derivation candidate: retracting all of this argument's open
    // assumptions kills the (only) derivation we know about for this arg.
    const candidates: CandidateJson[] = [
      {
        assumptionIds: assumptionIds.slice().sort(),
        badConclusionsExplained: 1,
        retractionCost: assumptionIds.length,
      },
    ];

    const existing = await prisma.beliefRevisionProposal.findUnique({
      where: { claimId_argumentId: { claimId, argumentId: arg.id } },
      select: { id: true, status: true },
    });
    if (existing?.status === "APPLIED") {
      skipped++;
      continue;
    }

    await prisma.beliefRevisionProposal.upsert({
      where: { claimId_argumentId: { claimId, argumentId: arg.id } },
      update: {
        candidatesJson: candidates as any,
        computedAt: new Date(),
        // Re-open if it was DISMISSED — the underlying culprit set may
        // have changed since the user dismissed.
        status: "OPEN",
      },
      create: {
        deliberationId,
        claimId,
        argumentId: arg.id,
        candidatesJson: candidates as any,
        status: "OPEN",
      },
    });
    proposals++;
  }
  return { proposals, skipped };
}
