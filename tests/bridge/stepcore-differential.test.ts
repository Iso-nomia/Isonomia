// tests/bridge/stepcore-differential.test.ts
//
// Phase 3 — discharge of T005 Future-work item 2 (Lemma A's one external appeal).
//
// Lemma A claims the bridge's pure `interact` (lib/bridge/dispute.ts) reduces the
// *canonical* Ludics orthogonality predicate — `stepInteraction` returning
// `CONVERGENT` — on the multiplicative, additive-free fragment the translation
// emits. The cross-check (T005 §3.2) flagged that this appeal was unverified:
// `interact` is a standalone re-implementation that never confronts the real
// engine, and the existing tests gave it zero evidence.
//
// This test closes that gap. `stepInteraction`'s decision procedure was lifted
// verbatim into the pure kernel `stepCore` (packages/ludics-engine/stepCore.ts),
// which `stepInteraction` now delegates to. Here we encode each realized dispute
// play as a faithful Proponent(pos)/Opponent(neg) Ludics design pair and run the
// REAL kernel over it, asserting its CONVERGENT verdict coincides with
// `interact`'s — exhaustively, over every AF on n ≤ 3 args and every
// (PRO strategy, CON strategy) pair.
//
// Non-circularity: the daimon is placed by the *structural* translation rule
// (PRO acknowledges with † at a locus whose asserted argument has no attacker —
// decision #2 of the translation spec), never from a precomputed verdict. The
// engine then decides convergence by its own locus-matched traversal; a faulty
// traversal (locus mismatch, cursor/daimon/additive misfire) would diverge from
// `interact` and fail here.
//
// T005: RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T005-grounded-ludics-keystone.md

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  interact,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

import { stepCore, type CoreAct } from "packages/ludics-engine/stepCore";

// ---------------------------------------------------------------------------
// AF family (same generator as the keystone exhaustive test)
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

// ---------------------------------------------------------------------------
// The realized play (pure move rule — NO convergence verdict)
// ---------------------------------------------------------------------------
//
// Walk the single dispute line that a PRO strategy `pro` and CON strategy `con`
// co-determine, exactly under the grounded game's asymmetric repetition rule
// (PRO may not re-assert; CON may repeat). Returns the move sequence and which
// player is left with no legal move. This is the move rule shared by `interact`,
// `disputeWins` and the translation ⟦·⟧ — it is *not* where convergence is
// decided.

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

// ---------------------------------------------------------------------------
// Faithful encoding of a play as a Ludics design pair for the REAL kernel
// ---------------------------------------------------------------------------
//
// The line alternates PRO-assertion (even depth, starting with the claim) and
// CON-attack (odd depth). At each depth the asserting side contributes a positive
// (P) act and the receiving side a dual negative (O) act at the same locus; the
// kernel pairs them and alternates sides. A † (DAIMON) is appended to the
// Opponent design iff the play ends CON-stuck — i.e. PRO last asserted an
// argument with no attacker — which is the translation's structural daimon rule.

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

/** Does the REAL engine kernel converge on the faithful encoding of this play? */
function convergesViaStepCore(
  af: AF,
  claim: ArgId,
  pro: Strategy,
  con: Strategy
): boolean {
  const { line, ended } = realizedPlay(af, claim, pro, con);
  const { pos, neg, pathById, idByPath } = buildPlayDesigns(line, ended);
  const res = stepCore({
    posActs: pos,
    negActs: neg,
    pathById,
    idByPath,
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  });
  return res.status === "CONVERGENT";
}

// ---------------------------------------------------------------------------
// The differential check
// ---------------------------------------------------------------------------

const CAP = 8_000;

describe("Lemma A discharge — interact ⟺ real stepCore (per play, exhaustive)", () => {
  for (const n of [1, 2, 3]) {
    it(`coincides on every AF and every (σ,τ) for ${n} argument(s)`, () => {
      let plays = 0;
      let skipped = 0;
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
          for (const σ of pros) {
            for (const τ of cons) {
              plays++;
              const viaInteract = interact(af, claim, σ, τ) === "CONVERGENT";
              const viaEngine = convergesViaStepCore(af, claim, σ, τ);
              // The canonical predicate (real kernel) agrees with the pure model.
              expect(viaEngine).toBe(viaInteract);
            }
          }
        }
      }
      expect(plays).toBeGreaterThan(0);
      expect(skipped).toBe(0); // n ≤ 3 stays within the enumeration bound
    });
  }
});

describe("Lemma A discharge — acceptance predicate agrees (∃σ∀τ)", () => {
  for (const n of [1, 2, 3]) {
    it(`acceptable-by-interact ⟺ acceptable-by-engine for ${n} argument(s)`, () => {
      let checked = 0;
      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const pros = enumerateStrategies(af, claim, "PRO", CAP);
          const cons = enumerateStrategies(af, claim, "CON", CAP);
          const acceptableInteract = pros.some((σ) =>
            cons.every((τ) => interact(af, claim, σ, τ) === "CONVERGENT")
          );
          const acceptableEngine = pros.some((σ) =>
            cons.every((τ) => convergesViaStepCore(af, claim, σ, τ))
          );
          checked++;
          expect(acceptableEngine).toBe(acceptableInteract);
        }
      }
      expect(checked).toBe(n * (1 << (n * n)));
    });
  }
});
