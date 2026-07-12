/**
 * Spec 4 §4.3 — pin the behaviour fingerprint.
 *
 * The fingerprint is a pure function; same input ⇒ same output across runs.
 * One pinned digest below is the canonical fixture; if you change the
 * fingerprint domain (Q-020-style widening), update the pin deliberately.
 */

import {
  computeBehaviourFingerprint,
  computeFingerprintDigest,
} from "@/lib/schemes/verifier/computeFingerprint";

type Cq = {
  cqKey: string | null;
  attackType: string | null;
  targetScope: string | null;
};

const FIXTURE = {
  premises: [
    { id: "P1", type: "major", text: "E is an expert in domain D", variables: ["E", "D"] },
    { id: "P2", type: "minor", text: "E asserts A", variables: ["E", "A"] },
  ],
  conclusion: { text: "A is true", variables: ["A"] },
  epistemicMode: "FACTUAL",
  cqs: [
    { cqKey: "CQ1", attackType: "UNDERMINES", targetScope: "premise" },
    { cqKey: "CQ2", attackType: "UNDERCUTS", targetScope: "inference" },
    { cqKey: "CQ3", attackType: "REBUTS", targetScope: "conclusion" },
  ] satisfies Cq[],
};

// Pinned digest. Computed by running computeBehaviourFingerprint(FIXTURE)
// at the spec landing moment. Change deliberately if the domain widens.
const PINNED_FIXTURE_FINGERPRINT =
  "7a3d73b65836d71353764a76ba17aa19a97e197f43f27946347eccd6c07374cc";

describe("computeBehaviourFingerprint", () => {
  it("is a pure function (same input ⇒ same output across runs)", () => {
    const a = computeBehaviourFingerprint(FIXTURE);
    const b = computeBehaviourFingerprint(FIXTURE);
    expect(a).toBe(b);
  });

  it("is insensitive to CQ ordering (CQs sorted by cqKey)", () => {
    const reversed = { ...FIXTURE, cqs: [...FIXTURE.cqs].reverse() };
    expect(computeBehaviourFingerprint(reversed)).toBe(
      computeBehaviourFingerprint(FIXTURE),
    );
  });

  it("changes when epistemicMode changes (Q-020 widening, 2026-05-28)", () => {
    const hypothetical = { ...FIXTURE, epistemicMode: "HYPOTHETICAL" };
    expect(computeBehaviourFingerprint(hypothetical)).not.toBe(
      computeBehaviourFingerprint(FIXTURE),
    );
  });

  it("changes when an attackType differs", () => {
    const flipped = {
      ...FIXTURE,
      cqs: FIXTURE.cqs.map((c, i) =>
        i === 0 ? { ...c, attackType: "REBUTS" } : c,
      ),
    };
    expect(computeBehaviourFingerprint(flipped)).not.toBe(
      computeBehaviourFingerprint(FIXTURE),
    );
  });

  it("is invariant under non-domain field changes (display name, tags)", () => {
    const enriched = { ...FIXTURE, name: "Argument from Expert Opinion", tags: ["authority"] };
    expect(computeBehaviourFingerprint(enriched as any)).toBe(
      computeBehaviourFingerprint(FIXTURE),
    );
  });

  it("matches the pinned digest for the canonical fixture", () => {
    const actual = computeBehaviourFingerprint(FIXTURE);
    if (actual !== PINNED_FIXTURE_FINGERPRINT) {
      // Surface the new value so the test author can decide whether the
      // fingerprint domain change was intentional.
      console.log("[fingerprint pin] new value:", actual);
    }
    expect(actual).toBe(PINNED_FIXTURE_FINGERPRINT);
  });

  it("computeFingerprintDigest returns the expected canonical shape", () => {
    const d = computeFingerprintDigest(FIXTURE);
    expect(d.v).toBe(1);
    expect(d.epistemicMode).toBe("FACTUAL");
    expect(d.premiseArity.count).toBe(2);
    expect(d.premiseArity.variables).toEqual(["A", "D", "E"]); // sorted
    expect(d.conclusionArity).toBe(1);
    expect(d.cqs.map((c) => c.cqKey)).toEqual(["CQ1", "CQ2", "CQ3"]); // sorted
  });
});
