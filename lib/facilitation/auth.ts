/**
 * Facilitation — Authorization helpers
 *
 * Implements the helpers contracted in docs/facilitation/AUTH_MATRIX.md.
 * Reuses Scope A's role primitives (`isFacilitator`, `isDeliberationHost`)
 * verbatim where possible — facilitation does not introduce a new role enum.
 *
 * All helpers return plain results; route handlers wrap them with
 * `apiError("FORBIDDEN" | "UNAUTHORIZED" | "NOT_FOUND", ...)`.
 *
 * Status: C1.2 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import { isFacilitator, isDeliberationHost } from "@/lib/pathways/auth";
import { FacilitationHandoffStatus, FacilitationSessionStatus } from "./types";

export { isFacilitator, isDeliberationHost } from "@/lib/pathways/auth";

/**
 * True iff the caller currently controls the given session:
 *   - session.status = OPEN
 *   - caller's userId === session.openedById
 *   - no PENDING handoff originating from this session
 */
export async function isActiveSessionFacilitator(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const session = await prisma.facilitationSession.findUnique({
    where: { id: sessionId },
    select: { status: true, openedById: true },
  });
  if (!session) return false;
  if (session.status !== FacilitationSessionStatus.OPEN) return false;
  if (session.openedById !== userId) return false;

  const pending = await prisma.facilitationHandoff.findFirst({
    where: { fromSessionId: sessionId, status: FacilitationHandoffStatus.PENDING },
    select: { id: true },
  });
  return !pending;
}

/** Host or facilitator on the deliberation. */
export async function canManageFacilitation(
  userId: string,
  deliberationId: string,
): Promise<boolean> {
  return isFacilitator(deliberationId, userId);
}

export interface CanReadResult {
  ok: boolean;
  /** True iff caller can only see the redacted public-read view. */
  publicReadOnly: boolean;
  notFound?: boolean;
}

/**
 * Resolve read access on a session. Returns:
 *   - `{ ok: true, publicReadOnly: false }` for hosts / facilitators / observers
 *     on the deliberation.
 *   - `{ ok: true, publicReadOnly: true }` when the caller does not have a
 *     deliberation role but the session opted into public read (`isPublic = true`).
 *   - `{ ok: false, publicReadOnly: false, notFound: true }` if the session does
 *     not exist or the caller has no read path to it.
 */
export async function canReadFacilitation(
  userId: string | null,
  sessionId: string,
): Promise<CanReadResult> {
  const session = await prisma.facilitationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, deliberationId: true, isPublic: true },
  });
  if (!session) return { ok: false, publicReadOnly: false, notFound: true };

  if (userId) {
    if (await isDeliberationHost(session.deliberationId, userId)) {
      return { ok: true, publicReadOnly: false };
    }
    if (await isFacilitator(session.deliberationId, userId)) {
      return { ok: true, publicReadOnly: false };
    }
    const role = await prisma.deliberationRole.findFirst({
      where: { deliberationId: session.deliberationId, userId },
      select: { role: true },
    });
    if (role) {
      // observers / contributors — role visibility is "private read" of the
      // un-redacted facilitation surface for now. Public-read redaction only
      // applies when the caller is anonymous OR has no deliberation role.
      return { ok: true, publicReadOnly: false };
    }
  }

  if (session.isPublic) {
    return { ok: true, publicReadOnly: true };
  }
  return { ok: false, publicReadOnly: false, notFound: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public-read redaction (decision #5)
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";

/**
 * Stable, irreversible identifier for redacted fields. 12 hex chars of sha256
 * — enough to avoid practical collisions in a single deliberation while
 * preventing reverse lookup.
 */
export function hashAuthIdForRedaction(authId: string): string {
  return createHash("sha256").update(authId).digest("hex").slice(0, 12);
}

const REDACT_KEY_FIELDS = new Set([
  "actorId",
  "openedById",
  "closedById",
  "appliedById",
  "dismissedById",
  "lockedById",
  "authoredById",
  "acknowledgedById",
  "respondedById",
  "createdById",
  "initiatedById",
  "toUserId",
]);

const STRIP_FREE_TEXT_KEYS = new Set([
  "dismissedReasonText",
  "notesText",
  "noteText",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
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
      // Drop free-text fields entirely on public read.
      continue;
    }
    if (k === "rationaleJson" && isPlainObject(v)) {
      // Keep only the headline; details may carry author hints.
      const headline = (v as Record<string, unknown>).headline;
      out[k] = headline ? { headline } : {};
      continue;
    }
    if (k === "breakdownJson" && isPlainObject(v)) {
      // Strip per-author identifiers from breakdowns; keep counts and shares.
      out[k] = redactBreakdown(v);
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

function redactBreakdown(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    // Drop any list of identifying ids.
    if (
      ["topKAuthorIds", "implicitEnrollments", "lastActionEventId", "userA", "userB"].includes(k)
    ) {
      continue;
    }
    if (
      k === "staleClaimIds" &&
      Array.isArray(v)
    ) {
      // Keep length only; specific claim ids are room-internal context.
      out["staleClaimCount"] = v.length;
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
}

function redactPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && k.toLowerCase().includes("text")) continue;
    if (REDACT_KEY_FIELDS.has(k) && typeof v === "string") {
      out[k] = hashAuthIdForRedaction(v);
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
}

/**
 * Apply public-read redaction to a payload. No-op when `viewerCtx.publicReadOnly`
 * is false — route handlers should pass every response through this so the
 * redaction policy lives in one place (decision #5).
 */
export function redactForPublicRead<T>(
  payload: T,
  viewerCtx: { publicReadOnly: boolean },
): T {
  if (!viewerCtx.publicReadOnly) return payload;
  return redactValue(payload) as T;
}
