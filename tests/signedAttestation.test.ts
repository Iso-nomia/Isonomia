// tests/signedAttestation.test.ts
//
// Pure unit tests for the signed attestation envelope (Track AI-EPI Pt. 5 §1).
// No Prisma / Next — exercises `signSummaryEnvelope` (the pure signing half)
// against `verifyAttestation`, pinning the field-coverage decisions:
//   - the signature covers content + standing (tamper-evident cards),
//   - the volatile `retrievedAt` is NOT covered (deterministic signatures).

import {
  signSummaryEnvelope,
  SIGNED_ATTESTATION_FIELDS_V1,
} from "@/lib/citations/signedAttestation";
import {
  generateKeyHandle,
  publicKeyToJwksEntry,
  verifyAttestation,
  type Jwks,
} from "@/server/trust/attestationSigner";

/** A minimal attestation-summary-shaped object (plus the volatile retrievedAt). */
function makeSummary(): Record<string, unknown> {
  return {
    identifier: "abc123",
    argumentId: "arg_1",
    permalink: "https://isonomia.app/a/abc123",
    version: 2,
    contentHash: "sha256:" + "a".repeat(64),
    immutablePermalink: "https://isonomia.app/a/abc123@" + "a".repeat(64),
    isoId: "iso:argument:abc123",
    isoUrl: "https://isonomia.app/iso/argument/abc123",
    doi: null,
    // volatile, must NOT be covered:
    retrievedAt: new Date().toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    conclusion: { claimId: "c1", moid: "moid1", text: "Therefore X." },
    premises: [{ claimId: "p1", moid: "moidp1", text: "Because Y.", isImplicit: false }],
    scheme: { id: "s1", key: "expert-opinion", name: "Expert Opinion" },
    evidence: [],
    structuredCitations: [],
    criticalQuestions: { required: 3, answered: 1, open: 2 },
    schemeInstance: null,
    confidence: 0.7,
    dialecticalStatus: { incomingAttacks: 0, incomingSupports: 2, standingScore: 0.6, testedness: "lightly_tested" },
    deliberation: { id: "d1", title: "A room" },
    author: { id: "u1", displayName: "Ada", kind: "HUMAN", aiProvenance: null },
  };
}

function jwksFor(key: ReturnType<typeof generateKeyHandle>): Jwks {
  return { keys: [publicKeyToJwksEntry(key.publicKey, { kid: key.keyId })] };
}

describe("signedAttestation — envelope signing", () => {
  test("round-trips: signed envelope verifies against its JWKS", () => {
    const key = generateKeyHandle("pw-test-1");
    const signed = signSummaryEnvelope(makeSummary(), key);
    expect(signed.signature.alg).toBe("Ed25519");
    expect(signed.signature.keyId).toBe("pw-test-1");
    const result = verifyAttestation(signed, jwksFor(key));
    expect(result.ok).toBe(true);
  });

  test("signedFields covers contentHash + dialecticalStatus, excludes retrievedAt", () => {
    const key = generateKeyHandle("pw-test-2");
    const signed = signSummaryEnvelope(makeSummary(), key);
    expect(signed.signature.signedFields).toEqual([...SIGNED_ATTESTATION_FIELDS_V1].sort());
    expect(signed.signature.signedFields).toContain("contentHash");
    expect(signed.signature.signedFields).toContain("dialecticalStatus");
    expect(signed.signature.signedFields).not.toContain("retrievedAt");
  });

  test("tampering with a covered field (contentHash) breaks verification", () => {
    const key = generateKeyHandle("pw-test-3");
    const signed = signSummaryEnvelope(makeSummary(), key);
    const tampered = { ...signed, contentHash: "sha256:" + "b".repeat(64) };
    const result = verifyAttestation(tampered, jwksFor(key));
    expect(result.ok).toBe(false);
  });

  test("tampering with shown standing (dialecticalStatus) breaks verification — the verify-mode-A property", () => {
    const key = generateKeyHandle("pw-test-4");
    const signed = signSummaryEnvelope(makeSummary(), key);
    const boosted = {
      ...signed,
      dialecticalStatus: { incomingAttacks: 0, incomingSupports: 99, standingScore: 0.99, testedness: "well_tested" },
    };
    const result = verifyAttestation(boosted, jwksFor(key));
    expect(result.ok).toBe(false);
  });

  test("mutating the excluded retrievedAt does NOT break verification", () => {
    const key = generateKeyHandle("pw-test-5");
    const signed = signSummaryEnvelope(makeSummary(), key);
    const reFetched = { ...signed, retrievedAt: new Date(0).toISOString() };
    const result = verifyAttestation(reFetched, jwksFor(key));
    expect(result.ok).toBe(true);
  });

  test("verification fails against a different (wrong) key", () => {
    const key = generateKeyHandle("pw-test-6");
    const other = generateKeyHandle("pw-test-6"); // same kid, different keypair
    const signed = signSummaryEnvelope(makeSummary(), key);
    const result = verifyAttestation(signed, jwksFor(other));
    expect(result.ok).toBe(false);
  });
});
