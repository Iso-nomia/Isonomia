// tests/bridge/branching-prevalence.test.ts
//
// Q-041 O2 — the BRANCHING-GATE COUNTER (synthetic baseline). See:
//   RESEARCH_PROGRAMME/DEV_SPEC-minimal-disagreement-extractor-2026-06-04.md  §5.4, §8
//   RESEARCH_PROGRAMME/IMPLEMENTATION_TRACKS.md  → minimal-disagreement track
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-041 (O2: branching)
//
// WHAT THIS MEASURES (and why it is the meter, not the feature).
// --------------------------------------------------------------
// T008 / the minimal-disagreement extractor only claim `basis === "minimal-T008"`
// when the contested region is a SINGLE realized chronicle (one `⊑`-chain of
// loci). Where a dispute carries multiple `⊑`-incomparable defended lines at once
// it BRANCHES, the `isSingleChronicle` gate returns false, and minimality is not
// claimed (Q-041 O2). How often that linear path actually applies is the empirical
// input the session-04 fork wanted before committing Direction-5 / R1 effort.
//
// This harness gives the SYNTHETIC BASELINE: over `allAFs(n)`, n ≤ 3, it builds
// the dispute design `⟦claim⟧⁺` for every (AF, claim), collects the loci in play,
// and classifies single-chronicle vs branching via the SAME `isSingleChronicle`
// gate the extractor uses. It reports the distribution and asserts the structural
// invariants (n = 1 is always single; branching genuinely appears for n ≥ 2).
//
// HONEST SCOPE. This is a structural proxy over the enumerable AF corpus, not a
// measurement of live deliberations. Real deliberations are richer and almost
// certainly branch MORE, so this baseline is OPTIMISTIC for the linear path — a
// lower bound on how often branching bites. The live-deliberation telemetry
// (reading the prisma argument graph) is the gated follow-up.

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  buildDisputeDesign,
  type AF,
  type ArgId,
  type Attack,
} from "@/lib/bridge";

import { isSingleChronicle } from "packages/ludics-engine/properTest";

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

interface DisputeShape {
  /** Distinct loci in play (the contested region). */
  loci: string[];
  /** Single realized chronicle (one ⊑-chain) per the extractor's O2 gate. */
  single: boolean;
  /** Number of leaf loci (maximal lines) — 1 for a chronicle, ≥2 if branching. */
  leaves: number;
  /** Whether the claim has any attacker at all (a non-trivial dispute). */
  nonTrivial: boolean;
}

function disputeShape(af: AF, claim: ArgId): DisputeShape {
  const design = buildDisputeDesign(af, claim);
  const loci = Array.from(new Set(design.acts.map((a) => a.locusPath)));
  // Leaves: loci that are not a strict prefix (segment-wise) of any other locus.
  const seg = (s: string) => s.split(".");
  const isStrictPrefix = (a: string, b: string) => {
    if (a === b) return false;
    const sa = seg(a);
    const sb = seg(b);
    if (sa.length >= sb.length) return false;
    return sa.every((x, i) => x === sb[i]);
  };
  const leaves = loci.filter((l) => !loci.some((other) => isStrictPrefix(l, other))).length;
  return {
    loci,
    single: isSingleChronicle(loci),
    leaves,
    nonTrivial: attackersOf(af, claim).length > 0,
  };
}

describe("branching-gate counter — synthetic baseline over allAFs(n)", () => {
  for (const n of [1, 2, 3]) {
    it(`reports single-chronicle vs branching prevalence for ${n} argument(s)`, () => {
      let total = 0;
      let nonTrivial = 0;
      let single = 0;
      let branching = 0;
      let singleNonTrivial = 0;
      let branchingNonTrivial = 0;
      const leafHist = new Map<number, number>();

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const s = disputeShape(af, claim);
          total++;
          if (s.single) single++;
          else branching++;
          leafHist.set(s.leaves, (leafHist.get(s.leaves) ?? 0) + 1);
          if (s.nonTrivial) {
            nonTrivial++;
            if (s.single) singleNonTrivial++;
            else branchingNonTrivial++;
          }
        }
      }

      const pct = (a: number, b: number) => (b === 0 ? "—" : `${((100 * a) / b).toFixed(1)}%`);
      const leafDist = [...leafHist.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");

      // The deliverable: the baseline distribution (a measurement, surfaced).
      // eslint-disable-next-line no-console
      console.log(
        `[branching-baseline n=${n}] ` +
          `disputes=${total} (nonTrivial=${nonTrivial}) | ` +
          `single=${single} (${pct(single, total)}) branching=${branching} (${pct(branching, total)}) | ` +
          `nonTrivial: single=${singleNonTrivial} (${pct(singleNonTrivial, nonTrivial)}) ` +
          `branching=${branchingNonTrivial} (${pct(branchingNonTrivial, nonTrivial)}) | ` +
          `leafFactor[count]=${leafDist}`,
      );

      // Structural invariants (the test half).
      expect(total).toBeGreaterThan(0);
      // A single argument can have at most a self-attack → one line; never branches.
      if (n === 1) {
        expect(branching).toBe(0);
        expect(single).toBe(total);
      }
      // With ≥2 arguments, branching disputes genuinely exist (an argument with
      // two distinct attackers defended on two incomparable lines).
      if (n >= 2) {
        expect(branchingNonTrivial).toBeGreaterThan(0);
      }
      // Consistency: a single-chronicle dispute has exactly one leaf line; a
      // branching one has ≥2.
      expect(single + branching).toBe(total);
    });
  }
});
