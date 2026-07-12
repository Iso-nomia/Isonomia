/**
 * Attestation Signer — Track AI-EPI Pt. 5 §1
 *
 * Detached Ed25519 signatures over JCS-canonicalized attestation envelopes.
 *
 * Trust model:
 *   - The signed payload is `JCS(envelope minus signature)`, then SHA-256.
 *     The signature covers that hash, so the verifier never has to
 *     re-canonicalize anything more than the envelope it received.
 *   - `signedFields` is an explicit allowlist of envelope keys covered by
 *     the signature. Future envelope additions are *not* covered by old
 *     signatures unless their key is in the recipient's expected
 *     `signedFields` list for the envelope's `attestation.version`.
 *   - The signer never mutates the input envelope. The returned shape is a
 *     shallow copy with `signature` attached.
 *
 * Companion to (and gradually superseding for cross-system uses) the older
 * `server/trust/receipt.ts` and `server/trust/sign.ts` paths, which use
 * `JSON.stringify` and are unsafe for cross-system verification because
 * key ordering is implementation-defined.
 */

import crypto from "crypto";
import nacl from "tweetnacl";
import { canonicalize } from "@/lib/canonical/jcs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignatureAlg = "Ed25519";

export interface SignatureBlock {
  alg: SignatureAlg;
  /** Key id matching an entry in /.well-known/issuer-keys */
  keyId: string;
  /** Base64-encoded 64-byte Ed25519 signature */
  sig: string;
  /** ISO timestamp the signature was produced */
  signedAt: string;
  /**
   * Explicit allowlist of top-level envelope keys covered by the signature.
   * The verifier rebuilds `JCS(pickFields(envelope, signedFields))`,
   * SHA-256s it, and Ed25519-verifies. Anything outside this list is *not*
   * covered.
   */
  signedFields: string[];
  /** Hex SHA-256 of the JCS-canonicalized signed subset (verifier sanity check) */
  jcsHash: string;
  /** Optional: revocation marker stamped by `argumentAttestation.ts` */
  status?: "active" | "revoked";
  revocationReason?: string;
}

export interface SignedEnvelope<T extends Record<string, unknown>> {
  envelope: T;
  signature: SignatureBlock;
}

export interface KeyHandle {
  keyId: string;
  /** 32-byte Ed25519 seed (the first half of the nacl 64-byte secret key) */
  secretKey: Uint8Array;
  /** 32-byte Ed25519 public key */
  publicKey: Uint8Array;
  alg: SignatureAlg;
  notBefore?: Date | null;
  notAfter?: Date | null;
}

export interface JwksEntry {
  kid: string;
  kty: "OKP";
  crv: "Ed25519";
  /** Base64url-encoded 32-byte public key */
  x: string;
  use?: "sig";
  alg?: "EdDSA";
  ["iso:notBefore"]?: string | null;
  ["iso:notAfter"]?: string | null;
  ["iso:role"]?: "platform-witness" | "author";
}

export interface Jwks {
  keys: JwksEntry[];
}

export type VerifyResult =
  | { ok: true; keyId: string; signedAt: string }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

function envelopeWithoutSignature<T extends Record<string, unknown>>(
  signed: T & { signature?: unknown },
): Omit<T, "signature"> {
  const { signature: _drop, ...rest } = signed as Record<string, unknown>;
  return rest as Omit<T, "signature">;
}

// ---------------------------------------------------------------------------
// Sign / Verify
// ---------------------------------------------------------------------------

export interface SignAttestationOptions {
  /** Override the timestamp (tests). Defaults to `new Date().toISOString()`. */
  signedAt?: string;
  /**
   * Optional explicit allowlist of envelope top-level keys to cover. When
   * omitted, every own enumerable key on the envelope (sans `signature`)
   * is covered. Pinning this list explicitly is recommended for
   * production callers to make schema evolution audit-able.
   */
  signedFields?: readonly string[];
}

/**
 * Sign an attestation envelope. Returns a *new* object containing the
 * envelope's own keys plus a `signature` block; the input is not mutated.
 */
export function signAttestation<T extends Record<string, unknown>>(
  envelope: T,
  key: KeyHandle,
  options: SignAttestationOptions = {},
): T & { signature: SignatureBlock } {
  if ("signature" in envelope) {
    throw new Error(
      "signAttestation: envelope already has a `signature` field; remove it before re-signing",
    );
  }
  if (key.alg !== "Ed25519") {
    throw new Error(`signAttestation: unsupported alg ${key.alg}`);
  }

  const signedAt = options.signedAt ?? new Date().toISOString();
  const fields = options.signedFields
    ? [...options.signedFields].sort()
    : Object.keys(envelope).sort();

  const subset = pickFields(envelope, fields);
  const canonical = canonicalize(subset);
  const canonicalBytes = new TextEncoder().encode(canonical);
  const jcsHash = sha256Hex(canonicalBytes);

  // Build a 64-byte nacl secret key from the 32-byte seed.
  const naclSecret =
    key.secretKey.length === 64
      ? key.secretKey
      : nacl.sign.keyPair.fromSeed(key.secretKey).secretKey;

  const sig = nacl.sign.detached(canonicalBytes, naclSecret);

  return {
    ...envelope,
    signature: {
      alg: "Ed25519",
      keyId: key.keyId,
      sig: toBase64(sig),
      signedAt,
      signedFields: fields,
      jcsHash,
    },
  };
}

export interface VerifyOptions {
  /**
   * Tolerated clock skew when checking `signedAt` against a key's
   * `notBefore`/`notAfter` window. Defaults to 60 s.
   */
  clockSkewMs?: number;
}

/**
 * Verify a signed envelope against a JWKS. Performs:
 *   1. JWKS lookup for the signature's `keyId`.
 *   2. `notBefore`/`notAfter` window check on the JWKS entry against
 *      `signature.signedAt` (with `clockSkewMs` tolerance).
 *   3. Recomputation of `JCS(pickFields(envelope, signedFields))` and
 *      assertion that `sha256(canonical) === signature.jcsHash`.
 *   4. Ed25519 verification of the signature against that canonical bytes.
 */
export function verifyAttestation<T extends Record<string, unknown>>(
  signed: T & { signature: SignatureBlock },
  jwks: Jwks,
  options: VerifyOptions = {},
): VerifyResult {
  const sigBlock = signed.signature;
  if (!sigBlock || sigBlock.alg !== "Ed25519") {
    return { ok: false, reason: "missing or unsupported signature alg" };
  }
  const skew = options.clockSkewMs ?? 60_000;

  const entry = jwks.keys.find((k) => k.kid === sigBlock.keyId);
  if (!entry) return { ok: false, reason: `unknown keyId ${sigBlock.keyId}` };
  if (entry.kty !== "OKP" || entry.crv !== "Ed25519") {
    return { ok: false, reason: "JWKS entry is not Ed25519/OKP" };
  }

  const signedAtMs = Date.parse(sigBlock.signedAt);
  if (Number.isNaN(signedAtMs)) {
    return { ok: false, reason: "invalid signedAt timestamp" };
  }
  if (entry["iso:notBefore"]) {
    const nb = Date.parse(entry["iso:notBefore"]);
    if (Number.isFinite(nb) && signedAtMs + skew < nb) {
      return { ok: false, reason: "signedAt before key notBefore" };
    }
  }
  if (entry["iso:notAfter"]) {
    const na = Date.parse(entry["iso:notAfter"]);
    if (Number.isFinite(na) && signedAtMs - skew > na) {
      return { ok: false, reason: "signedAt after key notAfter" };
    }
  }

  const subset = pickFields(envelopeWithoutSignature(signed), sigBlock.signedFields);
  const canonicalBytes = new TextEncoder().encode(canonicalize(subset));
  const jcsHash = sha256Hex(canonicalBytes);
  if (jcsHash !== sigBlock.jcsHash) {
    return { ok: false, reason: "JCS hash mismatch (envelope mutated or signedFields drift)" };
  }

  const pub = fromBase64Url(entry.x);
  const sig = fromBase64(sigBlock.sig);
  const ok = nacl.sign.detached.verify(canonicalBytes, sig, pub);
  if (!ok) return { ok: false, reason: "Ed25519 verification failed" };

  return { ok: true, keyId: sigBlock.keyId, signedAt: sigBlock.signedAt };
}

// ---------------------------------------------------------------------------
// JWKS encoding helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw 32-byte Ed25519 public key into a JWKS entry.
 */
export function publicKeyToJwksEntry(
  publicKey: Uint8Array,
  meta: {
    kid: string;
    role?: "platform-witness" | "author";
    notBefore?: Date | null;
    notAfter?: Date | null;
  },
): JwksEntry {
  if (publicKey.length !== 32) {
    throw new Error(`publicKeyToJwksEntry: expected 32 bytes, got ${publicKey.length}`);
  }
  return {
    kid: meta.kid,
    kty: "OKP",
    crv: "Ed25519",
    x: toBase64Url(publicKey),
    use: "sig",
    alg: "EdDSA",
    "iso:notBefore": meta.notBefore ? meta.notBefore.toISOString() : null,
    "iso:notAfter": meta.notAfter ? meta.notAfter.toISOString() : null,
    "iso:role": meta.role ?? "author",
  };
}

/**
 * Generate an Ed25519 keypair suitable for use with `signAttestation`.
 * The returned `secretKey` is the 32-byte seed (NOT the 64-byte nacl
 * concatenation); callers that want to round-trip through nacl should use
 * `nacl.sign.keyPair.fromSeed(seed)`.
 */
export function generateKeyHandle(keyId: string): KeyHandle {
  const kp = nacl.sign.keyPair();
  // tweetnacl's secretKey is 64 bytes (seed || publicKey). Persist only
  // the 32-byte seed, which is the canonical Ed25519 private key form.
  return {
    keyId,
    secretKey: kp.secretKey.slice(0, 32),
    publicKey: kp.publicKey,
    alg: "Ed25519",
  };
}

// Re-exports for convenience in callers that don't want to import from `crypto`.
export { sha256Hex, toBase64, fromBase64, toBase64Url, fromBase64Url };
