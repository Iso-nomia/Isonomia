// server/ludics/witnessRecord.ts
//
// Service functions for the WitnessRecord layer (Phase 1a).
// Enforces the T4 non-attribution invariant: participantId is stored but
// NEVER returned by default. Pass includeIdentity: true to opt in (used only
// by get_witnesses and get_fossil_record — not by dialectical-layer tools).

import { prisma } from "@/lib/prismaclient";

// ─── Input / output types ────────────────────────────────────────────────────

export interface WitnessRecordCreateInput {
  ludicMoveId: string;
  dialogueMoveId: string;
  participantId: string;
  canonicalText: string;
  schemeKey?: string;
}

/** Default public shape — no participantId (T4 invariant). */
export interface WitnessRecordPublic {
  id: string;
  ludicMoveId: string;
  dialogueMoveId: string;
  timestamp: Date;
  fossilizedAt: Date | null;
  /** Structural retraction category. */
  retractLayer: string | null;
  /** Optional free-text reason supplied by the caller (any retractLayer). */
  retractReason: string | null;
}

/** Opt-in identity shape — only returned when includeIdentity: true. */
export interface WitnessRecordWithIdentity extends WitnessRecordPublic {
  participantId: string;
}

export type RetractLayer =
  | "argument_superseded"
  | "locus_deleted"
  | "design_excised"
  | "manual_retract";

/** @deprecated Use `RetractLayer` instead. Kept as an alias for one release. */
export type RetractReason = RetractLayer;

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new WitnessRecord (the iota write seam, lower-level path).
 * S1–S4 invariant enforcement is the responsibility of
 * bind_participant_to_design; this function is the raw DB write.
 */
export async function create(
  input: WitnessRecordCreateInput,
): Promise<WitnessRecordPublic> {
  const record = await prisma.witnessRecord.create({
    data: {
      ludicMoveId: input.ludicMoveId,
      dialogueMoveId: input.dialogueMoveId,
      participantId: input.participantId,
      canonicalText: input.canonicalText,
      schemeKey: input.schemeKey ?? null,
    },
  });
  return toPublic(record);
}

/**
 * Find all active (non-fossilized) WitnessRecords for a LudicMove.
 * Returns the anonymous shape by default (T4 invariant).
 * Pass includeIdentity: true to include participantId in the result.
 */
export async function findByLudicMoveId(
  ludicMoveId: string,
  options?: { includeIdentity: true },
): Promise<WitnessRecordWithIdentity[]>;
export async function findByLudicMoveId(
  ludicMoveId: string,
  options?: { includeIdentity?: false },
): Promise<WitnessRecordPublic[]>;
export async function findByLudicMoveId(
  ludicMoveId: string,
  options: { includeIdentity?: boolean } = {},
): Promise<WitnessRecordPublic[] | WitnessRecordWithIdentity[]> {
  const records = await prisma.witnessRecord.findMany({
    where: { ludicMoveId, fossilizedAt: null },
    orderBy: { timestamp: "asc" },
  });
  if (options.includeIdentity === true) {
    return records.map(toPublicWithIdentity);
  }
  return records.map(toPublic);
}

/**
 * Fossilize a WitnessRecord — mark it as no longer active in D_P.
 * The row is retained with a locus back-pointer for the fossil transcript.
 * Returns the public shape (no participantId).
 *
 * `retractLayer` is the structural category; `retractReason` is an optional
 * free-text explanation the caller may attach.
 *
 * Idempotence (A11.4): a second invocation on an already-fossilized record
 * is observably a no-op at the DB layer — `fossilizedAt`, `retractLayer`,
 * and `retractReason` are preserved from the first call. The route-layer
 * 409 guard remains in place; this service-layer guarantee is a defense in
 * depth against direct-service callers (workers, cron, tests).
 */
export async function fossilize(
  witnessId: string,
  retractLayer: RetractLayer,
  retractReason?: string | null,
): Promise<WitnessRecordPublic> {
  const existing = await prisma.witnessRecord.findUnique({
    where: { id: witnessId },
  });
  if (existing && existing.fossilizedAt !== null) {
    // Already fossilized — return the existing row verbatim; do not issue
    // a second UPDATE that would overwrite the original timestamp/layer.
    return toPublic(existing);
  }
  const record = await prisma.witnessRecord.update({
    where: { id: witnessId },
    data: {
      fossilizedAt: new Date(),
      retractLayer,
      retractReason: retractReason ?? null,
    },
  });
  return toPublic(record);
}

/**
 * Fossilize all active WitnessRecords whose LudicMove references a given
 * argumentId. Called by the argument deletion hook (Phase 2d).
 *
 * Uses the `argumentId` column added to LudicMove in Phase 2d so the join
 * is a single indexed query rather than a full table scan.
 *
 * Returns `{ fossilizedCount: 0 }` when no active witnesses match.
 */
export async function fossilizeByArgument(
  argumentId: string,
  layer: RetractLayer,
  reason?: string | null,
): Promise<{ fossilizedCount: number }> {
  const result = await prisma.witnessRecord.updateMany({
    where: {
      ludicMove: { argumentId },
      fossilizedAt: null,
    },
    data: {
      fossilizedAt: new Date(),
      retractLayer: layer,
      retractReason: reason ?? null,
    },
  });
  return { fossilizedCount: result.count };
}

// ─── Internal projection helpers ─────────────────────────────────────────────

type RawRecord = {
  id: string;
  ludicMoveId: string;
  dialogueMoveId: string;
  participantId: string;
  timestamp: Date;
  fossilizedAt: Date | null;
  retractLayer: string | null;
  retractReason: string | null;
};

function toPublic(record: RawRecord): WitnessRecordPublic {
  return {
    id: record.id,
    ludicMoveId: record.ludicMoveId,
    dialogueMoveId: record.dialogueMoveId,
    timestamp: record.timestamp,
    fossilizedAt: record.fossilizedAt,
    retractLayer: record.retractLayer,
    retractReason: record.retractReason,
  };
}

function toPublicWithIdentity(record: RawRecord): WitnessRecordWithIdentity {
  return {
    id: record.id,
    ludicMoveId: record.ludicMoveId,
    dialogueMoveId: record.dialogueMoveId,
    participantId: record.participantId,
    timestamp: record.timestamp,
    fossilizedAt: record.fossilizedAt,
    retractLayer: record.retractLayer,
    retractReason: record.retractReason,
  };
}

// ─── get_witnesses output shape ───────────────────────────────────────────────

export interface WitnessEntry {
  witnessId: string;
  dialogueMoveId: string;
  timestamp: Date;
  participantId?: string; // only present when includeIdentity: true
}

export interface GetWitnessesResult {
  ludicMoveId: string;
  witnessCount: number;
  witnesses: WitnessEntry[];
  stratum: string | null; // "walked" | "witnessable" | "latent" | null if LudicMove not found
}

/**
 * Return the witnessing record for a LudicMove.
 * Anonymous by default (T4). Pass includeIdentity: true to opt in.
 */
export async function getWitnessesForMove(
  ludicMoveId: string,
  options: { includeIdentity?: boolean } = {},
): Promise<GetWitnessesResult> {
  // Fetch the LudicMove for stratum label
  const ludicMove = await prisma.ludicMove.findUnique({
    where: { id: ludicMoveId },
    select: { id: true, stratumLabel: true },
  });

  const records = await prisma.witnessRecord.findMany({
    where: { ludicMoveId, fossilizedAt: null },
    orderBy: { timestamp: "asc" },
  });

  const witnesses: WitnessEntry[] = records.map((r) => {
    const entry: WitnessEntry = {
      witnessId: r.id,
      dialogueMoveId: r.dialogueMoveId,
      timestamp: r.timestamp,
    };
    if (options.includeIdentity) {
      entry.participantId = r.participantId;
    }
    return entry;
  });

  return {
    ludicMoveId,
    witnessCount: witnesses.length,
    witnesses,
    stratum: ludicMove?.stratumLabel ?? null,
  };
}
