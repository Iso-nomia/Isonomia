// lib/argumentation/ecc.ts
// Evidential Category of Claims (ECC)
// Implements categorical operations for argumentation with derivation sets.
// Phase: Gap 4 - Per-Derivation Assumption Tracking

import { corroborateProbs } from "./logodds";

export type DerivationId = string;
export type AssumptionId = string;

/**
 * Arrow in the evidential category with per-derivation assumptions.
 * 
 * Represents a morphism from A to B in the category of claims.
 * The morphism is materialized as a finite set of derivation IDs,
 * where each derivation represents a distinct argumentation path.
 * 
 * Each derivation in the hom-set may rely on a different set of assumptions.
 * This enables precise tracking of assumption dependencies through composition.
 * 
 * @typeParam A - Domain (source claim or premise)
 * @typeParam B - Codomain (target claim or conclusion)
 * 
 * @property from - Source object (claim A)
 * @property to - Target object (claim B)
 * @property derivs - Finite set of derivation IDs (each has its own assumptions, scheme, sources)
 * @property assumptions - Map from derivationId to set of assumptionIds
 *   - Key: derivationId (must be in `derivs` set)
 *   - Value: Set of AssumptionUse.id that this derivation requires
 * 
 * @invariant assumptions.keys() ⊆ derivs
 * 
 * @example
 * ```typescript
 * const arrow: Arrow = {
 *   from: "P",
 *   to: "C",
 *   derivs: new Set(["d1", "d2"]),
 *   assumptions: new Map([
 *     ["d1", new Set(["λ1", "λ2"])],  // d1 uses λ1, λ2
 *     ["d2", new Set(["λ1"])]         // d2 uses only λ1
 *   ])
 * };
 * ```
 */
export type Arrow<A=string,B=string> = {
  from: A; 
  to: B;
  derivs: Set<DerivationId>;
  assumptions: Map<DerivationId, Set<AssumptionId>>;
};

/**
 * Join (accrual) operation: union of derivation sets with assumption tracking.
 * 
 * Categorical semantics: Coproduct (∨) in the hom-set poset hom(A,B).
 * "Piles up" independent arguments for the same conclusion.
 * Merges independent arguments while preserving per-derivation assumptions.
 * 
 * PRECONDITION: f and g must be morphisms in the SAME hom-set.
 * That is, f.from === g.from AND f.to === g.to.
 * 
 * Mathematically: If f,g ∈ hom(A,B), then join(f,g) ∈ hom(A,B).
 * 
 * Assumption merge strategy: Simple union of both assumption maps.
 * - If derivation d appears in both f and g with different assumptions,
 *   union them (should be rare - derivation IDs are typically unique).
 * 
 * Identity: join(f, zero(A,B)) = f
 * Commutativity: join(f,g) = join(g,f)
 * Associativity: join(join(f,g),h) = join(f,join(g,h))
 * 
 * @param f - First morphism from A to B
 * @param g - Second morphism from A to B
 * @returns New morphism with union of derivation sets and merged assumptions
 * @throws {Error} if morphisms have different domains or codomains
 * 
 * @example
 * ```typescript
 * const arg1: Arrow = { 
 *   from: "P", to: "C", 
 *   derivs: new Set(["d1"]),
 *   assumptions: new Map([["d1", new Set(["λ1"])]])
 * };
 * const arg2: Arrow = { 
 *   from: "P", to: "C", 
 *   derivs: new Set(["d2"]),
 *   assumptions: new Map([["d2", new Set(["λ2"])]])
 * };
 * const combined = join(arg1, arg2);
 * // Result: { 
 * //   from: "P", to: "C", 
 * //   derivs: Set(["d1", "d2"]),
 * //   assumptions: Map([["d1", Set(["λ1"])], ["d2", Set(["λ2"])]])
 * // }
 * ```
 */
export function join<A,B>(f: Arrow<A,B>, g: Arrow<A,B>): Arrow<A,B> {
  if (f.from !== g.from || f.to !== g.to) {
    throw new Error('join: type mismatch - morphisms must be in same hom-set (same domain and codomain)');
  }
  
  // Merge derivation sets
  const derivs = new Set([...f.derivs, ...g.derivs]);
  
  // Merge assumption maps
  const assumptions = new Map<DerivationId, Set<AssumptionId>>();
  for (const [deriv, assums] of f.assumptions) {
    assumptions.set(deriv, new Set(assums));  // Deep copy
  }
  for (const [deriv, assums] of g.assumptions) {
    if (assumptions.has(deriv)) {
      // Same derivation in both - union assumptions (should be rare)
      const existing = assumptions.get(deriv)!;
      for (const a of assums) existing.add(a);
    } else {
      assumptions.set(deriv, new Set(assums));
    }
  }
  
  return { from: f.from, to: f.to, derivs, assumptions };
}

/**
 * Zero morphism: empty derivation set (vacuous support).
 * 
 * Categorical semantics: Bottom element (⊥) in the hom-set poset hom(A,B).
 * Represents "no argumentation path from A to B".
 * 
 * Identity for join: join(f, zero(A,B)) = f
 * 
 * @param from - Domain (source claim A)
 * @param to - Codomain (target claim B)
 * @returns Arrow with empty derivation set and empty assumptions map
 * 
 * @example
 * ```typescript
 * const empty = zero("P", "C");
 * // Result: { from: "P", to: "C", derivs: Set([]), assumptions: Map([]) }
 * ```
 */
export function zero<A,B>(from:A, to:B): Arrow<A,B> {
  return { 
    from, 
    to, 
    derivs: new Set(),
    assumptions: new Map()  // Empty map for vacuous morphism
  };
}

/**
 * Composition operation: chain two morphisms with transitive assumption tracking.
 * 
 * Categorical semantics: Functorial composition (∘) in the evidential category.
 * If f: A→B and g: B→C, then compose(g,f): A→C.
 * 
 * Each composed derivation is the Cartesian product of derivation pairs.
 * Represents transitive argumentation: "A supports B" and "B supports C" implies "A supports C".
 * 
 * Assumption propagation:
 * - The composed derivation `d_f ∘ d_g` inherits assumptions from BOTH derivations.
 * - This models transitive dependencies: "To believe C via this path, you must accept
 *   all assumptions from A→B AND all assumptions from B→C."
 * 
 * Mathematical property: If f uses {λ1} and g uses {λ2}, then compose(g,f) uses {λ1, λ2}.
 * 
 * Category laws:
 * - Associativity: compose(h, compose(g,f)) = compose(compose(h,g), f)
 * - Identity: compose(id_B, f) = f = compose(f, id_A)
 * 
 * @param g - Second morphism (B→C)
 * @param f - First morphism (A→B)
 * @returns Composed morphism (A→C) with derivation pairs and inherited assumptions
 * 
 * @example
 * ```typescript
 * const f: Arrow = { 
 *   from: "A", to: "B", 
 *   derivs: new Set(["d1", "d2"]),
 *   assumptions: new Map([["d1", new Set(["λ1"])]])
 * };
 * const g: Arrow = { 
 *   from: "B", to: "C", 
 *   derivs: new Set(["d3"]),
 *   assumptions: new Map([["d3", new Set(["λ2"])]])
 * };
 * const composed = compose(g, f);
 * // Result: { 
 * //   from: "A", to: "C", 
 * //   derivs: Set(["d1∘d3", "d2∘d3"]),
 * //   assumptions: Map([
 * //     ["d1∘d3", Set(["λ1", "λ2"])],  // Union from d1 and d3
 * //     ["d2∘d3", Set(["λ2"])]         // Only from d3 (d2 has no assumptions)
 * //   ])
 * // }
 * ```
 */
export function compose<A,B,C>(g: Arrow<B,C>, f: Arrow<A,B>): Arrow<A,C> {
  // semantics: each composed derivation references an ordered pair (d_f, d_g)
  const out = zero<A,C>(f.from, g.to);
  
  for (const df of f.derivs) {
    for (const dg of g.derivs) {
      const composedDerivId = `${df}∘${dg}`;
      out.derivs.add(composedDerivId);
      
      // Union assumptions from both derivations
      const assumsF = f.assumptions.get(df) ?? new Set();
      const assumsG = g.assumptions.get(dg) ?? new Set();
      const unionAssums = new Set([...assumsF, ...assumsG]);
      
      out.assumptions.set(composedDerivId, unionAssums);
    }
  }
  
  return out;
}

/**
 * Extract the minimal set of assumptions required for a morphism.
 * 
 * Returns the union of all assumptions across all derivations in the morphism.
 * This represents the complete set of assumptions needed to accept the conclusion.
 * 
 * @param arrow - Arrow to extract assumptions from
 * @returns Set of all unique assumption IDs
 * 
 * @example
 * ```typescript
 * const arrow: Arrow = {
 *   from: "P", to: "C",
 *   derivs: new Set(["d1", "d2"]),
 *   assumptions: new Map([
 *     ["d1", new Set(["λ1", "λ2"])],
 *     ["d2", new Set(["λ2", "λ3"])]
 *   ])
 * };
 * const minimal = minimalAssumptions(arrow);
 * // Result: Set(["λ1", "λ2", "λ3"])
 * ```
 */
export function minimalAssumptions<A,B>(arrow: Arrow<A,B>): Set<AssumptionId> {
  const result = new Set<AssumptionId>();
  for (const assums of arrow.assumptions.values()) {
    for (const a of assums) result.add(a);
  }
  return result;
}

/**
 * Find all derivations in a morphism that use a given assumption.
 * 
 * Useful for "what if λ₁ fails?" analysis - find affected derivations.
 * 
 * @param arrow - Arrow to search
 * @param assumptionId - Assumption ID to find
 * @returns Set of derivation IDs that use this assumption
 * 
 * @example
 * ```typescript
 * const arrow: Arrow = {
 *   from: "P", to: "C",
 *   derivs: new Set(["d1", "d2", "d3"]),
 *   assumptions: new Map([
 *     ["d1", new Set(["λ1", "λ2"])],
 *     ["d2", new Set(["λ2"])],
 *     ["d3", new Set(["λ3"])]
 *   ])
 * };
 * const affectedDerivs = derivationsUsingAssumption(arrow, "λ1");
 * // Result: Set(["d1"])  (only d1 uses λ1)
 * ```
 */
export function derivationsUsingAssumption<A,B>(
  arrow: Arrow<A,B>, 
  assumptionId: AssumptionId
): Set<DerivationId> {
  const result = new Set<DerivationId>();
  for (const [deriv, assums] of arrow.assumptions) {
    if (assums.has(assumptionId)) {
      result.add(deriv);
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Sprint A — refined ECC surface
// All additions are pure (no I/O, no Prisma). They are designed to be reused
// by `evidential/route.ts`, the transport worker, and the MCP server.
// Citations refer to Ambler 1996 ("A Categorical Approach to the Theory of
// Argumentation"); see `Development and Ideation Documents/ARCHITECTURE/AMBLER_PAPER.md`.
// Settled design contracts live in `ECC_REFINEMENT_AND_MCP_INTEGRATION_PLAN.md §4`.
// ────────────────────────────────────────────────────────────────────────────

// ── §A1.1 Symmetric monoidal product ⊗ (Ambler §2.1, Def. 3) ───────────────

/**
 * Tensor product of two arrows: conjoin premises into a compound source.
 *
 * Categorical semantics: the symmetric monoidal product `⊗` on hom-sets.
 * If `f: A→B` and `g: C→D`, then `tensor(f,g): A⊗C → B⊗D` whose derivations
 * are ordered pairs `(d_f, d_g)` and whose assumptions are unioned per pair.
 *
 * @invariant Assumption-additivity: for the pair `(d_f, d_g)`, the resulting
 *   assumption set equals `assumptions(f, d_f) ∪ assumptions(g, d_g)`. (Ambler §2.1.)
 * @invariant Functoriality of ⊗ on composition: when both sides compose,
 *   `tensor(compose(g2,g1), compose(f2,f1)) = compose(tensor(g2,f2), tensor(g1,f1))`
 *   on minimal assumptions (Ambler Lemma 5).
 */
export function tensor<A,B,C,D>(
  f: Arrow<A,B>,
  g: Arrow<C,D>
): Arrow<[A,C],[B,D]> {
  const out: Arrow<[A,C],[B,D]> = {
    from: [f.from, g.from],
    to: [f.to, g.to],
    derivs: new Set<DerivationId>(),
    assumptions: new Map<DerivationId, Set<AssumptionId>>(),
  };
  for (const df of f.derivs) {
    for (const dg of g.derivs) {
      const id = `${df}⊗${dg}`;
      out.derivs.add(id);
      const aF = f.assumptions.get(df) ?? new Set<AssumptionId>();
      const aG = g.assumptions.get(dg) ?? new Set<AssumptionId>();
      out.assumptions.set(id, new Set<AssumptionId>([...aF, ...aG]));
    }
  }
  return out;
}

// ── §A1.2 Internal hom = warrant (Ambler §2.4, Λ adjunction) ───────────────

/**
 * Internal hom object `[A,B]`: the warrant for an inference from A to B,
 * reified as a first-class claim that may itself be undercut.
 *
 * In Mesh, `warrantClaimId` points at the `Claim` that materializes the
 * warrant; undercut attacks target it via `EdgeType.undercut`.
 *
 * @invariant Aggregation is monotone (Ambler p. 171): undercut never lowers
 *   numerical support inside the algebra. It propagates only by retracting
 *   the warrant claim's assumptions, which then flips `isLogical` off.
 */
export type Warrant<A=string,B=string> = {
  kind: "warrant";
  from: A;
  to: B;
  warrantClaimId: string;
};

export function internalHom<A,B>(
  from: A,
  to: B,
  warrantClaimId: string
): Warrant<A,B> {
  return { kind: "warrant", from, to, warrantClaimId };
}

// ── §A1.3 Structural predicates (Ambler Def. 8 + Def. 17) ──────────────────

/** Author provenance for an argument backing a derivation (ECC plan §4 row 3). */
export type AuthorKind = "HUMAN" | "AI" | "HYBRID";

/** Status of an `AssumptionUse` row in Mesh's Prisma schema. */
export type AssumptionStatus = "PROPOSED" | "ACCEPTED" | "CHALLENGED" | "RETRACTED";

/** Optional per-derivation provenance consulted by `isLogical`. */
export interface DerivationProvenance {
  authorKind?: AuthorKind;
  /** True iff a HUMAN has explicitly ratified an AI/HYBRID-authored derivation. */
  humanRatified?: boolean;
}

/** Structural metadata derived from the algebra (Ambler Def. 8). */
export interface ArrowMeta {
  simple: boolean;
  entire: boolean;
  selected: boolean;
}

/**
 * `simple` (Ambler Def. 8): the hom-set acts like a singleton — the
 * comonoid duplication law `Δ_Y ∘ f = (f⊗f) ∘ Δ_X` holds *with equality*
 * rather than the lax inequality. In our materialization that is `|derivs| ≤ 1`
 * (the empty hom-set is vacuously simple).
 */
export function isSimple<A,B>(arrow: Arrow<A,B>): boolean {
  return arrow.derivs.size <= 1;
}

/**
 * `entire` (Ambler Def. 8): the hom-set is non-empty — at least one
 * derivation exists, so `t_X = t_Y ∘ f` rather than the lax `t_X ≥ t_Y ∘ f`.
 */
export function isEntire<A,B>(arrow: Arrow<A,B>): boolean {
  return arrow.derivs.size >= 1;
}

/**
 * `selected` (Ambler Def. 8): `simple ∧ entire` — exactly one canonical
 * derivation. Selected arrows satisfy projection/duplication with equality.
 *
 * @invariant `isSelected(arrow) ⇒ |arrow.derivs| === 1`.
 */
export function isSelected<A,B>(arrow: Arrow<A,B>): boolean {
  return arrow.derivs.size === 1;
}

export function arrowMeta<A,B>(arrow: Arrow<A,B>): ArrowMeta {
  const simple = isSimple(arrow);
  const entire = isEntire(arrow);
  return { simple, entire, selected: simple && entire };
}

/**
 * `logical` (Ambler Def. 17): the smallest class of arrows containing
 * identities and the structural maps `l, r, a, t, ε`, closed under `⊗`,
 * `∘`, and `Λ`. In Mesh's defeasible setting we interpret this as:
 * **at least one derivation in the arrow is fully closed** — every
 * assumption it depends on has `status === ACCEPTED`, and (per ECC plan
 * §4 row 3) any AI/HYBRID-authored derivation is also `humanRatified`.
 *
 * @invariant Strict (ECC plan §4 row 1): a derivation whose closure
 *   contains *any* `AssumptionUse` with status ∈ `{PROPOSED, CHALLENGED,
 *   RETRACTED}` does NOT count as logical. Only ACCEPTED counts.
 * @invariant AI gating (ECC plan §4 row 3): a derivation whose
 *   provenance reports `authorKind ∈ {AI, HYBRID}` and `!humanRatified`
 *   never counts as logical regardless of assumption closure.
 * @invariant Lemma 23.1 corollary: `isLogical(arrow) ⇒ confidence(arrow, m)
 *   === m.top` for every monoid `m`, when the monoid honours its own
 *   contract that `m.base(d) === m.top` for logical derivations.
 */
export function isLogical<A,B>(
  arrow: Arrow<A,B>,
  ctx: {
    assumptionStatus: (id: AssumptionId) => AssumptionStatus;
    derivationProvenance?: (id: DerivationId) => DerivationProvenance | undefined;
  }
): boolean {
  for (const d of arrow.derivs) {
    if (isDerivationLogical(arrow, d, ctx)) return true;
  }
  return false;
}

/** Per-derivation variant of `isLogical`. Useful for confidence base steps. */
export function isDerivationLogical<A,B>(
  arrow: Arrow<A,B>,
  d: DerivationId,
  ctx: {
    assumptionStatus: (id: AssumptionId) => AssumptionStatus;
    derivationProvenance?: (id: DerivationId) => DerivationProvenance | undefined;
  }
): boolean {
  const prov = ctx.derivationProvenance?.(d);
  if (prov && (prov.authorKind === "AI" || prov.authorKind === "HYBRID") && !prov.humanRatified) {
    return false;
  }
  const assums = arrow.assumptions.get(d) ?? new Set<AssumptionId>();
  for (const a of assums) {
    if (ctx.assumptionStatus(a) !== "ACCEPTED") return false;
  }
  return true;
}

// ── §A1.4 Confidence monoid (Ambler §3 + Lemma 26, Theorem 30) ─────────────

/**
 * Confidence measure interface: `c: Hom(A,B) → ℳ` valued in a commutative
 * monoid ℳ in `(SLat, ⊗, I)` whose multiplicative identity coincides with
 * the top of the order (Ambler §3). The registry is closed by default
 * (ECC plan §4 row 5) — only `MIN_MONOID`, `PRODUCT_MONOID`, `DS_MONOID`
 * are seeded; admins extend via `registerConfidenceMonoid` (server-only).
 *
 * @invariant `combine(top, x) === x` (identity).
 * @invariant `combine` is associative + commutative; `join` is idempotent
 *   + associative + commutative; `top` is the absorbing element of `join`
 *   in this presentation (top = identity = order top).
 * @invariant `base(d)` MUST return `top` whenever the caller knows the
 *   derivation is logical — this is the contract that backs Lemma 23.1.
 */
export interface ConfidenceMonoid<M = number> {
  key: string;
  top: M;
  combine: (x: M, y: M) => M;
  join: (x: M, y: M) => M;
  base: (d: DerivationId) => M;
}

/**
 * Compute `c(arrow)`: join over derivations of the combined base values.
 *
 * For a derivation `d` we currently treat its score as the monoid's
 * `base(d)` directly; a later refinement may walk the per-derivation
 * assumption set and combine `base(λ)` across assumptions. This is sound
 * for the present pipeline because `evidential/route.ts` materializes one
 * scalar per `ArgumentSupport` row.
 *
 * @invariant `confidence(zero(A,B), m) === m.top` is FALSE in general —
 *   the empty join is the bottom of the order, not the top. We model
 *   bottom as `m.combine(m.top, m.top)` only when the caller asks for it
 *   via a non-empty arrow. Empty hom-sets must be checked by `isEntire`
 *   before reading confidence.
 * @invariant Theorem 30 soundness (DS monoid): when `m === DS_MONOID`,
 *   `confidence(arrow, m).bel ≤ confidence(arrow, m).pl`.
 */
export function confidence<M>(arrow: Arrow, m: ConfidenceMonoid<M>): M {
  let acc: M | undefined;
  for (const d of arrow.derivs) {
    const v = m.base(d);
    acc = acc === undefined ? v : m.join(acc, v);
  }
  // Empty hom-set: caller responsibility to check isEntire first; we return
  // the monoid identity (top) as a defensive default rather than throwing.
  return acc === undefined ? m.top : acc;
}

// — Built-in monoids (Ambler Examples 25/27/28, Theorem 30) ─────────────────

const _baseFromMap = (scores?: ReadonlyMap<DerivationId, number>): ((d: DerivationId) => number) =>
  (d) => scores?.get(d) ?? 1;

/**
 * `min` weakest-link monoid (Ambler Examples 25 + 27).
 * combine = min, join = max, top = 1, base from caller-supplied per-derivation map.
 * To inject per-derivation scores, call `withMinScores(scores)` to get a fresh monoid.
 */
export const MIN_MONOID: ConfidenceMonoid<number> = {
  key: "min",
  top: 1,
  combine: (x, y) => Math.min(x, y),
  join: (x, y) => Math.max(x, y),
  base: _baseFromMap(),
};

export function withMinScores(scores: ReadonlyMap<DerivationId, number>): ConfidenceMonoid<number> {
  return { ...MIN_MONOID, base: _baseFromMap(scores) };
}

/**
 * `product` monoid (Ambler Example 28): `w: 𝒟 → ([0,1], *, 1)`.
 * combine = *, join = noisy-OR `1 - ∏(1 - x)`, top = 1.
 */
export const PRODUCT_MONOID: ConfidenceMonoid<number> = {
  key: "product",
  top: 1,
  combine: (x, y) => x * y,
  join: (x, y) => 1 - (1 - x) * (1 - y),
  base: _baseFromMap(),
};

export function withProductScores(scores: ReadonlyMap<DerivationId, number>): ConfidenceMonoid<number> {
  return { ...PRODUCT_MONOID, base: _baseFromMap(scores) };
}

/**
 * `logodds` weight-of-evidence monoid (Phase 5b — confidence-algebra migration).
 * combine = `*` (premise conjunction, parity with the product monoid's compose);
 * join = log-odds corroboration `prob(weight(x) + weight(y))` so independent
 * derivations stack as additive weights of evidence. top = 1 (identity for
 * `combine`, absorbing for `join`).
 *
 * Unlike `product`, `join` is NON-idempotent: `0.6 ⊕ 0.6 ≈ 0.6923` (vs
 * noisy-OR's 0.84), matching `corroborateProbs` in `evidential/route.ts`.
 *
 * @invariant `join` is associative + commutative (weight/prob are an inverse
 *   pair, so `join` is addition in log-odds space). Pairwise folding in
 *   `confidence()` therefore equals the n-ary `corroborateProbs`.
 * @invariant base default = 0.5 (the log-odds neutral, weight 0) so a missing
 *   per-derivation score contributes no evidence rather than absorbing.
 */
export const LOGODDS_MONOID: ConfidenceMonoid<number> = {
  key: "logodds",
  top: 1,
  combine: (x, y) => x * y,
  join: (x, y) => corroborateProbs([x, y]),
  base: () => 0.5,
};

export function withLogoddsScores(scores: ReadonlyMap<DerivationId, number>): ConfidenceMonoid<number> {
  return { ...LOGODDS_MONOID, base: (d) => scores.get(d) ?? 0.5 };
}

/**
 * `ds` Dempster-Shafer monoid (Ambler Theorem 30).
 * Carrier is `{bel, pl}`; combine = pointwise product, join = pointwise
 * noisy-OR, top = `{bel: 1, pl: 1}`.
 *
 * @invariant Theorem 30 hypothesis: caller MUST supply a probability
 *   valuation `p` on a distributive lattice `𝒟`. The default `base` returns
 *   `top` so a caller that forgets to inject scores gets a defensible
 *   "no information" reading rather than a silent zero.
 */
export type DSValue = { bel: number; pl: number };

export const DS_MONOID: ConfidenceMonoid<DSValue> = {
  key: "ds",
  top: { bel: 1, pl: 1 },
  combine: (x, y) => ({ bel: x.bel * y.bel, pl: x.pl * y.pl }),
  join: (x, y) => ({
    bel: 1 - (1 - x.bel) * (1 - y.bel),
    pl: 1 - (1 - x.pl) * (1 - y.pl),
  }),
  base: () => ({ bel: 1, pl: 1 }),
};

export function withDsScores(
  scores: ReadonlyMap<DerivationId, DSValue>
): ConfidenceMonoid<DSValue> {
  return { ...DS_MONOID, base: (d) => scores.get(d) ?? { bel: 1, pl: 1 } };
}

// — Closed registry with admin extension path (ECC plan §4 row 5) ──────────

const _registry: Map<string, ConfidenceMonoid<any>> = new Map([
  [MIN_MONOID.key, MIN_MONOID as ConfidenceMonoid<any>],
  [PRODUCT_MONOID.key, PRODUCT_MONOID as ConfidenceMonoid<any>],
  [LOGODDS_MONOID.key, LOGODDS_MONOID as ConfidenceMonoid<any>],
  [DS_MONOID.key, DS_MONOID as ConfidenceMonoid<any>],
]);

/**
 * Look up a monoid by key. The MCP surface MUST take a closed enum
 * `"min" | "product" | "ds"` (ECC plan §4 row 5). HTTP routes must NOT
 * accept caller-supplied monoid keys without an allow-list check.
 */
export function getConfidenceMonoid(key: string): ConfidenceMonoid<any> | undefined {
  return _registry.get(key);
}

/**
 * Server-only admin path for registering an additional monoid (e.g. the
 * `−log r` work-cost monoid from Ambler Example 28). Must NOT be wired to
 * any HTTP path; adding a monoid is a code-review-gated change.
 */
export function registerConfidenceMonoid<M>(monoid: ConfidenceMonoid<M>): void {
  _registry.set(monoid.key, monoid as ConfidenceMonoid<any>);
}

// ── §A1.5 Transport along a RoomFunctor (Isonomia extension; §0.5.7) ───────

/**
 * Object-level functor between deliberation categories. Backed at the data
 * layer by `RoomFunctor.claimMapJson` (one-hop only, ECC plan §4 row 2).
 */
export interface Functor {
  mapClaim(id: string): string | null;
}

/**
 * Transport an arrow along a functor `F: 𝒟_A → 𝒟_B`. Returns `null` if
 * either endpoint has no image under `F` (the functor is partial).
 *
 * @invariant Composition preservation (one-hop): `transport(F, compose(g,f))`
 *   has the same minimal-assumption set as `compose(transport(F,g), transport(F,f))`
 *   when both sides are defined. This is checked in `tests/ecc.test.ts`.
 * @invariant Multi-hop transport (A→B→C) is intentionally NOT supported
 *   (ECC plan §4 row 2). MCP tool descriptions must say so explicitly.
 */
export function transport<A extends string, B extends string>(
  F: Functor,
  arrow: Arrow<A, B>
): Arrow<string, string> | null {
  const fromImg = F.mapClaim(arrow.from as string);
  const toImg = F.mapClaim(arrow.to as string);
  if (fromImg === null || toImg === null) return null;
  return {
    from: fromImg,
    to: toImg,
    derivs: new Set(arrow.derivs),
    assumptions: new Map(
      Array.from(arrow.assumptions, ([d, a]) => [d, new Set(a)] as const)
    ),
  };
}

/**
 * Multi-room aggregation:
 *   `Hom_B(I,ψ) = Hom_B^local(I,ψ) ∨ ⋁_F F(Hom_A(I,φ))`
 *
 * Transports each remote arrow through its (one-hop) functor, then joins
 * the results into the local arrow. Remotes that fail to transport (no
 * image for an endpoint) are silently skipped.
 *
 * @invariant Joins are commutative + associative — order of `imported`
 *   does not change the result.
 * @invariant Type safety: every successfully-transported remote MUST land
 *   on the same `(local.from, local.to)` pair; mismatched remotes are
 *   skipped (rather than thrown) to keep the worker idempotent.
 */
export function aggregateAcrossRooms(
  local: Arrow<string, string>,
  imported: ReadonlyArray<{ functor: Functor; remote: Arrow<string, string> }>
): Arrow<string, string> {
  let acc: Arrow<string, string> = local;
  for (const { functor, remote } of imported) {
    const t = transport(functor, remote);
    if (t === null) continue;
    if (t.from !== local.from || t.to !== local.to) continue;
    acc = join(acc, t);
  }
  return acc;
}

// ── §A1.6 Belief revision: culprit sets (Ambler §4) ────────────────────────

/**
 * A candidate retraction set, ranked for Sprint D's "Suggested retractions"
 * panel (ECC plan §4 row 4: inline nudges only).
 */
export interface CulpritSet {
  assumptions: Set<AssumptionId>;
  /** Number of derivations in `rejected` killed by retracting these assumptions. */
  badConclusionsExplained: number;
  /** Set size — used as a primary tiebreaker (smaller is cheaper). */
  retractionCost: number;
}

/**
 * Candidate retractions for an `OUT`-labelled arrow.
 *
 * Algorithm (Ambler §4 verbatim): for each derivation `d` in `rejected`,
 * its assumption set is a culprit candidate (retracting any subset of
 * those assumptions that hits `d` removes that derivation). We emit the
 * per-derivation full assumption set, then rank by:
 *   1. coverage (`badConclusionsExplained`) descending,
 *   2. cost (`retractionCost = |assumptions|`) ascending,
 *   3. lexicographic on the assumption ids for determinism.
 *
 * @invariant Coverage monotonicity: a culprit set `S₂ ⊇ S₁` has
 *   `S₂.badConclusionsExplained ≥ S₁.badConclusionsExplained`. Tested.
 * @invariant Empty arrow ⇒ empty result (nothing to retract).
 */
export function culpritSets(rejected: Arrow): CulpritSet[] {
  // Collect distinct assumption sets, recording how many derivations each
  // would kill (a candidate kills derivation `d` iff candidate ∩
  // assumptions(d) ≠ ∅).
  const candidates: Set<AssumptionId>[] = [];
  const seen = new Set<string>();
  for (const d of rejected.derivs) {
    const a = rejected.assumptions.get(d);
    if (!a || a.size === 0) continue;
    const key = Array.from(a).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(new Set(a));
  }
  const ranked: CulpritSet[] = candidates.map((cand) => {
    let coverage = 0;
    for (const d of rejected.derivs) {
      const a = rejected.assumptions.get(d);
      if (!a) continue;
      let hits = false;
      for (const x of cand) {
        if (a.has(x)) { hits = true; break; }
      }
      if (hits) coverage++;
    }
    return { assumptions: cand, badConclusionsExplained: coverage, retractionCost: cand.size };
  });
  ranked.sort((x, y) => {
    if (y.badConclusionsExplained !== x.badConclusionsExplained) {
      return y.badConclusionsExplained - x.badConclusionsExplained;
    }
    if (x.retractionCost !== y.retractionCost) {
      return x.retractionCost - y.retractionCost;
    }
    const xs = Array.from(x.assumptions).sort().join("|");
    const ys = Array.from(y.assumptions).sort().join("|");
    return xs < ys ? -1 : xs > ys ? 1 : 0;
  });
  return ranked;
}

// ── §A1.7 Enthymeme detection (Sprint D3) ──────────────────────────────────

/** Minimal scheme spec consumed by `detectEnthymemes`. */
export interface SchemeSpec {
  key: string;
  /** Roles the scheme requires authors to fill, e.g. `["warrant","background"]`. */
  requiredRoles: string[];
}
export interface SchemeCatalog {
  get(key: string): SchemeSpec | undefined;
}

/** Per-derivation metadata used to detect missing roles. */
export interface DerivationSchemeMeta {
  schemeKey?: string;
  argumentId?: string;
  rolesPresent?: string[];
}

export interface EnthymemeNudge {
  argumentId: string;
  derivationId: DerivationId;
  schemeKey: string;
  missingPremiseRoles: string[];
  /** LLM-filled at the call site; the algebra leaves this empty. */
  suggestedWarrantText: string;
}

/**
 * Emit nudges for derivations whose backing argument is missing a role
 * the scheme requires. Pure structural check — the LLM-friendly suggestion
 * text is left blank for the composer/MCP layer to fill.
 *
 * @invariant Idempotent on `arrow`; calling twice yields the same nudges.
 * @invariant A derivation with no `schemeKey` or whose scheme is unknown
 *   produces no nudge (fail-quiet rather than fail-loud — the composer is
 *   the source of truth for whether a scheme assignment is required).
 */
export function detectEnthymemes(
  arrow: Arrow,
  schemes: SchemeCatalog,
  metaFor: (d: DerivationId) => DerivationSchemeMeta | undefined
): EnthymemeNudge[] {
  const out: EnthymemeNudge[] = [];
  for (const d of arrow.derivs) {
    const meta = metaFor(d);
    if (!meta?.schemeKey || !meta.argumentId) continue;
    const spec = schemes.get(meta.schemeKey);
    if (!spec) continue;
    const present = new Set(meta.rolesPresent ?? []);
    const missing = spec.requiredRoles.filter((r) => !present.has(r));
    if (missing.length === 0) continue;
    out.push({
      argumentId: meta.argumentId,
      derivationId: d,
      schemeKey: meta.schemeKey,
      missingPremiseRoles: missing,
      suggestedWarrantText: "",
    });
  }
  return out;
}
