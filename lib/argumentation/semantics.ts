// lib/argumentation/semantics.ts
//
// Exact Dung semantics derived from the labelling core (Phase 1, commitments
// C1 + C2). All four semantics — grounded, preferred, stable, semi-stable —
// come from a single exact enumeration of complete extensions. There is no
// approximation and no node-count ceiling: the random/greedy fallbacks that
// previously lived in `afEngine.ts` and `deepdive/af.ts` are gone.
//
// Enumeration strategy. Every complete extension fixes the same IN/OUT decision
// for the arguments the grounded labelling already decides; only the arguments
// left UNDEC by grounded (the "undecided core") can vary. We therefore branch
// only over the core, with conflict-free pruning, and test completeness at the
// leaves. This is exact (preferred/stable enumeration is intractable in the
// worst case, as expected) but in practice fast because real frameworks have a
// small undecided core.

import type { ArgId, DefeatGraph } from "@/lib/argumentation/types";
import {
  groundedExtension,
  groundedLabelling,
  isComplete,
  attacks,
} from "@/lib/argumentation/labelling";

const keyOf = (S: Set<ArgId>): string => [...S].sort().join("\u0000");

const isSubset = (a: Set<ArgId>, b: Set<ArgId>): boolean => {
  if (a.size > b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
};

/**
 * All complete extensions of `dg`, computed exactly.
 *
 * The grounded extension is the ⊆-least complete extension; its IN/OUT
 * arguments are fixed in every complete extension, so we only branch over the
 * grounded-UNDEC core.
 */
export function completeExtensions(dg: DefeatGraph): Set<ArgId>[] {
  const gLab = groundedLabelling(dg);
  const forcedIn: ArgId[] = [];
  const core: ArgId[] = [];
  for (const a of dg.args) {
    const l = gLab.get(a);
    if (l === "IN") forcedIn.push(a);
    else if (l === "UNDEC") core.push(a);
    // OUT arguments are excluded from every complete extension.
  }

  const results: Set<ArgId>[] = [];
  const seen = new Set<string>();

  const conflictFreeToAdd = (S: Set<ArgId>, a: ArgId): boolean => {
    if (attacks(dg, a, a)) return false; // self-attack
    for (const s of S) {
      if (attacks(dg, a, s) || attacks(dg, s, a)) return false;
    }
    return true;
  };

  const base = new Set<ArgId>(forcedIn);

  const recur = (idx: number, S: Set<ArgId>): void => {
    if (idx === core.length) {
      if (isComplete(dg, S)) {
        const k = keyOf(S);
        if (!seen.has(k)) {
          seen.add(k);
          results.push(new Set(S));
        }
      }
      return;
    }
    const a = core[idx];
    // branch: leave `a` not-IN (it will be OUT or UNDEC, resolved by isComplete)
    recur(idx + 1, S);
    // branch: put `a` IN, if that keeps the set conflict-free
    if (conflictFreeToAdd(S, a)) {
      S.add(a);
      recur(idx + 1, S);
      S.delete(a);
    }
  };

  recur(0, base);
  return results;
}

/** The grounded extension (re-exported from the labelling core). */
export { groundedExtension } from "@/lib/argumentation/labelling";

/**
 * Preferred extensions — the ⊆-maximal complete extensions (equivalently the
 * ⊆-maximal admissible sets).
 */
export function preferredExtensions(dg: DefeatGraph): Set<ArgId>[] {
  const complete = completeExtensions(dg);
  const maximal: Set<ArgId>[] = [];
  for (const S of complete) {
    if (complete.some((T) => T !== S && isSubset(S, T) && T.size > S.size)) continue;
    maximal.push(S);
  }
  return maximal;
}

/**
 * Stable extensions — complete extensions whose labelling has no UNDEC, i.e.
 * every argument outside the extension is attacked by it.
 */
export function stableExtensions(dg: DefeatGraph): Set<ArgId>[] {
  const out: Set<ArgId>[] = [];
  for (const S of completeExtensions(dg)) {
    let stable = true;
    for (const a of dg.args) {
      if (S.has(a)) continue;
      // a is outside S; for stability it must be attacked by S
      let attacked = false;
      for (const s of S) {
        if (attacks(dg, s, a)) {
          attacked = true;
          break;
        }
      }
      if (!attacked) {
        stable = false;
        break;
      }
    }
    if (stable) out.push(S);
  }
  return out;
}

/**
 * Semi-stable extensions — complete extensions with ⊆-maximal range
 * (IN ∪ OUT), equivalently minimal UNDEC.
 */
export function semiStableExtensions(dg: DefeatGraph): Set<ArgId>[] {
  const complete = completeExtensions(dg);
  const rangeOf = (S: Set<ArgId>): Set<ArgId> => {
    const range = new Set<ArgId>(S);
    for (const a of dg.args) {
      if (range.has(a)) continue;
      for (const s of S) {
        if (attacks(dg, s, a)) {
          range.add(a);
          break;
        }
      }
    }
    return range;
  };
  const ranges = complete.map(rangeOf);
  const out: Set<ArgId>[] = [];
  for (let i = 0; i < complete.length; i++) {
    let maximal = true;
    for (let j = 0; j < complete.length; j++) {
      if (i === j) continue;
      if (
        isSubset(ranges[i], ranges[j]) &&
        ranges[j].size > ranges[i].size
      ) {
        maximal = false;
        break;
      }
    }
    if (maximal) out.push(complete[i]);
  }
  return out;
}
