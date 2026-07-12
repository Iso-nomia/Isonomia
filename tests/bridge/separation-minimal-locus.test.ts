// tests/bridge/separation-minimal-locus.test.ts
//
// Phase 2 of Direction 2 (separation / locus of disagreement) — corroborate the
// load-bearing half of C012 over allAFs(n). See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/03-separation-locus-of-disagreement-2026-06-03.md
//   RESEARCH_PROGRAMME/03_CONJECTURES/C012-separation-minimal-locus.md  (§Phase 1, Positive settlement)
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-040
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T006-first-divergence-locus-e0.md  (E0)
//
// Phase 0 settled the *easy half* (E0): per opponent, the first-divergence locus
// `ξ(E) = divergenceLocusOf(⟦D⟧, ⟦E⟧)` is unique and computable. Phase 1 fixed the
// order `⊑` (prefix on locus anchors) and named the **minimal unshared
// commitment** `ξ*` = the `⊑`-least element of `Sep(D) = { ξ(E) : E ∈ D⊥ }`.
//
// This harness corroborates the *load-bearing* claim — cross-opponent minimality —
// empirically before the Phase-3 proof:
//
//   For each Proponent dispute design `D` (from a faithful PRO/CON play over
//   allAFs(n)), enumerate a family of non-orthogonal Opponent designs `{E}` by
//   dropping each Proponent positive's dual O-act in turn (each drop forces a
//   `DIVERGENT` run at a determinate anchor — the substrate of separation). Over
//   the collected anchors `Sep(D)` assert:
//
//     (existence)    `Sep(D)` has a `⊑`-least element `ξ*` (the reducer
//                    `minimalAnchor` returns `exists: true`);
//     (uniqueness)   exactly one anchor is a prefix of every other;
//     (realisation)  `ξ*` is `ξ(E*)` for an actual enumerated opponent `E*`
//                    (so the minimal unshared commitment is *computed*, not just
//                    defined — a single run witnesses it);
//     (chain)        the anchors are totally ordered by `⊑` — the additive-free
//                    corroboration that the T005 fragment's linear chronicle never
//                    produces the `⊑`-incomparable anchors of the negative
//                    settlement (the branching where minimality is fragile).
//
// The reducer under test (`packages/ludics-engine/separation.ts`) is checked
// against an *independent* shallowest-anchor oracle (fewest segments, with an
// explicit prefix-of-all verification) so the assertion is differential, not a
// restatement of the reducer.

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

import {
  isPrefixLocus,
  comparableLoci,
  locusSegments,
  minimalAnchor,
} from "packages/ludics-engine/separation";

// ---------------------------------------------------------------------------
// AF family + play walker (same generators as the Phase-0 differential test)
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

const lineKey = (line: readonly ArgId[]): string => line.join(">");

type PlayEnd = "CON-stuck" | "PRO-stuck" | "ongoing";

function realizedPlay(
  af: AF,
  claim: ArgId,
  pro: Strategy,
  con: Strategy
): { line: ArgId[]; ended: PlayEnd } {
  const line: ArgId[] = [claim];
  const used = new Set<ArgId>([claim]);
  let current = claim;
  let turn: "CON" | "PRO" = "CON";
  const guard = 4 * af.args.length + 10;

  for (let step = 0; step < guard; step++) {
    if (turn === "CON") {
      const opts = attackersOf(af, current);
      if (opts.length === 0) return { line, ended: "CON-stuck" };
      const pick = con.get(lineKey(line));
      if (pick === undefined) return { line, ended: "ongoing" };
      line.push(pick);
      current = pick;
      turn = "PRO";
    } else {
      const opts = attackersOf(af, current).filter((o) => !used.has(o));
      if (opts.length === 0) return { line, ended: "PRO-stuck" };
      const pick = pro.get(lineKey(line));
      if (pick === undefined) return { line, ended: "ongoing" };
      used.add(pick);
      line.push(pick);
      current = pick;
      turn = "CON";
    }
  }
  return { line, ended: "ongoing" };
}

function locusAt(depth: number): string {
  if (depth === 0) return "0";
  return "0." + Array.from({ length: depth }, (_, k) => k + 1).join(".");
}

function buildPlayDesigns(
  line: ArgId[],
  ended: PlayEnd
): { pos: CoreAct[]; neg: CoreAct[]; pathById: Map<string, string>; idByPath: Map<string, string> } {
  const pos: CoreAct[] = [];
  const neg: CoreAct[] = [];
  const loci: string[] = [];

  for (let t = 0; t < line.length; t++) {
    const L = locusAt(t);
    loci.push(L);
    const proAsserts = t % 2 === 0;
    const positive: CoreAct = { id: `p${t}`, kind: "PROPER", polarity: "P", locusId: L };
    const negative: CoreAct = { id: `o${t}`, kind: "PROPER", polarity: "O", locusId: L };
    if (proAsserts) {
      pos.push(positive);
      neg.push(negative);
    } else {
      neg.push(positive);
      pos.push(negative);
    }
  }

  if (ended === "CON-stuck") {
    const L = locusAt(line.length);
    loci.push(L);
    neg.push({ id: "dagger", kind: "DAIMON", polarity: "daimon", locusId: L });
  }

  const uniq = Array.from(new Set(loci));
  const pathById = new Map(uniq.map((l) => [l, l] as const));
  const idByPath = new Map(uniq.map((l) => [l, l] as const));
  return { pos, neg, pathById, idByPath };
}

// ---------------------------------------------------------------------------
// Opponent family: drop each Proponent positive's dual O-act in turn
// ---------------------------------------------------------------------------
//
// Each single drop deletes the dual of some Proponent positive, forcing an
// `incoherent-move` divergence at that positive's locus — one non-orthogonal
// opponent `E`, one anchor `ξ(E)`. The family of single drops is `Sep(D)` for the
// purposes of this corroboration (each subset's run would diverge at the shallowest
// dropped dual, so single drops already realise every attainable anchor).

interface OpponentRun {
  anchor: string; // ξ(E)
  droppedIndex: number; // which neg O-act was removed to realise this run
}

function separatingAnchors(
  pos: CoreAct[],
  neg: CoreAct[],
  pathById: Map<string, string>,
  idByPath: Map<string, string>
): OpponentRun[] {
  const runs: OpponentRun[] = [];
  for (let i = 0; i < neg.length; i++) {
    const a = neg[i];
    if (!(a.kind === "PROPER" && a.polarity === "O")) continue;
    const input: StepCoreInput = {
      posActs: pos,
      negActs: neg.filter((_, k) => k !== i),
      pathById,
      idByPath,
      posParticipantId: "Proponent",
      negParticipantId: "Opponent",
    };
    const res = stepCore(input);
    if (res.status === "DIVERGENT" && res.divergenceLocus !== undefined) {
      runs.push({ anchor: res.divergenceLocus, droppedIndex: i });
    }
  }
  return runs;
}

// Independent oracle: the shallowest anchor (fewest segments), with an explicit
// prefix-of-all check. NO shared code with `minimalAnchor`.
function shallowestPrefixLeast(anchors: readonly string[]): string | undefined {
  if (anchors.length === 0) return undefined;
  let best = anchors[0];
  for (const a of anchors) {
    if (locusSegments(a).length < locusSegments(best).length) best = a;
  }
  // `best` is prefix-least only if it is a prefix of every anchor.
  for (const a of anchors) {
    let pre = true;
    const sb = locusSegments(best);
    const sa = locusSegments(a);
    if (sb.length > sa.length) pre = false;
    else for (let i = 0; i < sb.length; i++) if (sb[i] !== sa[i]) pre = false;
    if (!pre) return undefined; // no prefix-least (incomparable shape)
  }
  return best;
}

// ---------------------------------------------------------------------------
// Unit checks on the order `⊑` itself
// ---------------------------------------------------------------------------

describe("⊑ — prefix order on locus anchors (C012 §Phase 1)", () => {
  it("respects dot boundaries (segment-wise, not raw string prefix)", () => {
    expect(isPrefixLocus("0.1", "0.1.2")).toBe(true);
    expect(isPrefixLocus("0", "0.1.2")).toBe(true);
    expect(isPrefixLocus("0.1", "0.12")).toBe(false); // not a string-prefix trap
    expect(isPrefixLocus("0.1.2", "0.1")).toBe(false);
  });

  it("is a partial order with root '0' least", () => {
    const ξs = ["0", "0.1", "0.1.2", "0.2"];
    for (const a of ξs) expect(isPrefixLocus(a, a)).toBe(true); // reflexive
    for (const a of ξs) expect(isPrefixLocus("0", a)).toBe(true); // bottom
    // antisymmetry: mutual prefixes are equal
    for (const a of ξs)
      for (const b of ξs)
        if (isPrefixLocus(a, b) && isPrefixLocus(b, a)) expect(a).toBe(b);
    // transitivity
    expect(isPrefixLocus("0", "0.1") && isPrefixLocus("0.1", "0.1.2")).toBe(true);
    expect(isPrefixLocus("0", "0.1.2")).toBe(true);
  });

  it("is partial, not total — siblings are incomparable (negative-settlement shape)", () => {
    expect(comparableLoci("0.1", "0.2")).toBe(false);
    const m = minimalAnchor(["0.1", "0.2"]);
    expect(m.isChain).toBe(false);
    expect(m.exists).toBe(false);
    expect(m.min).toBeUndefined();
  });

  it("reducer returns the unique ⊑-least of a chain", () => {
    const m = minimalAnchor(["0.1.2", "0.1", "0.1.2.3"]);
    expect(m.isChain).toBe(true);
    expect(m.exists).toBe(true);
    expect(m.min).toBe("0.1");
  });
});

// ---------------------------------------------------------------------------
// The corroboration over allAFs(n)
// ---------------------------------------------------------------------------

const CAP = 8_000;

describe("C012 — minimal unshared commitment ξ* over allAFs(n) (exhaustive)", () => {
  for (const n of [1, 2, 3]) {
    it(`Sep(D) has a unique, realised ⊑-minimum on every AF and (σ,τ) for ${n} argument(s)`, () => {
      let designsWithSep = 0;
      let multiAnchorDesigns = 0; // designs whose opponent family spans >1 depth
      let totalRuns = 0;

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const pros = enumerateStrategies(af, claim, "PRO", CAP);
          const cons = enumerateStrategies(af, claim, "CON", CAP);
          for (const σ of pros) {
            for (const τ of cons) {
              const { line, ended } = realizedPlay(af, claim, σ, τ);
              const { pos, neg, pathById, idByPath } = buildPlayDesigns(line, ended);

              const runs = separatingAnchors(pos, neg, pathById, idByPath);
              if (runs.length === 0) continue;
              designsWithSep++;
              totalRuns += runs.length;

              const Sep = runs.map((r) => r.anchor);
              const distinct = new Set(Sep);
              if (distinct.size > 1) multiAnchorDesigns++;

              const m = minimalAnchor(Sep);

              // (chain) additive-free fragment ⟹ anchors never branch
              expect(m.isChain).toBe(true);

              // (existence) the ⊑-minimum exists
              expect(m.exists).toBe(true);
              expect(m.min).toBeDefined();

              // (uniqueness) exactly one anchor is a prefix of every other
              const leasts = [...distinct].filter((a) =>
                [...distinct].every((b) => isPrefixLocus(a, b))
              );
              expect(leasts.length).toBe(1);
              expect(leasts[0]).toBe(m.min);

              // (existence, differential) the reducer agrees with an independent
              // shallowest-prefix-least oracle
              expect(shallowestPrefixLeast(Sep)).toBe(m.min);

              // ξ* is genuinely a floor: every opponent diverges at or below it
              for (const ξ of Sep) expect(isPrefixLocus(m.min!, ξ)).toBe(true);

              // (realisation) ξ* is ξ(E*) for an actual enumerated opponent E*,
              // realised by a single run (one dropped dual)
              const witness = runs.find((r) => r.anchor === m.min);
              expect(witness).toBeDefined();
              expect(witness!.anchor).toBe(m.min);

              // ξ* is a real locus path of the design pair
              expect(pathById.has(m.min!)).toBe(true);
            }
          }
        }
      }

      expect(designsWithSep).toBeGreaterThan(0);
      expect(totalRuns).toBeGreaterThan(0);
      // the opponent family really spans multiple divergence depths somewhere,
      // so the ⊑-minimum is non-trivially the least of a genuine chain
      if (n >= 2) expect(multiAnchorDesigns).toBeGreaterThan(0);
    });
  }
});
