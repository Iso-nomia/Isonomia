// tests/bridge/keystone-simulation.exhaustive.test.ts
//
// Phase 3 (keystone lemma) — deterministic corroboration.
//
// The property test `grounded-biorthogonal.property.test.ts` samples random AFs.
// This file is the *exhaustive* backstop the keystone proof (T005) cites: it
// enumerates EVERY abstract AF up to a fixed size and checks the two equivalences
// the proof decomposes into, so the simulation/adequacy claims are confirmed on
// the entire finite slice, not merely sampled.
//
//   Lemma C (game adequacy):   disputeWins(F, a) ⟺ a ∈ grounded(F)
//   Lemma A+B (simulation):    acceptableByInteraction(F, a) ⟺ disputeWins(F, a)
//                              (where enumeration is within bound; capped → skip)
//
// T005: RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T005-grounded-ludics-keystone.md

import { describe, it, expect } from "@jest/globals";

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

/** All abstract AFs on `n` named args (every subset of the n² directed edges). */
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

function grounded(af: AF): Set<string> {
  return groundedExtension(toDefeatGraphFromEdgeList(af.args, af.attacks));
}

describe("keystone — Lemma C: disputeWins ⟺ grounded (exhaustive)", () => {
  for (const n of [1, 2, 3, 4]) {
    it(`holds for every AF on ${n} argument(s)`, () => {
      let afs = 0;
      let checks = 0;
      for (const af of allAFs(n)) {
        afs++;
        const G = grounded(af);
        for (const a of af.args) {
          checks++;
          expect(disputeWins(af, a)).toBe(G.has(a));
        }
      }
      // sanity: the full 2^(n^2) family was traversed
      expect(afs).toBe(1 << (n * n));
      expect(checks).toBe(n * (1 << (n * n)));
    });
  }
});

describe("keystone — Lemma A+B: acceptableByInteraction ⟺ disputeWins (exhaustive)", () => {
  for (const n of [1, 2, 3]) {
    it(`holds for every AF on ${n} argument(s) (within enumeration bound)`, () => {
      let checked = 0;
      let skipped = 0;
      for (const af of allAFs(n)) {
        for (const a of af.args) {
          const res = acceptableByInteraction(af, a);
          if (res.accepted === undefined) {
            skipped++;
            continue;
          }
          checked++;
          expect(res.accepted).toBe(disputeWins(af, a));
        }
      }
      // the simulation is exercised on essentially the whole slice
      expect(checked).toBeGreaterThan(0);
      expect(skipped).toBe(0); // n ≤ 3 never exceeds the 8000-strategy bound
    });
  }
});
