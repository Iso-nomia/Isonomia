// tests/complexity/q044-schreier-sims.test.ts
//
// Q-044 audit 4 corroboration — the Schreier–Sims fast path for the H¹-rank
// holonomy-group order.
//
// See:
//   lib/complexity/schreier-sims.ts
//   RESEARCH_PROGRAMME/audits/q044-h1rank-schreier-sims-2026-07-05.md
//   scripts/plexus-topology-probe.ts  (computeH1RankBasis — the drop-in target)
//
// Validates the prototype three ways:
//   (KNOWN)    exact order on groups with known |G| — cyclic Cₙ, elementary
//              abelian (Z/2)ᵏ, symmetric Sₙ = n!;
//   (E.A.2)    the generator-level elementary-abelian-2 test is correct;
//   (AGREES)   agrees with a naive orbit-closure on small groups (|G| ≤ cap);
//   (COST)     a FAITHFUL replica of the shipped closure (caps BFS *rounds*, like
//              `guard++ < 1000`, NOT element count) computes S₇ = 5040 CORRECTLY
//              but materialises all |G| elements — the real Θ(|G|²) defect — while
//              Schreier–Sims returns 5040 exact without enumeration.
//              (Corrected per cross-check D1: the shipped `guard` caps rounds, not
//              elements, so it does NOT silently truncate S₇ to a wrong order.)

import { describe, it, expect } from "@jest/globals";

import {
  type Perm,
  groupOrder,
  isElementaryAbelian2,
  holonomyGroupRank,
  groundSet,
  buildBSGS,
  contains,
} from "@/lib/complexity/schreier-sims";

// ---------------------------------------------------------------------------
// Permutation constructors over points p0..p{d-1}
// ---------------------------------------------------------------------------

const P = (i: number) => `p${i}`;
const pts = (d: number) => Array.from({ length: d }, (_, i) => P(i));

/** The n-cycle (p0 p1 … p_{n-1}). */
function nCycle(n: number): Perm {
  const g: Perm = new Map();
  for (let i = 0; i < n; i++) g.set(P(i), P((i + 1) % n));
  return g;
}

/** The transposition (p_i p_j). */
function transposition(i: number, j: number, d: number): Perm {
  const g: Perm = new Map(pts(d).map((p) => [p, p] as const));
  g.set(P(i), P(j));
  g.set(P(j), P(i));
  return g;
}

/** k commuting involutions on disjoint pairs (p_{2t}, p_{2t+1}) ⇒ (Z/2)^k. */
function ea2Generators(k: number): Perm[] {
  const d = 2 * k;
  return Array.from({ length: k }, (_, t) => transposition(2 * t, 2 * t + 1, d));
}

// ---------------------------------------------------------------------------
// Reference naive orbit-closure (the probe's algorithm, with an explicit cap)
// ---------------------------------------------------------------------------

const permKey = (g: Perm, ps: string[]) => ps.map((x) => g.get(x) ?? x).join(",");
function composeT(g: Perm, f: Perm, ps: string[]): Perm {
  return new Map(ps.map((x) => [x, g.get(f.get(x) ?? x) ?? f.get(x) ?? x] as const));
}

/** Naive closure to |G|, capped by ELEMENT count (a strawman for the shipped code — kept only for the small-group AGREES check where no cap bites). */
function naiveOrder(gens: Perm[], ps: string[], cap: number): { order: number; truncated: boolean } {
  const id: Perm = new Map(ps.map((p) => [p, p] as const));
  const elems = new Map<string, Perm>([[permKey(id, ps), id]]);
  for (const g of gens) elems.set(permKey(g, ps), g);
  let changed = true;
  let truncated = false;
  while (changed) {
    changed = false;
    for (const e of [...elems.values()]) {
      for (const g of gens) {
        const gh = composeT(e, g, ps);
        const k = permKey(gh, ps);
        if (!elems.has(k)) {
          if (elems.size >= cap) { truncated = true; break; }
          elems.set(k, gh);
          changed = true;
        }
      }
      if (truncated) break;
    }
    if (truncated) break;
  }
  return { order: elems.size, truncated };
}

/**
 * FAITHFUL replica of the shipped `computeH1RankBasis` closure: caps the number
 * of BFS ROUNDS (`while (changed && guard++ < roundCap)`), NOT the element count.
 * Materialises every element (the Θ(|G|²) cost). `roundTruncated` is true only if
 * the loop was still discovering elements when the round cap hit (Cayley diameter
 * > roundCap) — the rare silent-truncation regime.
 */
function naiveRoundCapped(
  gens: Perm[], ps: string[], roundCap: number
): { order: number; rounds: number; roundTruncated: boolean; materialised: number } {
  const id: Perm = new Map(ps.map((p) => [p, p] as const));
  const elems = new Map<string, Perm>([[permKey(id, ps), id]]);
  for (const g of gens) elems.set(permKey(g, ps), g);
  let changed = true;
  let rounds = 0;
  while (changed && rounds < roundCap) {
    changed = false;
    rounds++;
    for (const e of [...elems.values()]) {
      for (const g of gens) {
        const gh = composeT(e, g, ps);
        const k = permKey(gh, ps);
        if (!elems.has(k)) { elems.set(k, gh); changed = true; }
      }
    }
  }
  return { order: elems.size, rounds, roundTruncated: changed, materialised: elems.size };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));

describe("Q-044 — Schreier–Sims holonomy-group order (fast path)", () => {
  it("(KNOWN) cyclic Cₙ order = n", () => {
    for (let n = 1; n <= 12; n++) {
      expect(groupOrder([nCycle(n)], pts(n))).toBe(BigInt(n));
    }
  });

  it("(KNOWN) elementary abelian (Z/2)ᵏ order = 2ᵏ", () => {
    for (let k = 1; k <= 8; k++) {
      const gens = ea2Generators(k);
      const ps = pts(2 * k);
      expect(groupOrder(gens, ps)).toBe(2n ** BigInt(k));
      expect(isElementaryAbelian2(gens, ps)).toBe(true);
    }
  });

  it("(KNOWN) symmetric Sₙ = n! (n-cycle + a transposition)", () => {
    for (let n = 2; n <= 7; n++) {
      const gens = [nCycle(n), transposition(0, 1, n)];
      expect(groupOrder(gens, pts(n))).toBe(factorial(n));
    }
  });

  it("(E.A.2) detects non-elementary-abelian-2 groups", () => {
    // S₃ from two overlapping transpositions — involutions that do NOT commute.
    const s3 = [transposition(0, 1, 3), transposition(1, 2, 3)];
    expect(isElementaryAbelian2(s3, pts(3))).toBe(false);
    expect(groupOrder(s3, pts(3))).toBe(6n);

    // A single transposition — an involution, trivially e.a.2, order 2.
    expect(isElementaryAbelian2([transposition(0, 1, 2)], pts(2))).toBe(true);

    // A 3-cycle — order 3, not exponent 2.
    expect(isElementaryAbelian2([nCycle(3)], pts(3))).toBe(false);
  });

  it("(AGREES) matches the naive orbit-closure on small groups", () => {
    const cases: Array<{ gens: Perm[]; d: number }> = [
      { gens: [nCycle(5)], d: 5 },
      { gens: ea2Generators(3), d: 6 },
      { gens: [nCycle(4), transposition(0, 1, 4)], d: 4 }, // S₄ = 24
      { gens: [transposition(0, 1, 4), transposition(2, 3, 4)], d: 4 }, // (Z/2)² = 4
      { gens: [nCycle(6)], d: 6 },
    ];
    for (const { gens, d } of cases) {
      const ps = pts(d);
      const naive = naiveOrder(gens, ps, 100_000);
      expect(naive.truncated).toBe(false);
      expect(groupOrder(gens, ps)).toBe(BigInt(naive.order));
    }
  });

  it("(COST) shipped-faithful round-capped closure computes S₇=5040 correctly but materialises |G|; Schreier–Sims exact without enumeration", () => {
    const gens = [nCycle(7), transposition(0, 1, 7)];
    const ps = pts(7);
    // Faithful replica of the shipped `guard++ < 1000` (caps ROUNDS, not elements).
    const r = naiveRoundCapped(gens, ps, 1000);
    // Corrected per cross-check D1: the round cap does NOT bite on S₇ (Cayley
    // diameter ≪ 1000), so the shipped closure returns the CORRECT order — not a
    // silent truncation. The defect is COST, not soundness.
    expect(r.roundTruncated).toBe(false);
    expect(r.rounds).toBeLessThan(1000);
    expect(r.order).toBe(5040);
    // ... but it materialises ALL |G| = 5040 elements (the Θ(|G|²) blow-up),
    expect(r.materialised).toBe(5040);
    // ... whereas Schreier–Sims returns the exact order without enumerating G.
    expect(groupOrder(gens, ps)).toBe(5040n);
  });

  it("(SIFT) buildBSGS gives a membership test; strong-gen count stays polynomial", () => {
    // A₃ = ⟨(0 1 2)⟩ (order 3, a proper subgroup of Sym(3)): membership discriminates.
    const a3 = buildBSGS([nCycle(3)], pts(3));
    expect(a3.order).toBe(3n);
    expect(contains(nCycle(3), a3)).toBe(true); // generator
    expect(contains(new Map([["p0", "p0"], ["p1", "p1"], ["p2", "p2"]]), a3)).toBe(true); // identity
    // the square of the 3-cycle (0 2 1) is in A₃; a transposition is NOT.
    const sq = new Map([["p0", "p2"], ["p1", "p0"], ["p2", "p1"]]);
    expect(contains(sq, a3)).toBe(true);
    expect(contains(transposition(0, 1, 3), a3)).toBe(false); // odd permutation ∉ A₃

    // (POLY) sifting keeps the strong-generator count polynomial (≤ d²) even for
    // Sₙ, where |G| = n! is exponential — the D2 gap is closed in the routine.
    for (let n = 3; n <= 7; n++) {
      const bsgs = buildBSGS([nCycle(n), transposition(0, 1, n)], pts(n));
      expect(bsgs.order).toBe(factorial(n));
      expect(bsgs.base.length).toBeLessThanOrEqual(n); // base ≤ degree
      expect(bsgs.strongGens.length).toBeLessThanOrEqual(n * n); // polynomial, not n!
    }
  });

  it("(RANK) holonomyGroupRank mirrors the probe output on partial holonomies", () => {
    // Two commuting involutions given as PARTIAL maps (unmapped ⇒ fixed):
    // (Z/2)² ⇒ order 4, e.a.2, rank 2.
    const h1 = new Map([["a", "b"], ["b", "a"]]);
    const h2 = new Map([["c", "d"], ["d", "c"]]);
    const r = holonomyGroupRank([h1, h2]);
    expect(r.groupOrder).toBe(4n);
    expect(r.elementaryAbelian2).toBe(true);
    expect(r.rank).toBe(2);

    // One involution (the binary p/q monodromy) ⇒ Z/2, rank 1 (the synthetic
    // contextuality-cell shape from T011).
    const single = holonomyGroupRank([new Map([["p", "q"], ["q", "p"]])]);
    expect(single.groupOrder).toBe(2n);
    expect(single.rank).toBe(1);

    // No monodromy ⇒ trivial group, rank 0 (the live-data H¹ = 0 shape).
    const triv = holonomyGroupRank([new Map([["p", "p"]])]);
    expect(triv.groupOrder).toBe(1n);
    expect(triv.rank).toBe(0);
    expect(groundSet([new Map([["p", "p"]])])).toEqual(["p"]);
  });
});
