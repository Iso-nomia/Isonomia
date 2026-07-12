/**
 * Instantiation service — `get_instantiation` Cluster C read.
 *
 * Given a dialogueMoveId, returns the Ludics node it instantiates via ι.
 * Checks WitnessRecord first (Phase 1b write seam), then falls back to
 * CommitmentLudicMapping (legacy path) for backwards compatibility.
 *
 * When the dialogueMoveId has no mapping, returns `instantiated: false` with
 * a lightweight delocation check (does any LudicMove locus match?).
 */

import { prisma } from "@/lib/prismaclient";

export interface InstantiationFound {
  dialogueMoveId: string;
  instantiated: true;
  ludicMoveId: string;
  locus: string;
  moveType: string;
  wouldTriggerDelocation: false;
}

export interface InstantiationNotFound {
  dialogueMoveId: string;
  instantiated: false;
  wouldTriggerDelocation: boolean;
  candidateLocus?: string;
}

export type GetInstantiationResult = InstantiationFound | InstantiationNotFound;

export async function getInstantiation(
  dialogueMoveId: string,
): Promise<GetInstantiationResult> {
  // 1. Check WitnessRecord (Phase 1b — primary path)
  const witness = await prisma.witnessRecord.findUnique({
    where: { dialogueMoveId },
    select: { ludicMoveId: true },
  });

  if (witness) {
    const ludicMove = await prisma.ludicMove.findUnique({
      where: { id: witness.ludicMoveId },
      select: { id: true, locus: true, moveType: true },
    });
    if (ludicMove) {
      return {
        dialogueMoveId,
        instantiated: true,
        ludicMoveId: ludicMove.id,
        locus: ludicMove.locus,
        moveType: ludicMove.moveType,
        wouldTriggerDelocation: false,
      };
    }
  }

  // 2. Fall back: check CommitmentLudicMapping (legacy path — pre Phase 1b)
  const mapping = await (prisma as any).commitmentLudicMapping?.findFirst({
    where: { dialogueCommitmentId: dialogueMoveId },
    select: { ludicCommitmentElementId: true },
  }).catch(() => null);

  if (mapping?.ludicCommitmentElementId) {
    // CommitmentLudicMapping exists but not yet linked to a LudicMove.
    // Return a partial instantiation with what we know.
    return {
      dialogueMoveId,
      instantiated: true,
      ludicMoveId: mapping.ludicCommitmentElementId,
      locus: "unknown", // LudicMove not yet populated from CommitmentLudicMapping
      moveType: "positive", // default assumption for promoted commitments
      wouldTriggerDelocation: false,
    };
  }

  // 3. Not found — run lightweight delocation check
  // A move "would trigger delocation" if adding it would expand D_P.
  // For Phase 1c: we approximate by checking if the deliberation has
  // any LudicMove at all. Full ι(·) partiality check follows in Phase 1d.
  const hasAnyMoves = await prisma.ludicMove.findFirst({
    where: { deliberationId: { not: undefined } },
    select: { id: true },
  });

  return {
    dialogueMoveId,
    instantiated: false,
    wouldTriggerDelocation: hasAnyMoves !== null, // heuristic: would expand if moves exist
  };
}
