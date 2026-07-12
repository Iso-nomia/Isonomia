/**
 * Exposure service — `get_unwitnessed_exposure` Cluster C read.
 *
 * Returns LudicMoves in a deliberation that currently have no active
 * WitnessRecord (the "unaddressed" structural objections).
 * Filter by stratum label stored on LudicMove.
 */

import { prisma } from "@/lib/prismaclient";

export type ExposureStratum = "witnessable" | "latent" | "all";

export interface UnwitnessedMove {
  ludicMoveId: string;
  locus: string;
  moveType: string;
  depth: number; // dots in the locus path (e.g. "0.1.2" → depth 2)
}

export interface GetUnwitnessedExposureResult {
  unwitnessed: UnwitnessedMove[];
  totalUnwitnessed: number;
  stratum: ExposureStratum;
}

/** Compute locus depth from the locus path string (number of dots). */
function locusDepth(locus: string): number {
  return (locus.match(/\./g) ?? []).length;
}

export async function getUnwitnessedExposure(
  deliberationId: string,
  stratum: ExposureStratum = "witnessable",
  limit = 20,
): Promise<GetUnwitnessedExposureResult> {
  // Build stratum filter
  const stratumWhere =
    stratum === "all"
      ? { in: ["witnessable", "latent"] as string[] }
      : ({ equals: stratum } as any);

  // Fetch all LudicMoves for this deliberation in the target stratum
  const allMoves = await prisma.ludicMove.findMany({
    where: {
      deliberationId,
      stratumLabel: stratum === "all" ? { in: ["witnessable", "latent"] } : stratum,
    },
    select: { id: true, locus: true, moveType: true },
    orderBy: { locus: "asc" },
  });

  if (allMoves.length === 0) {
    return { unwitnessed: [], totalUnwitnessed: 0, stratum };
  }

  // Anti-join: find move ids that have at least one active WitnessRecord
  const witnessedIds = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: allMoves.map((m) => m.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  const unwitnessedMoves = allMoves.filter((m) => !witnessedIds.has(m.id));
  const totalUnwitnessed = unwitnessedMoves.length;

  const paged = unwitnessedMoves.slice(0, limit).map((m) => ({
    ludicMoveId: m.id,
    locus: m.locus,
    moveType: m.moveType,
    depth: locusDepth(m.locus),
  }));

  return { unwitnessed: paged, totalUnwitnessed, stratum };
}
