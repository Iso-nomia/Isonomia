/**
 * Shared HTTP client + base URL config for Isonomia MCP tools.
 *
 * All tools talk to the live Isonomia API surface. The MCP server itself
 * holds no DB connection — it's a thin, portable adapter.
 *
 * Configuration (env):
 *   ISONOMIA_BASE_URL  Public base, e.g. "https://isonomia.app"
 *                      Defaults to "https://isonomia.app" when unset.
 *   ISONOMIA_API_TOKEN Bearer token. REQUIRED for non-Ludics write tools
 *                      (propose_argument, propose_warrant). Read tools work
 *                      anonymously.
 *   ISONOMIA_TIMEOUT_MS  Per-request timeout (default 30000).
 *
 *   ── Ludics auto-mint (see ludicsAuth.ts) ──
 *   LUDICS_JWT_SIGNING_KEY    HS256 secret, MUST match the Next server.
 *   LUDICS_PARTICIPANT_ID     `sub` claim; the human identity behind writes.
 *   LUDICS_JWT_ISSUER         default "mesh-ludics".
 *   LUDICS_JWT_TTL_SECONDS    default 300 (5 min).
 *
 * When these auto-mint vars are set and a caller passes `ludicsDeliberationId`
 * in IsoFetchInit, `isoFetch` mints a fresh deliberation-scoped JWT per call
 * and uses it as `Authorization: Bearer`, overriding the static
 * ISONOMIA_API_TOKEN. The Next perimeter then enforces JWT scope against
 * the body / query deliberationId per WS-3.
 */

import type { IsoFetchInit } from "@app/isonomia-tools";
import { isLudicsAutoMintConfigured, mintScopedToken } from "./ludicsAuth.js";

export type { IsoFetchInit };

export const BASE_URL =
  process.env.ISONOMIA_BASE_URL?.replace(/\/+$/, "") || "https://isonomia.app";

export const API_TOKEN = process.env.ISONOMIA_API_TOKEN || "";

export const TIMEOUT_MS = Number(process.env.ISONOMIA_TIMEOUT_MS ?? 30000) || 30000;

export const USER_AGENT = "isonomia-mcp/0.1.0 (+https://isonomia.app/mcp)";

/**
 * Fetch wrapper with timeout + UA + optional bearer + JSON parsing.
 * Throws an Error with a descriptive message on non-2xx, with the body
 * truncated to 500 chars so it surfaces nicely in MCP tool errors.
 */
export async function isoFetch<T = unknown>(
  path: string,
  init: IsoFetchInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("User-Agent", USER_AGENT);

  // Ludics auto-mint takes precedence over the static API_TOKEN when configured
  // and the caller supplied a deliberationId to scope against.
  const useAutoMint =
    !!init.ludicsDeliberationId && isLudicsAutoMintConfigured();
  if (useAutoMint) {
    const jwt = await mintScopedToken(init.ludicsDeliberationId!);
    headers.set("Authorization", `Bearer ${jwt}`);
  } else if (init.authenticated && API_TOKEN) {
    headers.set("Authorization", `Bearer ${API_TOKEN}`);
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      const snippet = text.length > 500 ? text.slice(0, 500) + "…" : text;
      // Surface the common "Firebase auth middleware swallowed the request
      // and 307'd us to /login (or returned a generic HTML error page)" case
      // with an actionable hint, so the agent doesn't waste turns retrying.
      const looksLikeHtml = /^\s*<(?:!doctype|html)/i.test(text);
      const wasRedirect = res.status >= 300 && res.status < 400;
      if (looksLikeHtml || wasRedirect) {
        throw new Error(
          `HTTP ${res.status} ${res.statusText} from ${url}: response is HTML, not JSON. ` +
            `This usually means the Next middleware auth-gate blocked the request before the route handler ran ` +
            `(check middleware.ts PUBLIC_API allowlist) or the route is not deployed. ` +
            `First 500 chars: ${snippet}`
        );
      }
      // Tolerated statuses with a JSON body are returned as a value (not thrown)
      // so the agent can act on a structured protocol rejection.
      if (init.tolerateStatuses?.includes(res.status) && text) {
        try {
          return JSON.parse(text) as T;
        } catch {
          /* fall through to the throw below when the body isn't JSON */
        }
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}: ${snippet}`);
    }
    if (init.raw) return text as unknown as T;
    if (!text) return {} as T;
    // Some upstream errors (or middleware redirects) return HTML with a 200.
    // Detect and refuse to JSON.parse so the agent sees a clean error.
    if (/^\s*<(?:!doctype|html)/i.test(text)) {
      const snippet = text.length > 500 ? text.slice(0, 500) + "…" : text;
      throw new Error(
        `Expected JSON from ${url} but got HTML (status ${res.status}). ` +
          `Likely an auth-middleware redirect — verify the path is in middleware.ts PUBLIC_API. ` +
          `First 500 chars: ${snippet}`
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      // For endpoints that return JSON-LD with extra profile parameters in
      // Content-Type, .json() can over-strictly bail — we already got text.
      return JSON.parse(text) as T;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// permalinkToShortCode moved to @app/isonomia-tools (B0) — the registry is
// its only consumer.
