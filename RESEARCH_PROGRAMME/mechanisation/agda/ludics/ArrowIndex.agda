------------------------------------------------------------------------
-- ludics.ArrowIndex — L1 of Session 20 (Diairesis cross-test):
--   "the arrow is the ℕ-index" — the Q-B(N) classification of
--   normalisation `interact` as recursion over a pre-given step-index.
--
-- Direction: cross-program.  Serves Diairesis `q013-approach.md` §2–§3
-- (the dilemma of generation: Horn B = temporal/processual generation
-- presupposes the arrow) via Session 20
-- (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/20-ludics-diairesis-crosstest.md),
-- step L1.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT L1 ASKS (Session 20 §3 (N))
-- ─────────────────────────────────────────────────────────────────────
-- Classify the second Ludics primitive — NORMALISATION (cut-elimination,
-- here the fuel-indexed `interact`).  Predicted: recursion (algebraic) over
-- ℕ, whose DIRECTEDNESS — the arrow — is exactly the ℕ-index / reduction
-- order, and is IMPORTED (Horn B: a reduction runs one way), not generated
-- by the symmetric Player/Opponent structure.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS ESTABLISHED HERE (all by REUSE of M2's already-`--safe` lemmas,
-- plus two small fuel-gating facts proved by `refl`)
-- ─────────────────────────────────────────────────────────────────────
--   (R) `interact` IS RECURSION OVER ℕ.  `loop` (ludics.Core §6) recurses
--       structurally on the fuel; fuel 0 performs NO reduction step
--       (`no-fuel-is-ONGOING`), so the ℕ-index gates progress — it is the
--       reduction counter, the μ step-index.
--
--   (F) NORMALISATION IS A FUNCTION (M2 `interact-det`): a single
--       trajectory of states, no reduction-order freedom.  So confluence is
--       VACUOUS and the directedness is NOT in any branching — it can only
--       live in the index.
--
--   (A) THE ARROW = THE `≤` ORDER ON THE FUEL.  A DECIDED verdict is
--       monotone along `≤` (M2 `interact-mono-≤`): once reached at fuel n it
--       holds at every m ≥ n and NEVER reverses (`verdict-irreversible`).
--       The decided-fuels of a run are UPWARD-CLOSED in (ℕ, ≤) and the
--       verdict is constant on them — a one-way, accumulating structure.
--       That one-wayness is the arrow, and it is the pre-given well-order
--       of ℕ, imported wholesale.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE VERDICT (headline; the Diairesis report is the companion note
-- L1-arrow-index-2026-06-26.md)
-- ─────────────────────────────────────────────────────────────────────
--   Q-B(N): the directedness of normalisation is the `≤` order on the ℕ
--   step-index.  It is IMPORTED, corroborating Diairesis Horn B: the
--   reduction is a directed process (it RUNS, one unit of fuel at a time,
--   toward the daimon), and the direction is the ℕ-order it presupposes —
--   not a tertium produced from the symmetric P/O duality.  Whether
--   convergence-to-daimon could be defined WITHOUT this directed index
--   (the Risk-2 escape) is exactly L3; L1 only fixes that, AS PRESENTED,
--   the arrow of `interact` is the fuel.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/ArrowIndex.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.ArrowIndex where

open import Data.Nat using (ℕ; zero; suc; _≤_; z≤n; s≤s)
open import Data.List using ([]; _∷_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl)

open import ludics.Core
open import ludics.Interaction
  using (Decided; conv; div; stuck; interact-det; interact-mono-suc;
         interact-mono-≤; ⊥-upward)

------------------------------------------------------------------------
-- §1.  (R) Normalisation is recursion over the ℕ step-index
--
-- `interact fuel D E = loop D E fuel (initial state)`, and `loop` recurses
-- structurally on `fuel`.  The base case is the constitutive fact that the
-- index GATES progress: with no fuel, no reduction step is taken, so the
-- run is ONGOING — undecided BY CONSTRUCTION, not by any property of D, E.
------------------------------------------------------------------------

-- Zero fuel ⇒ no step ⇒ ONGOING, for ANY pair.  Proof: `refl` (`loop _ _ 0
-- _ = ONGOING` definitionally).  The index is the reduction counter.
no-fuel-is-ONGOING : ∀ D E → interact 0 D E ≡ ONGOING
no-fuel-is-ONGOING D E = refl

------------------------------------------------------------------------
-- §2.  (F) Normalisation is a function — confluence is vacuous
--
-- M2 modelled normalisation as the FUNCTION `interact`, not a relation, so
-- a run is a single fixed trajectory: no two reduction orders to reconcile.
-- Hence the directedness cannot hide in branching; it must be the index.
------------------------------------------------------------------------

-- Determinacy, re-exported under the Diairesis reading (no reduction-order
-- freedom ⇒ the arrow is not in the branching).
normalisation-deterministic : ∀ n D E {s s′}
  → interact n D E ≡ s → interact n D E ≡ s′ → s ≡ s′
normalisation-deterministic = interact-det

------------------------------------------------------------------------
-- §3.  (A) The arrow = the `≤` order on the fuel
--
-- A DECIDED verdict (CONVERGENT / DIVERGENT / STUCK) is monotone along the
-- fuel order and never reverses.  This is the one-way, accumulating
-- structure of the reduction — the arrow — exhibited as the pre-given
-- well-order (ℕ, ≤).
------------------------------------------------------------------------

-- IRREVERSIBILITY: a decided verdict at fuel n holds at every m ≥ n.  The
-- arrow, as the monotone (one-way) map from (ℕ, ≤) to a fixed verdict.
verdict-irreversible : ∀ D E {n m s} → Decided s → n ≤ m
  → interact n D E ≡ s → interact m D E ≡ s
verdict-irreversible D E dec n≤m eq = interact-mono-≤ D E n≤m dec eq

-- One step of the arrow: a decided verdict survives `n ↦ suc n`.  The
-- successor — the atomic increment of the index — is the generator of the
-- directedness; iterating it is `verdict-irreversible`.
verdict-step : ∀ D E n {s} → Decided s
  → interact n D E ≡ s → interact (suc n) D E ≡ s
verdict-step = interact-mono-suc

-- CONVERGENCE is upward-closed (the daimon, once reached, stays reached):
-- the μ-pole terminal is monotone in the index.
convergence-upward-closed : ∀ {D E n m} → n ≤ m
  → interact n D E ≡ CONVERGENT → interact m D E ≡ CONVERGENT
convergence-upward-closed = ⊥-upward

------------------------------------------------------------------------
-- §4.  Non-vacuity — the arrow is exhibited on real runs
--
-- The Core handshake decides CONVERGENT at fuel 2 and the index then only
-- carries it forward: at 2, at 3, at every larger budget — never reverting
-- to ONGOING.  The DIVERGENT verdict is equally one-way.  These witness the
-- arrow concretely: progress accumulates along ℕ and does not undo.
------------------------------------------------------------------------

-- At fuel 0, the handshake has not yet run: ONGOING (the index gates it).
handshake-at-0 : interact 0 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ ONGOING
handshake-at-0 = refl

-- Decided CONVERGENT at fuel 2 (the witness from ludics.Core).
handshake-at-2 : interact 2 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ CONVERGENT
handshake-at-2 = ex-conv-handshake

-- …and carried forward to fuel 3 by ONE step of the arrow — not recomputed,
-- but transported along the index.
handshake-at-3 : interact 3 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ CONVERGENT
handshake-at-3 = verdict-step (p0 ∷ []) (o0 ∷ dai ∷ []) 2 conv handshake-at-2

-- DIVERGENT at fuel 1 is just as irreversible: still DIVERGENT at fuel 7.
div-irreversible : interact 7 (p0 ∷ []) [] ≡ DIVERGENT
div-irreversible =
  verdict-irreversible (p0 ∷ []) [] {1} {7} div (s≤s z≤n) ex-div
