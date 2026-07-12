// ─────────────────────────────────────────────────────────────────────────────
// Verify-mode-A — offline provenance verification of Isonomia signed attestations.
//
// When an argument card is rendered in the wild, this fetches the argument's
// `?signed=1` attestation + the issuer JWKS + the revocation list, and verifies
// the Ed25519 signature **in the browser** (SubtleCrypto — no dependency, no call
// back to Isonomia beyond the public artifacts). The signature covers
// `contentHash` + `dialecticalStatus`, so a card whose shown standing was altered
// fails verification.
//
// Requires a browser with WebCrypto Ed25519 (Chrome 137+). The JCS canonicalizer
// is vendored in `./jcs` and MUST match the server's `lib/canonical/jcs.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import { canonicalize } from "./jcs";

export type ProvenanceVerdict =
  | { status: "verified"; keyId: string }
  | { status: "revoked"; reason: string }
  | { status: "modified"; reason: string }
  | { status: "unverified"; reason: string };

interface JwksEntry {
  kid: string;
  kty: string;
  crv: string;
  x: string; // base64url raw 32-byte Ed25519 public key
  ["iso:notBefore"]?: string | null;
  ["iso:notAfter"]?: string | null;
}
interface Jwks {
  keys: JwksEntry[];
}
interface SignatureBlock {
  alg: string;
  keyId: string;
  sig: string; // base64
  signedAt: string;
  signedFields: string[];
  jcsHash: string;
  status?: "active" | "revoked";
  revocationReason?: string;
}
type SignedEnvelope = Record<string, unknown> & {
  signature: SignatureBlock;
  contentHash?: string;
};

// ─── base64 helpers (browser) ────────────────────────────────────────────────

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return fromBase64(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
}

function pickFields(obj: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

// ─── core verification (mirrors server `verifyAttestation`) ───────────────────

/**
 * Verify a signed envelope against a JWKS, offline. Ed25519 verify runs over the
 * JCS-canonicalized signed subset — the same bytes the server signed. (The
 * server's `jcsHash` sanity check is redundant with this and is skipped here.)
 */
export async function verifySignedEnvelope(
  signed: SignedEnvelope,
  jwks: Jwks,
): Promise<{ ok: boolean; reason?: string; keyId?: string }> {
  const sig = signed.signature;
  if (!sig || sig.alg !== "Ed25519") return { ok: false, reason: "missing/unsupported signature" };

  const entry = jwks.keys.find((k) => k.kid === sig.keyId);
  if (!entry) return { ok: false, reason: `unknown keyId ${sig.keyId}` };
  if (entry.kty !== "OKP" || entry.crv !== "Ed25519") return { ok: false, reason: "JWKS entry not Ed25519" };

  // Reconstruct the exact signed bytes.
  const { signature: _drop, ...envelope } = signed as Record<string, unknown>;
  const subset = pickFields(envelope, sig.signedFields);
  const msg = new TextEncoder().encode(canonicalize(subset));
  const sigBytes = fromBase64(sig.sig);
  const pub = fromBase64Url(entry.x);

  try {
    const key = await crypto.subtle.importKey("raw", pub as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes as BufferSource, msg as BufferSource);
    return ok ? { ok: true, keyId: sig.keyId } : { ok: false, reason: "signature verification failed" };
  } catch (err: any) {
    return { ok: false, reason: `WebCrypto Ed25519 unavailable: ${err?.message || err}` };
  }
}

// ─── fetch + orchestrate ──────────────────────────────────────────────────────

// In-memory JWKS cache (per page load) keyed by origin.
const jwksCache = new Map<string, Jwks>();

async function fetchJwks(base: string): Promise<Jwks | null> {
  if (jwksCache.has(base)) return jwksCache.get(base)!;
  try {
    const res = await fetch(`${base}/.well-known/issuer-keys`);
    if (!res.ok) return null;
    const jwks = (await res.json()) as Jwks;
    jwksCache.set(base, jwks);
    return jwks;
  } catch {
    return null;
  }
}

/**
 * Authoritative revocation check: is `(shortCode, contentHash)` in the
 * append-only well-known list? (The `signature.status` stamp is only a hint.)
 */
async function isRevoked(base: string, shortCode: string, contentHash: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/.well-known/revoked-attestations`);
    if (!res.ok) return false;
    const body = await res.text();
    const needle = `${shortCode}@${contentHash} `;
    return body.split("\n").some((line) => line.startsWith(needle));
  } catch {
    return false;
  }
}

/**
 * Full verify-mode-A flow for one argument identifier. Never throws — returns a
 * verdict the badge renders. `base` is the argument's origin (e.g. the link's
 * origin), `identifier` its shortCode.
 */
export async function verifyProvenance(base: string, identifier: string): Promise<ProvenanceVerdict> {
  let signed: SignedEnvelope;
  try {
    const res = await fetch(`${base}/api/a/${identifier}/aif?format=attestation&signed=1`);
    if (res.status === 501) return { status: "unverified", reason: "issuer has not enabled signing" };
    if (!res.ok) return { status: "unverified", reason: `attestation fetch ${res.status}` };
    signed = (await res.json()) as SignedEnvelope;
  } catch (err: any) {
    return { status: "unverified", reason: `attestation fetch failed: ${err?.message || err}` };
  }
  if (!signed?.signature) return { status: "unverified", reason: "no signature on attestation" };

  const jwks = await fetchJwks(base);
  if (!jwks) return { status: "unverified", reason: "could not fetch issuer keys" };

  const result = await verifySignedEnvelope(signed, jwks);
  if (!result.ok) return { status: "modified", reason: result.reason || "signature invalid" };

  // Signature is genuine — now the authoritative revocation check.
  const contentHash = typeof signed.contentHash === "string" ? signed.contentHash : "";
  if (contentHash && (await isRevoked(base, identifier, contentHash))) {
    return { status: "revoked", reason: signed.signature.revocationReason || "revoked by issuer" };
  }

  return { status: "verified", keyId: result.keyId! };
}
