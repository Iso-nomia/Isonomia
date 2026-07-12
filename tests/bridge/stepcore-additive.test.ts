// tests/bridge/stepcore-additive.test.ts
//
// Session 21 — Step A: kernel `&`/`⊕` verification *in isolation*.
//
// The shared additive layer of the additive frontier (Q-039 / C011, and the
// participant-axis reuse Q-002 / C002) bets that the kernel's *one* additive
// primitive — exclusive superposition at an `isAdditive` locus — is the device
// the preferred/stable game branching (and the multi-agent opponent
// superposition) reduce to. That path (`isAdditive` / `usedAdditive` /
// `additive-violation` in packages/ludics-engine/stepCore.ts) has never been
// driven by a translation. Before writing `⟦·⟧₊` (Step B) we drive `stepCore`
// directly with hand-built additive designs and FREEZE its four invariants, so
// any later regression of the additive path is caught here rather than in the
// differential harness.
//
// Faithful flag placement (real persistence convention — appendActs.ts
// `assertAdditiveNotReused` / compileFromMoves.ts "mark additivity on opener"):
// the additive flag sits on the **P opener at the PARENT locus**; that parent's
// sibling children are the mutually-exclusive alternatives. Committing two
// distinct children is the ADDITIVE_REUSE / `additive-violation` event.
//
// Scope: this is a KERNEL unit test, not a dialogue-realism test. The act lists
// are minimal sequences chosen to exercise the mechanism; the `&`-vs-`⊕`
// (which side owns the locus / how the design pool is quantified) reading is
// Step B/C, not here.
//
// Session 21:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/21-additive-layer-translation-spec-stable-first-2026-06-28.md
// Kernel: packages/ludics-engine/stepCore.ts

import { describe, it, expect } from "@jest/globals";

import { stepCore, type CoreAct, type StepCoreInput } from "packages/ludics-engine/stepCore";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
//
// Loci are encoded as dot-paths and used directly as `locusId` (so pathById /
// idByPath are identity maps — same convention as stepcore-differential.test.ts).

type Pol = "P" | "O";

/** A PROPER act at `locus` with polarity `pol`; `isAdditive` marks an opener. */
const act = (id: string, pol: Pol, locus: string, isAdditive = false): CoreAct => ({
  id,
  kind: "PROPER",
  polarity: pol,
  locusId: locus,
  isAdditive,
});

/** A daimon (†) at `locus` — closes a line CONVERGENT when reached. */
const daimon = (id: string, locus: string): CoreAct => ({
  id,
  kind: "DAIMON",
  polarity: "daimon",
  locusId: locus,
});

/** Identity locus maps over every locusId appearing in the two designs. */
function run(posActs: CoreAct[], negActs: CoreAct[]): ReturnType<typeof stepCore> {
  const loci = new Set<string>();
  for (const a of [...posActs, ...negActs]) if (a.locusId) loci.add(a.locusId);
  const pathById = new Map([...loci].map((l) => [l, l] as const));
  const idByPath = new Map([...loci].map((l) => [l, l] as const));
  const input: StepCoreInput = {
    posActs,
    negActs,
    pathById,
    idByPath,
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  };
  return stepCore(input);
}

// ---------------------------------------------------------------------------
// Invariant 1 — committing ONE child of an additive parent continues the run,
// and `usedAdditive` records the chosen suffix.
// ---------------------------------------------------------------------------

describe("additive kernel — invariant 1: one committed child records & continues", () => {
  it("records usedAdditive[parent]=suffix and converges (no violation)", () => {
    // Proponent opens at "0" (additive), child "0.1" is the single committed
    // branch; the line then converges at a daimon.
    const pos: CoreAct[] = [
      act("open", "P", "0", /* isAdditive */ true),
      act("oa1", "O", "0.1"),
      daimon("dG", "0.1.1"),
    ];
    const neg: CoreAct[] = [
      act("ob0", "O", "0"),
      act("pb1", "P", "0.1"),
    ];

    const res = run(pos, neg);

    expect(res.status).toBe("CONVERGENT");
    expect(res.reason).toBeUndefined();
    expect(res.usedAdditive).toEqual({ "0": "1" }); // the committed branch is recorded
    expect(res.divergenceLocus).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Invariant 2 — committing a SECOND, distinct child of the same additive parent
// breaks DIVERGENT with reason `additive-violation`, and `divergenceLocus` is
// the offending child.
// ---------------------------------------------------------------------------

describe("additive kernel — invariant 2: a second distinct child violates", () => {
  it("DIVERGENT/additive-violation at the offending sibling locus", () => {
    // Opener at "0" (additive); the run commits "0.1" (usedAdditive["0"]="1"),
    // then a positive fires at the SIBLING "0.2" — the exclusive-choice breach.
    const pos: CoreAct[] = [
      act("open", "P", "0", /* isAdditive */ true),
      act("oa1", "O", "0.1"),
      act("pa2", "P", "0.2"),
    ];
    const neg: CoreAct[] = [
      act("ob0", "O", "0"),
      act("pb1", "P", "0.1"),
      act("ob2", "O", "0.2"),
    ];

    const res = run(pos, neg);

    expect(res.status).toBe("DIVERGENT");
    expect(res.reason).toBe("additive-violation");
    expect(res.divergenceLocus).toBe("0.2");
    // The first commitment is still on record at the moment of the breach.
    expect(res.usedAdditive).toEqual({ "0": "1" });
  });
});

// ---------------------------------------------------------------------------
// Invariant 3 — re-committing the SAME child (idempotent choice) does NOT
// violate; the run proceeds as if the additive choice were never re-made.
// ---------------------------------------------------------------------------

describe("additive kernel — invariant 3: re-committing the same child is benign", () => {
  it("no additive-violation when the same suffix fires twice", () => {
    // "0.1" fires twice under the additive opener at "0"; the second firing has
    // the same suffix "1", so the exclusive-choice guard passes.
    const pos: CoreAct[] = [
      act("open", "P", "0", /* isAdditive */ true),
      act("oa1", "O", "0.1"),
      act("pa1b", "P", "0.1"),
    ];
    const neg: CoreAct[] = [
      act("ob0", "O", "0"),
      act("pb1", "P", "0.1"),
      act("ob1b", "O", "0.1"),
      daimon("dG", "0.9"),
    ];

    const res = run(pos, neg);

    expect(res.reason).not.toBe("additive-violation");
    expect(res.status).toBe("CONVERGENT");
    expect(res.usedAdditive).toEqual({ "0": "1" });
    expect(res.divergenceLocus).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Invariant 4 — an additive parent with a SINGLE child degenerates to the
// multiplicative case: the verdict and the pairing are byte-for-byte identical
// to the same design with the opener NOT marked additive; the only difference is
// the `usedAdditive` bookkeeping entry.
// ---------------------------------------------------------------------------

describe("additive kernel — invariant 4: arity-1 additive ≡ multiplicative", () => {
  const designs = (openerAdditive: boolean): [CoreAct[], CoreAct[]] => [
    [
      act("open", "P", "0", openerAdditive),
      act("oa1", "O", "0.1"),
      daimon("dG", "0.1.1"),
    ],
    [
      act("ob0", "O", "0"),
      act("pb1", "P", "0.1"),
    ],
  ];

  it("status and pairing match; additive flag only adds bookkeeping", () => {
    const [posM, negM] = designs(false); // multiplicative
    const [posA, negA] = designs(true); // additive opener, single child

    const mult = run(posM, negM);
    const add = run(posA, negA);

    // Identical behaviour…
    expect(add.status).toBe(mult.status);
    expect(add.status).toBe("CONVERGENT");
    expect(add.pairs.length).toBe(mult.pairs.length);
    expect(add.pairs.map((p) => p.locusPath)).toEqual(mult.pairs.map((p) => p.locusPath));
    // …the ONLY difference is the additive bookkeeping entry.
    expect(mult.usedAdditive).toEqual({});
    expect(add.usedAdditive).toEqual({ "0": "1" });
  });
});
