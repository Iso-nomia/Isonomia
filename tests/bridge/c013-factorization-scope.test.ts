// tests/bridge/c013-factorization-scope.test.ts
//
// C013 abstract-proof SCOPING corroboration — the missing-coverage tests the
// scope pass (session 06) identified. See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/06-c013-abstract-proof-scoping-2026-06-05.md
//   RESEARCH_PROGRAMME/03_CONJECTURES/C013-branching-smyth-minimal-separating-context.md
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T007-minimal-separating-locus.md  (§Defect 1)
//   RESEARCH_PROGRAMME/03_CONJECTURES/C012-separation-minimal-locus.md          (§Route (b))
//
// WHAT THIS IS.
// ------------
// The existing harness (branching-normalization.test.ts) corroborates the
// AGGREGATED outcome (per-line minima form an antichain; Smyth-least = M) and
// per-line faithfulness on RECONSTRUCTED clean lines. It does NOT:
//   (i)   exercise O-parity's FACTORIZATION on a genuine multi-line tree;
//   (ii)  freeze the off-thread mis-divergence witness (O-faithful's failure);
//   (iii) spot-check a deeper ASYMMETRIC two-line tree (unequal line lengths).
// This file pins (i)/(ii)/(iii) as green facts — the crux (O-parity-b) gets
// differential teeth BEFORE the abstract proof, exactly as T008's harness did
// for leastness. It does NOT relabel any extractor basis and does NOT touch the
// kernel; the combined-tree FAILURE is expected (C013 §Out-of-scope), frozen
// here as a regression, not fixed.

import { describe, it, expect } from "@jest/globals";

import {
  stepCore,
  type CoreAct,
  type StepCoreInput,
} from "packages/ludics-engine/stepCore";

import {
  isPrefixLocus,
  comparableLoci,
  maximalLoci,
  commonStem,
} from "packages/ludics-engine/separation";

// ---------------------------------------------------------------------------
// Act + input builders (mirror branching-normalization.test.ts)
// ---------------------------------------------------------------------------

const P = (l: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId: l });
const O = (l: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId: l });

/** Identity id↔path maps over the loci a run touches. */
function inputOf(posActs: CoreAct[], negActs: CoreAct[]): StepCoreInput {
  const loci = Array.from(
    new Set([...posActs, ...negActs].map((a) => a.locusId).filter((l): l is string => !!l)),
  );
  return {
    posActs,
    negActs,
    pathById: new Map(loci.map((p) => [p, p] as const)),
    idByPath: new Map(loci.map((p) => [p, p] as const)),
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  };
}

const matchedLoci = (r: ReturnType<typeof stepCore>): string[] => r.pairs.map((p) => p.locusPath);

/**
 * One maximal line as a faithful linear T008 chronicle on the given loci, run
 * for the GENUINE REFUSAL of its deepest grant (withhold the O-receive at the
 * deepest even-depth P-locus). Returns the per-line ξ — which T008 guarantees
 * is that line's deepest grant. This is the per-line leg of the factorization.
 */
function lineRefusal(loci: string[]): string | undefined {
  const D: CoreAct[] = loci.map((L, t) => (t % 2 === 0 ? P(L, `p${t}`) : O(L, `o${t}`)));
  const deepestEven = (loci.length - 1) % 2 === 0 ? loci.length - 1 : loci.length - 2;
  const neg: CoreAct[] = [];
  for (let t = 0; t < loci.length; t++) {
    if (t === deepestEven) continue; // withhold the deepest grant's dual
    neg.push(t % 2 === 0 ? O(loci[t], `o${t}`) : P(loci[t], `r${t}`));
  }
  return stepCore(inputOf(D, neg)).divergenceLocus;
}

// ---------------------------------------------------------------------------
// (ii) Off-thread faithfulness witness — O-faithful's FAILURE spec, frozen
// ---------------------------------------------------------------------------

describe("C013 scope — off-thread mis-divergence on the combined tree (O-faithful failure spec)", () => {
  // The reproducible C012 §Route (b) / T007 §Defect-1 witness: a two-line tree
  // with a single test that engages line `0.2` makes stepCore diverge OFF-THREAD
  // at `0.1.1` (a line it never engaged). This is WHY the abstract normalizer
  // must factor per line rather than read the combined run. Expected failure —
  // frozen as a regression, NOT a bug to fix (R1 parked).
  it("combined run diverges off-thread at 0.1.1 with matched ['0','0.2']", () => {
    const pos: CoreAct[] = [
      P("0", "p0"),
      O("0.1", "o1"),
      O("0.2", "o2"),
      P("0.1.1", "p11"),
      P("0.2.1", "p21"),
    ];
    const neg: CoreAct[] = [O("0", "n0"), P("0.2", "t2"), O("0.2.1", "n21")];

    const r = stepCore(inputOf(pos, neg));

    expect(r.status).toBe("DIVERGENT");
    expect(r.divergenceLocus).toBe("0.1.1");
    expect(matchedLoci(r)).toEqual(["0", "0.2"]);

    // The reported divergence locus is UNJUSTIFIED in the matched trace: its
    // ⊑-predecessor `0.1` was never matched (the run went down `0.2`). That is
    // exactly the off-thread / unjustified-selection trigger of the R1-tree spec.
    expect(matchedLoci(r)).not.toContain("0.1");
    expect(isPrefixLocus("0.2", r.divergenceLocus ?? "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (i) Factorization probe — O-parity-c: per-line ≠ combined
// ---------------------------------------------------------------------------

describe("C013 scope — factorization: per-line runs recover M; the combined run does not", () => {
  // The same two-line shape (lines through 0.1.1 and 0.2.1), but run PER LINE in
  // isolation (each a faithful T008 chronicle, where stepCore is validated).
  it("each line in isolation diverges at its own deepest grant", () => {
    expect(lineRefusal(["0", "0.1", "0.1.1"])).toBe("0.1.1");
    expect(lineRefusal(["0", "0.2", "0.2.1"])).toBe("0.2.1");
  });

  it("aggregating the per-line ξ gives the antichain M with shared stem '0'", () => {
    const xiA = lineRefusal(["0", "0.1", "0.1.1"]);
    const xiB = lineRefusal(["0", "0.2", "0.2.1"]);
    const M = maximalLoci([xiA!, xiB!]);

    expect(new Set(M)).toEqual(new Set(["0.1.1", "0.2.1"]));
    expect(comparableLoci("0.1.1", "0.2.1")).toBe(false); // a genuine antichain
    expect(commonStem(M)).toBe("0");
  });

  it("the combined run yields a single (off-thread) locus, NOT the aggregate M", () => {
    // per-line factorization → the SET {0.1.1, 0.2.1}; the combined kernel run →
    // a single locus with an inconsistent matched trace. per-line ≠ combined.
    const M = new Set(["0.1.1", "0.2.1"]);
    const pos: CoreAct[] = [
      P("0", "p0"),
      O("0.1", "o1"),
      O("0.2", "o2"),
      P("0.1.1", "p11"),
      P("0.2.1", "p21"),
    ];
    const neg: CoreAct[] = [O("0", "n0"), P("0.2", "t2"), O("0.2.1", "n21")];
    const r = stepCore(inputOf(pos, neg));

    // The combined run reports ONE locus, and its matched trace does not cover
    // both lines — it cannot enumerate the antichain M. Only the factorization
    // (run per line, aggregate) recovers M. This is the load-bearing contrast.
    expect(r.divergenceLocus).toBeDefined();
    const combinedAsSet = new Set([r.divergenceLocus!]);
    expect(combinedAsSet).not.toEqual(M);
    expect(matchedLoci(r).length).toBeLessThan(M.size + 1); // did not engage both lines fully
  });
});

// ---------------------------------------------------------------------------
// (iii) Deeper ASYMMETRIC two-line tree — the Stage-B object (n=4 spot check)
// ---------------------------------------------------------------------------

describe("C013 scope — asymmetric two-line tree (unequal lengths) still factors", () => {
  it("a length-3 line and a length-5 line share stem '0' and give an antichain M", () => {
    const shallow = lineRefusal(["0", "0.1", "0.1.1"]); // deepest grant at depth 2
    const deep = lineRefusal(["0", "0.3", "0.3.1", "0.3.1.1", "0.3.1.1.1"]); // depth 4

    expect(shallow).toBe("0.1.1");
    expect(deep).toBe("0.3.1.1.1");

    const M = maximalLoci([shallow!, deep!]);
    expect(new Set(M)).toEqual(new Set(["0.1.1", "0.3.1.1.1"]));
    expect(comparableLoci("0.1.1", "0.3.1.1.1")).toBe(false);
    expect(commonStem(M)).toBe("0"); // branch point at the root; independent below
  });
});
