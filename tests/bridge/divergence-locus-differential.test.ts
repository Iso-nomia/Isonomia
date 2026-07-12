// tests/bridge/divergence-locus-differential.test.ts
//
// Phase 0 of Direction 2 (separation / locus of disagreement) — extraction +
// E0 corroboration. See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/03-separation-locus-of-disagreement-2026-06-03.md
//   RESEARCH_PROGRAMME/03_CONJECTURES/C012-separation-minimal-locus.md  (Warm-up lemma E0)
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-040
//
// The kernel `stepCore` now surfaces the first-divergence address as a typed
// field `divergenceLocus` (packages/ludics-engine/stepCore.ts) — the path of the
// offending positive at the moment the deterministic alternating loop breaks
// `DIVERGENT`. This is the warm-up object E0: along the deterministic run
// `⟨D ∣ E⟩` the first address at which the two strategies cease to match is the
// path of the *first unmatched positive*, hence unique and computable.
//
// This test gives E0 differential teeth in two independent directions:
//
//   (1) ORACLE vs KERNEL. `firstUnmatchedPositive` below is a standalone
//       re-derivation of the multiplicative additive-free traversal (no shared
//       code with `stepCore`). For every encoded (D, E) pair it independently
//       computes the first-divergence address; we assert it coincides with
//       `stepCore(...).divergenceLocus` and that the field is populated exactly
//       on `DIVERGENT` runs. A faulty extraction (off-by-one cursor, wrong locus,
//       populated on STUCK/CONVERGENT) fails here.
//
//   (2) STEPPER ⟺ KERNEL. `stepInteraction` (the DB-coupled path) is a verbatim
//       delegate of `stepCore` — it returns `core.divergenceLocus` unchanged
//       (packages/ludics-engine/stepper.ts), and the engine's integration tests
//       witness `stepInteraction == stepCore` end-to-end (see the header of
//       stepcore-differential.test.ts). Driving real prisma here would add no
//       semantic coverage and is impossible in a pure unit test, so the
//       stepper-side surface is exercised through the pure projection
//       `divergenceLocusOf` (the helper `stepInteraction`'s post-core extraction
//       is identical to), asserted equal to `stepCore`'s field on every pair.
//
// Non-orthogonal (D, E) pairs are produced from the existing AF enumeration
// harness (allAFs(n), n ≤ 3): each faithful PRO/CON play is encoded as a design
// pair, then every single Opponent O-act is dropped in turn — deleting the dual
// of some Proponent positive forces an `incoherent-move` divergence at a
// determinate locus, the substrate of the E0 claim.

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
  divergenceLocusOf,
  type CoreAct,
  type StepCoreInput,
} from "packages/ludics-engine/stepCore";

// ---------------------------------------------------------------------------
// AF family + play walker (same generators as stepcore-differential.test.ts)
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
// Independent oracle — first unmatched positive (NO shared code with stepCore)
// ---------------------------------------------------------------------------
//
// Re-implements the multiplicative, additive-free traversal of the T005 fragment
// (no phase/focus, no virtual negatives, no draw loci, no additives — exactly the
// inputs this harness produces) from scratch, so the assertion below is a genuine
// differential check rather than a tautology. Returns the path of the first
// positive that has no available dual O at its locus, or `undefined` when the run
// converges (daimon reached) or gets stuck (no positive left to play).

function firstUnmatchedPositive(input: StepCoreInput): string | undefined {
  const { posActs, negActs, pathById } = input;
  const A = posActs;
  const B = negActs;
  let cursorA = 0;
  let cursorB = 0;
  let side: "A" | "B" = "A";
  const usedNeg = new Set<string>();
  const guard = A.length + B.length + 4;

  const nextPositive = (acts: CoreAct[], from: number) => {
    for (let i = from; i < acts.length; i++) {
      const a = acts[i];
      if (a.kind === "DAIMON") return { idx: i, act: a };
      if (a.kind === "PROPER" && a.polarity === "P") return { idx: i, act: a };
    }
    return null;
  };
  const dualAtLocus = (acts: CoreAct[], locusId: string) => {
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (a.kind === "PROPER" && a.polarity === "O" && a.locusId === locusId) {
        if (a.id && usedNeg.has(a.id)) continue;
        return { idx: i, act: a };
      }
    }
    return null;
  };

  for (let step = 0; step < guard; step++) {
    const posActsSide = side === "A" ? A : B;
    const negActsSide = side === "A" ? B : A;
    const posCursor = side === "A" ? cursorA : cursorB;

    const nextPos = nextPositive(posActsSide, posCursor);
    if (!nextPos) return undefined; // STUCK
    if (nextPos.act.kind === "DAIMON") return undefined; // CONVERGENT

    const locusPath = nextPos.act.locusId ? pathById.get(nextPos.act.locusId) : undefined;
    const dual = dualAtLocus(negActsSide, nextPos.act.locusId!);
    if (!dual) return locusPath; // DIVERGENT — first unmatched positive

    if (dual.act.id) usedNeg.add(dual.act.id);
    if (side === "A") {
      cursorA = nextPos.idx + 1;
      cursorB = dual.idx + 1;
      side = "B";
    } else {
      cursorB = nextPos.idx + 1;
      cursorA = dual.idx + 1;
      side = "A";
    }
  }
  return undefined;
}

// `stepInteraction`'s post-core extraction is `core.divergenceLocus` verbatim
// (packages/ludics-engine/stepper.ts); `divergenceLocusOf` is the pure projection
// it threads. Naming it here makes the (2) STEPPER ⟺ KERNEL leg explicit.
const divergenceViaStepper = divergenceLocusOf;

// ---------------------------------------------------------------------------
// Case generation: faithful play + every single Opponent O-act dropped
// ---------------------------------------------------------------------------

function* divergenceCases(
  pos: CoreAct[],
  neg: CoreAct[],
  pathById: Map<string, string>,
  idByPath: Map<string, string>
): Generator<StepCoreInput> {
  const base = (negActs: CoreAct[]): StepCoreInput => ({
    posActs: pos,
    negActs,
    pathById,
    idByPath,
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  });

  yield base(neg); // unperturbed (CONVERGENT / STUCK)

  for (let i = 0; i < neg.length; i++) {
    const a = neg[i];
    if (a.kind === "PROPER" && a.polarity === "O") {
      // Drop the dual of some Proponent positive → forces a divergence.
      yield base(neg.filter((_, k) => k !== i));
    }
  }
}

// ---------------------------------------------------------------------------
// The differential check
// ---------------------------------------------------------------------------

const CAP = 8_000;

describe("E0 — divergenceLocus extraction (kernel ⟺ oracle ⟺ stepper, exhaustive)", () => {
  for (const n of [1, 2, 3]) {
    it(`first-divergence address agrees on every AF and (σ,τ) for ${n} argument(s)`, () => {
      let cases = 0;
      let divergent = 0;

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const pros = enumerateStrategies(af, claim, "PRO", CAP);
          const cons = enumerateStrategies(af, claim, "CON", CAP);
          for (const σ of pros) {
            for (const τ of cons) {
              const { line, ended } = realizedPlay(af, claim, σ, τ);
              const { pos, neg, pathById, idByPath } = buildPlayDesigns(line, ended);

              for (const input of divergenceCases(pos, neg, pathById, idByPath)) {
                cases++;
                const res = stepCore(input);

                // (1) kernel field populated exactly on DIVERGENT runs
                const isDivergent = res.status === "DIVERGENT";
                expect(res.divergenceLocus !== undefined).toBe(isDivergent);

                // (1) kernel field == independent oracle
                expect(res.divergenceLocus).toBe(firstUnmatchedPositive(input));

                // (2) pure projection (the surface stepInteraction threads) agrees
                expect(divergenceViaStepper(input)).toBe(res.divergenceLocus);

                if (isDivergent) {
                  divergent++;
                  // the address is a real locus path of the design pair
                  expect(pathById.has(res.divergenceLocus!)).toBe(true);
                }
              }
            }
          }
        }
      }

      expect(cases).toBeGreaterThan(0);
      expect(divergent).toBeGreaterThan(0); // dropped duals do force divergences
    });
  }
});
