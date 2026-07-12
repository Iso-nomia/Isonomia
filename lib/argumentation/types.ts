// lib/argumentation/types.ts
//
// Core types for the consolidated Dung abstract-argumentation engine.
//
// Phase 1 of the argumentation-semantics consolidation roadmap. The engine is
// *labelling-based* (design commitment C1): the complete labelling is the
// primitive, and grounded / preferred / stable / semi-stable are derived as
// constraints on labellings rather than enumerated extensions with labels
// back-derived.

/** Three-valued argument label (Caminada–Gabbay). */
export type Label = "IN" | "OUT" | "UNDEC";

export type ArgId = string;

/** A total labelling of every argument in a framework. */
export type Labelling = Map<ArgId, Label>;

/**
 * Provenance of a defeat-graph node (design commitment C3, runtime contract
 * §3/§4). Records whether the argument came from a **verified propositional
 * projection** (in-fragment, contract §3 — the deterministic `Inc(B) → 𝒞/Γ`
 * bijection) or an **unverified higher-order projection** (contract §4 — the
 * §3 projection is not yet proven canonical for λ-abstraction / exponential
 * generators, gated on Q-028a stratum-2).
 *
 * The distinction is mandated by the runtime contract: `unverified-higher-order`
 * nodes may be *labelled* but MUST NOT be persisted as canonical bridge data.
 * See `acceptability.ts` for the enforcement guard.
 */
export type Provenance = "verified-propositional" | "unverified-higher-order";

/**
 * A directed preference pair `[preferred, dispreferred]` on the abstract layer.
 * Structured preference *resolution* (last-link / weakest-link) lives in
 * `lib/aspic/defeats.ts` and is folded into `attacks` by `instantiate.ts`; this
 * optional field carries any residual abstract-level preferences for provenance
 * and display.
 */
export type Preference = [ArgId, ArgId];

/**
 * A Dung abstract-argumentation framework (an attack graph).
 *
 * `attacks` is the adjacency map attacker → set-of-attacked. It is the single
 * internal representation; adapters convert the two legacy surface shapes
 * (edge-list `Array<[string, string]>` and attack-map `Map<id, Set<id>>`) into
 * this type via `toDefeatGraph*` in `labelling.ts`.
 *
 * Phase 3 adds two optional fields (absent ⇒ back-compatible legacy behaviour):
 *   • `preferences` — abstract-level preference pairs (C3).
 *   • `provenance`  — per-argument verified/unverified tag (C3). An argument
 *     with no entry defaults to `verified-propositional`.
 */
export interface DefeatGraph {
  args: ArgId[];
  attacks: Map<ArgId, Set<ArgId>>;
  preferences?: Preference[];
  provenance?: Map<ArgId, Provenance>;
}
