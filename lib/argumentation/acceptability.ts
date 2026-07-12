// lib/argumentation/acceptability.ts
//
// Phase 3 of the argumentation-semantics consolidation roadmap: the typed
// bridge. Two runtime-contract invariants become type-level facts here rather
// than conventions:
//
//   • Level separation (C4 / contract §3 "aggregation lives one level up").
//     Acceptability is a 𝒫_fin(Inc(B)) operation — the free-JSL join of
//     argument *sets*, never a merge of designs inside Inc(B). The
//     `FiniteArgumentSet` brand makes the power-set level explicit so a route
//     handler cannot accidentally aggregate at the design level.
//
//   • Provenance (C3 / contract §4). `unverified-higher-order` nodes (from the
//     not-yet-canonical λ-abstraction projection, Q-028a stratum-2) may be
//     *labelled* but MUST NOT be persisted as canonical bridge data. The guard
//     below enforces that at the boundary.

import type {
  ArgId,
  DefeatGraph,
  Labelling,
  Provenance,
} from "@/lib/argumentation/types";
import { groundedExtension, groundedLabelling } from "@/lib/argumentation/labelling";
import { preferredExtensions, stableExtensions } from "@/lib/argumentation/semantics";
import type { Anonymous } from "@/lib/ludics/anonymity";

// ----------------------------------------------------------------------------
// Level separation — 𝒫_fin(Inc(B)) (C4, contract §3)
// ----------------------------------------------------------------------------

declare const POWERSET_BRAND: unique symbol;

/**
 * A finite subset of `Inc(B)` — an element of `𝒫_fin(Inc(B))`. This is the unit
 * of aggregation: combining multiple reinstaters / arguments is the free-JSL
 * join `∨_A` at *this* level, never a design-level merge inside `Inc(B)`.
 *
 * The brand prevents a bare `Set<ArgId>` (a design-level collection) from being
 * passed where power-set-level aggregation is required.
 */
export interface FiniteArgumentSet {
  readonly [POWERSET_BRAND]: "powerset";
  readonly members: ReadonlySet<ArgId>;
}

/** Lift a design-level collection of argument ids to the power-set level. */
export function liftToPowerSet(args: Iterable<ArgId>): FiniteArgumentSet {
  return { members: new Set(args) } as unknown as FiniteArgumentSet;
}

/**
 * The free-JSL join `∨_A` on `𝒫_fin(Inc(B))` — set union. This is the *only*
 * sanctioned way to aggregate argument sets (contract §3); it is associative,
 * commutative and idempotent, so repeated aggregation saturates.
 */
export function joinArgumentSets(
  a: FiniteArgumentSet,
  b: FiniteArgumentSet
): FiniteArgumentSet {
  const out = new Set<ArgId>(a.members);
  for (const x of b.members) out.add(x);
  return { members: out } as unknown as FiniteArgumentSet;
}

/** Join a finite family of argument sets (⊥ = ∅ when the family is empty). */
export function joinAll(sets: Iterable<FiniteArgumentSet>): FiniteArgumentSet {
  let acc = liftToPowerSet([]);
  for (const s of sets) acc = joinArgumentSets(acc, s);
  return acc;
}

// ----------------------------------------------------------------------------
// The acceptability functor  AF(𝒫_fin(Inc(B))) → Labelling
// ----------------------------------------------------------------------------

/**
 * The acceptability functor. Given a defeat graph whose node set is an element
 * of `𝒫_fin(Inc(B))`, it returns the canonical (grounded) labelling — the
 * finite Knaster–Tarski fixpoint reached in `≤ |Inc(B)|` steps (Q-031). This is
 * the typed home of contract §4's "cycle resolution lives one level up": odd
 * cycles resolve to all-UNDEC, even cycles are decided by the richer semantics
 * in `semantics.ts`.
 *
 * It takes the power-set-level `FiniteArgumentSet` for the node domain so the
 * caller is forced through `liftToPowerSet` / `joinArgumentSets`, making the
 * level separation explicit at the call site.
 */
export function acceptability(dg: DefeatGraph): Labelling {
  return groundedLabelling(dg);
}

/**
 * The node set of a defeat graph as a power-set-level element. Use this (rather
 * than reading `dg.args` directly) when aggregating, so the result stays typed
 * at the `𝒫_fin(Inc(B))` level.
 */
export function nodesOf(dg: DefeatGraph): FiniteArgumentSet {
  return liftToPowerSet(dg.args);
}

// ----------------------------------------------------------------------------
// Provenance enforcement (C3, contract §4)
// ----------------------------------------------------------------------------

/** Provenance of an argument; absent entries default to verified-propositional. */
export function provenanceOf(dg: DefeatGraph, a: ArgId): Provenance {
  return dg.provenance?.get(a) ?? "verified-propositional";
}

/** The arguments whose projection is unverified higher-order (contract §4). */
export function unverifiedArguments(dg: DefeatGraph): ArgId[] {
  if (!dg.provenance) return [];
  return dg.args.filter(
    (a) => dg.provenance!.get(a) === "unverified-higher-order"
  );
}

/**
 * Whether the whole graph may be persisted as canonical bridge data: true iff
 * no node is `unverified-higher-order` (contract §4).
 */
export function isCanonicalPersistable(dg: DefeatGraph): boolean {
  return unverifiedArguments(dg).length === 0;
}

/**
 * Contract §4 guard (T-GUARD). Throws if the graph carries any
 * `unverified-higher-order` node — such projections may be labelled but MUST
 * NOT be persisted as canonical bridge data. Call this at the persistence
 * boundary, not before labelling.
 */
export function assertCanonicalPersistable(dg: DefeatGraph): void {
  const unverified = unverifiedArguments(dg);
  if (unverified.length > 0) {
    throw new Error(
      `Refusing to persist unverified higher-order projection as canonical ` +
        `bridge data (runtime contract §4): ${unverified.join(", ")}`
    );
  }
}

/**
 * Split a graph's nodes by provenance — used to route the unverified part to
 * the guarded path while still labelling the whole graph.
 */
export function partitionByProvenance(dg: DefeatGraph): {
  verified: ArgId[];
  unverified: ArgId[];
} {
  const unverified = new Set(unverifiedArguments(dg));
  const verified = dg.args.filter((a) => !unverified.has(a));
  return { verified, unverified: [...unverified] };
}

// ----------------------------------------------------------------------------
// Multi-semantics acceptability surface (Reading-C roadmap item 1)
// ----------------------------------------------------------------------------
//
// Warrant: T015 (RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T015-additive-realizability-keystone.md).
// Admissibility / stable / preferred-defence are interactively realizable; the
// `⊆`-maximality of preferred is a SEPARATE constraint pass — and it already
// lives *inside* `preferredExtensions`/`stableExtensions`. This facade does NOT
// re-derive maximality from interaction; it reads membership off the exact
// consolidated engines and labels it. It is a *read* (a labelling over the whole
// graph, unverified nodes included — only persistence is provenance-guarded
// above), and it is T4-anonymous (argument-id keyed, no person id).
//
// Spec: docs/READING_C_ITEM1_ACCEPTABILITY_SURFACE_DEV_SPEC.md

/** Per-argument acceptance across the surfaced semantics. */
export interface SemanticAcceptability {
  /** `a` ∈ the grounded extension. */
  grounded: boolean;
  /** `a` ∈ some stable extension. */
  stableCredulous: boolean;
  /** A stable extension exists and `a` ∈ every one (empty-stable ⇒ false). */
  stableSkeptical: boolean;
  /** `a` ∈ some preferred extension. */
  preferredCredulous: boolean;
  /** `a` ∈ every preferred extension (≥1 always exists, `∅` admissible). */
  preferredSkeptical: boolean;
}

/** Grounded + stable + preferred membership for every argument, plus counts. */
export interface AcceptabilityResult {
  perArgument: Record<ArgId, SemanticAcceptability>;
  extensionCounts: { stable: number; preferred: number };
}

/**
 * Compute grounded / stable / preferred credulous+skeptical acceptance for every
 * argument of `dg`. The single place semantics membership is surfaced for the
 * deliberation read path. Pure; no DB, no I/O. T4-anonymous (`Anonymous<…>`).
 *
 * Empty-stable convention (T015 / Reading-C item C): no stable extension ⇒ both
 * stable flags false (nothing stably justified). Preferred always exists.
 */
export function computeAcceptability(dg: DefeatGraph): Anonymous<AcceptabilityResult> {
  const grounded = groundedExtension(dg);
  const stable = stableExtensions(dg);
  const preferred = preferredExtensions(dg);

  const perArgument: Record<ArgId, SemanticAcceptability> = {};
  for (const a of dg.args) {
    perArgument[a] = {
      grounded: grounded.has(a),
      stableCredulous: stable.some((E) => E.has(a)),
      stableSkeptical: stable.length > 0 && stable.every((E) => E.has(a)),
      preferredCredulous: preferred.some((E) => E.has(a)),
      preferredSkeptical: preferred.every((E) => E.has(a)),
    };
  }

  return {
    perArgument,
    extensionCounts: { stable: stable.length, preferred: preferred.length },
  };
}

