// tests/bridge/additive-internalisation.test.ts
//
// Session 21 — Step B: `⟦·⟧₊` (the additive emitter) + the ⊕/&-quantified
// acceptance predicate, validated against the grounded base case (T005).
//
// Step B's correctness criterion (session 21 §6 decision 1): the `⊕`
// internalisation must faithfully reproduce `∃σ` — i.e. the additive translation
// must agree with grounded acceptance on the additive-free / single-line
// fragment, with the isAdditive flags present but (Step-A invariant 4) inert at
// arity 1. Three checks:
//
//   (1) STRUCTURAL — `buildAdditiveDisputeDesign` places `&` on PRO-assertion
//       openers with ≥2 attack lines and `⊕` on CON-attack openers with ≥2
//       un-used PRO counters, and nowhere else.
//   (2) KERNEL-DRIVEN — running the REAL kernel (stepCore) over the isAdditive-
//       annotated resolved designs reproduces grounded acceptance over every AF
//       on n ≤ 3 (the additive path does not perturb the grounded verdict).
//   (3) PREDICATE AGREEMENT — the lib `acceptableByAdditiveInteraction` (∃ρ∀τ
//       over additive resolutions) coincides with the established grounded RHS
//       `acceptableByInteraction`.
//
// Session 21:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/21-additive-layer-translation-spec-stable-first-2026-06-28.md
// Emitter: lib/bridge/disputeAdditive.ts ; kernel: packages/ludics-engine/stepCore.ts

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  acceptableByInteraction,
  acceptableByAdditiveInteraction,
  buildAdditiveDisputeDesign,
  forkCensus,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

import { stepCore, type CoreAct } from "packages/ludics-engine/stepCore";

// ---------------------------------------------------------------------------
// AF family (same generator as the keystone / differential tests)
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
// (1) Structural — additives land exactly at the forks
// ---------------------------------------------------------------------------

describe("⟦·⟧₊ structural — additive openers land exactly at game forks", () => {
  it("a ⊕-fork: PRO has two un-used counters (one isAdditive O-opener)", () => {
    // a1 attacks a0; a2, a3 both attack a1 → PRO has two defences of a0.
    const af: AF = {
      args: ["a0", "a1", "a2", "a3"],
      attacks: [["a1", "a0"], ["a2", "a1"], ["a3", "a1"]],
    };
    expect(forkCensus(af, "a0")).toEqual({ andForks: 0, plusForks: 1 });

    const d = buildAdditiveDisputeDesign(af, "a0");
    const plus = d.acts.filter((a) => a.isAdditive && a.polarity === "O");
    expect(plus).toHaveLength(1);
    expect(plus[0].locusPath).toBe("0.a1"); // the CON-attack opener
    expect(plus[0].ramification.sort()).toEqual(["0.a1.a2", "0.a1.a3"]);
  });

  it("a &-fork: a0 has two attack lines (one isAdditive P-opener)", () => {
    // a1, a2 both attack a0 → opponent chooses which line to run.
    const af: AF = {
      args: ["a0", "a1", "a2"],
      attacks: [["a1", "a0"], ["a2", "a0"]],
    };
    expect(forkCensus(af, "a0")).toEqual({ andForks: 1, plusForks: 0 });

    const d = buildAdditiveDisputeDesign(af, "a0");
    const and = d.acts.filter((a) => a.isAdditive && a.polarity === "P");
    expect(and).toHaveLength(1);
    expect(and[0].locusPath).toBe("0"); // the PRO-assertion opener
    expect(and[0].ramification.sort()).toEqual(["0.a1", "0.a2"]);
  });

  it("a single-line dispute carries NO additives (additive-free, as T005)", () => {
    // a1 attacks a0; a2 attacks a1 — one defence, one attack line.
    const af: AF = {
      args: ["a0", "a1", "a2"],
      attacks: [["a1", "a0"], ["a2", "a1"]],
    };
    expect(forkCensus(af, "a0")).toEqual({ andForks: 0, plusForks: 0 });
    expect(buildAdditiveDisputeDesign(af, "a0").acts.every((a) => !a.isAdditive)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Realized play + isAdditive-annotated kernel designs
// ---------------------------------------------------------------------------

type PlayEnd = "CON-stuck" | "PRO-stuck" | "ongoing";

/** Walk the single line (σ,τ) co-determine under PRO-no-repeat / CON-repeat. */
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

/**
 * Is the opener at depth `t` of `line` an additive fork? Mirrors
 * `buildAdditiveDisputeDesign`: even depth (PRO assertion) → `&` iff ≥2 attackers
 * of `line[t]`; odd depth (CON attack) → `⊕` iff ≥2 un-used PRO counters.
 */
function isAdditiveAtDepth(af: AF, line: ArgId[], t: number): boolean {
  if (t % 2 === 0) return attackersOf(af, line[t]).length >= 2;
  const used = new Set<ArgId>();
  for (let i = 0; i < t; i += 2) used.add(line[i]); // PRO-asserted so far
  return attackersOf(af, line[t]).filter((o) => !used.has(o)).length >= 2;
}

/** Faithful kernel encoding of a resolved play, with isAdditive set at forks. */
function buildPlayDesignsAdditive(
  af: AF,
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
    const add = isAdditiveAtDepth(af, line, t);
    const positive: CoreAct = { id: `p${t}`, kind: "PROPER", polarity: "P", locusId: L, isAdditive: add };
    const negative: CoreAct = { id: `o${t}`, kind: "PROPER", polarity: "O", locusId: L, isAdditive: add };
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

/** ∃ρ∀τ over the REAL kernel on the isAdditive-annotated resolved designs. */
function acceptedViaAdditiveKernel(af: AF, claim: ArgId, cap = 8_000): boolean | undefined {
  let pros: Strategy[];
  let cons: Strategy[];
  try {
    pros = enumerateStrategies(af, claim, "PRO", cap);
    cons = enumerateStrategies(af, claim, "CON", cap);
  } catch {
    return undefined;
  }
  if (pros.length * cons.length > cap) return undefined;
  return pros.some((ρ) =>
    cons.every((τ) => {
      const { line, ended } = realizedPlay(af, claim, ρ, τ);
      const { pos, neg, pathById, idByPath } = buildPlayDesignsAdditive(af, line, ended);
      const res = stepCore({
        posActs: pos,
        negActs: neg,
        pathById,
        idByPath,
        posParticipantId: "Proponent",
        negParticipantId: "Opponent",
      });
      return res.status === "CONVERGENT";
    })
  );
}

// ---------------------------------------------------------------------------
// (2) Kernel-driven + (3) predicate agreement, exhaustive over n ≤ 3
// ---------------------------------------------------------------------------

describe("⟦·⟧₊ Step B — additive internalisation reproduces grounded", () => {
  for (const n of [1, 2, 3]) {
    it(`additive predicate ⟺ grounded ⟺ additive-kernel, every AF (${n} arg)`, () => {
      let checked = 0;
      let skipped = 0;
      let sawAdditive = false;
      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const grounded = acceptableByInteraction(af, claim);
          const additive = acceptableByAdditiveInteraction(af, claim);
          if (grounded.accepted === undefined || additive.accepted === undefined) {
            skipped++;
            continue;
          }
          checked++;
          // (3) lib additive predicate coincides with the established grounded RHS.
          expect(additive.accepted).toBe(grounded.accepted);
          // (2) the REAL kernel over isAdditive designs agrees too.
          const viaKernel = acceptedViaAdditiveKernel(af, claim);
          expect(viaKernel).toBe(grounded.accepted);
          // Non-vacuity: at least some AFs actually exercise an additive fork.
          if (forkCensus(af, claim).andForks + forkCensus(af, claim).plusForks > 0) {
            sawAdditive = true;
          }
        }
      }
      expect(checked).toBeGreaterThan(0);
      expect(skipped).toBe(0); // n ≤ 3 stays within the enumeration bound
      if (n >= 2) expect(sawAdditive).toBe(true); // the additive path is exercised
    });
  }
});
