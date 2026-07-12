// lib/bridge/disputeAdditive.ts
//
// Foundational-bridge (direction 1) — Phase 4, the additive frontier.
//
// `⟦·⟧₊` : abstract AF → ADDITIVE Ludics designs. Extends the grounded,
// additive-free translation (`buildDisputeDesign`, dispute.ts) by marking the
// **game branch points** with the additive-opener flag, and nowhere else
// (decision #3 — distinct subaddresses — is relaxed exactly at the forks).
//
// Spec: RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/21-additive-layer-translation-spec-stable-first-2026-06-28.md
//   §2.1  `⊕` (proponent internal choice of defence)  — an isAdditive opener
//          whose ramification is the set of PRO counters at a CON-attacked locus
//          (≥2 un-used counters = a real fork).
//   §2.2  `&` (opponent external choice of attack line) — an isAdditive opener
//          whose ramification is the set of CON attacks at a PRO-asserted locus
//          (≥2 attackers = a real fork).
//   §2.3  everything else stays multiplicative (no flag, distinct subaddresses).
//
// THE §1 FINDING, MADE CONCRETE. The kernel (stepCore.ts) fires its
// exclusive-choice guard on POSITIVE acts only. In a Proponent design the
// positive acts are PRO's own moves (the assertion at "0" and the counters), so:
//   • the `⊕` fork (PRO counters, positive children) IS enforced by the kernel's
//     `additive-violation` — two distinct committed counters diverge;
//   • the `&` fork (CON attacks, negative children) is NOT enforced by the
//     kernel's additive primitive (no positive child to fire the guard) — it is
//     realised by the `∀τ` quantifier over opponent tests in the acceptance
//     predicate below.
// So the `&`-marker on a PRO-assertion opener is **documentary** (it records that
// the opponent has an external choice there); the verdict-bearing additive
// discipline is the `⊕`-marker plus the test-pool quantifier. This is exactly
// session 21 §1 ("the `&`/`⊕` duality lives in the quantifier, on one kernel
// primitive"), surfaced by the emitter itself.

import {
  attackersOf,
  enumerateStrategies,
  interact,
  EnumerationTooLargeError,
  type Strategy,
} from "./dispute";
import type { AF, ArgId, BridgeAct, DisputeDesign } from "./types";

// ---------------------------------------------------------------------------
// ⟦·⟧₊⁺ — the additive Proponent design (inspectable artifact)
// ---------------------------------------------------------------------------

/**
 * Build the **additive** Proponent dispute design for `claim`: the grounded
 * dispute tree (`buildDisputeDesign`) with `isAdditive` set at every game branch
 * point — `&` on a PRO-assertion opener with ≥2 attackers, `⊕` on a CON-attack
 * opener with ≥2 un-used PRO counters. Non-fork loci stay multiplicative
 * (additive-free), so on a single-line (grounded) dispute this coincides with
 * the grounded design up to the (inert, by Step-A invariant 4) flag.
 */
export function buildAdditiveDisputeDesign(af: AF, claim: ArgId): DisputeDesign {
  const acts: BridgeAct[] = [];
  const visit = (line: ArgId[], used: Set<ArgId>, turn: "P" | "O"): void => {
    const current = line[line.length - 1];
    const locusPath = ["0", ...line.slice(1)].join(".");
    if (turn === "P") {
      // PRO has just asserted `current`; the opponent may attack at child loci.
      // The opponent's alternative attack lines are an external (`&`) choice.
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
        // `&` — opponent external choice. Documentary: the kernel does not fire
        // on these negative children; the `∀τ` quantifier realises the choice.
        isAdditive: attackers.length >= 2,
      });
      for (const b of attackers) visit([...line, b], used, "O");
    } else {
      // CON has attacked with `current`; PRO counters with un-used attackers.
      // PRO's alternative defences are an internal (`⊕`) choice.
      const counters = attackersOf(af, current).filter((o) => !used.has(o));
      acts.push({
        polarity: "O",
        locusPath,
        kind: "PROPER",
        arg: current,
        ramification: counters.map((c) => [locusPath, c].join(".")),
        // `⊕` — proponent internal choice. Verdict-bearing: the kernel's
        // exclusive-choice guard fires on the positive PRO counters below.
        isAdditive: counters.length >= 2,
      });
      for (const c of counters) visit([...line, c], new Set(used).add(c), "P");
    }
  };
  visit([claim], new Set([claim]), "P");
  return { role: "Proponent", rootArg: claim, acts };
}

// ---------------------------------------------------------------------------
// Fork census (structural inspection of where `⟦·⟧₊` places additives)
// ---------------------------------------------------------------------------

export interface ForkCensus {
  /** `&`-forks: PRO-assertion loci with ≥2 opponent attack lines. */
  andForks: number;
  /** `⊕`-forks: CON-attack loci with ≥2 un-used PRO counters. */
  plusForks: number;
}

/** Count the additive openers `buildAdditiveDisputeDesign` emits, by kind. */
export function forkCensus(af: AF, claim: ArgId): ForkCensus {
  const d = buildAdditiveDisputeDesign(af, claim);
  let andForks = 0;
  let plusForks = 0;
  for (const a of d.acts) {
    if (!a.isAdditive) continue;
    if (a.polarity === "P") andForks++;
    else plusForks++;
  }
  return { andForks, plusForks };
}

// ---------------------------------------------------------------------------
// Acceptance via additive interaction (the ⊕/&-quantified predicate)
// ---------------------------------------------------------------------------

export interface AdditiveAcceptanceResult {
  /** Accepted by additive interaction, or `undefined` if the AF was skipped. */
  accepted: boolean | undefined;
  /** Number of `⊕`-resolutions (PRO strategies) quantified over. */
  resolutionCount: number;
  /** Number of `&`-tests (CON strategies) quantified over. */
  testCount: number;
}

/**
 * Is `claim` accepted under the **additive** reading of the dispute?
 *
 *   accepted ⟺ ∃ρ (a resolution of the `⊕`-openers) ∀τ (a `&`-test).
 *               interact(ρ, τ) = CONVERGENT
 *
 * The `⊕` (proponent internal choice) is internalised as a quantifier over the
 * resolutions of the additive Proponent design — each resolution commits one
 * child at every `⊕`-opener, i.e. one un-used counter at every PRO fork, which
 * is exactly a PRO strategy. The `&` (opponent external choice) is the `∀` over
 * CON strategies (opponent tests). So the additive predicate is `∃ρ∀τ`, the same
 * shape T005's `acceptableByInteraction` computes — by construction the
 * `⊕`-internalisation reproduces `∃σ` (session 21 §6 decision 1). The Step-B
 * differential test confronts this with the REAL kernel over the isAdditive
 * designs; Step C then changes the game (stable's conflict-free / all-attacking
 * constraint) on top of this machinery.
 *
 * Returns `accepted: undefined` when the strategy product exceeds `cap` (the AF
 * is too large to enumerate); callers treat that as "skip", never a verdict.
 */
export function acceptableByAdditiveInteraction(
  af: AF,
  claim: ArgId,
  cap = 8_000
): AdditiveAcceptanceResult {
  let resolutions: Strategy[];
  let tests: Strategy[];
  try {
    resolutions = enumerateStrategies(af, claim, "PRO", cap);
    tests = enumerateStrategies(af, claim, "CON", cap);
  } catch (err) {
    if (err instanceof EnumerationTooLargeError) {
      return { accepted: undefined, resolutionCount: -1, testCount: -1 };
    }
    throw err;
  }
  if (resolutions.length * tests.length > cap) {
    return {
      accepted: undefined,
      resolutionCount: resolutions.length,
      testCount: tests.length,
    };
  }
  const accepted = resolutions.some((ρ) =>
    tests.every((τ) => interact(af, claim, ρ, τ) === "CONVERGENT")
  );
  return {
    accepted,
    resolutionCount: resolutions.length,
    testCount: tests.length,
  };
}

// ---------------------------------------------------------------------------
// Stable semantics — the additive commit-set reading (session 21 Step C)
// ---------------------------------------------------------------------------
//
// THE READING (session 21 §3). A stable extension is NOT recovered by the
// grounded interactive descent (`acceptableByAdditiveInteraction`): the grounded
// game's PRO-no-repeat rule is exactly what restricts it to the grounded
// extension, and it actively MIS-certifies stable sets that defend themselves by
// repetition (the 2-cycle `a ↔ b`: `{a}` is stable, but PRO cannot re-assert `a`
// to answer the attack `b`, so the grounded game rejects it). Stable is instead
// a **quantifier-plus-constraint** change: the `⊕`-resolution *commits* a set `E`
// (which arguments the Proponent superposes), and acceptance is whether `⟦E⟧₊⁺`
// is **orthogonal to the `&`-superposed universal opponent test** — i.e. answers
// every opponent branch. That orthogonality unfolds to exactly two conditions:
//
//   • conflict-free  — the committed `⊕`-branches do not attack each other
//                      (PRO's commitments are mutually coherent);
//   • all-attacking  — every argument the opponent could raise from outside `E`
//                      is attacked by `E` (every `&`-branch is answered).
//
// which is the Dung definition of a stable extension. So for stable the additive
// interaction is the *one-shot* orthogonality of the committed design to the
// universal test, NOT the recursive grounded game — confirming §3's grading of
// stable as the tractable, constraint-driven shakedown.

/** `E` is conflict-free: no committed argument attacks another (or itself). */
export function conflictFree(af: AF, E: Set<ArgId>): boolean {
  for (const e of E) {
    for (const attacker of attackersOf(af, e)) {
      if (E.has(attacker)) return false;
    }
  }
  return true;
}

/** `E` is all-attacking: every argument outside `E` is attacked by some member. */
export function allAttacking(af: AF, E: Set<ArgId>): boolean {
  for (const b of af.args) {
    if (E.has(b)) continue;
    const attackedByE = attackersOf(af, b).some((y) => E.has(y));
    if (!attackedByE) return false;
  }
  return true;
}

/**
 * `E` is a **stable extension by the additive reading**: `⟦E⟧₊⁺` is orthogonal to
 * the `&`-superposed universal opponent test — equivalently conflict-free and
 * all-attacking (see module note). The one-shot orthogonality reading of stable.
 */
export function isStableByAdditive(af: AF, E: Set<ArgId>): boolean {
  return conflictFree(af, E) && allAttacking(af, E);
}

function* subsetsOf(args: ArgId[]): Generator<Set<ArgId>> {
  const n = args.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const s = new Set<ArgId>();
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s.add(args[i]);
    yield s;
  }
}

/** All stable extensions, computed via the additive commit-set reading. */
export function stableExtensionsByAdditive(af: AF): Set<ArgId>[] {
  const out: Set<ArgId>[] = [];
  for (const E of subsetsOf(af.args)) {
    if (isStableByAdditive(af, E)) out.push(E);
  }
  return out;
}

/** `a` is **credulously** stable-accepted: in some additive stable extension. */
export function credulouslyStableByAdditive(af: AF, a: ArgId): boolean {
  return stableExtensionsByAdditive(af).some((E) => E.has(a));
}

/**
 * `a` is **skeptically** stable-accepted: in *every* additive stable extension,
 * and at least one exists. Empty-stable is handled explicitly as the
 * deliberation-substrate convention — no stable extension ⇒ nothing is stably
 * skeptically justified (returns `false`), rather than vacuous truth.
 */
export function skepticallyStableByAdditive(af: AF, a: ArgId): boolean {
  const S = stableExtensionsByAdditive(af);
  if (S.length === 0) return false;
  return S.every((E) => E.has(a));
}

// ---------------------------------------------------------------------------
// Preferred semantics — the maximality fork (session 21 Step D)
// ---------------------------------------------------------------------------
//
// Preferred = the `⊆`-maximal admissible sets. The admissible part lifts the
// Step-C reading: a `⊕`-resolution commits a conflict-free set `E` that DEFENDS
// each of its members (every attacker of a member is itself attacked by `E`) —
// answered via the same one-shot orthogonality, NOT the grounded descent (the
// 2-cycle repetition trap, Step C). What preferred ADDS is maximality, and that
// is the pre-registered obstruction: `⊆`-maximality is a global property of the
// whole extension lattice with **no local interactive counterpart** — there is
// no orthogonality test, on one design pair, that reads "this admissible set is
// `⊆`-maximal." So the bridge recovers preferred as `interactive defence (⊕/&) +
// a bolted-on maximality constraint`, not by interaction alone. This is exactly
// the realizability characterization §3 names as the publishable outcome:
// admissibility/defence IS interactively realizable; maximality is not — it is a
// post-hoc selection over the realizable sets.

/** `E` defends `x`: every attacker of `x` is attacked by some member of `E`. */
function defends(af: AF, E: Set<ArgId>, x: ArgId): boolean {
  return attackersOf(af, x).every((b) => attackersOf(af, b).some((y) => E.has(y)));
}

/** `E` is admissible: conflict-free and defends each of its members. */
export function isAdmissibleByAdditive(af: AF, E: Set<ArgId>): boolean {
  if (!conflictFree(af, E)) return false;
  for (const x of E) if (!defends(af, E, x)) return false;
  return true;
}

const isSubset = (S: Set<ArgId>, T: Set<ArgId>): boolean => {
  for (const x of S) if (!T.has(x)) return false;
  return true;
};

/** Preferred extensions via the additive reading: ⊆-maximal admissible sets. */
export function preferredExtensionsByAdditive(af: AF): Set<ArgId>[] {
  const adm: Set<ArgId>[] = [];
  for (const E of subsetsOf(af.args)) if (isAdmissibleByAdditive(af, E)) adm.push(E);
  // ⊆-maximality is the bolted-on constraint (no interactive counterpart).
  return adm.filter(
    (E) => !adm.some((T) => T !== E && T.size > E.size && isSubset(E, T))
  );
}

/** `a` is **credulously** preferred-accepted: in some preferred extension. */
export function credulouslyPreferredByAdditive(af: AF, a: ArgId): boolean {
  return preferredExtensionsByAdditive(af).some((E) => E.has(a));
}

/**
 * `a` is **skeptically** preferred-accepted: in *every* preferred extension. A
 * preferred extension always exists (at least `∅`), so no empty guard is needed.
 */
export function skepticallyPreferredByAdditive(af: AF, a: ArgId): boolean {
  return preferredExtensionsByAdditive(af).every((E) => E.has(a));
}

