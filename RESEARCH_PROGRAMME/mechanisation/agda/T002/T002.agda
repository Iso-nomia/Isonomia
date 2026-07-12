------------------------------------------------------------------------
-- T002 — Inc(B) is an antichain; B decomposes into disjoint cones
--
-- Statement (per 02_THEOREMS_AND_PROOFS/T002-inc-b-antichain.md):
--
--   1. Antichain.  Inc(B) := { D ∈ B : ∄ D′ ∈ B, D′ ⊊ D } is an
--      antichain under ⊆.  (If D₁, D₂ ∈ Inc(B) and D₁ ⊆ D₂ then D₁ = D₂.)
--
--   2. Cone decomposition.  B = ⨆_{Dᵢ ∈ Inc(B)} Cᵢ, the disjoint union
--      following from uniqueness of incarnation (Fouqueré–Quatrini 2013).
--
-- Mechanisation strategy (mirrors the human proof in
-- LUDICS_OQ_JSL_PROOF.md §§3–5):
--
--   * The antichain argument is, in the source's own words, "purely
--     order-theoretic … it holds for the minimal elements of any
--     partially ordered set" (§0.3, §5.1).  It is therefore mechanised
--     ABSTRACTLY over an arbitrary setoid partial order, WITHOUT
--     POSTULATES OR HOLES.  Since 2026-05-30 that abstract development
--     lives in the shared `lib.Order` module (`Order.Behaviour`), which
--     T001 and T002 both import — this file is now the thin T002 view
--     onto it.
--
--   * The cone-decomposition and cross-cone-incompatibility results
--     genuinely depend on the Fouqueré–Quatrini uniqueness-of-incarnation
--     theorem (LMCS 9(4:6), 2013).  Rather than smuggle that in as an
--     Agda `postulate`, it is exposed as an explicit `Incarnation` record
--     (a module HYPOTHESIS) in `lib.Order`.  Every cone result is then a
--     theorem of the form "given an incarnation structure, …".
--
--   * §2 instantiates the abstract order on the C001a list-design model
--     (Carrier = List A, ⊑ = set-inclusion, ≈ = set-equality), discharging
--     every order axiom, to show the abstract theorems are non-vacuous on
--     the substrate's actual design representation (designs-as-sets).  The
--     model is `lib.Order.ListSetInclusion`, shared with T001.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T002/T002.agda`.
--
-- This is *evidence* for T002 under the Theorem Register policy
-- (02_THEOREMS_AND_PROOFS/README.md), not a positive settlement: the
-- abstraction faithfully captures the order theory, but the match of the
-- abstract `Incarnation` record to F-Q 2013, and of the list-design model
-- to the substrate's chronicle-tree designs, remain human-review
-- obligations (see README in this directory).
--
-- Substrate cross-references:
--   T001 (per-cone JSL; the cones whose disjointness is proved here)
--   T002 (this artefact: antichain + cone decomposition)
--   C001a / T004 (downstream: the JSL-fragment bridge, already mechanised)
--   lib.Order (the shared abstract order theory + list-design model)
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T002 where

open import Level using (Level)

------------------------------------------------------------------------
-- §1.  Abstract setoid partial order + Inc(B) theory
--
-- The abstract development (the setoid poset, minimality, Inc(B), the
-- antichain theorem, cross-cone incompatibility, and cone decomposition)
-- lives in `lib.Order`.  Re-exported here so external references resolve
-- as `T002.Order.Behaviour.antichain`, etc.  The T002-relevant content is
--   Order.Behaviour.antichain
--   Order.Behaviour.no-upper-bound-in-Inc
--   Order.Behaviour.Incarnation.cross-cone-incompat
--   Order.Behaviour.Incarnation.{cone-total, cone-disjoint, cone-bottom}
------------------------------------------------------------------------

open import lib.Order public

------------------------------------------------------------------------
-- §2.  Non-vacuity: the C001a list-design model
--
-- Carrier = List A, ⊑ = set-inclusion, ≈ = set-equality (the ≈ᴰ of C001a
-- / finding F2).  Every order axiom is discharged in
-- `lib.Order.ListSetInclusion`; opening it specialises the abstract §1
-- theorems to the substrate's designs-as-sets representation.
------------------------------------------------------------------------

module ListModel {a : Level} (A : Set a) where

  open ListSetInclusion A public

------------------------------------------------------------------------
-- §3.  What this proves and what it doesn't
--
-- PROVED (no postulates, no holes):
--   - Part 1 (antichain): minimal elements of any setoid partial order
--     form an antichain (`Order.Behaviour.antichain`), with the in-Inc
--     no-upper-bound corollary.  Order-theoretic, exactly as the source
--     proof advertises.
--   - Part 2 (cross-cone incompatibility + cone decomposition): given an
--     `Incarnation` structure (the F-Q uniqueness-of-incarnation
--     hypothesis, made explicit in the types), distinct incarnations
--     have no common upper bound in B, and B partitions into cones
--     (totality `cone-total` + functionality `cone-disjoint`), each with
--     its incarnation as bottom (`cone-bottom`).
--   - Non-vacuity: the C001a list-design model discharges every order
--     axiom (§2), so the theorems apply to designs-as-sets.
--
-- NOT PROVED (human-review obligations, per Register policy):
--   - That the abstract `Incarnation` record faithfully captures
--     Fouqueré–Quatrini 2013 (it is asserted as a hypothesis, not built).
--   - That the list-design model matches the substrate's chronicle-tree
--     designs (the same F2/representation caveat as C001a).
--   - Finite-generation of Inc(B) (assumed in T001/T002 prose; not used
--     by the order-theoretic core, hence not modelled here).
------------------------------------------------------------------------
