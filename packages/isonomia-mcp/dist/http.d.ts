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
export type { IsoFetchInit };
export declare const BASE_URL: string;
export declare const API_TOKEN: string;
export declare const TIMEOUT_MS: number;
export declare const USER_AGENT = "isonomia-mcp/0.1.0 (+https://isonomia.app/mcp)";
/**
 * Fetch wrapper with timeout + UA + optional bearer + JSON parsing.
 * Throws an Error with a descriptive message on non-2xx, with the body
 * truncated to 500 chars so it surfaces nicely in MCP tool errors.
 */
export declare function isoFetch<T = unknown>(path: string, init?: IsoFetchInit): Promise<T>;
