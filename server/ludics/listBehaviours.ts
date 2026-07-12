/**
 * server/ludics/listBehaviours.ts
 *
 * Enumerate every Behaviour in a deliberation, with summary statistics
 * sufficient for clients to pick the "most-articulated" one without
 * making N additional round-trips.
 *
 * Per behaviour we return:
 *   - behaviourId, rootLocus
 *   - incarnationCount  (Designs attached to the behaviour)
 *   - coneCount         (Phase 2g: antichain decomposition over Inc(B))
 *   - moveCount         (LudicMoves owned by any of the behaviour's Designs)
 *   - walkedCount       (subset of moveCount with ≥1 active WitnessRecord)
 *   - witnessRatio      (walkedCount / moveCount, 0 when moveCount==0)
 *
 * The result is sorted by incarnationCount desc, then coneCount desc,
 * then moveCount desc — so `result.behaviours[0]` is a reasonable
 * "largest articulation lattice" pick for cold-start exploration.
 *
 * T4 invariant: no participantId is read or returned.
 */

import { prisma } from "@/lib/prismaclient";
import { computeCones } from "./articulationLattice";

export interface BehaviourSummary {
  behaviourId: string;
  rootLocus: string;
  incarnationCount: number;
  coneCount: number;
  moveCount: number;
  walkedCount: number;
  witnessRatio: number;
}

export interface ListBehavioursResult {
  deliberationId: string;
  behaviourCount: number;
  behaviours: BehaviourSummary[];
}

export async function listBehaviours(
  deliberationId: string,
): Promise<ListBehavioursResult> {
  const behaviours = await prisma.behaviour.findMany({
    where: { deliberationId },
    select: { id: true, rootLocus: true },
  });

  if (behaviours.length === 0) {
    return { deliberationId, behaviourCount: 0, behaviours: [] };
  }

  const behaviourIds = behaviours.map((b) => b.id);

  // One round-trip each for designs / inclusions / moves / witnesses.
  const [designs, inclusions, moves, witnessed] = await Promise.all([
    prisma.design.findMany({
      where: { behaviourId: { in: behaviourIds } },
      select: { id: true, behaviourId: true, loci: true, derivedBy: true },
    }),
    prisma.designInclusion.findMany({
      where: { smaller: { behaviourId: { in: behaviourIds } } },
      select: {
        smallerId: true,
        largerId: true,
        smaller: { select: { behaviourId: true } },
      },
    }),
    prisma.ludicMove.findMany({
      where: { deliberationId, design: { behaviourId: { in: behaviourIds } } },
      select: { id: true, designId: true },
    }),
    prisma.witnessRecord
      .findMany({
        where: {
          fossilizedAt: null,
          ludicMove: { deliberationId },
        },
        select: { ludicMoveId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.ludicMoveId))),
  ]);

  // Bucket designs, inclusions, moves by behaviourId.
  const designsByB = new Map<string, typeof designs>();
  for (const d of designs) {
    const arr = designsByB.get(d.behaviourId) ?? [];
    arr.push(d);
    designsByB.set(d.behaviourId, arr);
  }
  const inclByB = new Map<string, { smallerId: string; largerId: string }[]>();
  for (const e of inclusions) {
    const bId = e.smaller.behaviourId;
    const arr = inclByB.get(bId) ?? [];
    arr.push({ smallerId: e.smallerId, largerId: e.largerId });
    inclByB.set(bId, arr);
  }
  const moveDesignIds = new Map<string, string[]>();
  for (const m of moves) {
    if (!m.designId) continue;
    const arr = moveDesignIds.get(m.designId) ?? [];
    arr.push(m.id);
    moveDesignIds.set(m.designId, arr);
  }

  const summaries: BehaviourSummary[] = behaviours.map((b) => {
    const bDesigns = designsByB.get(b.id) ?? [];
    const bIncl = inclByB.get(b.id) ?? [];
    const { cones } =
      bDesigns.length > 0
        ? computeCones(bDesigns, bIncl)
        : { cones: [] };

    let moveCount = 0;
    let walkedCount = 0;
    for (const d of bDesigns) {
      const ids = moveDesignIds.get(d.id) ?? [];
      moveCount += ids.length;
      for (const mid of ids) if (witnessed.has(mid)) walkedCount++;
    }
    return {
      behaviourId: b.id,
      rootLocus: b.rootLocus,
      incarnationCount: bDesigns.length,
      coneCount: cones.length,
      moveCount,
      walkedCount,
      witnessRatio: moveCount > 0 ? walkedCount / moveCount : 0,
    };
  });

  summaries.sort(
    (a, b) =>
      b.incarnationCount - a.incarnationCount ||
      b.coneCount - a.coneCount ||
      b.moveCount - a.moveCount,
  );

  return {
    deliberationId,
    behaviourCount: summaries.length,
    behaviours: summaries,
  };
}
