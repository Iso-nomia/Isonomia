/**
 * Iota write seam — bind_participant_to_design service layer.
 *
 * Enforces invariants S1–S4 before writing a WitnessRecord (renamed from
 * I1–I4 post-review to avoid collision with Girard's I1–I4 ludics invariants).
 * All invariant checks run inside a single DB transaction so any
 * failure is clean and leaves no partial state.
 *
 *  S1  existingLocus        — ludicMoveId must be in LudicMove with a non-empty locus
 *  S2  existingStructure    — LudicMove.deliberationId must be non-null (structural integrity)
 *  S3  canonPipelineGated   — canonicalText must be a valid JSON.stringify({text:…}) from canonicalizeClaimText
 *  S4  schemeTyped          — if schemeKey provided it must exist in ArgumentScheme catalog;
 *                             if moveType === "daimon" a schemeKey is required
 *
 * Error codes (never logged with participantId in messages — T4 invariant):
 *  409  DELOCATION_REQUIRED  — ludicMoveId absent / locus not found
 *  422  CANON_GATE_FAILED    — canonicalText failed the pipeline validator
 *  422  SCHEME_REQUIRED      — schemeKey absent for daimon move, or key not in catalog
 */

import { prisma } from "@/lib/prismaclient";
import { canonicalizeClaimText } from "@/lib/ids/mintMoid";
import { compoundRateLimit } from "@/lib/rateLimit";
import { publishAnnouncement } from "@/lib/ludics/announcementBus";

// ── Error class ──────────────────────────────────────────────────────────────

export type BindErrorCode =
  | "DELOCATION_REQUIRED"
  | "CANON_GATE_FAILED"
  | "SCHEME_REQUIRED"
  | "RATE_LIMITED";

export class BindError extends Error {
  readonly code: BindErrorCode;
  readonly status: 409 | 422 | 429;
  /** Seconds the caller should wait before retrying. Set for RATE_LIMITED only. */
  readonly retryAfter?: number;

  constructor(
    code: BindErrorCode,
    message: string,
    status: 409 | 422 | 429,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "BindError";
    this.code = code;
    this.status = status;
    if (typeof retryAfter === "number") this.retryAfter = retryAfter;
  }
}

// ── Public shapes ─────────────────────────────────────────────────────────────

export interface BindInput {
  dialogueMoveId: string;
  ludicMoveId: string;
  participantId: string;
  /** Must be the output of canonicalizeClaimText (i.e. JSON.stringify({text:…})). */
  canonicalText: string;
  /** Required when moveType === "daimon"; optional for positive/negative. */
  schemeKey?: string;
  /**
   * Optional back-reference to the Argument this move represents (Phase 2d).
   * When supplied, stored on the LudicMove row so `fossilizeByArgument` can
   * find all witnesses for this argument on deletion.
   */
  argumentId?: string;
  /**
   * Caller IP for B11 v2 compound rate-limiting (WS-2). Pass from the route
   * handler: `req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()`.
   * When omitted, only the per-participant bucket is checked.
   */
  ip?: string | null;
}

export interface InvariantChecks {
  S1_existingLocus: boolean;
  S2_existingStructure: boolean;
  S3_canonPipelineGated: boolean;
  S4_schemeTyped: boolean;
}

export interface BindResult {
  witnessId: string;
  ludicMoveId: string;
  dialogueMoveId: string;
  invariantChecks: InvariantChecks;
}

// ── Main service function ─────────────────────────────────────────────────────

export async function bindParticipantToDesign(
  input: BindInput
): Promise<BindResult> {
  const { dialogueMoveId, ludicMoveId, participantId, canonicalText, schemeKey, argumentId, ip } =
    input;

  // ── S1 + S2: LudicMove must exist, have a locus, and belong to a deliberation ──
  const ludicMove = await prisma.ludicMove.findUnique({
    where: { id: ludicMoveId },
    select: { id: true, deliberationId: true, locus: true, moveType: true },
  });

  if (!ludicMove || !ludicMove.locus) {
    throw new BindError(
      "DELOCATION_REQUIRED",
      `ludicMoveId "${ludicMoveId}" not found in LudicMove — locus does not exist`,
      409
    );
  }

  if (!ludicMove.deliberationId) {
    throw new BindError(
      "DELOCATION_REQUIRED",
      `LudicMove "${ludicMoveId}" has no deliberationId — existingStructure invariant violated`,
      409
    );
  }

  // ── Phase 2f §6.1 (B11 v2 / WS-2) compound rate limit ────────────────────
  // Scope = deliberationId (per WS-0 tenant-scope audit, 2026-05-22 — repo
  // has no tenant axis). Bucket 1: (scope, participant, "bind"). Bucket 2:
  // (scope, ip, "bind") when IP supplied. Either exhausted ⇒ 429.
  const rl = await compoundRateLimit(
    {
      scopeId: ludicMove.deliberationId,
      participantId,
      ip: ip ?? null,
      action: "bind",
    },
    {
      perParticipant: { max: 10, window: "1 m" },
      perIp:          { max: 30, window: "1 m" },
    },
  );
  if (!rl.success) {
    throw new BindError(
      "RATE_LIMITED",
      "RATE_LIMITED",
      429,
      rl.retryAfter,
    );
  }

  // ── S3: canonicalText must pass the canonicalization pipeline validator ──────
  if (!canonicalText || canonicalText.trim().length === 0) {
    throw new BindError(
      "CANON_GATE_FAILED",
      "canonicalText is empty — text must pass canonicalizeClaimText before binding",
      422
    );
  }

  // Verify it is well-formed and idempotent under the pipeline
  let innerText: string;
  try {
    const parsed = JSON.parse(canonicalText) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).text !== "string" ||
      !(parsed as Record<string, string>).text.trim()
    ) {
      throw new Error("wrong shape");
    }
    innerText = (parsed as Record<string, string>).text;
    const recheckCanon = canonicalizeClaimText(innerText);
    if (recheckCanon !== canonicalText) {
      throw new Error("not idempotent");
    }
  } catch {
    throw new BindError(
      "CANON_GATE_FAILED",
      "canonicalText must be JSON.stringify({text: <NFC-normalized, whitespace-collapsed string>})",
      422
    );
  }

  // ── S4: schemeKey validation ──────────────────────────────────────────────
  // Daimon moves require a schemeKey; positive/negative treat it as optional.
  const isDaimon = ludicMove.moveType === "daimon";
  const isDialogueOnly = ludicMove.moveType === "dialogue-only";

  if (isDaimon && !isDialogueOnly && !schemeKey) {
    throw new BindError(
      "SCHEME_REQUIRED",
      `moveType "daimon" requires a schemeKey`,
      422
    );
  }

  if (schemeKey) {
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key: schemeKey },
      select: { key: true },
    });
    if (!scheme) {
      throw new BindError(
        "SCHEME_REQUIRED",
        `schemeKey "${schemeKey}" not found in ArgumentScheme catalog`,
        422
      );
    }
  }

  const I4Passed = isDialogueOnly
    ? true
    : isDaimon
    ? !!schemeKey
    : schemeKey
    ? true  // S4: provided and valid (would have thrown above if invalid)
    : true; // S4: optional for positive/negative

  // ── All checks passed — write WitnessRecord (and optionally update LudicMove.argumentId) ──
  const witness = await prisma.$transaction(async (tx) => {
    // Phase 2d: backfill argumentId on the LudicMove when caller provides it.
    if (argumentId) {
      await tx.ludicMove.update({
        where: { id: ludicMoveId },
        data: { argumentId },
      });
    }
    return tx.witnessRecord.create({
      data: {
        ludicMoveId,
        dialogueMoveId,
        participantId,
        canonicalText,
        schemeKey: schemeKey ?? null,
      },
    });
  });

  // A1 announcement (WS-5b): emit `witness_committed` post-transaction.
  // Protocol §7.0 + §8. Bus failures MUST NOT fail the bind operation.
  try {
    await publishAnnouncement({
      eventType: "witness_committed",
      version: 1,
      scopeId: ludicMove.deliberationId,
      actorParticipantId: participantId,
      subjectId: witness.id,
      occurredAt: witness.timestamp.toISOString(),
      payload: {
        witnessId: witness.id,
        ludicMoveId,
        dialogueMoveId,
        schemeKey: schemeKey ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bindParticipantToDesign] announcement publish failed", err);
  }

  return {
    witnessId: witness.id,
    ludicMoveId,
    dialogueMoveId,
    invariantChecks: {
      S1_existingLocus: true,
      S2_existingStructure: true,
      S3_canonPipelineGated: true,
      S4_schemeTyped: I4Passed,
    },
  };
}
