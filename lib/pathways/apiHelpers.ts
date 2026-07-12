/**
 * Pathways — API helpers
 *
 * Standardized error envelope and auth helpers for route handlers.
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT_PACKET_FROZEN"
  | "CONFLICT_DUPLICATE_SUBMISSION"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "HASH_CHAIN_VIOLATION"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_PACKET_FROZEN: 409,
  CONFLICT_DUPLICATE_SUBMISSION: 409,
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  HASH_CHAIN_VIOLATION: 500,
  INTERNAL: 500,
};

export function apiError(
  code: ApiErrorCode,
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
 * Resolve the calling identity. Returns:
 *  - `userId`: stringified internal `User.id` bigint, used as the `createdById`
 *    / `actorId` / `openedById` / etc. value across Pathways tables. Matches
 *    the convention used by `Deliberation.createdById` (see
 *    `app/api/deliberations/spawn/route.ts` -> `String(userId)`).
 *  - `authId`: Supabase / Firebase auth_id, used for admin-allowlist checks
 *    and any future cross-system identity joins.
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

export function mapServiceError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return apiError("NOT_FOUND", msg);
  if (/already submitted|duplicate/i.test(msg)) {
    return apiError("CONFLICT_DUPLICATE_SUBMISSION", msg);
  }
  if (/status (DRAFT|SUBMITTED|RESPONDED|REVISED|CLOSED)|frozen|cannot add|cannot remove|cannot finalize/i.test(msg)) {
    return apiError("CONFLICT_PACKET_FROZEN", msg);
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
