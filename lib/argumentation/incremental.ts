// lib/argumentation/incremental.ts
//
// Phase 4a of the argumentation-semantics consolidation roadmap: incremental
// grounded relabelling on graph extension.
//
// A deliberation grows by *adding* arguments and attacks. Recomputing the
// grounded labelling from ∅ on every edit is wasteful when the change is local.
// This module recomputes only the **affected region** — the newly-added
// arguments, arguments whose attacker set changed, and everything reachable
// from them along attack edges — while reusing the previous labels for the
// untouched part of the graph.
//
// Correctness (commitment C2 — exact, never approximate): an argument outside
// the affected region has an identical attack-ancestry to the previous graph,
// so its grounded label is unchanged. The result is therefore *bit-for-bit
// identical* to a full `groundedLabelling(next)` recompute; `incremental.test.ts`
// asserts this on random extensions.

import type { ArgId, DefeatGraph, Labelling } from "@/lib/argumentation/types";
import { attackersOf, groundedLabelling } from "@/lib/argumentation/labelling";

/** Adjacency: attacker → set-of-attacked, defaulting to the empty set. */
function outNeighbours(dg: DefeatGraph, a: ArgId): Set<ArgId> {
  return dg.attacks.get(a) ?? new Set<ArgId>();
}

/** Set equality on small string sets. */
function sameSet(a: Set<ArgId>, b: Set<ArgId>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * The arguments directly perturbed by going from `prev` to `next`: every
 * argument that is new, or whose set of attackers changed (gained or lost an
 * attacker). Arguments dropped in `next` are not reported (they no longer
 * exist); their former targets surface here via an attacker-set change.
 */
export function dirtySeed(prev: DefeatGraph, next: DefeatGraph): Set<ArgId> {
  const seed = new Set<ArgId>();
  const prevArgs = new Set(prev.args);
  for (const a of next.args) {
    if (!prevArgs.has(a)) {
      seed.add(a);
      continue;
    }
    if (!sameSet(attackersOf(prev, a), attackersOf(next, a))) seed.add(a);
  }
  return seed;
}

/**
 * The affected region: the forward-reachable closure of `seed` along attack
 * edges (if `a` is affected and `a` attacks `b`, then `b` may be relabelled).
 * Every argument *outside* this region has an unchanged grounded label.
 */
export function affectedRegion(next: DefeatGraph, seed: Set<ArgId>): Set<ArgId> {
  const affected = new Set<ArgId>(seed);
  const stack = [...seed];
  while (stack.length) {
    const a = stack.pop()!;
    for (const b of outNeighbours(next, a)) {
      if (!affected.has(b)) {
        affected.add(b);
        stack.push(b);
      }
    }
  }
  return affected;
}

export interface IncrementalResult {
  /** The grounded labelling of `next` (identical to a full recompute). */
  labelling: Labelling;
  /** The arguments that were recomputed. */
  affected: Set<ArgId>;
  /** Fixpoint sweeps over the affected region. */
  rounds: number;
}

/**
 * Recompute the grounded labelling of `next` incrementally, reusing
 * `prevLabelling` for the unaffected part of the graph.
 *
 * Preconditions: `prevLabelling` is the grounded labelling of `prev`. `next` is
 * any graph (typically `prev` extended with arguments/attacks). The result is
 * exact regardless of how `next` differs from `prev`; the incrementality is a
 * performance optimisation, not an approximation.
 */
export function relabelOnExtend(
  prev: DefeatGraph,
  prevLabelling: Labelling,
  next: DefeatGraph
): IncrementalResult {
  const seed = dirtySeed(prev, next);
  const affected = affectedRegion(next, seed);

  // Seed: unaffected args keep their (correct) previous label; affected args
  // are reset to UNDEC and recomputed from scratch. Any unaffected arg missing
  // from prevLabelling (shouldn't happen) is treated as affected.
  const lab: Labelling = new Map();
  for (const a of next.args) {
    if (affected.has(a)) {
      lab.set(a, "UNDEC");
    } else {
      const old = prevLabelling.get(a);
      if (old === undefined) {
        affected.add(a);
        lab.set(a, "UNDEC");
      } else {
        lab.set(a, old);
      }
    }
  }

  // Fixpoint over the affected region only. Unaffected attackers contribute
  // their fixed, correct labels; affected ones settle during iteration.
  const affectedList = [...affected];
  let changed = true;
  let rounds = 0;
  while (changed) {
    changed = false;
    rounds++;
    for (const a of affectedList) {
      if (lab.get(a) !== "UNDEC") continue;
      const atts = attackersOf(next, a);
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

  return { labelling: lab, affected, rounds };
}

/**
 * Convenience wrapper when no previous labelling is cached: computes the
 * previous grounded labelling first, then relabels incrementally. Mostly useful
 * in tests and as a drop-in that still benefits subsequent calls.
 */
export function relabelFrom(prev: DefeatGraph, next: DefeatGraph): IncrementalResult {
  return relabelOnExtend(prev, groundedLabelling(prev), next);
}
