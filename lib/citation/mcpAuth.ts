/**
 * Shared-secret MCP bearer-token auth for the citation routes.
 *
 * Mirrors the pattern used by
 * `app/api/v3/deliberations/[id]/ecc/propose-warrant/route.ts`: when an
 * `Authorization: Bearer <token>` header exactly matches the server's
 * `MCP_API_TOKEN` env var, the caller is treated as the configured MCP
 * bot user (`MCP_AUTHOR_USER_ID`, default `"mcp-bot"`). Otherwise we
 * fall back to the session-cookie / Firebase-ID-token path that
 * `getCurrentUserId` already implements.
 *
 * Required because the citation MCP tools (`resolve_citation`,
 * `resolve_citations_bulk`) send a static `ISONOMIA_API_TOKEN` as a
 * bearer header — that token is not a Firebase ID token, so the
 * default `getCurrentUserId` path always rejects it.
 *
 * Returns the caller's user-id as a string (the citation store keys on
 * string userId), or `null` when the request is unauthenticated.
 */

import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";

/**
 * Returns true when the request carries an `Authorization: Bearer
 * <MCP_API_TOKEN>` header matching the server-side shared secret.
 * Useful for callers that need to flag the resulting row as
 * AI-authored (e.g. `authorKind = AI` on Argument) per Track AI-EPI
 * Pt.3 §5, separate from just resolving a user-id.
 */
export function isMcpBearer(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const expected = process.env.MCP_API_TOKEN;
  return Boolean(m && expected && m[1] === expected);
}

export async function resolveCitationCallerUserId(
  req: NextRequest,
): Promise<string | null> {
  if (isMcpBearer(req)) {
    return process.env.MCP_AUTHOR_USER_ID || "mcp-bot";
  }
  try {
    const sessionUserId = await getCurrentUserId();
    return sessionUserId == null ? null : String(sessionUserId);
  } catch {
    return null;
  }
}

/**
 * Normalise a caller-supplied `speakAs` label into a safe side token.
 * Keeps only `[A-Za-z0-9._-]`, clamps to 64 chars, and falls back to
 * `"default"` when empty — so the resulting token can never inject an extra
 * path segment or collide with structured ids.
 */
export function normalizeSpeakAs(raw?: string | null): string {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 64);
  return cleaned.length ? cleaned : "default";
}

/**
 * Resolve the effective **dialogical-side** actor id for a protocol write
 * (dialogue move / attack). See ATTACKS_AND_DIALOGUE_MOVES_OVER_MCP_SPEC §4.
 *
 * The one non-negotiable floor: only an **MCP-bearer** caller may namespace
 * into a side. For any human/cookie caller `speakAs` is ignored and the raw
 * base id is returned — so a `speakAs` value can NEVER resolve to, collide
 * with, or impersonate a human participant's `auth_id`, and a human can never
 * forge the service-identity prefix. Under an MCP bearer the base id is always
 * the service identity (`MCP_AUTHOR_USER_ID || "mcp-bot"`), so every namespaced
 * id is of the form `"<service>:<side>"` (e.g. `mcp-bot:proponent`), giving the
 * protocol two genuinely distinct sides that both trace to the service user.
 *
 * A side is **opt-in**: with no `speakAs` the caller stays the *bare* service
 * identity (`mcp-bot`), so a bare self-reply is still R3-blocked and bare MCP
 * writes remain `NON_HUMAN_ACTORS`-detectable. Declaring a `speakAs` is the
 * explicit act that creates a distinct dialogical side.
 *
 * There is intentionally NO persona cap (Q2): any number of stable `speakAs`
 * labels are allowed; misuse (manufacturing many-sided agreement) is addressed
 * in orientation copy, not structurally.
 */
export function namespaceForSpeakAs(opts: {
  isMcpBearer: boolean;
  baseUserId: string;
  speakAs?: string | null;
}): string {
  const { isMcpBearer, baseUserId, speakAs } = opts;
  if (!isMcpBearer) return baseUserId;
  // No side declared → bare service identity (side is opt-in).
  if (!String(speakAs ?? "").trim()) return baseUserId;
  return `${baseUserId}:${normalizeSpeakAs(speakAs)}`;
}
