// tests/argumentation/logodds.test.ts
//
// Phase 1 of the confidence-algebra log-odds migration track. Property tests for
// the lawful weight-of-evidence semiring kernel `lib/argumentation/logodds.ts`:
// round-trip, identity at p=0.5, associativity/commutativity of corroboration,
// monotonicity, signed pro/con cancellation, and the ε-clamp finiteness guard.

import {
  EPS,
  NEUTRAL_WEIGHT,
  clampProb,
  weight,
  prob,
  corroborate,
  corroborateProbs,
  combineSignedProbs,
} from "../../lib/argumentation/logodds";

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

// A spread of probabilities, including the exact extremes 0 and 1.
const PS = [0, EPS, 0.01, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.99, 1 - EPS, 1];
const INNER = PS.filter((p) => p > EPS && p < 1 - EPS);

describe("logodds — weight / prob inverse pair", () => {
  it("weight(0.5) is exactly the neutral weight 0", () => {
    expect(weight(0.5)).toBe(NEUTRAL_WEIGHT);
    expect(weight(0.5)).toBe(0);
  });

  it("prob(0) is exactly 0.5", () => {
    expect(prob(0)).toBe(0.5);
  });

  it("round-trips prob(weight(p)) ≈ p on the unclamped interior", () => {
    for (const p of INNER) {
      expect(close(prob(weight(p)), p, 1e-6)).toBe(true);
    }
  });

  it("round-trips weight(prob(w)) ≈ w across a range of weights", () => {
    for (const w of [-12, -5, -1, -0.3, 0, 0.3, 1, 5, 12]) {
      expect(close(weight(prob(w)), w, 1e-6)).toBe(true);
    }
  });

  it("prob is total and bounded in (0,1) for large-magnitude weights", () => {
    for (const w of [-1000, -50, 50, 1000, Number.MAX_SAFE_INTEGER]) {
      const p = prob(w);
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("logodds — ε-clamp finiteness guard", () => {
  it("weight(0) and weight(1) are finite (clamped, not ±∞)", () => {
    expect(Number.isFinite(weight(0))).toBe(true);
    expect(Number.isFinite(weight(1))).toBe(true);
    expect(weight(0)).toBeLessThan(0);
    expect(weight(1)).toBeGreaterThan(0);
    // Symmetric about 0.
    expect(close(weight(0), -weight(1))).toBe(true);
  });

  it("clampProb pins out-of-range and NaN inputs", () => {
    expect(clampProb(-3)).toBe(EPS);
    expect(clampProb(0)).toBe(EPS);
    expect(clampProb(1)).toBe(1 - EPS);
    expect(clampProb(7)).toBe(1 - EPS);
    expect(clampProb(Number.NaN)).toBe(0.5);
    expect(clampProb(0.42)).toBe(0.42);
  });
});

describe("logodds — corroboration is a commutative monoid (addition in ℝ)", () => {
  it("identity: corroborate([]) === 0 and corroborateProbs([]) === 0.5", () => {
    expect(corroborate([])).toBe(NEUTRAL_WEIGHT);
    expect(corroborateProbs([])).toBe(0.5);
  });

  it("neutral element: a 0.5 input adds no evidence", () => {
    for (const p of INNER) {
      expect(close(corroborateProbs([p, 0.5]), p, 1e-9)).toBe(true);
    }
  });

  it("commutative: order of corroborated evidence is irrelevant", () => {
    const a = corroborateProbs([0.6, 0.7, 0.55]);
    const b = corroborateProbs([0.55, 0.6, 0.7]);
    const c = corroborateProbs([0.7, 0.55, 0.6]);
    expect(close(a, b)).toBe(true);
    expect(close(b, c)).toBe(true);
  });

  it("associative: regrouping corroborated evidence is irrelevant", () => {
    const all = corroborateProbs([0.6, 0.7, 0.8]);
    // (0.6 ⊕ 0.7) then ⊕ 0.8, via weight-space regrouping.
    const left = prob(corroborate([weight(0.6), weight(0.7)]) + weight(0.8));
    const right = prob(weight(0.6) + corroborate([weight(0.7), weight(0.8)]));
    expect(close(all, left)).toBe(true);
    expect(close(left, right)).toBe(true);
  });

  it("stacks (non-idempotent): two independent 0.6 routes exceed 0.6", () => {
    const stacked = corroborateProbs([0.6, 0.6]);
    expect(stacked).toBeGreaterThan(0.6);
    // The discriminating diagnostic from session 01: 0.6 ⊕ 0.6 = ~0.692.
    expect(close(stacked, 0.6923076923076923, 1e-9)).toBe(true);
  });
});

describe("logodds — monotonicity", () => {
  it("adding any pro evidence p>0.5 strictly increases combined confidence", () => {
    const base = corroborateProbs([0.6]);
    const more = corroborateProbs([0.6, 0.7]);
    expect(more).toBeGreaterThan(base);
  });

  it("a stronger single input yields a higher combined confidence", () => {
    expect(corroborateProbs([0.55, 0.7])).toBeGreaterThan(corroborateProbs([0.55, 0.6]));
  });
});

describe("logodds — signed pro/con combination (replaces Dempster–Shafer)", () => {
  it("equal-strength pro and con cancel to 0.5", () => {
    for (const p of INNER) {
      expect(close(combineSignedProbs([p], [p]), 0.5, 1e-9)).toBe(true);
    }
  });

  it("a con strictly lowers confidence below the pro-only result", () => {
    const proOnly = combineSignedProbs([0.7, 0.65], []);
    const withCon = combineSignedProbs([0.7, 0.65], [0.6]);
    expect(withCon).toBeLessThan(proOnly);
  });

  it("net pro dominance stays above 0.5; net con dominance below 0.5", () => {
    expect(combineSignedProbs([0.7, 0.7], [0.6])).toBeGreaterThan(0.5);
    expect(combineSignedProbs([0.6], [0.7, 0.7])).toBeLessThan(0.5);
  });

  it("pros-only signed combination equals plain corroboration", () => {
    const ps = [0.6, 0.7, 0.55];
    expect(close(combineSignedProbs(ps, []), corroborateProbs(ps), 1e-12)).toBe(true);
  });

  it("no high-conflict pathology: strong opposed evidence stays finite at 0.5", () => {
    const v = combineSignedProbs([0.999, 0.999], [0.999, 0.999]);
    expect(Number.isFinite(v)).toBe(true);
    expect(close(v, 0.5, 1e-9)).toBe(true);
  });
});
