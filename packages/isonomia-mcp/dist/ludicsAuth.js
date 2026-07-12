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
import { SignJWT } from "jose";
const ALG = "HS256";
const DEFAULT_ISSUER = "mesh-ludics";
const DEFAULT_TTL_SECONDS = 300;
export function isLudicsAutoMintConfigured() {
    return Boolean(process.env.LUDICS_JWT_SIGNING_KEY && process.env.LUDICS_PARTICIPANT_ID);
}
function getSigningKey() {
    const raw = process.env.LUDICS_JWT_SIGNING_KEY;
    if (!raw) {
        throw new Error("LUDICS_JWT_SIGNING_KEY is not configured on the MCP server; cannot auto-mint scoped tokens.");
    }
    return new TextEncoder().encode(raw);
}
function getIssuer() {
    return process.env.LUDICS_JWT_ISSUER ?? DEFAULT_ISSUER;
}
function getTtlSeconds() {
    const raw = Number(process.env.LUDICS_JWT_TTL_SECONDS);
    if (!Number.isFinite(raw) || raw <= 0)
        return DEFAULT_TTL_SECONDS;
    return Math.floor(raw);
}
/**
 * Mint a fresh JWT scoped to `deliberationId`. Uses `LUDICS_PARTICIPANT_ID`
 * as `sub`. TTL is intentionally short — these are one-shot per request.
 */
export async function mintScopedToken(deliberationId) {
    if (!deliberationId) {
        throw new Error("mintScopedToken: deliberationId is required");
    }
    const participantId = process.env.LUDICS_PARTICIPANT_ID;
    if (!participantId) {
        throw new Error("LUDICS_PARTICIPANT_ID is not configured on the MCP server; cannot auto-mint scoped tokens.");
    }
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({ scope: { deliberationId } })
        .setProtectedHeader({ alg: ALG })
        .setIssuer(getIssuer())
        .setSubject(participantId)
        .setIssuedAt(now)
        .setExpirationTime(now + getTtlSeconds())
        .sign(getSigningKey());
}
