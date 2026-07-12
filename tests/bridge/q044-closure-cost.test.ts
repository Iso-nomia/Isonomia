// tests/bridge/q044-closure-cost.test.ts
//
// Q-044 audit 2 corroboration — the `CLOSURE` (biorthogonal closure) bound.
//
// See:
//   RESEARCH_PROGRAMME/audits/q044-closure-upper-bound-2026-07-05.md   (the bound)
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/22-q044-complexity-primitives-scoping-2026-07-05.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-044, Q-050
//
// `orthogonalSet` / `biorthogonalClosure` take the orthogonality oracle as a
// PARAMETER, so the audit's `O(|U|²)`-tests bound is testable DB-free with a
// hand-built oracle over a synthetic universe (no prisma, no stepInteraction).
//
// This test asserts three predictions of audit 2 §2 over randomised symmetric
// orthogonality relations:
//   (CORRECT)  biorthogonalClosure(G,U) equals the brute-force reference clo_U(G);
//   (RAW)      raw oracle calls ≤ |U|·|G| + |U|²  (the naive loop bound, §2.1);
//   (DISTINCT) with a memo mirroring makeCanonicalOracle, distinct unordered-pair
//              evaluations ≤ |U|·(|U|+1)/2  (the memo-tightened count, §2.2).
//
// The universe-completeness gate (audit 2 §3 / Q-050) is a *definability* claim,
// not a count, and is deliberately out of scope here.

import { describe, it, expect } from "@jest/globals";

import {
  orthogonalSet,
  biorthogonalClosure,
  type Orthogonality,
  type OrthogonalityOracle,
} from "packages/ludics-engine/behaviourClosure";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) for reproducible randomised trials
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// A synthetic symmetric orthogonality relation over a labelled universe
// ---------------------------------------------------------------------------

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Build a symmetric relation `isOrth(a,b)` from a random density over U². */
function makeRelation(U: string[], rng: () => number, density: number) {
  const orth = new Set<string>();
  for (let i = 0; i < U.length; i++) {
    for (let j = i; j < U.length; j++) {
      if (rng() < density) orth.add(pairKey(U[i], U[j]));
    }
  }
  return (a: string, b: string): boolean => orth.has(pairKey(a, b));
}

/** Reference clo_U(G) = ((G⊥∩U)⊥∩U) ∪ (G∩U), in U order — the spec of §1. */
function referenceClosure(
  U: string[],
  G: string[],
  isOrth: (a: string, b: string) => boolean
): { closure: string[]; orthLen: number } {
  const orth = U.filter((c) => G.every((g) => isOrth(c, g)));
  const biorth = U.filter((d) => orth.every((c) => isOrth(d, c)));
  const inClosure = new Set(biorth);
  const inU = new Set(U);
  for (const g of G) if (inU.has(g)) inClosure.add(g);
  return { closure: U.filter((d) => inClosure.has(d)), orthLen: orth.length };
}

// ---------------------------------------------------------------------------
// Oracles: a raw counter and a memoising counter (mirrors makeCanonicalOracle)
// ---------------------------------------------------------------------------

function rawCountingOracle(
  isOrth: (a: string, b: string) => boolean,
  stats: { raw: number }
): OrthogonalityOracle {
  return async (a, b) => {
    stats.raw++;
    return (isOrth(a, b) ? "orthogonal" : "non-orthogonal") as Orthogonality;
  };
}

function memoCountingOracle(
  isOrth: (a: string, b: string) => boolean,
  stats: { distinct: number }
): OrthogonalityOracle {
  const cache = new Map<string, Orthogonality>();
  return async (a, b) => {
    const key = pairKey(a, b);
    const hit = cache.get(key);
    if (hit) return hit;
    stats.distinct++;
    const v = (isOrth(a, b) ? "orthogonal" : "non-orthogonal") as Orthogonality;
    cache.set(key, v);
    return v;
  };
}

// ---------------------------------------------------------------------------
// The corroboration
// ---------------------------------------------------------------------------

describe("Q-044 — CLOSURE cost: correctness + O(|U|²)-tests bound (randomised)", () => {
  it("biorthogonalClosure = brute-force reference, under the raw and memo call bounds", async () => {
    const rng = mulberry32(0x51a4);
    let trials = 0;
    let maxRawOverU2 = 0;
    let maxDistinctOverU2 = 0;

    for (const sizeU of [3, 4, 5, 6]) {
      const U = Array.from({ length: sizeU }, (_, i) => `d${i}`);
      for (let rep = 0; rep < 40; rep++) {
        const density = 0.2 + 0.6 * rng();
        const isOrth = makeRelation(U, rng, density);

        // random non-empty G ⊆ U
        const G = U.filter(() => rng() < 0.5);
        if (G.length === 0) G.push(U[Math.floor(rng() * U.length)]);

        const { closure: ref, orthLen } = referenceClosure(U, G, isOrth);

        // (CORRECT)
        const rawStats = { raw: 0 };
        const got = await biorthogonalClosure(G, U, rawCountingOracle(isOrth, rawStats));
        expect(got).toEqual(ref);

        // (RAW) — naive loop bound |U|·|G| + |U|·|orth| ≤ |U|·|G| + |U|²
        expect(rawStats.raw).toBeLessThanOrEqual(U.length * G.length + U.length * orthLen);
        expect(rawStats.raw).toBeLessThanOrEqual(U.length * G.length + U.length * U.length);

        // (DISTINCT) — memo caps distinct unordered-pair tests at |U|·(|U|+1)/2
        const memoStats = { distinct: 0 };
        const got2 = await biorthogonalClosure(G, U, memoCountingOracle(isOrth, memoStats));
        expect(got2).toEqual(ref);
        expect(memoStats.distinct).toBeLessThanOrEqual((U.length * (U.length + 1)) / 2);

        maxRawOverU2 = Math.max(maxRawOverU2, rawStats.raw / (U.length * U.length));
        maxDistinctOverU2 = Math.max(maxDistinctOverU2, memoStats.distinct / (U.length * U.length));
        trials++;
      }
    }

    expect(trials).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      `[Q-044 CLOSURE cost] trials=${trials} ` +
        `max(raw/|U|²)=${maxRawOverU2.toFixed(3)} max(distinct/|U|²)=${maxDistinctOverU2.toFixed(3)}`
    );
  });

  it("orthogonalSet is antitone-consistent: G ⊆ H ⇒ H⊥∩U ⊆ G⊥∩U (the §3 error direction)", async () => {
    const rng = mulberry32(0x0b1d);
    for (let rep = 0; rep < 60; rep++) {
      const U = Array.from({ length: 5 }, (_, i) => `d${i}`);
      const isOrth = makeRelation(U, rng, 0.2 + 0.6 * rng());
      const G = U.filter(() => rng() < 0.5);
      const H = Array.from(new Set([...G, ...U.filter(() => rng() < 0.5)]));
      if (G.length === 0 || H.length === 0) continue;

      const orthG = new Set(await orthogonalSet(G, U, rawCountingOracle(isOrth, { raw: 0 })));
      const orthH = await orthogonalSet(H, U, rawCountingOracle(isOrth, { raw: 0 }));
      // G ⊆ H ⇒ H⊥ ⊆ G⊥ (antitone) — the monotonicity underpinning "clo_U over-approximates".
      for (const x of orthH) expect(orthG.has(x)).toBe(true);
    }
  });
});
