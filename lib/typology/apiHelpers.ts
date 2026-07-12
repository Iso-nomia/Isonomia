/**
 * Typology — API helpers
 *
 * Mirrors `lib/facilitation/apiHelpers.ts`. Error code taxonomy follows
 * docs/typology/API.md "Common error codes".
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";

export type TypologyApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT_TARGET_OUTSIDE_DELIBERATION"
  | "CONFLICT_TAG_RETRACTED"
  | "CONFLICT_TAG_NOT_FOUND"
  | "CONFLICT_AXIS_INACTIVE"
  | "CONFLICT_CANDIDATE_RESOLVED"
  | "CONFLICT_CANDIDATE_NOT_FOUND"
  | "CONFLICT_PROMOTE_REQUIRES_TARGET"
  | "CONFLICT_SUMMARY_NOT_DRAFT"
  | "CONFLICT_SUMMARY_NOT_PUBLISHED"
  | "CONFLICT_SUMMARY_NOT_FOUND"
  | "CONFLICT_SUMMARY_REFERENCES_RETRACTED_TAG"
  | "CONFLICT_SUMMARY_REFERENCES_UNKNOWN_TAG"
  | "CONFLICT_SUMMARY_PARENT_NOT_PUBLISHED"
  | "SNAPSHOT_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "HASH_CHAIN_VIOLATION"
  | "INTERNAL";

const STATUS: Record<TypologyApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_TARGET_OUTSIDE_DELIBERATION: 404,
  CONFLICT_TAG_RETRACTED: 409,
  CONFLICT_TAG_NOT_FOUND: 404,
  CONFLICT_AXIS_INACTIVE: 409,
  CONFLICT_CANDIDATE_RESOLVED: 409,
  CONFLICT_CANDIDATE_NOT_FOUND: 404,
  CONFLICT_PROMOTE_REQUIRES_TARGET: 409,
  CONFLICT_SUMMARY_NOT_DRAFT: 409,
  CONFLICT_SUMMARY_NOT_PUBLISHED: 409,
  CONFLICT_SUMMARY_NOT_FOUND: 404,
  CONFLICT_SUMMARY_REFERENCES_RETRACTED_TAG: 409,
  CONFLICT_SUMMARY_REFERENCES_UNKNOWN_TAG: 409,
  CONFLICT_SUMMARY_PARENT_NOT_PUBLISHED: 409,
  SNAPSHOT_TOO_LARGE: 422,
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  HASH_CHAIN_VIOLATION: 500,
  INTERNAL: 500,
};

export function apiError(
  code: TypologyApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}

export function zodError(err: ZodError) {
  return apiError("VALIDATION_ERROR", "Request validation failed", {
    fieldErrors: err.flatten().fieldErrors,
    formErrors: err.flatten().formErrors,
  });
}

export async function requireAuth(): Promise<
  | { ok: true; userId: string; authId: string | null }
  | { ok: false; response: NextResponse }
> {
  const [userIdBig, authId] = await Promise.all([
    getCurrentUserId().catch(() => null),
    getCurrentUserAuthId().catch(() => null),
  ]);
  if (!userIdBig) {
    return { ok: false, response: apiError("UNAUTHORIZED", "Authentication required") };
  }
  return { ok: true, userId: String(userIdBig), authId };
}

export async function resolveOptionalAuth(): Promise<{
  userId: string | null;
  authId: string | null;
}> {
  const [userIdBig, authId] = await Promise.all([
    getCurrentUserId().catch(() => null),
    getCurrentUserAuthId().catch(() => null),
  ]);
  return { userId: userIdBig ? String(userIdBig) : null, authId };
}

export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

interface CodedError {
  name?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Translate a service-layer error into a typed API response. Recognizes the
 * shape thrown by `TagServiceError`, `CandidateServiceError`,
 * `SummaryServiceError`, and `AxisRegistryError` (which all carry a
 * `code: TypologyApiErrorCode`-aligned string).
 */
export function mapServiceError(err: unknown): NextResponse {
  const e = err as CodedError;
  const code = typeof e?.code === "string" ? e.code : null;
  const msg = e?.message ?? "Internal error";

  if (code && code in STATUS) {
    return apiError(code as TypologyApiErrorCode, msg, e.details);
  }

  // Substring fallbacks (older message-based errors)
  if (/not found/i.test(msg)) return apiError("NOT_FOUND", msg);
  if (/hash.*chain/i.test(msg)) return apiError("HASH_CHAIN_VIOLATION", msg);
  return apiError("INTERNAL", msg);
}
