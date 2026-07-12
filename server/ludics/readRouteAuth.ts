/**
 * Shared auth resolver for the Ludics-substrate READ routes
 * (deliberation/[id]/ludics-schema, behaviour-at-locus, exposure-map,
 * behaviours/[id]/articulation-lattice, minimal-incarnations,
 * substitute-premises, designs/[id]/equivalent-articulations,
 * articulations/compress, articulations/join).
 *
 * Accepts, in order:
 *   1. Scoped JWT issued by `issueScopedToken` (HS256, sub=participantId,
 *      scope.deliberationId set). When the route has a deliberationId in
 *      scope, callers should additionally call `enforceTokenScope` to
 *      reject cross-deliberation token reuse (WS-3).
 *   2. Legacy `MCP_API_TOKEN` literal bearer (kept for backward compat
 *      with operator scripts; the canonical ludics WRITE routes already
 *      removed this fallback in v2.5).
 *   3. Session cookie (`getCurrentUserId`).
 *
 * Returns `null` when no credential is presented; throws `LudicsAuthError`
 * when a presented credential is malformed/expired (so the route can map
 * to the right status code + error envelope).
 */

import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  LudicsAuthError,
  verifyScopedToken,
  type LudicsCaller,
} from "@/server/ludics/auth";

export async function resolveLudicsReadCaller(
  req: NextRequest,
): Promise<LudicsCaller | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);

  if (m) {
    const token = m[1].trim();

    // 1. Legacy MCP_API_TOKEN literal match (constant-time-ish: short strings).
    const legacy = process.env.MCP_API_TOKEN;
    if (legacy && token === legacy) {
      return {
        callerId: process.env.MCP_AUTHOR_USER_ID ?? "mcp-system",
        // Use "session" so enforceTokenScope is a no-op for the legacy
        // machine-token path (it has no per-deliberation scope claim).
        authMode: "session",
      };
    }

    // 2. Scoped JWT.
    if (process.env.LUDICS_JWT_SIGNING_KEY) {
      try {
        const verified = await verifyScopedToken(token);
        return {
          callerId: verified.participantId,
          scope: { deliberationId: verified.deliberationId },
          authMode: "jwt",
        };
      } catch (err) {
        if (err instanceof LudicsAuthError) throw err;
        throw new LudicsAuthError("INVALID_TOKEN", "Invalid bearer token", 401);
      }
    }

    // Bearer present but neither legacy nor JWT recognises it.
    throw new LudicsAuthError("INVALID_TOKEN", "Invalid bearer token", 401);
  }

  // 3. Session cookie.
  const sessionId = await getCurrentUserId();
  if (sessionId == null) return null;
  return { callerId: String(sessionId), authMode: "session" };
}
