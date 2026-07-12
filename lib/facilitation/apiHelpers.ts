/**
 * Facilitation — API helpers
 *
 * Standardized error envelope for route handlers. Mirrors
 * `lib/pathways/apiHelpers.ts`; error code taxonomy extended for the
 * facilitation domain (see docs/facilitation/API.md "Common error codes").
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";

export type FacilitationApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT_SESSION_ALREADY_OPEN"
  | "CONFLICT_SESSION_INACTIVE"
  | "CONFLICT_QUESTION_LOCKED"
  | "CONFLICT_BLOCK_SEVERITY_UNRESOLVED"
  | "CONFLICT_HANDOFF_PENDING"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "HASH_CHAIN_VIOLATION"
  | "INTERNAL";

const STATUS: Record<FacilitationApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_SESSION_ALREADY_OPEN: 409,
  CONFLICT_SESSION_INACTIVE: 409,
  CONFLICT_QUESTION_LOCKED: 409,
  CONFLICT_BLOCK_SEVERITY_UNRESOLVED: 409,
  CONFLICT_HANDOFF_PENDING: 409,
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  HASH_CHAIN_VIOLATION: 500,
  INTERNAL: 500,
};

export function apiError(
  code: FacilitationApiErrorCode,
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

/**
 * Resolve the calling identity. Same convention as Pathways:
 *   - `userId` is the stringified internal `User.id` bigint.
 *   - `authId` is the Supabase / Firebase auth_id.
 */
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

/**
 * Resolve the calling identity if present, but do not 401 on absence. Used by
 * public-read endpoints that serve redacted payloads to anonymous viewers
 * when `session.isPublic = true`.
 */
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

export function mapServiceError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return apiError("NOT_FOUND", msg);
  if (/session.*already open/i.test(msg)) {
    return apiError("CONFLICT_SESSION_ALREADY_OPEN", msg);
  }
  if (/session.*(inactive|closed|handed off)/i.test(msg)) {
    return apiError("CONFLICT_SESSION_INACTIVE", msg);
  }
  if (/question.*locked/i.test(msg)) {
    return apiError("CONFLICT_QUESTION_LOCKED", msg);
  }
  if (/block.*unresolved|unresolved.*block/i.test(msg)) {
    return apiError("CONFLICT_BLOCK_SEVERITY_UNRESOLVED", msg);
  }
  if (/handoff.*pending|pending.*handoff/i.test(msg)) {
    return apiError("CONFLICT_HANDOFF_PENDING", msg);
  }
  if (/hash.*chain/i.test(msg)) {
    return apiError("HASH_CHAIN_VIOLATION", msg);
  }
  return apiError("INTERNAL", msg);
}

export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
