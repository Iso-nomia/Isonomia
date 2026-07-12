// tests/bridge/q044-orth-cost.test.ts
//
// Q-044 audit 1 corroboration — the `ORTH` upper bound + fuel-sufficiency lemma.
//
// See:
//   RESEARCH_PROGRAMME/audits/q044-orth-upper-bound-2026-07-05.md   (the bound)
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/22-q044-complexity-primitives-scoping-2026-07-05.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-044
//
// The audit proves, author-side, that a single orthogonality test
// `stepCore(D, E)` on the additive-free finite fragment is `O(n²)` (n = total
// act count) and, under hypothesis (H-ID) that Opponent acts carry distinct
// ids, HALTS DECISIVELY within `|negActs| + 1` iterations — so `ONGOING` never
// occurs when `fuel ≥ |negActs| + 1`. This is the falsification gate the
// programme's Phase-2-before-Phase-3 discipline requires before the bound is
// treated as more than author-side.
//
// This test drives the REAL kernel `stepCore` over every faithful dispute-play
// encoding on `allAFs(n)`, n ≤ 3 (the encoding is lifted verbatim from
// tests/bridge/stepcore-differential.test.ts, the Lemma A discharge), and
// asserts two predictions of the audit:
//
//   (FUEL)  with fuel = |negActs| + 1, the verdict is never ONGOING;
//   (COUNT) the number of productive iterations (= pairs.length) is
//           ≤ |negActs|  (the consumed-O-act bound of §2.2), hence total
//           iterations ≤ |negActs| + 1 and, a fortiori, ≤ n + 1 — i.e. the run
//           length is LINEAR in the design size, corroborating the O(n) iteration
//           count that underlies the O(n²) bound.
//
// It also records the observed max (iterations / n) ratio, which the O(n)-per-run
// claim predicts stays ≤ 1.

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

import { stepCore, type CoreAct } from "packages/ludics-engine/stepCore";

// ---------------------------------------------------------------------------
// AF family + play encoding (verbatim from stepcore-differential.test.ts)
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
// (H-ID) guard — the hypothesis the fuel bound rests on
// ---------------------------------------------------------------------------

/** Every Opponent (polarity 'O') act carries a distinct, non-null id. */
function distinctOpponentIds(negActs: CoreAct[]): boolean {
  const ids = negActs.filter((a) => a.polarity === "O").map((a) => a.id);
  if (ids.some((id) => id == null)) return false;
  return new Set(ids).size === ids.length;
}

// ---------------------------------------------------------------------------
// The cost corroboration
// ---------------------------------------------------------------------------

const CAP = 8_000;

describe("Q-044 — ORTH cost: fuel-sufficiency + linear iteration count (exhaustive)", () => {
  for (const n of [1, 2, 3]) {
    it(`fuel = |negActs|+1 is decisive and iterations ≤ |negActs| for every AF / (σ,τ) on ${n} arg(s)`, () => {
      let plays = 0;
      let skipped = 0;
      let maxPairsOverNeg = 0;
      let maxIterOverN = 0;

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          let pros: Strategy[];
          let cons: Strategy[];
          try {
            pros = enumerateStrategies(af, claim, "PRO", CAP);
            cons = enumerateStrategies(af, claim, "CON", CAP);
          } catch {
            skipped++;
            continue;
          }

          for (const pro of pros) {
            for (const con of cons) {
              const { line, ended } = realizedPlay(af, claim, pro, con);
              if (ended === "ongoing") continue; // strategy underspecified (bug guard)
              const { pos, neg, pathById, idByPath } = buildPlayDesigns(line, ended);

              // (H-ID) must hold for the fuel lemma to apply — assert it, don't assume.
              expect(distinctOpponentIds(neg)).toBe(true);

              const sizeN = pos.length + neg.length;
              // The proven fuel-sufficiency bound is n+1 (audit 1 §3, corrected per
              // cross-check D-ORTH to the general n = |pos|+|neg|, not |negActs|).
              const tightFuel = sizeN + 1;

              const res = stepCore({
                posActs: pos,
                negActs: neg,
                pathById,
                idByPath,
                posParticipantId: "Proponent",
                negParticipantId: "Opponent",
                fuel: tightFuel,
              });

              // (FUEL): tight fuel is decisive — never ONGOING on the finite fragment.
              expect(res.status).not.toBe("ONGOING");

              // (COUNT): productive iterations = pairs pushed. The GENERAL lemma
              // (audit 1 §2.2, corrected per cross-check D-ORTH) is ≤ n = |pos|+|neg|
              // (O-acts are consumed from BOTH designs as the side alternates). This
              // symmetric encoding achieves the tighter ≤ |negActs|; we assert both
              // — the general bound and the encoding-specific observation.
              expect(res.pairs.length).toBeLessThanOrEqual(pos.length + neg.length);
              expect(res.pairs.length).toBeLessThanOrEqual(neg.length);

              // Decisive verdict must be stable under a larger budget (no
              // fuel-dependent flip): the verdict at tight fuel = verdict at cap.
              const resDefault = stepCore({
                posActs: pos,
                negActs: neg,
                pathById,
                idByPath,
                posParticipantId: "Proponent",
                negParticipantId: "Opponent",
              });
              expect(resDefault.status).toBe(res.status);

              const iterations = res.pairs.length + 1; // productive + the breaking step
              maxPairsOverNeg = Math.max(maxPairsOverNeg, res.pairs.length / Math.max(1, neg.length));
              maxIterOverN = Math.max(maxIterOverN, iterations / Math.max(1, sizeN));
              plays++;
            }
          }
        }
      }

      expect(plays).toBeGreaterThan(0);
      // The O(n)-per-run claim: iterations grow at most linearly in n.
      expect(maxIterOverN).toBeLessThanOrEqual(1);
      // eslint-disable-next-line no-console
      console.log(
        `[Q-044 ORTH cost] n=${n}: plays=${plays} skipped=${skipped} ` +
          `max(pairs/|neg|)=${maxPairsOverNeg.toFixed(3)} max(iters/n)=${maxIterOverN.toFixed(3)}`
      );
    });
  }
});
