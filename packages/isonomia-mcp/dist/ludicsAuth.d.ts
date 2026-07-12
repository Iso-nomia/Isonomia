/**
 * packages/isonomia-mcp/src/ludicsAuth.ts
 * ───────────────────────────────────────────────────────────────────────────
 * MCP-side mirror of `server/ludics/auth.ts::issueScopedToken`.
 *
 * Lets the MCP server mint short-lived, deliberation-scoped JWTs per request
 * so a Claude Desktop user can configure the server once and just supply
 * `deliberationId` in tool args. The Next dev server verifies these tokens
 * with the same `LUDICS_JWT_SIGNING_KEY`, so the algorithm, issuer, and
 * claim shape must stay in lockstep with `server/ludics/auth.ts`.
 *
 * Env (all optional except KEY/PARTICIPANT for auto-mint to activate):
 *   LUDICS_JWT_SIGNING_KEY    — HS256 secret, MUST match the Next server.
 *   LUDICS_PARTICIPANT_ID     — `sub` claim; the human identity behind writes.
 *   LUDICS_JWT_ISSUER         — default "mesh-ludics".
 *   LUDICS_JWT_TTL_SECONDS    — default 300 (5 min — short on purpose).
 */
export declare function isLudicsAutoMintConfigured(): boolean;
/**
 * Mint a fresh JWT scoped to `deliberationId`. Uses `LUDICS_PARTICIPANT_ID`
 * as `sub`. TTL is intentionally short — these are one-shot per request.
 */
export declare function mintScopedToken(deliberationId: string): Promise<string>;
