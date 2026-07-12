// packages/ludics-engine/separation.ts
//
// Direction 2 (separation / locus of disagreement), Phase 1/2 vocabulary in code.
// See:
//   RESEARCH_PROGRAMME/03_CONJECTURES/C012-separation-minimal-locus.md  (§Phase 1)
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T006-first-divergence-locus-e0.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-040
//
// This is the pure order `⊑` on locus paths (the prefix order from C012 §Phase 1)
// together with the reducer that computes the `⊑`-least anchor of a set of
// separating-context anchors — the **minimal unshared commitment** `ξ*`, when it
// exists. Zero I/O, no prisma, no clock: it mirrors the purity of `stepCore`
// (which surfaces each opponent's first-divergence anchor as `divergenceLocus`),
// so the theorem object and the Phase-2 harness share one definition.
//
// Loci are dot-separated paths ("0", "0.1", "0.1.2", …) reusing the existing
// `pairs[].locusPath` address space (there is no `LocusPath` type). The prefix
// order is taken on **segments**, not raw strings: "0.1" ⊑ "0.1.2" but
// "0.1" ⋢ "0.12".

/** Split a locus path into its dot-separated segments ("0.1.2" → ["0","1","2"]). */
export function locusSegments(path: string): string[] {
  return path.split(".");
}

/**
 * `a ⊑ b` — `a` is a prefix (initial segment) of `b` on the dispute tree.
 * Reflexive, antisymmetric, transitive (a partial order); the root "0" is the
 * global least. Compared segment-wise so dot boundaries are respected.
 */
export function isPrefixLocus(a: string, b: string): boolean {
  const sa = locusSegments(a);
  const sb = locusSegments(b);
  if (sa.length > sb.length) return false;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/** `a` and `b` are `⊑`-comparable iff one is a prefix of the other. */
export function comparableLoci(a: string, b: string): boolean {
  return isPrefixLocus(a, b) || isPrefixLocus(b, a);
}

/**
 * The `⊑`-**maximal** loci of a set — its `⊑`-antichain of deepest elements
 * (drop every locus that is a strict prefix of another). On a branching dispute
 * design the maximal Proponent-positive loci are the *per-line first-divergence
 * loci*, and this antichain is the Smyth-minimal separating context of
 * [C013](../../RESEARCH_PROGRAMME/03_CONJECTURES/C013-branching-smyth-minimal-separating-context.md).
 * For a single chronicle it returns the singleton `{ deepest locus }`.
 */
export function maximalLoci(loci: readonly string[]): string[] {
  const uniq = Array.from(new Set(loci));
  return uniq.filter((l) => !uniq.some((o) => o !== l && isPrefixLocus(l, o)));
}

/**
 * The longest common `⊑`-prefix (shared stem) of a non-empty locus set — the
 * locus below which all lines agree and above which they branch. Empty input
 * yields the root `"0"`.
 */
export function commonStem(loci: readonly string[]): string {
  if (loci.length === 0) return "0";
  let stem = locusSegments(loci[0]);
  for (let i = 1; i < loci.length; i++) {
    const s = locusSegments(loci[i]);
    let k = 0;
    while (k < stem.length && k < s.length && stem[k] === s[k]) k++;
    stem = stem.slice(0, k);
  }
  return stem.length === 0 ? "0" : stem.join(".");
}

export interface MinimalAnchor {
  /**
   * The `⊑`-least anchor, when one exists: the unique anchor that is a prefix of
   * every anchor in the set (the minimal unshared commitment `ξ*`).
   */
  min?: string;
  /** Whether a (necessarily unique) `⊑`-least element exists. */
  exists: boolean;
  /**
   * Whether the anchors are totally ordered by `⊑` — a chain, no incomparable
   * pair. In the additive-free T005 fragment the chronicle is linear, so anchors
   * are expected to form a chain; an incomparable pair is the C012
   * negative-settlement shape.
   */
  isChain: boolean;
}

/**
 * Reduce a set of separating-context anchors to their `⊑`-minimum.
 *
 * The `⊑`-least element, when it exists, is unique by antisymmetry: two mutual
 * prefixes are equal. `exists` is false exactly when the anchors have no common
 * prefix-least element (e.g. the `⊑`-incomparable "0.1" / "0.2" of the
 * negative-settlement clause).
 */
export function minimalAnchor(anchors: readonly string[]): MinimalAnchor {
  const uniq = Array.from(new Set(anchors));
  if (uniq.length === 0) return { exists: false, isChain: true };

  // A `⊑`-least element must be a prefix of every anchor in the set; if one
  // exists it is unique, so the first such witness is the minimum.
  let min: string | undefined;
  for (const a of uniq) {
    if (uniq.every((b) => isPrefixLocus(a, b))) {
      min = a;
      break;
    }
  }

  const isChain = uniq.every((a) => uniq.every((b) => comparableLoci(a, b)));

  return { min, exists: min !== undefined, isChain };
}
