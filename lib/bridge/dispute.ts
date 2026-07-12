// lib/bridge/dispute.ts
//
// Foundational-bridge (direction 1) — Phase 2 prototype.
//
// The translation ⟦·⟧ : abstract AF → Ludics designs, a faithful PURE model of
// the canonical orthogonality predicate on the multiplicative additive-free
// fragment, and the operational acceptance predicate the property test compares
// to the grounded extension.
//
// Spec: RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02b-translation-spec-af-to-designs-2026-06-02.md
//
// ENCODING (first pass — the four open decisions in the spec resolved as):
//   • One dispute interaction per (PRO strategy, CON strategy) pair; PRO and CON
//     strategies are enumerated explicitly (decision #1 — strategy designs).
//   • The dispute line is the locus path; root = PRO asserts the claim.
//   • Daimon (†, convergence) is played by PRO exactly when CON is stuck —
//     i.e. the argument PRO last asserted has no attacker (decision #2).
//   • Distinct subaddresses per advanced argument; no locus sharing across
//     siblings (decision #3) — avoids additive/collision structure entirely.
//   • The behaviour universe is the finite set of enumerated strategy designs
//     (decision #4).
//
// REPETITION RULE (the one substantive game choice): the standard grounded
// discussion game asymmetry — PRO may not re-assert an argument it has already
// played on the line; CON may repeat. This is what makes odd cycles resolve to
// "not accepted" and keeps every line finite.

import type {
  AF,
  ArgId,
  BridgeAct,
  DisputeDesign,
  InteractionStatus,
} from "./types";

// ---------------------------------------------------------------------------
// AF helpers
// ---------------------------------------------------------------------------

/** Attackers of `x`: `{ y | (y, x) ∈ attacks }`. */
export function attackersOf(af: AF, x: ArgId): ArgId[] {
  const out: ArgId[] = [];
  for (const [from, to] of af.attacks) if (to === x) out.push(from);
  return out;
}

// ---------------------------------------------------------------------------
// Strategy enumeration over the dispute tree
// ---------------------------------------------------------------------------
//
// A strategy is a choice function keyed by the dispute line so far:
//   key = the line (array of arg ids) → the arg the deciding player advances.
// A PRO strategy fixes PRO's counters (decisions taken when it is PRO's turn);
// a CON strategy fixes CON's attacks (decisions taken when it is CON's turn).
// A strategy must specify a choice at *every* reachable decision node of its
// player, across all branches the opponent can force — hence the cartesian
// merge over the opponent's options.

export type Strategy = Map<string, ArgId>;

const lineKey = (line: readonly ArgId[]): string => line.join(">");

type Turn = "PRO" | "CON";
const other = (t: Turn): Turn => (t === "PRO" ? "CON" : "PRO");

/** Thrown when strategy enumeration exceeds its bound (AF too large to enumerate). */
export class EnumerationTooLargeError extends Error {
  constructor(readonly bound: number) {
    super(`strategy enumeration exceeded bound ${bound}`);
    this.name = "EnumerationTooLargeError";
  }
}

function cartesianMerge(as: Strategy[], bs: Strategy[]): Strategy[] {
  const out: Strategy[] = [];
  for (const a of as) {
    for (const b of bs) {
      const m: Strategy = new Map(a);
      for (const [k, v] of b) m.set(k, v);
      out.push(m);
    }
  }
  return out;
}

/**
 * Enumerate all strategies for `decisionTurn` in the dispute rooted at the claim.
 *
 * `used` tracks the arguments PRO has asserted (PRO no-repeat); CON moves do not
 * extend it. Returns one `Strategy` per distinct choice function. The number of
 * strategies is multiplicative across opponent branches, so enumeration is
 * bounded by `cap`: it throws `EnumerationTooLargeError` rather than exhausting
 * memory on dense AFs (callers treat that as "skip", never as a verdict).
 */
export function enumerateStrategies(
  af: AF,
  claim: ArgId,
  decisionTurn: Turn,
  cap = 8_000
): Strategy[] {
  const guardSize = (n: number): void => {
    if (n > cap) throw new EnumerationTooLargeError(cap);
  };

  const rec = (
    line: ArgId[],
    used: Set<ArgId>,
    turn: Turn
  ): Strategy[] => {
    const current = line[line.length - 1];
    // Available moves: CON may repeat; PRO may not re-assert.
    const opts =
      turn === "CON"
        ? attackersOf(af, current)
        : attackersOf(af, current).filter((o) => !used.has(o));

    if (opts.length === 0) {
      // Leaf: no decision to record (CON-stuck → PRO wins; PRO-stuck → loses).
      return [new Map()];
    }

    if (turn === decisionTurn) {
      // This player decides → one strategy per chosen option.
      const res: Strategy[] = [];
      for (const o of opts) {
        const nextUsed = turn === "PRO" ? new Set(used).add(o) : used;
        for (const sub of rec([...line, o], nextUsed, other(turn))) {
          const m = new Map(sub);
          m.set(lineKey(line), o);
          res.push(m);
        }
        guardSize(res.length);
      }
      return res;
    }

    // Opponent moves → the strategy must cover every option (cartesian merge).
    let acc: Strategy[] = [new Map()];
    for (const o of opts) {
      const nextUsed = turn === "PRO" ? new Set(used).add(o) : used;
      const sub = rec([...line, o], nextUsed, other(turn));
      guardSize(acc.length * sub.length); // bound the product before allocating
      acc = cartesianMerge(acc, sub);
    }
    return acc;
  };

  return rec([claim], new Set([claim]), "CON");
}

// ---------------------------------------------------------------------------
// Faithful interaction (the canonical predicate, purely, on this fragment)
// ---------------------------------------------------------------------------

/**
 * Interact a PRO strategy against a CON strategy along the single dispute line
 * their choices jointly determine.
 *
 * This mirrors `stepInteraction`'s core loop on the multiplicative, additive-free
 * fragment: alternate polarity, match the locus, converge on a daimon, diverge
 * when the side to move is stuck. Orthogonality (D0.1) is `CONVERGENT`.
 *
 *   • CON's turn, no attacker of the current arg → CON stuck → PRO plays † →
 *     CONVERGENT (orthogonal).
 *   • PRO's turn, no un-used counter → PRO stuck → DIVERGENT (non-orthogonal).
 *
 * Bounded by PRO no-repeat (line length ≤ 2·|args|+1), so termination is
 * structural; the guard only protects against encoding bugs and, if ever hit,
 * returns ONGOING (undecided, D0.2) rather than a guessed verdict.
 */
export function interact(
  af: AF,
  claim: ArgId,
  pro: Strategy,
  con: Strategy
): InteractionStatus {
  const line: ArgId[] = [claim];
  const used = new Set<ArgId>([claim]);
  let current = claim;
  let turn: Turn = "CON";
  const guard = 4 * af.args.length + 10;

  for (let step = 0; step < guard; step++) {
    if (turn === "CON") {
      const opts = attackersOf(af, current);
      if (opts.length === 0) return "CONVERGENT"; // CON stuck → PRO daimon
      const pick = con.get(lineKey(line));
      if (pick === undefined) return "ONGOING"; // strategy underspecified (bug)
      line.push(pick);
      current = pick;
      turn = "PRO";
    } else {
      const opts = attackersOf(af, current).filter((o) => !used.has(o));
      if (opts.length === 0) return "DIVERGENT"; // PRO stuck
      const pick = pro.get(lineKey(line));
      if (pick === undefined) return "ONGOING";
      used.add(pick);
      line.push(pick);
      current = pick;
      turn = "CON";
    }
  }
  return "ONGOING";
}

// ---------------------------------------------------------------------------
// Acceptance via interaction (the operational bridge RHS)
// ---------------------------------------------------------------------------

export interface AcceptanceResult {
  /** Whether the claim is accepted by interaction, or undefined if skipped. */
  accepted: boolean | undefined;
  /** Number of PRO strategies enumerated. */
  proCount: number;
  /** Number of CON strategies enumerated. */
  conCount: number;
}

/**
 * Is `claim` accepted under the interaction semantics? — i.e. does PRO have a
 * strategy orthogonal (CONVERGENT) to *every* CON strategy?
 *
 *   accepted ⟺ ∃σ ∀τ. interact(σ, τ) = CONVERGENT
 *
 * This is the operational right-hand side of the §2 grounded-bridge conjecture,
 * computed by genuine interaction (not a shortcut). Returns `accepted:
 * undefined` when the strategy product exceeds `cap` (the AF is too large to
 * enumerate); the property test treats that as "skip", never as a verdict.
 */
export function acceptableByInteraction(
  af: AF,
  claim: ArgId,
  cap = 8_000
): AcceptanceResult {
  let pros: Strategy[];
  let cons: Strategy[];
  try {
    pros = enumerateStrategies(af, claim, "PRO", cap);
    cons = enumerateStrategies(af, claim, "CON", cap);
  } catch (err) {
    if (err instanceof EnumerationTooLargeError) {
      return { accepted: undefined, proCount: -1, conCount: -1 };
    }
    throw err;
  }
  if (pros.length * cons.length > cap) {
    return { accepted: undefined, proCount: pros.length, conCount: cons.length };
  }
  const accepted = pros.some((σ) =>
    cons.every((τ) => interact(af, claim, σ, τ) === "CONVERGENT")
  );
  return { accepted, proCount: pros.length, conCount: cons.length };
}

// ---------------------------------------------------------------------------
// Minimax reference (cross-check that interaction is faithful, not a shortcut)
// ---------------------------------------------------------------------------

/**
 * The grounded dispute-game value of `claim`, computed directly as a minimax:
 *   PRO-node (CON to move): PRO wins iff PRO wins for ALL of CON's attacks.
 *   CON-node (PRO to move): PRO wins iff PRO wins for SOME un-used counter.
 *
 * Should agree with `acceptableByInteraction` everywhere; the test asserts this
 * to confirm the strategy-enumeration + interaction is faithful to the game.
 */
export function disputeWins(af: AF, claim: ArgId): boolean {
  const proAtCon = (line: ArgId[], used: Set<ArgId>): boolean => {
    // It is CON's turn at the last (PRO-asserted) argument.
    const current = line[line.length - 1];
    const attacks = attackersOf(af, current);
    if (attacks.length === 0) return true; // CON stuck → PRO wins
    return attacks.every((c) => proAtPro([...line, c], used));
  };
  const proAtPro = (line: ArgId[], used: Set<ArgId>): boolean => {
    // It is PRO's turn at the last (CON-attacked) argument.
    const current = line[line.length - 1];
    const counters = attackersOf(af, current).filter((o) => !used.has(o));
    if (counters.length === 0) return false; // PRO stuck → PRO loses
    return counters.some((p) =>
      proAtCon([...line, p], new Set(used).add(p))
    );
  };
  return proAtCon([claim], new Set([claim]));
}

// ---------------------------------------------------------------------------
// Inspectable design artifact (the "actual design structure" ⟦·⟧ emits)
// ---------------------------------------------------------------------------

/**
 * Build the Proponent dispute design for `claim` as an inspectable tree of acts.
 * This is the documentation/debug artifact of ⟦·⟧⁺ (the interaction itself uses
 * the strategy-map form above). Loci encode the dispute line; PRO opens one
 * child per attacker; a † act marks where CON is stuck.
 */
export function buildDisputeDesign(af: AF, claim: ArgId): DisputeDesign {
  const acts: BridgeAct[] = [];
  const visit = (line: ArgId[], used: Set<ArgId>, turn: "P" | "O"): void => {
    const current = line[line.length - 1];
    const locusPath = ["0", ...line.slice(1)].join(".");
    if (turn === "P") {
      // PRO has just asserted `current`; opponents may attack at child loci.
      const attackers = attackersOf(af, current);
      if (attackers.length === 0) {
        acts.push({ polarity: "P", locusPath, kind: "DAIMON", ramification: [] });
        return;
      }
      acts.push({
        polarity: "P",
        locusPath,
        kind: "PROPER",
        arg: current,
        ramification: attackers.map((b) => [locusPath, b].join(".")),
      });
      for (const b of attackers) visit([...line, b], used, "O");
    } else {
      // CON has attacked with `current`; PRO counters with un-used attackers.
      const counters = attackersOf(af, current).filter((o) => !used.has(o));
      acts.push({
        polarity: "O",
        locusPath,
        kind: "PROPER",
        arg: current,
        ramification: counters.map((c) => [locusPath, c].join(".")),
      });
      for (const c of counters) visit([...line, c], new Set(used).add(c), "P");
    }
  };
  visit([claim], new Set([claim]), "P");
  return { role: "Proponent", rootArg: claim, acts };
}
