/**
 * Stratum verify-on-read service (B2, per LUDICS_SESSION_1_DEV_SPEC.md §4.1
 * NOTE *[ADDED post-review, Tier 3.10]* and LUDICS_SESSIONS_1_2_SPEC_REVIEW.md
 * Bin 2 row B2).
 *
 * `LudicMove.stratumLabel` is a stored cache, not the authoritative source.
 * The authoritative stratum for a move ℓ is a function of:
 *   - whether ℓ has any active (non-fossilized) WitnessRecord  → walked
 *   - else whether ℓ is parent/child of a walked locus (1 edge) → witnessable
 *   - else                                                       → latent
 *
 * `getStratumLabel(ludicMoveId)` recomputes that authoritative value, compares
 * to the stored cache, logs a structured `substrate_violation` WARN on
 * mismatch, and returns the authoritative label. Read paths that need a
 * single-move stratum reading SHOULD use this helper rather than trusting the
 * stored column directly. (Aggregate reads — `computeExposureMap`,
 * `getBehaviourAtLocus` — already derive `walked` from `WitnessRecord` for the
 * same reason; this helper is the point-lookup analogue.)
 *
 * Treating the stored value as a cache (rather than authoritative) is the
 * "verify-on-read" pattern from the Bin 2 review: read remains O(deliberation
 * size) once per call but cannot be silently stale; writers that update
 * WitnessRecord without re-projecting stratumLabel will surface as WARN logs.
 */

import { prisma } from "@/lib/prismaclient";

export type StratumLabel = "walked" | "witnessable" | "latent";

function locusParent(locus: string): string | null {
  const lastDot = locus.lastIndexOf(".");
  return lastDot === -1 ? null : locus.slice(0, lastDot);
}

/**
 * Recompute the authoritative stratum for a single LudicMove, log a WARN on
 * mismatch with the stored cache, and return the authoritative label.
 *
 * Returns `null` if the move id does not exist.
 */
export async function getStratumLabel(
  ludicMoveId: string,
): Promise<StratumLabel | null> {
  const move = await prisma.ludicMove.findUnique({
    where: { id: ludicMoveId },
    select: {
      id: true,
      deliberationId: true,
      locus: true,
      stratumLabel: true,
    },
  });

  if (!move) return null;

  // Fetch all moves in the same deliberation to resolve parent/child adjacency.
  const peers = await prisma.ludicMove.findMany({
    where: { deliberationId: move.deliberationId },
    select: { id: true, locus: true },
  });

  // Fetch active witnesses across the deliberation in one round-trip.
  const witnessedIds = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: peers.map((p) => p.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  const lociById = new Map(peers.map((p) => [p.id, p.locus]));
  const walkedLoci = new Set<string>();
  for (const p of peers) {
    if (witnessedIds.has(p.id)) walkedLoci.add(p.locus);
  }

  let authoritative: StratumLabel;
  if (witnessedIds.has(move.id)) {
    authoritative = "walked";
  } else {
    // witnessable iff adjacent (parent or direct child) to any walked locus
    const parent = locusParent(move.locus);
    const isChildOfWalked = parent !== null && walkedLoci.has(parent);
    const isParentOfWalked = peers.some(
      (p) => locusParent(p.locus) === move.locus && walkedLoci.has(lociById.get(p.id)!),
    );
    authoritative = isChildOfWalked || isParentOfWalked ? "witnessable" : "latent";
  }

  if (authoritative !== move.stratumLabel) {
    console.warn(
      JSON.stringify({
        event: "substrate_violation",
        kind: "stratum_label_drift",
        deliberationId: move.deliberationId,
        ludicMoveId: move.id,
        locus: move.locus,
        stored: move.stratumLabel,
        authoritative,
      }),
    );
  }

  return authoritative;
}
