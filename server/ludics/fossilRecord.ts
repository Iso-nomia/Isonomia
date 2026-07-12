/**
 * Fossil record service — Cluster E (Phase 1f).
 *
 * Exposes the retraction history for WitnessRecord rows: acts that were
 * active at some point but whose locus has since been retracted, the
 * argument superseded, or the design excised.
 *
 * Each fossil carries a `ludicMoveId` back-pointer so callers can
 * reconstruct "this act applied to ⊢A.1 before it was retracted" even
 * when the locus no longer exists in the current D_P.
 *
 * T4 invariant: participantId is stored on WitnessRecord but is
 * omitted from fossil responses by default (attribution is part of
 * provenance; exposed via `includeIdentity: true`).
 */

import { prisma } from "@/lib/prismaclient";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FossilEntry {
  witnessId: string;
  ludicMoveId: string;
  /** Locus address at the time of fossilization (from the LudicMove back-pointer). */
  locus: string;
  retractedAt: string; // ISO-8601
  /** Structural retraction category. */
  retractLayer: string | null;
  /** Optional free-text reason supplied at fossilization time. */
  retractReason: string | null;
  dialogueMoveId: string;
  canonicalText: string;
  /** Only present when includeIdentity: true (T4 opt-in). */
  participantId?: string;
}

export interface ActiveEntry {
  witnessId: string;
  ludicMoveId: string;
  locus: string;
  timestamp: string; // ISO-8601
  dialogueMoveId: string;
  canonicalText: string;
}

export interface GetFossilRecordResult {
  fossils: FossilEntry[];
  totalFossils: number;
  /** Only populated when includeActive: true. */
  activeCount?: number;
}

export interface GetFossilRecordOptions {
  /** Filter to a specific deliberation's fossil records. */
  deliberationId?: string;
  /** Filter to a specific Ludics move's fossil records. */
  ludicMoveId?: string;
  /** If true, also return active (non-fossilized) witness records. */
  includeActive?: boolean;
  /** Max rows returned. Default 50, max 200. */
  limit?: number;
  /** If true, include participantId in each entry (T4 opt-in). */
  includeIdentity?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Return the fossil record for a deliberation or specific Ludics move.
 *
 * At least one of `deliberationId` or `ludicMoveId` must be provided.
 * If both are provided, both constraints are applied (AND).
 *
 * Results are ordered by `fossilizedAt` descending (most recent first).
 */
export async function getFossilRecord(
  opts: GetFossilRecordOptions,
): Promise<GetFossilRecordResult> {
  const { deliberationId, ludicMoveId, includeActive = false, limit = 50, includeIdentity = false } =
    opts;

  const effectiveLimit = Math.min(limit, 200);

  // Build the LudicMove filter for scoping by deliberationId
  const ludicMoveFilter = deliberationId
    ? { deliberationId }
    : undefined;

  // Query fossilized records
  const fossils = await prisma.witnessRecord.findMany({
    where: {
      fossilizedAt: { not: null },
      ...(ludicMoveId ? { ludicMoveId } : {}),
      ...(ludicMoveFilter ? { ludicMove: ludicMoveFilter } : {}),
    },
    include: {
      ludicMove: { select: { locus: true } },
    },
    orderBy: { fossilizedAt: "desc" },
    take: effectiveLimit,
  });

  const totalFossils = await prisma.witnessRecord.count({
    where: {
      fossilizedAt: { not: null },
      ...(ludicMoveId ? { ludicMoveId } : {}),
      ...(ludicMoveFilter ? { ludicMove: ludicMoveFilter } : {}),
    },
  });

  const fossilEntries: FossilEntry[] = fossils.map((w) => {
    const entry: FossilEntry = {
      witnessId: w.id,
      ludicMoveId: w.ludicMoveId,
      locus: w.ludicMove.locus,
      retractedAt: w.fossilizedAt!.toISOString(),
      retractLayer: w.retractLayer,
      retractReason: w.retractReason,
      dialogueMoveId: w.dialogueMoveId,
      canonicalText: w.canonicalText,
    };
    if (includeIdentity) {
      entry.participantId = w.participantId;
    }
    return entry;
  });

  const result: GetFossilRecordResult = {
    fossils: fossilEntries,
    totalFossils,
  };

  // Optionally include active count
  if (includeActive) {
    result.activeCount = await prisma.witnessRecord.count({
      where: {
        fossilizedAt: null,
        ...(ludicMoveId ? { ludicMoveId } : {}),
        ...(ludicMoveFilter ? { ludicMove: ludicMoveFilter } : {}),
      },
    });
  }

  return result;
}
