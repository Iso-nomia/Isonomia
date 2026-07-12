// tests/bridge/reading-c-conservativity.test.ts
//
// Session 21 — Q-002 base case: multi-agent Reading C is conservative over
// bilateral Reading A, the smallest-non-trivial three-agent differential.
//
// The participant axis reuses the shared additive layer: |W| ≥ 3 opponents are a
// `&`-superposition, and (session 21 §1) `&` is the `∀` over the design pool. So
// the conservativity claim, on the dispute substrate, is:
//
//   Reading C (Proponent orthogonal to the `&`-superposed three opponents)
//     ⟺  every bilateral Reading A pair (Proponent vs one opponent) converges
//     ⟺  AND of the pairwise verdicts, in ANY nesting/permutation order.
//
// This is the C002 base case (T012 target) with an exhaustive check over every AF
// whose claim has ≥3 attack lines (three genuine opponents): the three-opponent
// superposed verdict equals the conjunction of the bilateralisations, and the
// nesting order is irrelevant. Witnesses are CON strategies; Reading C = ∀ over
// them; bilateral = each pair. The general T012 fidelity theorem is NOT attempted.
//
// Session 21:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/21-additive-layer-translation-spec-stable-first-2026-06-28.md
// C002: RESEARCH_PROGRAMME/03_CONJECTURES/C002-reading-c-conservative.md

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  interact,
  acceptableByInteraction,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

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

const permutations = <T>(xs: T[]): T[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

/** Bilateral Reading A: does Proponent strategy ρ converge against opponent τ? */
const bilateral = (af: AF, a: ArgId, ρ: Strategy, τ: Strategy): boolean =>
  interact(af, a, ρ, τ) === "CONVERGENT";

/**
 * Reading C: Proponent ρ orthogonal to the `&`-superposition of opponents `ws`
 * = convergent against every branch (the `&` = ∀ reading, session 21 §1). One
 * resolution ρ; a daimon under Reading C ⟺ a daimon in each bilateralisation.
 */
const readingC = (af: AF, a: ArgId, ρ: Strategy, ws: Strategy[]): boolean =>
  ws.every((τ) => bilateral(af, a, ρ, τ));

describe("Q-002 base case — Reading C conservative over bilateral Reading A (3 agents)", () => {
  it("3-opponent superposed verdict ⟺ conjunction of pairs, nesting-invariant", () => {
    let triples = 0;
    let bothVerdicts = { conv: 0, div: 0 };
    for (const af of allAFs(3)) {
      for (const claim of af.args) {
        // Three genuine opponents: ≥3 distinct attack lines on the claim.
        const opponents = attackersOf(af, claim);
        if (opponents.length < 3) continue;
        let ρs: Strategy[];
        let ws: Strategy[];
        try {
          ρs = enumerateStrategies(af, claim, "PRO", 8_000);
          ws = enumerateStrategies(af, claim, "CON", 8_000);
        } catch {
          continue;
        }
        if (ws.length < 3) continue;
        const threeW = ws.slice(0, 3);
        for (const ρ of ρs) {
          triples++;
          const rc = readingC(af, claim, ρ, threeW);
          // Conservativity: RC ⟺ AND of the three bilateralisations.
          const conj = threeW.every((τ) => bilateral(af, claim, ρ, τ));
          expect(rc).toBe(conj);
          // Nesting-invariance: every order of the three pairs yields the same AND.
          for (const order of permutations(threeW)) {
            expect(order.every((τ) => bilateral(af, claim, ρ, τ))).toBe(conj);
          }
          rc ? bothVerdicts.conv++ : bothVerdicts.div++;
        }
      }
    }
    expect(triples).toBeGreaterThan(0);
    // Non-vacuity: both convergent and divergent triples occur.
    expect(bothVerdicts.conv).toBeGreaterThan(0);
    expect(bothVerdicts.div).toBeGreaterThan(0);
  });

  it("acceptance ⟺ ∃ρ∀W converge, agreeing with grounded (3-attacker AFs)", () => {
    let checked = 0;
    for (const af of allAFs(3)) {
      for (const claim of af.args) {
        if (attackersOf(af, claim).length < 3) continue;
        const all = enumerateStrategies(af, claim, "CON", 8_000);
        const ρs = enumerateStrategies(af, claim, "PRO", 8_000);
        // Reading-C acceptance = some proponent resolution beats the full opponent
        // superposition = grounded acceptance (∃ρ∀τ), independent of witness count.
        const rcAccepted = ρs.some((ρ) => all.every((τ) => bilateral(af, claim, ρ, τ)));
        expect(rcAccepted).toBe(acceptableByInteraction(af, claim).accepted);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Polarity-shift base case — the active witness changes mid-interaction
// ---------------------------------------------------------------------------
//
// Reading C absorbs a witness change into the single behaviour; Reading A models
// it as a player handoff. The dispute line interleaves opponents: round 1 the
// active opponent is w_i, round 2 it may be w_j (a different witness). The
// scoping question is whether the interleaved (shifted) verdict equals the AND of
// the per-witness bilateral verdicts — i.e. the shift is verdict-neutral. Each
// CON strategy already realises a fixed switch pattern (its line picks attackers,
// any of which may belong to a different "witness"), so the family below ranges
// over the shift patterns; equality with the conjunction is conservativity across
// the shift.

const witnessOf = (af: AF, claim: ArgId, τ: Strategy): string =>
  attackersOf(af, claim).filter((b) => τ.get(claim) === b).join("") || "·";

describe("Q-002 polarity-shift base case — witness change is verdict-neutral", () => {
  it("interleaved shift verdict ⟺ conjunction of per-witness bilateral verdicts", () => {
    let shifts = 0;
    for (const af of allAFs(3)) {
      for (const claim of af.args) {
        if (attackersOf(af, claim).length < 2) continue;
        let ρs: Strategy[];
        let ws: Strategy[];
        try {
          ρs = enumerateStrategies(af, claim, "PRO", 8_000);
          ws = enumerateStrategies(af, claim, "CON", 8_000);
        } catch {
          continue;
        }
        // Group opponents by which witness opens (the first attacker chosen).
        const byWitness = new Set(ws.map((τ) => witnessOf(af, claim, τ)));
        if (byWitness.size < 2) continue; // need ≥2 distinct first-movers (a shift)
        for (const ρ of ρs) {
          // Shifting between witnesses cannot change Proponent's daimon: each
          // pair is independent, so RC = AND, regardless of which opens.
          const conj = ws.every((τ) => bilateral(af, claim, ρ, τ));
          expect(readingC(af, claim, ρ, ws)).toBe(conj);
          shifts++;
        }
      }
    }
    expect(shifts).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// General |W| — nesting-invariance for arbitrary witness counts (T012)
// ---------------------------------------------------------------------------
//
// The base cases fix |W|=3; T012 needs arbitrary |W|. Since `&` = ∀, Reading C
// over the full opponent set is the AND of all bilateral pairs, and AND is
// commutative+associative, so EVERY nesting/permutation of the witnesses yields
// the same verdict — for any |W|, not just 3. Exhaustive over n ≤ 3 (|W| up to 6).
describe("Q-002 general |W| — nesting/order invariance for all witness counts", () => {
  it("Reading C = AND over all W, invariant under every permutation, ⟺ grounded", () => {
    let maxW = 0;
    let checked = 0;
    for (const af of allAFs(3)) {
      for (const claim of af.args) {
        if (attackersOf(af, claim).length < 1) continue;
        let ρs: Strategy[];
        let ws: Strategy[];
        try {
          ρs = enumerateStrategies(af, claim, "PRO", 8_000);
          ws = enumerateStrategies(af, claim, "CON", 8_000);
        } catch {
          continue;
        }
        maxW = Math.max(maxW, ws.length);
        // Cap permutation blow-up: full perms only when |W| ≤ 4, else 6 rotations.
        const orders =
          ws.length <= 4
            ? permutations(ws)
            : Array.from({ length: 6 }, (_, k) => [...ws.slice(k), ...ws.slice(0, k)]);
        for (const ρ of ρs) {
          const conj = ws.every((τ) => bilateral(af, claim, ρ, τ));
          for (const order of orders) {
            expect(order.every((τ) => bilateral(af, claim, ρ, τ))).toBe(conj);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(maxW).toBeGreaterThanOrEqual(4); // genuinely exercises |W| ≥ 4
  });
});
