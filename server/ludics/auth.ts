/**
 * server/ludics/auth.ts — B6 / WS-3 (v2.5 cutover, legacy bearer removed)
 *
 * Scoped session-token (JWT) issuance + verification for the Ludics
 * Phase 2c/2d HTTP perimeter. Replaces the shared bearer pattern
 *
 *   const m = auth.match(/^Bearer\s+(.+)$/i);
 *   if (m && m[1] === process.env.MCP_API_TOKEN) ...
 *
 * that was duplicated across every v3/ludics/* route.
 *
 * ── Design ──────────────────────────────────────────────────────────────────
 *  • Algorithm: HS256 v1 (single signing key in env). ES256 v2 reserved for
 *    a multi-issuer future per WS-3 spec.
 *  • Claims:
 *      sub          participantId
 *      scope        { deliberationId }    ← WS-0: no tenant axis in this repo,
 *                                            so scope is keyed on deliberationId
 *      iss          process.env.LUDICS_JWT_ISSUER ?? "mesh-ludics"
 *      iat/exp      seconds-since-epoch
 *  • Resolution order in `resolveLudicsCaller`:
 *      1. Bearer → JWT verify (`verifyScopedToken`)
 *      2. Session cookie (`getCurrentUserId`)
 *  • Throws `LudicsAuthError` (401/403) when credentials are present but
 *    invalid. Returns null only when no credentials are present at all
 *    (caller maps that to a 401 of its own).
 *
 * ── v2.5 cutover note ──────────────────────────────────────────────────────
 *  The opt-in legacy `MCP_API_TOKEN` bearer fallback gated by
 *  `LUDICS_LEGACY_BEARER=1` was removed in the v2.5 cutover sprint
 *  (post v2 production-readiness). All ludics MCP clients must now
 *  mint scoped tokens via `scripts/mintMcpToken.ts`. The standalone
 *  `MCP_API_TOKEN` env var is still consumed by non-ludics surfaces
 *  (see `lib/citation/mcpAuth.ts` and the isonomia MCP server) and is
 *  intentionally NOT dropped from `.env.example`.
 */

import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getCurrentUserId } from "@/lib/serverutils";

const DEFAULT_ISSUER = "mesh-ludics";
const ALG = "HS256";
const DEFAULT_TTL_SECONDS = 3600;

export type LudicsAuthMode = "jwt" | "session";

export interface LudicsCaller {
  callerId: string;
  /** Only set when the caller authenticated via a scoped JWT. */
  scope?: { deliberationId: string };
  authMode: LudicsAuthMode;
}

export type AuthErrorCode =
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "SCOPE_MISMATCH";

export class LudicsAuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: 401 | 403;

  constructor(code: AuthErrorCode, message: string, status: 401 | 403) {
    super(message);
    this.name = "LudicsAuthError";
    this.code = code;
    this.status = status;
  }
}

// ── Key + issuer helpers ─────────────────────────────────────────────────────

function getSigningKey(): Uint8Array {
  const raw = process.env.LUDICS_JWT_SIGNING_KEY;
  if (!raw) {
    throw new Error(
      "LUDICS_JWT_SIGNING_KEY is not configured. Cannot issue or verify scoped tokens.",
    );
  }
  return new TextEncoder().encode(raw);
}

function getIssuer(): string {
  return process.env.LUDICS_JWT_ISSUER ?? DEFAULT_ISSUER;
}

// ── Issue ────────────────────────────────────────────────────────────────────

export interface IssueScopedTokenInput {
  deliberationId: string;
  participantId: string;
  /** Time-to-live in seconds. Default 3600 (1h). */
  ttlSeconds?: number;
}

export async function issueScopedToken(
  input: IssueScopedTokenInput,
): Promise<string> {
  if (!input.deliberationId) {
    throw new Error("issueScopedToken: deliberationId is required");
  }
  if (!input.participantId) {
    throw new Error("issueScopedToken: participantId is required");
  }
  const ttl = Math.max(1, Math.floor(input.ttlSeconds ?? DEFAULT_TTL_SECONDS));
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    scope: { deliberationId: input.deliberationId },
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(getIssuer())
    .setSubject(input.participantId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(getSigningKey());
}

// ── Verify ───────────────────────────────────────────────────────────────────

export interface VerifiedScopedToken {
  participantId: string;
  deliberationId: string;
  iss: string;
  iat: number;
  exp: number;
}

export interface VerifyScopedTokenOptions {
  /**
   * If set, the JWT's `scope.deliberationId` must equal this value or the
   * verifier throws SCOPE_MISMATCH (403).
   */
  requireDeliberationId?: string;
}

export async function verifyScopedToken(
  token: string,
  opts: VerifyScopedTokenOptions = {},
): Promise<VerifiedScopedToken> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, getSigningKey(), {
      issuer: getIssuer(),
      algorithms: [ALG],
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ERR_JWT_EXPIRED") {
      throw new LudicsAuthError("EXPIRED_TOKEN", "Token expired", 401);
    }
    throw new LudicsAuthError("INVALID_TOKEN", "Invalid token", 401);
  }

  const sub = payload.sub;
  const participantId = typeof sub === "string" && sub.length > 0 ? sub : null;
  const scope =
    payload.scope && typeof payload.scope === "object"
      ? (payload.scope as Record<string, unknown>)
      : null;
  const scopeDelibId =
    scope && typeof scope.deliberationId === "string" && scope.deliberationId.length > 0
      ? (scope.deliberationId as string)
      : null;

  if (!participantId || !scopeDelibId) {
    throw new LudicsAuthError(
      "INVALID_TOKEN",
      "Malformed scoped token payload",
      401,
    );
  }
  if (opts.requireDeliberationId && opts.requireDeliberationId !== scopeDelibId) {
    throw new LudicsAuthError(
      "SCOPE_MISMATCH",
      `Token scope ${scopeDelibId} does not match requested deliberation ${opts.requireDeliberationId}`,
      403,
    );
  }

  return {
    participantId,
    deliberationId: scopeDelibId,
    iss: String(payload.iss ?? ""),
    iat: Number(payload.iat ?? 0),
    exp: Number(payload.exp ?? 0),
  };
}

// ── Scope assertion (used after body parse on POST routes) ──────────────────

/**
 * After a caller has been resolved, assert that — if they came in via a
 * scoped JWT — the JWT's `scope.deliberationId` equals the deliberationId
 * the route is about to operate on. No-op for session callers.
 *
 * Throws SCOPE_MISMATCH (403) on conflict.
 */
export function enforceTokenScope(
  caller: LudicsCaller,
  deliberationId: string,
): void {
  if (caller.authMode !== "jwt") return;
  if (caller.scope?.deliberationId !== deliberationId) {
    throw new LudicsAuthError(
      "SCOPE_MISMATCH",
      `Token scope ${caller.scope?.deliberationId ?? "(none)"} does not match deliberation ${deliberationId}`,
      403,
    );
  }
}

// ── Caller resolution (route entry point) ───────────────────────────────────

export async function resolveLudicsCaller(
  req: NextRequest,
  opts: VerifyScopedTokenOptions = {},
): Promise<LudicsCaller | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);

  if (m) {
    const token = m[1].trim();

    // 1. Scoped JWT (the only accepted bearer path post-v2.5).
    if (process.env.LUDICS_JWT_SIGNING_KEY) {
      try {
        const verified = await verifyScopedToken(token, opts);
        return {
          callerId: verified.participantId,
          scope: { deliberationId: verified.deliberationId },
          authMode: "jwt",
        };
      } catch (err) {
        // Surface JWT verification failures (SCOPE_MISMATCH / EXPIRED_TOKEN /
        // INVALID_TOKEN) with their precise code + status. Previously this
        // catch only re-threw SCOPE_MISMATCH and let other failures fall
        // through to the legacy MCP_API_TOKEN bearer fallback; that fallback
        // was removed in v2.5, so accuracy now beats permissiveness.
        if (err instanceof LudicsAuthError) throw err;
        throw new LudicsAuthError("INVALID_TOKEN", "Invalid bearer token", 401);
      }
    }

    // Bearer present but no signing key configured → explicit 401.
    throw new LudicsAuthError("INVALID_TOKEN", "Invalid bearer token", 401);
  }

  // 2. Session cookie
  const sessionId = await getCurrentUserId();
  if (sessionId == null) return null;
  return { callerId: String(sessionId), authMode: "session" };
}
