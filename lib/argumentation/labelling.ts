// lib/argumentation/labelling.ts
//
// Labelling-based primitives for the Dung core (Phase 1, commitment C1).
//
// The grounded labelling is computed directly as the least fixpoint; complete
// labellings (and hence preferred/stable/semi-stable) are characterised in
// terms of *defence* so that `semantics.ts` can enumerate them exactly.

import type { ArgId, DefeatGraph, Label, Labelling } from "@/lib/argumentation/types";

// ---- graph adapters --------------------------------------------------------

/** Build a DefeatGraph from the edge-list representation (afEngine `AF`). */
export function toDefeatGraphFromEdgeList(
  A: string[],
  R: Array<[string, string]>
): DefeatGraph {
  const attacks = new Map<ArgId, Set<ArgId>>();
  for (const a of A) attacks.set(a, new Set());
  for (const [from, to] of R) {
    if (!attacks.has(from)) attacks.set(from, new Set());
    if (!attacks.has(to)) attacks.set(to, new Set());
    attacks.get(from)!.add(to);
  }
  return { args: [...A], attacks };
}

/** Build a DefeatGraph from the attack-map representation (deepdive `af`). */
export function toDefeatGraphFromAttackMap(
  nodes: string[],
  attackMap: Map<string, Set<string>>
): DefeatGraph {
  const attacks = new Map<ArgId, Set<ArgId>>();
  for (const n of nodes) attacks.set(n, new Set(attackMap.get(n) ?? []));
  return { args: [...nodes], attacks };
}

// ---- attack/defence helpers ------------------------------------------------

/** Arguments that attack `x`. */
export function attackersOf(dg: DefeatGraph, x: ArgId): Set<ArgId> {
  const out = new Set<ArgId>();
  for (const [a, tos] of dg.attacks) if (tos.has(x)) out.add(a);
  return out;
}

/** Does `a` attack `b`? */
export function attacks(dg: DefeatGraph, a: ArgId, b: ArgId): boolean {
  return dg.attacks.get(a)?.has(b) ?? false;
}

/** Does the set `S` attack `b` (some member attacks `b`)? */
export function setAttacks(dg: DefeatGraph, S: Set<ArgId>, b: ArgId): boolean {
  for (const a of S) if (dg.attacks.get(a)?.has(b)) return true;
  return false;
}

/** Is `S` conflict-free (no member attacks another, including self-attack)? */
export function isConflictFree(dg: DefeatGraph, S: Set<ArgId>): boolean {
  for (const a of S) {
    const tos = dg.attacks.get(a);
    if (!tos) continue;
    for (const b of S) if (tos.has(b)) return false;
  }
  return true;
}

/** Does `S` defend `x` (every attacker of `x` is attacked by `S`)? */
export function defends(dg: DefeatGraph, S: Set<ArgId>, x: ArgId): boolean {
  for (const b of attackersOf(dg, x)) {
    if (!setAttacks(dg, S, b)) return false;
  }
  return true;
}

/** Dung's characteristic function F(S) = { a | S defends a }. */
export function characteristic(dg: DefeatGraph, S: Set<ArgId>): Set<ArgId> {
  const out = new Set<ArgId>();
  for (const a of dg.args) if (defends(dg, S, a)) out.add(a);
  return out;
}

/** `S` is admissible iff it is conflict-free and defends each of its members. */
export function isAdmissible(dg: DefeatGraph, S: Set<ArgId>): boolean {
  if (!isConflictFree(dg, S)) return false;
  for (const a of S) if (!defends(dg, S, a)) return false;
  return true;
}

/**
 * `S` is a complete extension iff it is conflict-free and for every argument
 * `a`: a ∈ S ⟺ S defends a. (Admissible + contains everything it defends.)
 */
export function isComplete(dg: DefeatGraph, S: Set<ArgId>): boolean {
  if (!isConflictFree(dg, S)) return false;
  for (const a of dg.args) {
    if (defends(dg, S, a) !== S.has(a)) return false;
  }
  return true;
}

// ---- grounded labelling ----------------------------------------------------

/**
 * The grounded labelling — the least complete labelling (most UNDEC).
 *
 * Iterative fixpoint: an UNDEC argument becomes IN when all its attackers are
 * OUT, and OUT when some attacker is IN. Terminates in ≤ |args| sweeps (the
 * acceptability computation is a finite Knaster–Tarski fixpoint, Q-031).
 */
export function groundedLabelling(dg: DefeatGraph): Labelling {
  return groundedLabellingDetailed(dg).labelling;
}

/**
 * Grounded labelling plus the number of fixpoint sweeps performed. Exposed so
 * structured (ASPIC+) callers can keep reporting an `iterations` diagnostic
 * while still delegating the actual computation to this single core.
 */
export function groundedLabellingDetailed(
  dg: DefeatGraph
): { labelling: Labelling; rounds: number } {
  const lab: Labelling = new Map();
  for (const a of dg.args) lab.set(a, "UNDEC");

  let changed = true;
  let rounds = 0;
  while (changed) {
    changed = false;
    rounds++;
    for (const a of dg.args) {
      if (lab.get(a) !== "UNDEC") continue;
      const atts = attackersOf(dg, a);
      if ([...atts].every((b) => lab.get(b) === "OUT")) {
        lab.set(a, "IN");
        changed = true;
        continue;
      }
      if ([...atts].some((b) => lab.get(b) === "IN")) {
        lab.set(a, "OUT");
        changed = true;
      }
    }
  }
  return { labelling: lab, rounds };
}

/** The grounded extension (the IN-labelled arguments of the grounded labelling). */
export function groundedExtension(dg: DefeatGraph): Set<ArgId> {
  const lab = groundedLabelling(dg);
  const out = new Set<ArgId>();
  for (const [a, l] of lab) if (l === "IN") out.add(a);
  return out;
}

/** The IN/OUT/UNDEC labelling induced by a (complete) extension `E`. */
export function labellingOf(dg: DefeatGraph, E: Set<ArgId>): Labelling {
  const lab: Labelling = new Map();
  for (const a of dg.args) {
    if (E.has(a)) lab.set(a, "IN");
    else if (setAttacks(dg, E, a)) lab.set(a, "OUT");
    else lab.set(a, "UNDEC");
  }
  return lab;
}

/** Convenience: split a labelling into IN/OUT/UNDEC sets. */
export function labellingToSets(lab: Labelling): {
  IN: Set<ArgId>;
  OUT: Set<ArgId>;
  UNDEC: Set<ArgId>;
} {
  const IN = new Set<ArgId>();
  const OUT = new Set<ArgId>();
  const UNDEC = new Set<ArgId>();
  for (const [a, l] of lab) {
    if (l === "IN") IN.add(a);
    else if (l === "OUT") OUT.add(a);
    else UNDEC.add(a);
  }
  return { IN, OUT, UNDEC };
}
