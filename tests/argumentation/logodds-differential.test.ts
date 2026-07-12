// tests/argumentation/logodds-differential.test.ts
//
// Phase 3 of the confidence-algebra migration. A *differential* characterization
// of how the new `logodds` join differs from the legacy `product` (noisy-OR)
// join, evaluated through the real typed pipeline (`evaluateEvidentialTyped`).
//
// The point of this file is not parity — the two modes intentionally disagree.
// It pins the qualitative semantics we are flipping the default toward, so a
// future change that silently alters the delta will fail loudly.

import {
  evaluateEvidentialTyped,
  type EvidentialInputs,
} from "../../lib/argumentation/eccAdapter";

function inputsForClaim(bases: number[]): EvidentialInputs {
  return {
    claims: [{ id: "c1", text: "C" }],
    concludingArgumentByClaim: new Map(),
    localSupports: bases.map((base, i) => ({
      id: `s${i}`,
      claimId: "c1",
      argumentId: `a${i}`,
      base,
    })),
    virtualSupports: [],
    premiseEdges: [],
    derivationAssumptions: [],
    assumptionStatus: new Map(),
    legacyAssumptionsByArg: new Map(),
    defaultArgumentConfidence: 0.6,
    defaultPremiseBase: 0.6,
  };
}

const supportFor = (bases: number[], mode: "product" | "logodds") =>
  evaluateEvidentialTyped(inputsForClaim(bases), mode).support["c1"];

describe("logodds vs product — differential semantics", () => {
  it("agree exactly on a single argument (no corroboration to apply)", () => {
    for (const p of [0.1, 0.3, 0.5, 0.6, 0.75, 0.9]) {
      expect(supportFor([p], "logodds")).toBeCloseTo(supportFor([p], "product"), 4);
    }
  });

  it("p=0.5 is the log-odds identity but still raises support under noisy-OR", () => {
    // Two perfectly-neutral arguments.
    expect(supportFor([0.5, 0.5], "logodds")).toBeCloseTo(0.5, 4);
    // Noisy-OR treats 0.5 as positive evidence: 1 - 0.5*0.5 = 0.75.
    expect(supportFor([0.5, 0.5], "product")).toBeCloseTo(0.75, 4);
    expect(supportFor([0.5, 0.5], "product")).toBeGreaterThan(supportFor([0.5, 0.5], "logodds"));
  });

  it("below-neutral evidence: log-odds lowers support; noisy-OR perversely raises it", () => {
    // Two weak (p<0.5) arguments. Under log-odds these are evidence *against*
    // the claim and stack downward; under noisy-OR they only ever push up.
    const lo = supportFor([0.3, 0.3], "logodds");
    const prod = supportFor([0.3, 0.3], "product");
    expect(lo).toBeLessThan(0.3); // pushed below either input
    expect(prod).toBeGreaterThan(0.3); // noisy-OR pathology: 1 - 0.7*0.7 = 0.51
    expect(prod).toBeCloseTo(0.51, 4);
    expect(lo).toBeLessThan(prod);
  });

  it("above-neutral evidence: both rise, but log-odds is the more conservative", () => {
    const lo = supportFor([0.6, 0.6], "logodds");
    const prod = supportFor([0.6, 0.6], "product");
    expect(lo).toBeGreaterThan(0.6); // genuine stacking
    expect(lo).toBeCloseTo(0.6923, 4);
    expect(prod).toBeCloseTo(0.84, 4); // 1 - 0.4*0.4
    // Noisy-OR runs away toward 1 far faster than the lawful log-odds sum.
    expect(prod).toBeGreaterThan(lo);
  });

  it("noisy-OR saturates toward 1 with weak agreement; log-odds does not", () => {
    // Ten weakly-positive (0.55) arguments.
    const many = Array(10).fill(0.55);
    const lo = supportFor(many, "logodds");
    const prod = supportFor(many, "product");
    expect(prod).toBeGreaterThan(0.999); // 1 - 0.45^10 ≈ 0.99966
    expect(lo).toBeLessThan(prod);
    expect(lo).toBeGreaterThan(0.55); // still stacks, but stays short of certainty
    expect(lo).toBeLessThan(0.9); // ≈ 0.8815, nowhere near the noisy-OR's ~1
  });

  it("log-odds corroboration is symmetric about 0.5; noisy-OR is not", () => {
    // p and (1-p) should land symmetrically around 0.5 under log-odds.
    const hi = supportFor([0.7, 0.7], "logodds");
    const lo = supportFor([0.3, 0.3], "logodds");
    expect(hi - 0.5).toBeCloseTo(0.5 - lo, 4);
  });
});
