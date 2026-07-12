// tests/bridge/grounded-biorthogonal.property.test.ts
//
// Phase 2 (test-first) of the foundational bridge (direction 1).
//
// Differential test of the §2 grounded-bridge conjecture:
//
//   a ∈ grounded(F)  ⟺  ⟦a⟧⁺ is orthogonal (canonical predicate) to every
//                       opponent design — operationally, PRO has a winning
//                       interaction strategy: ∃σ ∀τ. interact(σ,τ) = CONVERGENT.
//
// The left-hand side is the exact, consolidated engine (`lib/argumentation`,
// trustworthy per session-02 §0b). The right-hand side is the Phase-2 prototype
// in `lib/bridge`, which interacts translated designs via a faithful PURE model
// of the canonical predicate (stepInteraction CONVERGENT) on the multiplicative,
// additive-free fragment the abstract-AF translation emits.
//
// Spec: RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02b-translation-spec-af-to-designs-2026-06-02.md

import { describe, it, expect } from "@jest/globals";
import fc from "fast-check";

import {
  groundedExtension,
  toDefeatGraphFromEdgeList,
} from "@/lib/argumentation/labelling";

import {
  acceptableByInteraction,
  disputeWins,
  type AF,
  type Attack,
} from "@/lib/bridge";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function grounded(af: AF): Set<string> {
  return groundedExtension(toDefeatGraphFromEdgeList(af.args, af.attacks));
}

/** Random finite AF over n named args with a random attack relation (incl. self). */
function afArbitrary() {
  return fc
    .integer({ min: 1, max: 5 })
    .chain((n) => {
      const args = Array.from({ length: n }, (_, i) => `a${i}`);
      const allPairs: Attack[] = [];
      for (const from of args) for (const to of args) allPairs.push([from, to]);
      return fc
        .subarray(allPairs, { minLength: 0, maxLength: allPairs.length })
        .map((attacks): AF => ({ args, attacks }));
    });
}

// ---------------------------------------------------------------------------
// fixed-case sanity (the worked cases from the Q-031 verdict / spec)
// ---------------------------------------------------------------------------

describe("bridge — fixed cases", () => {
  const accepted = (af: AF, a: string) =>
    acceptableByInteraction(af, a).accepted;

  it("a→b: grounded = {a}; interaction accepts a, rejects b", () => {
    const af: AF = { args: ["a", "b"], attacks: [["a", "b"]] };
    expect([...grounded(af)]).toEqual(["a"]);
    expect(accepted(af, "a")).toBe(true);
    expect(accepted(af, "b")).toBe(false);
  });

  it("even cycle a⇄b: grounded = ∅; interaction rejects both", () => {
    const af: AF = { args: ["a", "b"], attacks: [["a", "b"], ["b", "a"]] };
    expect(grounded(af).size).toBe(0);
    expect(accepted(af, "a")).toBe(false);
    expect(accepted(af, "b")).toBe(false);
  });

  it("odd 3-cycle: grounded = ∅; interaction rejects all", () => {
    const af: AF = {
      args: ["a", "b", "c"],
      attacks: [["a", "b"], ["b", "c"], ["c", "a"]],
    };
    expect(grounded(af).size).toBe(0);
    expect(accepted(af, "a")).toBe(false);
    expect(accepted(af, "b")).toBe(false);
    expect(accepted(af, "c")).toBe(false);
  });

  it("self-attack a→a: a is not grounded; interaction rejects a", () => {
    const af: AF = { args: ["a"], attacks: [["a", "a"]] };
    expect(grounded(af).has("a")).toBe(false);
    expect(accepted(af, "a")).toBe(false);
  });

  it("defended chain a→b→c: grounded = {a,c}; interaction matches", () => {
    const af: AF = {
      args: ["a", "b", "c"],
      attacks: [["a", "b"], ["b", "c"]],
    };
    expect(new Set(grounded(af))).toEqual(new Set(["a", "c"]));
    expect(accepted(af, "a")).toBe(true);
    expect(accepted(af, "b")).toBe(false);
    expect(accepted(af, "c")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// property: interaction acceptance ⟺ grounded membership
// ---------------------------------------------------------------------------

describe("bridge — property: interaction ⟺ grounded", () => {
  it("∃σ∀τ converge agrees with grounded membership on random AFs", () => {
    fc.assert(
      fc.property(afArbitrary(), (af) => {
        const G = grounded(af);
        for (const a of af.args) {
          const res = acceptableByInteraction(af, a);
          if (res.accepted === undefined) continue; // too large → skip, not a verdict
          expect(res.accepted).toBe(G.has(a));
        }
      }),
      { numRuns: 500 }
    );
  });

  it("interaction acceptance equals the minimax dispute value (faithfulness)", () => {
    fc.assert(
      fc.property(afArbitrary(), (af) => {
        for (const a of af.args) {
          const res = acceptableByInteraction(af, a);
          if (res.accepted === undefined) continue;
          expect(res.accepted).toBe(disputeWins(af, a));
        }
      }),
      { numRuns: 500 }
    );
  });
});
