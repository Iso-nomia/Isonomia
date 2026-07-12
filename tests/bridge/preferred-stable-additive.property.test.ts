// tests/bridge/preferred-stable-additive.property.test.ts
//
// Session 21 — Step C: the STABLE differential shakedown of the additive layer.
//
// The first measurement of the additive bridge on a NON-grounded semantics. Two
// findings, both pre-registered by session 21 §3 (stable = a "quantifier-plus-
// constraint" change, the tractable shakedown):
//
//   FINDING 1 (the grounded/stable boundary, with a witness). The grounded
//   additive interaction (`acceptableByAdditiveInteraction`, PRO-no-repeat) does
//   NOT compute stable acceptance. The 2-cycle `a ↔ b` is the witness: `{a}` is a
//   stable extension (conflict-free, attacks `b`), so `a` is credulously stable,
//   yet the grounded game rejects `a` (PRO would have to re-assert `a` to answer
//   the attack `b`, which no-repeat forbids). This is exactly why stable needs
//   the commit-set reading, not the recursive descent.
//
//   RESULT (the shakedown). Under the additive commit-set reading — the
//   `⊕`-resolution commits a set `E`, accepted iff `⟦E⟧₊⁺` is orthogonal to the
//   `&`-superposed universal opponent test (= conflict-free + all-attacking) —
//   the bridge reproduces `stableExtensions` EXACTLY, and credulous/skeptical
//   stable acceptance agree with the Dung oracle, over every AF on n ≤ 3.
//
// LHS oracle: lib/argumentation/semantics.ts `stableExtensions` (exact, the
// consolidation roadmap is fully implemented). RHS: the additive reading in
// lib/bridge/disputeAdditive.ts.
//
// Session 21:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/21-additive-layer-translation-spec-stable-first-2026-06-28.md

import { describe, it, expect } from "@jest/globals";

import {
  acceptableByAdditiveInteraction,
  stableExtensionsByAdditive,
  credulouslyStableByAdditive,
  skepticallyStableByAdditive,
  isAdmissibleByAdditive,
  preferredExtensionsByAdditive,
  credulouslyPreferredByAdditive,
  skepticallyPreferredByAdditive,
  type AF,
  type ArgId,
  type Attack,
} from "@/lib/bridge";

import { stableExtensions, preferredExtensions } from "@/lib/argumentation/semantics";
import { toDefeatGraphFromEdgeList } from "@/lib/argumentation/labelling";

// ---------------------------------------------------------------------------
// AF family + oracle adapters
// ---------------------------------------------------------------------------

function* allAFs(n: number): Generator<AF> {
  const args = Array.from({ length: n }, (_, i) => `a${i}`);
  const edges: Attack[] = [];
  for (const from of args) for (const to of args) edges.push([from, to]);
  const m = edges.length;
  for (let mask = 0; mask < 1 << m; mask++) {
    const attacks: Attack[] = [];
    for (let b = 0; b < m; b++) if (mask & (1 << b)) attacks.push(edges[b]);
    yield { args, attacks };
  }
}

/** Canonical key for a set of args (order-independent), for set-of-sets equality. */
const setKey = (s: Set<ArgId>): string => [...s].sort().join(",");
const extKey = (exts: Set<ArgId>[]): string => exts.map(setKey).sort().join("|");

/** The Dung oracle's stable extensions for a bridge AF. */
function oracleStable(af: AF): Set<ArgId>[] {
  const dg = toDefeatGraphFromEdgeList(af.args, af.attacks);
  return stableExtensions(dg);
}

/** The Dung oracle's preferred extensions for a bridge AF. */
function oraclePreferred(af: AF): Set<ArgId>[] {
  const dg = toDefeatGraphFromEdgeList(af.args, af.attacks);
  return preferredExtensions(dg);
}

// Oracle credulous/skeptical with the SAME empty-stable convention as the bridge
// (nothing is stably justified when no stable extension exists).
function oracleCredulous(af: AF, a: ArgId): boolean {
  return oracleStable(af).some((E) => E.has(a));
}
function oracleSkeptical(af: AF, a: ArgId): boolean {
  const S = oracleStable(af);
  return S.length > 0 && S.every((E) => E.has(a));
}

// ---------------------------------------------------------------------------
// Finding 1 — the grounded additive game does NOT compute stable
// ---------------------------------------------------------------------------

describe("Step C finding — grounded additive interaction ≠ stable (2-cycle witness)", () => {
  const twoCycle: AF = { args: ["a", "b"], attacks: [["a", "b"], ["b", "a"]] };

  it("`{a}` is a stable extension, so `a` is credulously stable", () => {
    expect(oracleStable(twoCycle).map(setKey).sort()).toEqual(["a", "b"]);
    expect(credulouslyStableByAdditive(twoCycle, "a")).toBe(true);
  });

  it("but the grounded additive game (PRO-no-repeat) rejects `a`", () => {
    // grounded({a↔b}) is empty — PRO cannot re-assert `a` to defend it.
    expect(acceptableByAdditiveInteraction(twoCycle, "a").accepted).toBe(false);
  });

  it("`a` is NOT skeptically stable (`{b}` excludes it)", () => {
    expect(skepticallyStableByAdditive(twoCycle, "a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Result — the additive commit-set reading reproduces stable, exhaustively
// ---------------------------------------------------------------------------

describe("Step C shakedown — additive commit-set reading ⟺ stable, every AF n ≤ 3", () => {
  for (const n of [1, 2, 3]) {
    it(`stable extensions + credulous/skeptical agree (${n} arg)`, () => {
      let afCount = 0;
      let withStable = 0;
      let withoutStable = 0;
      let multiStable = 0;

      for (const af of allAFs(n)) {
        afCount++;

        // (a) the additive stable extensions equal the Dung oracle's, as SETS.
        const bridge = stableExtensionsByAdditive(af);
        const oracle = oracleStable(af);
        expect(extKey(bridge)).toBe(extKey(oracle));

        if (oracle.length === 0) withoutStable++;
        else withStable++;
        if (oracle.length >= 2) multiStable++;

        // (b) credulous + skeptical membership agree, per argument.
        for (const a of af.args) {
          expect(credulouslyStableByAdditive(af, a)).toBe(oracleCredulous(af, a));
          expect(skepticallyStableByAdditive(af, a)).toBe(oracleSkeptical(af, a));
        }
      }

      expect(afCount).toBeGreaterThan(0);
      // Non-vacuity: the family exercises both stable-existing and stable-free AFs…
      expect(withStable).toBeGreaterThan(0);
      if (n >= 1) expect(withoutStable).toBeGreaterThan(0); // self-attackers ⇒ no stable
      if (n >= 2) expect(multiStable).toBeGreaterThan(0); // ≥2 stable extensions occur
    });
  }
});

// ---------------------------------------------------------------------------
// Step D finding — maximality is the obstruction (no interactive counterpart)
// ---------------------------------------------------------------------------

describe("Step D finding — admissibility is interactive, maximality is a constraint", () => {
  // a ↔ b plus c (unrelated): admissible sets {}, {a}, {b}, {c}, {a,c}, {b,c}.
  // Preferred = the ⊆-maximal ones: {a,c}, {b,c}. `∅` and singletons are
  // admissible (interactively defended) but NOT preferred — only the global
  // ⊆-maximality test, not any orthogonality check, removes them.
  const af: AF = { args: ["a", "b", "c"], attacks: [["a", "b"], ["b", "a"]] };

  it("singletons/∅ are admissible-by-additive but pruned by maximality", () => {
    expect(isAdmissibleByAdditive(af, new Set())).toBe(true);
    expect(isAdmissibleByAdditive(af, new Set(["a"]))).toBe(true);
    const pref = preferredExtensionsByAdditive(af).map(setKey).sort();
    expect(pref).toEqual(["a,c", "b,c"]); // maximal only
  });

  it("preferred additive extensions equal the oracle's", () => {
    expect(extKey(preferredExtensionsByAdditive(af))).toBe(extKey(oraclePreferred(af)));
  });
});

// ---------------------------------------------------------------------------
// Step D — additive preferred reading ⟺ preferred, exhaustively
// ---------------------------------------------------------------------------

describe("Step D — additive ⊆-maximal-admissible ⟺ preferred, every AF n ≤ 3", () => {
  for (const n of [1, 2, 3]) {
    it(`preferred extensions + credulous/skeptical agree (${n} arg)`, () => {
      let afCount = 0;
      let multiPref = 0;
      for (const af of allAFs(n)) {
        afCount++;
        const bridge = preferredExtensionsByAdditive(af);
        const oracle = oraclePreferred(af);
        expect(extKey(bridge)).toBe(extKey(oracle));
        if (oracle.length >= 2) multiPref++;
        for (const a of af.args) {
          expect(credulouslyPreferredByAdditive(af, a)).toBe(oracle.some((E) => E.has(a)));
          expect(skepticallyPreferredByAdditive(af, a)).toBe(oracle.every((E) => E.has(a)));
        }
      }
      expect(afCount).toBeGreaterThan(0);
      if (n >= 2) expect(multiPref).toBeGreaterThan(0); // ≥2 preferred extensions occur
    });
  }
});
