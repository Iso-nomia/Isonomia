/**
 * Signed attestation envelope — the pure signing half of Track AI-EPI Pt. 5 §1.
 *
 * This module is deliberately **Prisma-free and Next-free**: it takes an
 * already-built attestation summary (a plain JSON object) plus a `KeyHandle`
 * and returns the signed envelope. Key custody / DB access lives in the impure
 * caller (`buildSignedAttestationEnvelope` in `argumentAttestation.ts`). Keeping
 * this half pure makes it unit-testable without a database and is the first
 * brick of a future standalone `provenance-core` (see the boundary brainstorm in
 * `RESEARCH_PROGRAMME/provenance-research/`).
 *
 * Field pinning (why `signedFields` is explicit, not "cover all keys"):
 * the served attestation summary carries a volatile `retrievedAt = now()`
 * (a fetch-time artifact, not attested content). Covering it would make every
 * signature non-deterministic. So the signature covers the content-bearing
 * fields — including `dialecticalStatus` and `criticalQuestions`, so that
 * tampering with a card's *shown standing* breaks verification — and excludes
 * `retrievedAt`.
 */

import {
  signAttestation,
  type KeyHandle,
  type SignatureBlock,
} from "@/server/trust/attestationSigner";

/**
 * Top-level attestation-summary keys covered by the v1 signature. Pinned and
 * versioned with the attestation `version`; append-only. `retrievedAt` and
 * `canonicalPayload` are intentionally absent (volatile / not served in the
 * summary respectively).
 */
export const SIGNED_ATTESTATION_FIELDS_V1: readonly string[] = [
  "identifier",
  "argumentId",
  "permalink",
  "version",
  "contentHash",
  "immutablePermalink",
  "isoId",
  "isoUrl",
  "doi",
  "createdAt",
  "updatedAt",
  "conclusion",
  "premises",
  "scheme",
  "evidence",
  "structuredCitations",
  "criticalQuestions",
  "schemeInstance",
  "confidence",
  "dialecticalStatus",
  "deliberation",
  "author",
] as const;

export type SignedAttestationEnvelope = Record<string, unknown> & {
  signature: SignatureBlock;
};

/**
 * Sign an attestation summary with the given key, covering exactly
 * {@link SIGNED_ATTESTATION_FIELDS_V1}. Pure: no I/O, does not mutate `summary`.
 * The `signature.signedFields` recorded on the envelope is this allowlist, so a
 * verifier reconstructs the same JCS subset regardless of which non-covered
 * fields (e.g. `retrievedAt`) travel alongside.
 */
export function signSummaryEnvelope(
  summary: Record<string, unknown>,
  key: KeyHandle,
): SignedAttestationEnvelope {
  return signAttestation(summary, key, {
    signedFields: SIGNED_ATTESTATION_FIELDS_V1,
  }) as SignedAttestationEnvelope;
}
