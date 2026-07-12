// tests/revocation.test.ts
//
// Pure unit tests for the revocation surface (Track AI-EPI Pt. 5 §3, Item 3).
// No Prisma / Next — exercises row + root witness signatures against
// `verifyAttestation`.

import {
  signRevocationRecord,
  verifyRevocationRecord,
  revocationListBody,
  signRevocationRoot,
  verifyRevocationRoot,
  type RevocationRecord,
} from "@/lib/citations/revocation";
import {
  generateKeyHandle,
  publicKeyToJwksEntry,
  type Jwks,
} from "@/server/trust/attestationSigner";

function jwksFor(key: ReturnType<typeof generateKeyHandle>): Jwks {
  return { keys: [publicKeyToJwksEntry(key.publicKey, { kid: key.keyId })] };
}

const REC_A: RevocationRecord = {
  shortCode: "abc123",
  contentHash: "sha256:" + "a".repeat(64),
  reason: "author-retraction",
  revokedAt: "2026-03-01T00:00:00.000Z",
};
const REC_B: RevocationRecord = {
  shortCode: "def456",
  contentHash: "sha256:" + "b".repeat(64),
  reason: "abuse-takedown",
  revokedAt: "2026-02-01T00:00:00.000Z",
};

describe("revocation — per-row witness signature", () => {
  test("signs and verifies a record", () => {
    const key = generateKeyHandle("pw-rev-1");
    const sig = signRevocationRecord(REC_A, key);
    expect(verifyRevocationRecord(REC_A, sig, jwksFor(key)).ok).toBe(true);
  });

  test("is deterministic (signedAt pinned to revokedAt)", () => {
    const key = generateKeyHandle("pw-rev-2");
    const s1 = signRevocationRecord(REC_A, key);
    const s2 = signRevocationRecord(REC_A, key);
    expect(s1.sig).toBe(s2.sig);
    expect(s1.signedAt).toBe(REC_A.revokedAt);
  });

  test("tampering with the reason breaks verification", () => {
    const key = generateKeyHandle("pw-rev-3");
    const sig = signRevocationRecord(REC_A, key);
    const tampered = { ...REC_A, reason: "superseded" };
    expect(verifyRevocationRecord(tampered, sig, jwksFor(key)).ok).toBe(false);
  });
});

describe("revocation — list body", () => {
  test("sorts by (revokedAt, shortCode, contentHash) and is order-independent", () => {
    const forward = revocationListBody([REC_A, REC_B]);
    const reverse = revocationListBody([REC_B, REC_A]);
    expect(forward).toBe(reverse);
    // REC_B (Feb) sorts before REC_A (Mar)
    expect(forward.indexOf("def456")).toBeLessThan(forward.indexOf("abc123"));
  });

  test("empty list is the empty string; non-empty ends with newline", () => {
    expect(revocationListBody([])).toBe("");
    expect(revocationListBody([REC_A]).endsWith("\n")).toBe(true);
  });

  test("line format is {shortCode}@{contentHash} {reason} {revokedAt}", () => {
    expect(revocationListBody([REC_A]).trim()).toBe(
      `abc123@sha256:${"a".repeat(64)} author-retraction 2026-03-01T00:00:00.000Z`,
    );
  });
});

describe("revocation — witness-signed root", () => {
  test("root signs and verifies over the list body", () => {
    const key = generateKeyHandle("pw-rev-4");
    const body = revocationListBody([REC_A, REC_B]);
    const { rootLine, signature } = signRevocationRoot(body, key, REC_A.revokedAt);
    expect(rootLine.startsWith("# root sig: ")).toBe(true);
    expect(rootLine).toContain("kid:pw-rev-4");
    expect(verifyRevocationRoot(body, signature, jwksFor(key)).ok).toBe(true);
  });

  test("mutating the body breaks the root signature", () => {
    const key = generateKeyHandle("pw-rev-5");
    const body = revocationListBody([REC_A, REC_B]);
    const { signature } = signRevocationRoot(body, key, REC_A.revokedAt);
    const tamperedBody = body + `evil@sha256:${"c".repeat(64)} abuse-takedown 2026-04-01T00:00:00.000Z\n`;
    expect(verifyRevocationRoot(tamperedBody, signature, jwksFor(key)).ok).toBe(false);
  });
});
