/**
 * Track AI-EPI Pt. 5 §1 — attestation signer round-trip + verifier
 * tamper-detection tests.
 */

import {
  generateKeyHandle,
  signAttestation,
  verifyAttestation,
  publicKeyToJwksEntry,
  type Jwks,
} from "@/server/trust/attestationSigner";

function jwksFor(handle: ReturnType<typeof generateKeyHandle>, opts: {
  notBefore?: Date | null;
  notAfter?: Date | null;
} = {}): Jwks {
  return {
    keys: [
      publicKeyToJwksEntry(handle.publicKey, {
        kid: handle.keyId,
        notBefore: opts.notBefore ?? null,
        notAfter: opts.notAfter ?? null,
      }),
    ],
  };
}

const fixtureEnvelope = () => ({
  identifier: "Bx7kQ2mN",
  permalink: "https://isonomia.app/a/Bx7kQ2mN",
  contentHash: "sha256:abc123",
  version: 3,
  retrievedAt: "2026-05-01T12:00:00Z",
  conclusion: { claimId: "c1", text: "Phones in schools cause harm." },
});

describe("attestationSigner", () => {
  it("round-trips a signed envelope", () => {
    const key = generateKeyHandle("user:test:1");
    const jwks = jwksFor(key);
    const env = fixtureEnvelope();

    const signed = signAttestation(env, key, { signedAt: "2026-05-01T12:00:00Z" });
    expect(signed.signature.alg).toBe("Ed25519");
    expect(signed.signature.keyId).toBe("user:test:1");
    expect(signed.signature.signedFields).toContain("contentHash");

    const result = verifyAttestation(signed, jwks);
    expect(result.ok).toBe(true);
  });

  it("does not mutate the input envelope", () => {
    const key = generateKeyHandle("user:test:2");
    const env = fixtureEnvelope();
    const before = JSON.stringify(env);
    signAttestation(env, key);
    expect(JSON.stringify(env)).toBe(before);
    expect("signature" in env).toBe(false);
  });

  it("refuses to re-sign an envelope that already carries a signature", () => {
    const key = generateKeyHandle("user:test:3");
    const env = { ...fixtureEnvelope(), signature: "stale" } as unknown as Record<string, unknown>;
    expect(() => signAttestation(env, key)).toThrow(/already has a `signature`/);
  });

  it("fails verification on field mutation", () => {
    const key = generateKeyHandle("user:test:4");
    const jwks = jwksFor(key);
    const signed = signAttestation(fixtureEnvelope(), key);

    const tampered = { ...signed, contentHash: "sha256:DEADBEEF" };
    const result = verifyAttestation(tampered, jwks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/JCS hash mismatch/);
  });

  it("fails verification with a substituted public key", () => {
    const trueKey = generateKeyHandle("user:test:5");
    const otherKey = generateKeyHandle("user:test:5"); // same kid, different key material
    const signed = signAttestation(fixtureEnvelope(), trueKey);
    const result = verifyAttestation(signed, jwksFor(otherKey));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Ed25519 verification failed/);
  });

  it("fails verification when signedAt is outside the key's notBefore/notAfter window", () => {
    const key = generateKeyHandle("user:test:6");
    const signed = signAttestation(fixtureEnvelope(), key, {
      signedAt: "2026-01-01T00:00:00Z",
    });
    const jwks = jwksFor(key, {
      notBefore: new Date("2026-04-01T00:00:00Z"),
    });
    const result = verifyAttestation(signed, jwks, { clockSkewMs: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/notBefore/);
  });

  it("fails verification when keyId is unknown", () => {
    const key = generateKeyHandle("user:test:7");
    const signed = signAttestation(fixtureEnvelope(), key);
    const result = verifyAttestation(signed, { keys: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown keyId/);
  });

  it("respects an explicit signedFields allowlist", () => {
    const key = generateKeyHandle("user:test:8");
    const jwks = jwksFor(key);
    const env = fixtureEnvelope();

    const signed = signAttestation(env, key, {
      signedFields: ["identifier", "contentHash", "version"],
    });
    expect(signed.signature.signedFields).toEqual([
      "contentHash",
      "identifier",
      "version",
    ]);

    // Mutating a non-signed field does not break the signature, because
    // the verifier rebuilds JCS over the same allowlist subset.
    const mutated = { ...signed, retrievedAt: "2030-01-01T00:00:00Z" };
    const result = verifyAttestation(mutated, jwks);
    expect(result.ok).toBe(true);
  });
});
