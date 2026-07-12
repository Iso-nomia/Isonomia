// tests/bridge/separation-daimon-closed-harness.test.ts
//
// Q-041 / Direction 2 — R2 corroboration: the DAIMON-CLOSED test harness (the
// proper-test analogue of the truncation harness). See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/04-separating-context-predicate-decision-2026-06-04.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-041 (O1: linear-leastness)
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T008-minimal-separating-context-daimon-closed.md
//
// WHAT THIS IS (and how it contrasts the truncation harness).
// -----------------------------------------------------------
// `tests/bridge/separation-truncation-harness.test.ts` freezes the BROKEN object:
// a raw truncation `E↾ℓ` simply STOPS, and `stepCore` reads "stopped" as
// "diverged," so a strict ODD-depth prefix `ℓ ⊏ ξ(E)` SEPARATES (DIVERGENT) — a
// `⊑`-smaller separating context than `ξ(E)`, refuting leastness. (DO NOT modify
// that file; it is the contrast fixture.)
//
// This harness exercises the PROPER object (route R2, session 04): a *complete,
// daimon-closed counter-design* — a test that, on its own turn at a frontier, plays
// the daimon `†` (concedes / closes) instead of running out of acts. The claim it
// corroborates (T008) is the working hypothesis of session 04 §2:
//
//   Against proper daimon-closed tests, `ξ(E)` IS the `⊑`-minimal separating
//   context on the linear chronicle, and the parity artifact DISSOLVES.
//
// Concretely, at exactly the ODD-depth frontiers where a raw truncation DIVERGED
// (breaking leastness), the proper test CONCEDES (`†` on its own turn) and
// `⟨D ∣ T⟩` CONVERGES — so it does NOT separate. The only proper test that
// separates is the genuine non-conceding refusal `E` itself, which diverges at
// `ξ(E)`. Hence `ξ(E)` is the unique, `⊑`-least separating context.
//
// The verdicts frozen here are the GROUND TRUTH the T008 abstract normalization
// proves; together with the truncation harness they pin the *exact* boundary where
// `stepCore ∘ ⟦·⟧` is faithful (proper tests) vs unfaithful (raw truncations) —
// the faithfulness lemma of T008 §Faithfulness.

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

// ---------------------------------------------------------------------------
// Design builders (same encoding as the truncation harness + the daimon `†`)
// ---------------------------------------------------------------------------

const P = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId });
const O = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId });
/** The daimon `†` — a POSITIVE act by which a complete design concedes / closes. */
const DAGGER = (locusId: string, id: string): CoreAct => ({ id, kind: "DAIMON", polarity: "daimon", locusId });

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

interface RunObservation {
  status: string;
  reason?: string;
  divergenceLocus?: string;
  matched: string[];
}

function run(pos: CoreAct[], neg: CoreAct[], paths: string[]): RunObservation {
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
  return {
    status: r.status,
    reason: r.reason,
    divergenceLocus: r.divergenceLocus,
    matched: r.pairs.map((p) => p.locusPath),
  };
}

const depthOf = (locus: string): number => locusSegments(locus).length - 1;

// A faithful linear chronicle of `len` rounds (loci at depths 0..len-1):
//   D (pos): even depth → P ; odd depth → O
//   E (neg): even depth → O ; odd depth → P   (the dual)
// E plays POSITIVE acts at ODD depths — those are its turns to move, where a
// complete design plays its proper attack OR concedes with `†`.
function faithfulChronicle(len: number): { D: CoreAct[]; Efull: CoreAct[]; paths: string[] } {
  const paths = chainPaths(len - 1);
  const D: CoreAct[] = [];
  const Efull: CoreAct[] = [];
  for (let t = 0; t < len; t++) {
    const L = paths[t];
    if (t % 2 === 0) {
      D.push(P(L, `p${t}`));
      Efull.push(O(L, `o${t}`));
    } else {
      D.push(O(L, `o${t}`));
      Efull.push(P(L, `r${t}`));
    }
  }
  return { D, Efull, paths };
}

/**
 * The proper, daimon-closed counter-design that CONCEDES at E-positive turn `j`
 * (`j` ODD). It plays E's proper chronicle through depth `j-1` — every O-receive
 * at even depths `< j` and every P-attack at odd depths `< j` — and then, on its
 * own turn at depth `j`, plays `†` (concede) instead of the proper attack.
 *
 * This is the proper analogue of "stop the test at frontier `d_{j}`": where the
 * raw truncation is simply ABSENT (and `D` over-runs → DIVERGENT), the complete
 * design CLOSES (`†` → CONVERGENT). Carries its O-receives, unlike a truncation.
 */
function concedeAt(Efull: CoreAct[], j: number, paths: string[]): CoreAct[] {
  const acts: CoreAct[] = [];
  for (let t = 0; t < j; t++) acts.push(Efull[t]); // proper actions at depths 0..j-1
  acts.push(DAGGER(paths[j], `dagger${j}`)); // concede on E's own turn at depth j
  return acts;
}

// ---------------------------------------------------------------------------
// 1. Explicit frozen fixtures — the parity artifact DISSOLVES
// ---------------------------------------------------------------------------

describe("daimon-closed harness — frozen R2 witnesses (proper tests recover leastness)", () => {
  it("length-5 chronicle: ξ(E)=0.1.2.3.4; every shallower CONCESSION converges (no early separation)", () => {
    const { D, Efull, paths } = faithfulChronicle(5);
    // Genuine refusal: the proper non-conceding test that withholds the deepest
    // grant O@0.1.2.3.4 — this is the real disagreement, diverging at ξ(E).
    const Erefuse = Efull.filter((a) => a.locusId !== "0.1.2.3.4");

    const xi = run(D, Erefuse, paths);
    expect(xi.status).toBe("DIVERGENT");
    expect(xi.divergenceLocus).toBe("0.1.2.3.4");

    // The proper daimon-closed tests that concede at each E-positive turn j ⊏ ξ(E).
    // j = 1 (0.1) and j = 3 (0.1.2.3) are EXACTLY the odd-depth frontiers whose RAW
    // truncations DIVERGED in the truncation harness — here they CONVERGE.
    const table = [1, 3].map((j) => {
      const r = run(D, concedeAt(Efull, j, paths), paths);
      return { concedeDepth: j, frontier: paths[j], status: r.status, at: r.divergenceLocus };
    });

    expect(table).toEqual([
      { concedeDepth: 1, frontier: "0.1", status: "CONVERGENT", at: undefined },
      { concedeDepth: 3, frontier: "0.1.2.3", status: "CONVERGENT", at: undefined },
    ]);

    // Leastness, recovered: no proper test with a frontier strictly ⊏ ξ(E)
    // separates; the unique separating proper test diverges exactly at ξ(E).
    for (const row of table) {
      expect(row.status).not.toBe("DIVERGENT");
      expect(isPrefixLocus(row.frontier, "0.1.2.3.4")).toBe(true);
      expect(depthOf(row.frontier)).toBeLessThan(depthOf("0.1.2.3.4"));
    }
  });

  it("length-3 chronicle: ξ(E)=0.1.2; the concession at 0.1 converges (truncation diverged)", () => {
    const { D, Efull, paths } = faithfulChronicle(3);
    const Erefuse = Efull.filter((a) => a.locusId !== "0.1.2");

    const xi = run(D, Erefuse, paths);
    expect(xi.status).toBe("DIVERGENT");
    expect(xi.divergenceLocus).toBe("0.1.2");

    // The odd-depth frontier 0.1 (which SEPARATED under raw truncation) now CONCEDES.
    const r = run(D, concedeAt(Efull, 1, paths), paths);
    expect(r.status).toBe("CONVERGENT");
    expect(r.divergenceLocus).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Generalized scan over allAFs(n) — leastness holds SYSTEMICALLY under proper
//    tests, exactly where the raw-truncation harness showed it fails.
// ---------------------------------------------------------------------------

const lineKey = (line: readonly ArgId[]): string => line.join(">");
type PlayEnd = "CON-stuck" | "PRO-stuck" | "ongoing";

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

function buildPlayDesigns(line: ArgId[]): { pos: CoreAct[]; neg: CoreAct[]; paths: string[] } {
  const pos: CoreAct[] = [];
  const neg: CoreAct[] = [];
  const loci: string[] = [];
  for (let t = 0; t < line.length; t++) {
    const L = locusAt(t);
    loci.push(L);
    if (t % 2 === 0) {
      pos.push(P(L, `p${t}`));
      neg.push(O(L, `o${t}`));
    } else {
      pos.push(O(L, `o${t}`));
      neg.push(P(L, `r${t}`));
    }
  }
  return { pos, neg, paths: Array.from(new Set(loci)) };
}

const CAP = 8_000;

describe("daimon-closed harness — leastness is systemic over allAFs(n) (proper tests)", () => {
  for (const n of [1, 2, 3]) {
    it(`every concession ⊏ ξ(E) converges and only ξ(E) separates for ${n} argument(s)`, () => {
      let chronicles = 0;
      let leastnessRecovered = 0;

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
              const { line } = realizedPlay(af, claim, σ, τ);
              const { pos, neg, paths } = buildPlayDesigns(line);

              // Deepest dropped-dual opponent (the genuine refusal): drop the
              // deepest neg O-act → DIVERGENT at the deepest D-positive locus ξ(E).
              const oIdx = [...neg.keys()].filter(
                (i) => neg[i].kind === "PROPER" && neg[i].polarity === "O"
              );
              if (oIdx.length === 0) continue;
              const deepest = oIdx[oIdx.length - 1];
              const Erefuse = neg.filter((_, k) => k !== deepest);
              const xiRun = run(pos, Erefuse, paths);
              if (xiRun.status !== "DIVERGENT" || xiRun.divergenceLocus === undefined) continue;
              const xi = xiRun.divergenceLocus;
              const xiDepth = depthOf(xi);
              chronicles++;

              // The proper non-conceding refusal separates exactly at ξ(E)…
              expect(isPrefixLocus(xi, xi)).toBe(true);

              // …and EVERY proper daimon-closed test that concedes at an E-positive
              // turn j (odd) strictly before ξ(E) CONVERGES — D wins, no early
              // separation. These j are precisely the odd-depth frontiers whose RAW
              // truncations DIVERGED in the truncation harness.
              let anyConcession = false;
              for (let j = 1; j < xiDepth; j += 2) {
                const r = run(pos, concedeAt(neg, j, paths), paths);
                anyConcession = true;
                // Proper concession converges; it never separates (no DIVERGENT).
                expect(r.status).toBe("CONVERGENT");
                expect(r.divergenceLocus).toBeUndefined();
              }

              // Leastness recovered wherever there was room for a shallower frontier.
              if (xiDepth >= 2) {
                expect(anyConcession).toBe(true);
                leastnessRecovered++;
              }
            }
          }
        }
      }

      expect(chronicles).toBeGreaterThan(0);
      if (n >= 2) expect(leastnessRecovered).toBeGreaterThan(0);
    });
  }
});
