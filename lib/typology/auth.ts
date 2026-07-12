/**
 * Typology / Meta-consensus — Authorization helpers
 *
 * Implements the helpers contracted in docs/typology/AUTH_MATRIX.md.
 * Reuses Scope C's helpers verbatim (which themselves re-export Scope A's).
 * No new role enum is introduced.
 *
 * All helpers return plain results; route handlers wrap them with
 * `apiError("FORBIDDEN" | "UNAUTHORIZED" | "NOT_FOUND", ...)`.
 *
 * Status: B1 scaffold.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prismaclient";
import {
  isFacilitator,
  isDeliberationHost,
  isActiveSessionFacilitator,
} from "@/lib/facilitation/auth";

export {
  isFacilitator,
  isDeliberationHost,
  isActiveSessionFacilitator,
} from "@/lib/facilitation/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Capability helpers (1-1 with docs/typology/AUTH_MATRIX.md "to be implemented")
// ─────────────────────────────────────────────────────────────────────────────

/** Any participant of the deliberation. Hosts and facilitators implicitly qualify. */
export async function canProposeTag(
  authId: string,
  deliberationId: string,
): Promise<boolean> {
  if (!authId) return false;
  if (await isDeliberationHost(deliberationId, authId)) return true;
  if (await isFacilitator(deliberationId, authId)) return true;
  const role = await prisma.deliberationRole.findFirst({
    where: { deliberationId, userId: authId },
    select: { id: true },
  });
  return !!role;
}

/** Confirm own tag, or be a facilitator/host on the deliberation. */
export async function canConfirmTag(authId: string, tagId: string): Promise<boolean> {
  if (!authId) return false;
  const tag = await prisma.disagreementTag.findUnique({
    where: { id: tagId },
    select: { authoredById: true, deliberationId: true },
  });
  if (!tag) return false;
  if (tag.authoredById === authId) return true;
  if (await isFacilitator(tag.deliberationId, authId)) return true;
  return false;
}

/** Retract own tag, or be a facilitator/host on the deliberation. */
export async function canRetractTag(authId: string, tagId: string): Promise<boolean> {
  if (!authId) return false;
  const tag = await prisma.disagreementTag.findUnique({
    where: { id: tagId },
    select: { authoredById: true, deliberationId: true },
  });
  if (!tag) return false;
  if (tag.authoredById === authId) return true;
  if (await isFacilitator(tag.deliberationId, authId)) return true;
  return false;
}

/**
 * Promote / dismiss a candidate. Active session facilitator only — the host
 * does not implicitly take over an open session (parity with Scope C).
 */
export async function canManageCandidates(
  authId: string,
  sessionId: string,
): Promise<boolean> {
  if (!authId) return false;
  return isActiveSessionFacilitator(authId, sessionId);
}

/** Draft a meta-consensus summary: facilitator or host on the deliberation. */
export async function canDraftSummary(
  authId: string,
  deliberationId: string,
): Promise<boolean> {
  if (!authId) return false;
  return isFacilitator(deliberationId, authId);
}

/** Edit a DRAFT summary: original drafter only (decision per AUTH_MATRIX). */
export async function canEditDraft(authId: string, summaryId: string): Promise<boolean> {
  if (!authId) return false;
  const s = await prisma.metaConsensusSummary.findUnique({
    where: { id: summaryId },
    select: { authoredById: true, status: true },
  });
  if (!s) return false;
  if (s.status !== "DRAFT") return false;
  return s.authoredById === authId;
}

/** Publish or retract a summary: facilitator or host on the deliberation. */
export async function canPublishSummary(
  authId: string,
  deliberationId: string,
): Promise<boolean> {
  if (!authId) return false;
  return isFacilitator(deliberationId, authId);
}

export interface CanReadResult {
  ok: boolean;
  /** True iff caller can only see the redacted public-read view. */
  publicReadOnly: boolean;
  notFound?: boolean;
}

/**
 * Resolve typology read access. Mirrors `lib/facilitation/auth.ts → canReadFacilitation`
 * but on a deliberation (and optional session) scope instead of a session-only scope.
 *
 * Public-read eligibility rules:
 *   - If `sessionId` is provided AND the session is `isPublic = true`, anonymous reads
 *     resolve to `{ ok: true, publicReadOnly: true }`.
 *   - If `sessionId` is null, deliberation-scoped public read is permitted only when
 *     ALL relevant facilitation sessions on the deliberation are `isPublic = true`
 *     (export-style policy from AUTH_MATRIX). For per-summary reads on a public
 *     deliberation, the route loads the summary's session first and re-checks.
 */
export async function canReadTypology(
  authId: string | null,
  deliberationId: string,
  sessionId: string | null = null,
): Promise<CanReadResult> {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!delib) return { ok: false, publicReadOnly: false, notFound: true };

  if (authId) {
    if (await isDeliberationHost(deliberationId, authId)) {
      return { ok: true, publicReadOnly: false };
    }
    if (await isFacilitator(deliberationId, authId)) {
      return { ok: true, publicReadOnly: false };
    }
    const role = await prisma.deliberationRole.findFirst({
      where: { deliberationId, userId: authId },
      select: { role: true },
    });
    if (role) {
      // Observers / contributors get the un-redacted view of their own deliberation.
      return { ok: true, publicReadOnly: false };
    }
  }

  // Anonymous (or non-role-bearing) caller — check public read.
  if (sessionId) {
    const s = await prisma.facilitationSession.findUnique({
      where: { id: sessionId },
      select: { isPublic: true, deliberationId: true },
    });
    if (!s || s.deliberationId !== deliberationId) {
      return { ok: false, publicReadOnly: false, notFound: true };
    }
    if (s.isPublic) return { ok: true, publicReadOnly: true };
    return { ok: false, publicReadOnly: false, notFound: true };
  }

  // Deliberation-scoped: every session in scope must be public.
  const sessions = await prisma.facilitationSession.findMany({
    where: { deliberationId },
    select: { isPublic: true },
  });
  if (sessions.length > 0 && sessions.every((s) => s.isPublic)) {
    return { ok: true, publicReadOnly: true };
  }
  return { ok: false, publicReadOnly: false, notFound: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public-read redaction (decision #5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable, irreversible identifier for redacted fields. 12 hex chars of sha256
 * — parity with Scope A / Scope C `hashAuthIdForRedaction`.
 */
export function hashAuthIdForRedaction(authId: string): string {
  return createHash("sha256").update(authId).digest("hex").slice(0, 12);
}

const REDACT_KEY_FIELDS = new Set([
  "actorId",
  "authoredById",
  "confirmedById",
  "retractedById",
  "publishedById",
  "promotedById",
  "dismissedById",
  "createdById",
]);

/** Per AUTH_MATRIX: free-text reasons are omitted entirely on public read. */
const STRIP_FREE_TEXT_KEYS = new Set([
  "retractedReasonText",
  "dismissedReasonText",
]);

const EVIDENCE_TRUNC_LIMIT = 140;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function truncateEvidence(s: string): string {
  if (s.length <= EVIDENCE_TRUNC_LIMIT) return s;
  return s.slice(0, EVIDENCE_TRUNC_LIMIT) + "…";
}

function redactValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redactValue);
  if (isPlainObject(v)) return redactObject(v);
  return v;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEY_FIELDS.has(k) && typeof v === "string" && v.length > 0) {
      out[k] = hashAuthIdForRedaction(v);
      continue;
    }
    if (STRIP_FREE_TEXT_KEYS.has(k)) {
      // Drop entirely on public read.
      continue;
    }
    if (k === "evidenceText" && typeof v === "string") {
      out[k] = truncateEvidence(v);
      continue;
    }
    if (k === "evidenceJson" && isPlainObject(v)) {
      out[k] = redactEvidenceJson(v);
      continue;
    }
    if (k === "snapshotJson" && isPlainObject(v)) {
      out[k] = redactSnapshotJson(v);
      continue;
    }
    if (k === "payloadJson" && isPlainObject(v)) {
      out[k] = redactPayload(v);
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
}

function redactEvidenceJson(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "userId" || k === "authId" || REDACT_KEY_FIELDS.has(k)) {
      continue; // strip identifying refs entirely
    }
    out[k] = redactValue(v);
  }
  return out;
}

function redactSnapshotJson(obj: Record<string, unknown>): Record<string, unknown> {
  // Snapshot carries per-tag entries; truncate `evidenceText` and hash author refs.
  return redactObject(obj);
}

function redactPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    // Per AUTH_MATRIX: strip free-text notes; keep structural fields.
    if (typeof v === "string" && k.toLowerCase().endsWith("text")) continue;
    if (REDACT_KEY_FIELDS.has(k) && typeof v === "string") {
      out[k] = hashAuthIdForRedaction(v);
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
}

/**
 * Apply public-read redaction to a payload. No-op when
 * `viewerCtx.publicReadOnly` is false — route handlers should pass every
 * response through this so the redaction policy lives in one place.
 */
export function redactForPublicRead<T>(
  payload: T,
  viewerCtx: { publicReadOnly: boolean },
): T {
  if (!viewerCtx.publicReadOnly) return payload;
  return redactValue(payload) as T;
}
