// tests/bridge/minimal-disagreement-extractor.test.ts
//
// Q-041 / Direction 2 — the VERIFIED minimal-disagreement extractor. See:
//   RESEARCH_PROGRAMME/DEV_SPEC-minimal-disagreement-extractor-2026-06-04.md
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T008-minimal-separating-context-daimon-closed.md
//
// This is the test-then-ship suite of the extractor (spec §5). It pins:
//   1. Oracle agreement: the extractor's `locus` ≡ the daimon-closed harness's
//      `ξ(E)` over allAFs(n), n ≤ 3.
//   2. The prime invariant (the safety net): every test the extractor constructs
//      is frontier-complete BEFORE it reaches stepCore; feeding a raw truncation
//      makes `assertFrontierComplete` throw.
//   3. Faithfulness contrast: the frozen length-5 witness yields ξ = 0.1.2.3.4
//      with basis "minimal-T008", while the raw truncation would have diverged
//      at the ⊑-smaller 0.1.2.
//   4. The branching gate (surfaces O2): a constructed branching dispute yields
//      isSingleChronicle === false and a basis ≠ "minimal-T008".

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

import {
  stepCore,
  type CoreAct,
  type StepCoreInput,
} from "packages/ludics-engine/stepCore";

import { isPrefixLocus, locusSegments } from "packages/ludics-engine/separation";

import {
  buildProperTest,
  buildChronicleProponent,
  isFrontierComplete,
  assertFrontierComplete,
  isSingleChronicle,
  extractMinimalDisagreementLocus,
  smythMinimalSeparatingContext,
  type Chronicle,
} from "packages/ludics-engine/properTest";

import { buildDisputeDesign } from "@/lib/bridge";

// ---------------------------------------------------------------------------
// Shared builders (the same encoding as the daimon-closed harness)
// ---------------------------------------------------------------------------

const P = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId });
const O = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId });

const chainPaths = (depth: number): string[] => {
  const out: string[] = [];
  for (let t = 0; t <= depth; t++) {
    out.push(t === 0 ? "0" : "0." + Array.from({ length: t }, (_, k) => k + 1).join("."));
  }
  return out;
};

const idMaps = (paths: string[]) => ({
  pathById: new Map(paths.map((p) => [p, p] as const)),
  idByPath: new Map(paths.map((p) => [p, p] as const)),
});

const depthOf = (locus: string): number => locusSegments(locus).length - 1;

function run(pos: CoreAct[], neg: CoreAct[], paths: string[]) {
  const { pathById, idByPath } = idMaps(paths);
  const input: StepCoreInput = {
    posActs: pos,
    negActs: neg,
    pathById,
    idByPath,
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  };
  const r = stepCore(input);
  return { status: r.status, divergenceLocus: r.divergenceLocus };
}

function chronicle(len: number): Chronicle {
  return { loci: chainPaths(len - 1) };
}

/** The deepest D-positive (even) depth — the genuine refusal anchor ξ(E) depth. */
function deepestEvenDepth(len: number): number {
  const max = len - 1;
  return max % 2 === 0 ? max : max - 1;
}

// ---------------------------------------------------------------------------
// 1. Frozen length-5 / length-3 witnesses (faithfulness contrast)
// ---------------------------------------------------------------------------

describe("extractor — frozen witnesses (basis = minimal-T008 on the faithful region)", () => {
  it("length-5: ξ(E) = 0.1.2.3.4, basis minimal-T008; truncation would have diverged at 0.1.2", () => {
    const chron = chronicle(5);
    const D = buildChronicleProponent(chron);
    const anchor = deepestEvenDepth(5); // depth 4 → locus 0.1.2.3.4

    const out = extractMinimalDisagreementLocus(chron, D, { anchorDepth: anchor }, chron.loci);
    expect(out.locus).toBe("0.1.2.3.4");
    expect(out.basis).toBe("minimal-T008");

    // Contrast: the raw truncation at the odd-depth prefix 0.1 (acts at loci ⊑ 0.1)
    // over-runs and diverges at the ⊑-SMALLER 0.1.2 — the unfaithful object T008
    // excludes. The extractor never produces this.
    const Efull = D.map((_, t) =>
      t % 2 === 0 ? O(chron.loci[t], `o${t}`) : P(chron.loci[t], `r${t}`),
    );
    const truncatedAt01 = Efull.filter((a) => isPrefixLocus(a.locusId!, "0.1"));
    const trunc = run(D, truncatedAt01, chron.loci);
    expect(trunc.status).toBe("DIVERGENT");
    expect(trunc.divergenceLocus).toBe("0.1.2");
    expect(isPrefixLocus("0.1.2", "0.1.2.3.4")).toBe(true);
    expect(depthOf("0.1.2")).toBeLessThan(depthOf(out.locus));
  });

  it("length-3: ξ(E) = 0.1.2, basis minimal-T008", () => {
    const chron = chronicle(3);
    const D = buildChronicleProponent(chron);
    const out = extractMinimalDisagreementLocus(
      chron,
      D,
      { anchorDepth: deepestEvenDepth(3) },
      chron.loci,
    );
    expect(out.locus).toBe("0.1.2");
    expect(out.basis).toBe("minimal-T008");
  });

  it("maps ξ back to an argument-graph target when a resolver is supplied", () => {
    const chron = chronicle(5);
    const D = buildChronicleProponent(chron);
    const out = extractMinimalDisagreementLocus(
      chron,
      D,
      { anchorDepth: deepestEvenDepth(5) },
      chron.loci,
      (locus) => ({ kind: "edge", id: `edge:${locus}` }),
    );
    expect(out.target).toEqual({ kind: "edge", id: "edge:0.1.2.3.4" });
  });
});

// ---------------------------------------------------------------------------
// 2. The prime invariant — no partial test ever reaches stepCore
// ---------------------------------------------------------------------------

describe("extractor — prime invariant (frontier-completeness is enforced)", () => {
  it("buildProperTest emits a frontier-complete Refuse at every even anchor", () => {
    for (const len of [3, 5, 7]) {
      const chron = chronicle(len);
      const { acts } = buildProperTest(chron, deepestEvenDepth(len));
      expect(isFrontierComplete(acts, chron)).toBe(true);
      expect(() => assertFrontierComplete(acts, chron)).not.toThrow();
    }
  });

  it("buildProperTest emits a frontier-complete Concede at every odd anchor", () => {
    const chron = chronicle(6); // odd depths 1, 3, 5
    for (const j of [1, 3, 5]) {
      const { acts, frontier } = buildProperTest(chron, j);
      expect(frontier).toBe(chron.loci[j]);
      expect(isFrontierComplete(acts, chron)).toBe(true);
    }
  });

  it("a raw truncation is NOT frontier-complete — assertFrontierComplete throws", () => {
    const chron = chronicle(5);
    const Efull = chron.loci.map((L, t) =>
      t % 2 === 0 ? O(L, `o${t}`) : P(L, `r${t}`),
    );
    // E↾0.1: silent at its own positive turn (odd depth 3) — the T007 truncation.
    const truncated = Efull.filter((a) => isPrefixLocus(a.locusId!, "0.1"));
    expect(isFrontierComplete(truncated, chron)).toBe(false);
    expect(() => assertFrontierComplete(truncated, chron)).toThrow(/frontier-complete/);
  });
});

// ---------------------------------------------------------------------------
// 3. The branching gate — minimality is refused off the linear path (O2)
// ---------------------------------------------------------------------------

describe("extractor — branching gate (surfaces Q-041 O2)", () => {
  it("isSingleChronicle is true on a ⊑-chain, false on incomparable loci", () => {
    expect(isSingleChronicle(["0", "0.1", "0.1.2"])).toBe(true);
    // Two ⊑-incomparable defended lines simultaneously in play (C012 §Route b).
    expect(isSingleChronicle(["0", "0.1", "0.2"])).toBe(false);
  });

  it("never claims minimal-T008 when the contested region is branching", () => {
    const chron = chronicle(5);
    const D = buildChronicleProponent(chron);
    // Same realized line, but the contested region has an incomparable sibling.
    const branchingLociInPlay = [...chron.loci, "0.2"];
    expect(isSingleChronicle(branchingLociInPlay)).toBe(false);

    const out = extractMinimalDisagreementLocus(
      chron,
      D,
      { anchorDepth: deepestEvenDepth(5) },
      branchingLociInPlay,
    );
    expect(out.locus).toBe("0.1.2.3.4"); // still the first-divergence on this line
    expect(out.basis).not.toBe("minimal-T008");
    expect(out.basis).toBe("first-divergence-T006");
  });

  it("fails closed to heuristic-fallback when the proper test converges (no separation)", () => {
    const chron = chronicle(5);
    const D = buildChronicleProponent(chron);
    // Concede at an odd anchor → the proper test converges, nothing to separate.
    const out = extractMinimalDisagreementLocus(chron, D, { anchorDepth: 3 }, chron.loci);
    expect(out.basis).toBe("heuristic-fallback");
  });
});

// ---------------------------------------------------------------------------
// 4. Oracle agreement over allAFs(n) — extractor.locus ≡ harness ξ(E)
// ---------------------------------------------------------------------------

const lineKey = (line: readonly ArgId[]): string => line.join(">");

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

function realizedPlay(af: AF, claim: ArgId, pro: Strategy, con: Strategy): ArgId[] {
  const line: ArgId[] = [claim];
  const used = new Set<ArgId>([claim]);
  let current = claim;
  let turn: "CON" | "PRO" = "CON";
  const guard = 4 * af.args.length + 10;
  for (let step = 0; step < guard; step++) {
    if (turn === "CON") {
      const opts = attackersOf(af, current);
      if (opts.length === 0) return line;
      const pick = con.get(lineKey(line));
      if (pick === undefined) return line;
      line.push(pick);
      current = pick;
      turn = "PRO";
    } else {
      const opts = attackersOf(af, current).filter((o) => !used.has(o));
      if (opts.length === 0) return line;
      const pick = pro.get(lineKey(line));
      if (pick === undefined) return line;
      used.add(pick);
      line.push(pick);
      current = pick;
      turn = "CON";
    }
  }
  return line;
}

function locusAt(depth: number): string {
  if (depth === 0) return "0";
  return "0." + Array.from({ length: depth }, (_, k) => k + 1).join(".");
}

const CAP = 8_000;

describe("extractor — oracle agreement with the daimon-closed harness over allAFs(n)", () => {
  for (const n of [1, 2, 3]) {
    it(`extractor.locus ≡ harness ξ(E) for ${n} argument(s)`, () => {
      let checked = 0;
      let minimalClaims = 0;

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          let pros: Strategy[];
          let cons: Strategy[];
          try {
            pros = enumerateStrategies(af, claim, "PRO", CAP);
            cons = enumerateStrategies(af, claim, "CON", CAP);
          } catch {
            continue;
          }
          for (const σ of pros) {
            for (const τ of cons) {
              const line = realizedPlay(af, claim, σ, τ);
              const len = line.length;
              const loci = Array.from({ length: len }, (_, t) => locusAt(t));
              const chron: Chronicle = { loci };
              const D = buildChronicleProponent(chron);

              const anchor = deepestEvenDepth(len);
              if (anchor < 0) continue;

              // Oracle: the daimon-closed harness's genuine refusal (drop deepest O).
              const Efull = loci.map((L, t) =>
                t % 2 === 0 ? O(L, `o${t}`) : P(L, `r${t}`),
              );
              const oIdx = [...Efull.keys()].filter(
                (i) => Efull[i].polarity === "O",
              );
              if (oIdx.length === 0) continue;
              const deepest = oIdx[oIdx.length - 1];
              const Erefuse = Efull.filter((_, k) => k !== deepest);
              const oracle = run(D, Erefuse, loci);
              if (oracle.status !== "DIVERGENT" || oracle.divergenceLocus === undefined) {
                continue;
              }

              const out = extractMinimalDisagreementLocus(
                chron,
                D,
                { anchorDepth: anchor },
                loci,
              );
              expect(out.locus).toBe(oracle.divergenceLocus);
              expect(out.basis).toBe("minimal-T008");
              checked++;
              minimalClaims++;
            }
          }
        }
      }

      expect(checked).toBeGreaterThan(0);
      if (n >= 2) expect(minimalClaims).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Branching path — the Smyth-least separating antichain (C013)
// ---------------------------------------------------------------------------
//
// `smythMinimalSeparatingContext` returns the set-valued disagreement for a
// branching dispute: the ⊑-antichain of per-line first-divergence loci. Its basis
// is `smyth-minimal-T009` — the Smyth-minimal separating ANTICHAIN, proven minimal
// under the Smyth order (T009, established). It is a minimal SET, never a single
// ⊑-least locus (branching has none) and never `minimal-T008` (that tag is the
// single-chronicle ⊑-least locus). Surface: "minimal set, one per open line".

function* allAFsB(n: number): Generator<AF> {
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

const grantLociOf = (af: AF, claim: ArgId): string[] =>
  buildDisputeDesign(af, claim)
    .acts.filter((a) => a.polarity === "P" && a.kind === "PROPER")
    .map((a) => a.locusPath);

describe("extractor — branching Smyth antichain (C013, set-valued)", () => {
  it("two incomparable lines → antichain set, basis smyth-minimal-T009, NOT minimal-T008", () => {
    // Grants on two lines below the root: "0.1.2" and "0.2.2" (incomparable).
    const grants = ["0", "0.1", "0.2", "0.1.2", "0.2.2"];
    const out = smythMinimalSeparatingContext(grants);
    expect(out.basis).toBe("smyth-minimal-T009");
    expect(out.basis).not.toBe("minimal-T008"); // a minimal SET (antichain), not the single ⊑-least locus
    expect(new Set(out.loci)).toEqual(new Set(["0.1.2", "0.2.2"])); // ⊑-maximal antichain
    expect(out.locus).toBe("0"); // shared stem = where the lines branch
    // every element is a genuine deeper grant; none a prefix of another
    for (const a of out.loci!)
      for (const b of out.loci!)
        if (a !== b) expect(isPrefixLocus(a, b)).toBe(false);
  });

  it("a single line collapses to a singleton antichain (the deepest grant)", () => {
    const out = smythMinimalSeparatingContext(["0", "0.1", "0.1.2"]);
    expect(out.loci).toEqual(["0.1.2"]);
    expect(out.basis).toBe("smyth-minimal-T009");
  });

  it("over allAFs(n): the set is always a ⊑-antichain and never claims minimal-T008", () => {
    for (const n of [2, 3]) {
      let branching = 0;
      for (const af of allAFsB(n)) {
        for (const claim of af.args) {
          const grants = grantLociOf(af, claim);
          if (grants.length === 0) continue;
          const out = smythMinimalSeparatingContext(grants);
          // branching path is a minimal SET (smyth-minimal-T009), never the
          // single-chronicle ⊑-least locus tag minimal-T008
          expect(out.basis).not.toBe("minimal-T008");
          const M = out.loci ?? [];
          // M is a ⊑-antichain
          for (const a of M)
            for (const b of M)
              if (a !== b) expect(isPrefixLocus(a, b)).toBe(false);
          // each element is one of D's actual grants
          for (const a of M) expect(grants).toContain(a);
          if (M.length >= 2) branching++;
        }
      }
      if (n >= 2) expect(branching).toBeGreaterThan(0);
    }
  });
});
