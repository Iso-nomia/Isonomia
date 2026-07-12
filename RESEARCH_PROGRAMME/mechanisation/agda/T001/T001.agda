------------------------------------------------------------------------
-- T001 — OQ-JSL per-cone
--
-- Statement (per 02_THEOREMS_AND_PROOFS/T001-oq-jsl-per-cone.md):
--
--   Fix a behaviour B in the finitely-generated regime.  For each
--   incarnation Dᵢ ∈ Inc(B), the cone
--
--     Cᵢ := { D ∈ B : Dᵢ ⊆ D, and no Dⱼ ∈ Inc(B), Dⱼ ≠ Dᵢ, Dⱼ ⊆ D }
--
--   is a join-semilattice (Cᵢ, ⊆, ∪) with bottom Dᵢ.  The join is
--   *literal* chronicle-set union, D ∨ D′ = D ∪ D′ ∈ Cᵢ.
--
-- Equality convention (T001, added 2026-05-29): cone elements are sets of
-- chronicles; equality is literal set-equality.  The JSL axioms
-- (idempotence, neutrality, commutativity, associativity) hold strictly
-- under set-equality.  On a *representative* data structure (a list of
-- chronicles) they hold up to the kernel ≈ᴰ — i.e. the JSL lives on the
-- quotient Cᵢ / ≈ᴰ, equivalently as a setoid-internal JSL.  This file
-- mechanises the setoid-internal reading.
--
-- Mechanisation strategy (mirrors the human proof in
-- LUDICS_ORDER_RELATION_DEFINITION.md §§4, 6 — the Reading A route):
--
--   * §1.1  The JSL axioms are *purely order-theoretic*: they are exactly
--     the laws every least-upper-bound operation satisfies on a setoid
--     poset.  `lib.Order.Order.JoinFromLUB` derives idempotence,
--     commutativity, associativity, ≈-congruence, and (with a bottom)
--     neutrality from the three LUB clauses alone — WITHOUT POSTULATES OR
--     HOLES, with no Ludics-specific input.  This is the bulk of T001 and,
--     since 2026-05-30, lives in the shared `lib.Order` module.
--
--   * §1.2  The Ludics-specific content is the Daimon Lock Lemma
--     (LUDICS_ORDER_RELATION_DEFINITION.md §4): within a cone, set-union
--     stays in the cone (closure) and Dᵢ is the bottom.  Rather than
--     postulate it, the `lib.Order.Order.Cone` module takes the cone
--     predicate, the bottom-below-everything witness (`cone-bottom`, =
--     T002's), the join, its within-cone closure, and the LUB clauses as
--     explicit HYPOTHESES, and derives the full per-cone JSL — including
--     bottom neutrality `Dᵢ ∪ D ≈ D`.  T001 instantiates that `Cone`
--     module on the principal up-set (§2.1 below).
--
--   * §2  The C001a list-design model (Carrier = List A, ⊑ = set-inclusion,
--     ≈ = set-equality ≈ᴰ) instantiates everything: set-union is `_++_`,
--     whose LUB clauses are exactly the C001a lemmas
--     (⊆ᴰ-++ˡ / ⊆ᴰ-++ʳ / ⊆ᴰ-++-collapse).  The shared instantiation is
--     `lib.Order.ListSetInclusion`; the principal up-set ↑Dᵢ is exhibited
--     here as a concrete inhabited cone, so the per-cone JSL is non-vacuous
--     on the substrate's designs-as-sets representation, and the JSL axioms
--     hold for `_++_` up to ≈ᴰ (idempotence in particular — `D ++ D ≢ D`
--     propositionally but `D ++ D ≈ D`, the F2 setoid point).
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T001/T001.agda`.
--
-- This is *evidence* for T001 under the Theorem Register policy
-- (02_THEOREMS_AND_PROOFS/README.md), not a positive settlement: the
-- match of the `Cone` hypotheses to the Daimon Lock Lemma, and of the
-- list-design model to chronicle-tree designs, remain human-review
-- obligations (see README in this directory).
--
-- Substrate cross-references:
--   T001 (this artefact: per-cone JSL)
--   T002 (Inc(B) antichain + cone decomposition; supplies `cone-bottom`)
--   C001a / T004 (downstream: the JSL-fragment bridge, already mechanised;
--                 its ⊆ᴰ-++ lemmas are the LUB clauses reused here)
--   lib.Order (the shared abstract order theory + list-design model)
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T001 where

open import Level using (Level)

------------------------------------------------------------------------
-- §1.  Abstract setoid partial order + JSL-from-LUB + per-cone JSL
--
-- The abstract development (the setoid poset, `JoinFromLUB`, and the
-- per-cone `Cone` module) lives in `lib.Order`.  Re-exported here so
-- external references resolve as `T001.Order.JoinFromLUB`, `T001.Order.Cone`,
-- etc.
------------------------------------------------------------------------

open import lib.Order public

------------------------------------------------------------------------
-- §2.  Non-vacuity: the C001a list-design model
--
-- Carrier = List A, ⊑ = set-inclusion, ≈ = set-equality ≈ᴰ.  Set-union is
-- `_++_`; its LUB clauses are the C001a lemmas.  The shared instantiation
-- `lib.Order.ListSetInclusion` discharges every order axiom and the LUB
-- clauses; here we add the principal up-set ↑Dᵢ as an inhabited cone, so
-- the abstract §1.2 JSL is non-vacuous and the axioms hold for `_++_` up
-- to ≈ᴰ.
------------------------------------------------------------------------

module ListModel {a : Level} (A : Set a) where

  open import Data.List using (List; _++_)
  open import Function using (id)

  open ListSetInclusion A public

  ----------------------------------------------------------------------
  -- §2.1  The principal up-set ↑Dᵢ as a concrete inhabited cone.
  --
  -- InCone D := Dᵢ ⊑ D.  This is the cone above Dᵢ in the simplest
  -- representative form (the up-set), and it is genuinely a JSL under
  -- set-union: closed (union of two designs above Dᵢ is above Dᵢ), with
  -- Dᵢ as bottom.  Witnesses the abstract `Cone` is inhabited.
  ----------------------------------------------------------------------

  module PrincipalCone (Dᵢ : List A) where

    ↑-closed : ∀ {D D'} → Dᵢ ⊑ D → Dᵢ ⊑ D' → Dᵢ ⊑ (D ++ D')
    ↑-closed p _ = ⊑-trans p ++-ub₁

    -- The per-cone JSL on ↑Dᵢ: ⊔-idem, ⊔-comm, ⊔-assoc, ⊔-cong, ⊔-bot,
    -- ⊥-least all in scope, with join = `_++_` and bottom = Dᵢ.
    open Cone Dᵢ (λ D → Dᵢ ⊑ D) ⊑-refl id _++_ ↑-closed
              ++-ub₁ ++-ub₂ ++-lub public

------------------------------------------------------------------------
-- §3.  What this proves and what it doesn't
--
-- PROVED (no postulates, no holes):
--   - §1.1 (the JSL axioms): every least-upper-bound operation on a
--     setoid poset is idempotent, commutative, associative and
--     ≈-congruent (`JoinFromLUB`).  Pure order theory — this is the bulk
--     of T001 and is unconditional.
--   - §1.2 (the per-cone JSL): given the Daimon-Lock-backed hypotheses
--     (bottom `cone-bottom`, membership `Dᵢ∈`, within-cone closure
--     `⊔-closed`) and the LUB clauses for set-union, the cone Cᵢ is a JSL
--     with bottom Dᵢ and neutrality `Dᵢ ⊔ D ≈ D` (`Cone.⊔-bot`).
--   - §2 (non-vacuity): set-union = `_++_` satisfies the LUB clauses
--     (the C001a lemmas), the JSL axioms hold up to ≈ᴰ (idempotence is the
--     F2 setoid point), and the principal up-set ↑Dᵢ is an inhabited cone
--     (`PrincipalCone`).
--
-- NOT PROVED (human-review obligations, per Register policy):
--   - That the `Cone` hypotheses faithfully capture the Daimon Lock Lemma
--     (LUDICS_ORDER_RELATION_DEFINITION.md §4) — they are asserted, not
--     derived from the chronicle-coherence axioms.  In particular,
--     within-cone closure of set-union (`⊔-closed`) is the substrate's
--     Forest/Coherence/Positivity argument, modelled here as a hypothesis.
--   - That the list-design model matches the substrate's chronicle-tree
--     designs (the same F2/representation caveat as C001a / T002).
--   - Finite-generation of Inc(B) (assumed in T001 prose; not used by the
--     order-theoretic core, hence not modelled here).
------------------------------------------------------------------------
