/**
 * Revocation surface — pure signing/verification (Track AI-EPI Pt. 5 §3, Item 3).
 *
 * Prisma-free and Next-free, like `signedAttestation.ts`: the impure routes
 * (`/.well-known/revoked-attestations`, the revoke POST) call these helpers with
 * rows they've read/written. Keeping the crypto pure makes it unit-testable
 * without a database and keeps it eligible for a future `provenance-core`.
 *
 * Model (why signatures aren't "invalidated" on revocation): an Ed25519
 * signature over a content-pinned envelope stays cryptographically valid
 * forever — that's the point. Revocation is a *separately verifiable status*
 * layered on top: (a) a witness-signed row asserting "(shortCode, contentHash)
 * was revoked at T for reason R", published in the append-only well-known list,
 * and (b) a witness-signed root over the whole list so a verifier can confirm
 * the list itself wasn't tampered. A verifier that trusts a signed envelope then
 * additionally checks the revocation list before presenting it as current.
 */

import {
  signAttestation,
  verifyAttestation,
  sha256Hex,
  type KeyHandle,
  type Jwks,
  type SignatureBlock,
} from "@/server/trust/attestationSigner";

export interface RevocationRecord {
  shortCode: string;
  contentHash: string;
  /** "author-retraction" | "abuse-takedown" | "key-rotation" | "superseded" */
  reason: string;
  /** ISO timestamp; also used as the deterministic `signedAt` for the row sig. */
  revokedAt: string;
}

/** Fields covered by a per-row witness signature (pinned & sorted by the signer). */
const ROW_SIGNED_FIELDS: readonly string[] = [
  "shortCode",
  "contentHash",
  "reason",
  "revokedAt",
];

/**
 * Witness-sign a single revocation record. Deterministic: `signedAt` is pinned
 * to `revokedAt`, so re-signing the same record yields identical bytes. Returns
 * the `SignatureBlock`; callers persist `signature.sig` (and can reconstruct the
 * rest from the record + the platform key).
 */
export function signRevocationRecord(rec: RevocationRecord, key: KeyHandle): SignatureBlock {
  const signed = signAttestation({ ...rec } as Record<string, unknown>, key, {
    signedFields: ROW_SIGNED_FIELDS,
    signedAt: rec.revokedAt,
  });
  return signed.signature;
}

/** Verify a per-row witness signature against the issuer JWKS. */
export function verifyRevocationRecord(
  rec: RevocationRecord,
  signature: SignatureBlock,
  jwks: Jwks,
) {
  return verifyAttestation(
    { ...rec, signature } as RevocationRecord & { signature: SignatureBlock },
    jwks,
  );
}

/**
 * The append-only list body: one line per record,
 * `"{shortCode}@{contentHash} {reason} {revokedAt}"`, sorted by
 * `(revokedAt, shortCode, contentHash)` for a stable, reproducible serialization.
 * Trailing newline when non-empty.
 */
export function revocationListBody(records: RevocationRecord[]): string {
  const lines = [...records]
    .sort(
      (a, b) =>
        a.revokedAt.localeCompare(b.revokedAt) ||
        a.shortCode.localeCompare(b.shortCode) ||
        a.contentHash.localeCompare(b.contentHash),
    )
    .map((r) => `${r.shortCode}@${r.contentHash} ${r.reason} ${r.revokedAt}`);
  return lines.length ? lines.join("\n") + "\n" : "";
}

/**
 * Witness-sign the whole list body (over its SHA-256). Returns both the
 * `SignatureBlock` and the `# root sig: <sig> kid:<keyId>` line to append to the
 * served body. `signedAt` should be a stable value derived from the list (e.g.
 * the latest `revokedAt`) so identical lists produce identical roots.
 */
export function signRevocationRoot(
  body: string,
  key: KeyHandle,
  signedAt: string,
): { rootLine: string; signature: SignatureBlock } {
  const bodyHash = sha256Hex(new TextEncoder().encode(body));
  const signed = signAttestation({ bodyHash } as Record<string, unknown>, key, {
    signedFields: ["bodyHash"],
    signedAt,
  });
  return {
    rootLine: `# root sig: ${signed.signature.sig} kid:${signed.signature.keyId}`,
    signature: signed.signature,
  };
}

/** Verify a list-body root signature. */
export function verifyRevocationRoot(
  body: string,
  signature: SignatureBlock,
  jwks: Jwks,
) {
  const bodyHash = sha256Hex(new TextEncoder().encode(body));
  return verifyAttestation(
    { bodyHash, signature } as { bodyHash: string; signature: SignatureBlock },
    jwks,
  );
}
