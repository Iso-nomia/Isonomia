------------------------------------------------------------------------
-- ludics.Interaction — M2: determinacy & fuel-monotonicity of interaction
--
-- Direction 5 (mechanization), session 09 step M2.  This is the first
-- constitutive *theorem* about the M1 `interact` of ludics.Core — the
-- soundness backbone that makes the fuel-indexed normalizer behave like a
-- normalizer and makes orthogonality `_⊥_` well-defined.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS, AND NOT "ASSOCIATIVITY" VERBATIM
-- ─────────────────────────────────────────────────────────────────────
-- Session 09 named M2 "associativity of interaction".  On contact with the
-- M1 carrier (audit m0-…; the programme's own discipline: a slogan is
-- earned, not assumed), associativity PROPER is not even STATABLE here, for
-- two precise reasons — and naming the obstruction is the result:
--
--   (1) `interact : ℕ → Design → Design → Status` is a TWO-party,
--       Status-valued normalizer.  Associativity ⟨(D∘E)∘F⟩ = ⟨D∘(E∘F)⟩
--       needs a COMPOSITION / cut operation that takes two designs to a
--       RESIDUAL DESIGN (designs cut on a shared locus, normalised to a new
--       design).  M1 has no such operation; `interact` collapses the run to
--       a Status.  Composition is therefore a PREREQUISITE for associativity,
--       a separate step (scoped below), not a corollary of M1.
--
--   (2) The other classical reading of "associativity of normalisation" is
--       CONFLUENCE / Church–Rosser: the normal form is independent of the
--       order cuts are reduced.  But `interact` is DETERMINISTIC — a single
--       fixed trajectory of states (each `step1` has exactly one successor).
--       With no reduction-order freedom, confluence is VACUOUS.  So the real
--       content of "associativity" lives entirely in the multi-party
--       composition of (1); over the deterministic two-party loop there is
--       nothing to confluently reorder.
--
-- What IS both statable and load-bearing over M1 is the well-definedness of
-- the normalizer itself.  That is this file.  The registry OQ
-- "mechanized finite Ludics" (filed at M2) carries composition+associativity
-- proper as its next obligation; see RESEARCH_PROGRAMME/
-- 10_IDEATION_SESSIONS/09-mechanization-ludics-core-sequencing-2026-06-08.md.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS PROVED
-- ─────────────────────────────────────────────────────────────────────
--   * DETERMINACY — `interact` is a function, so the run is determinate by
--     construction (recorded as the trivial `interact-det`; the content is
--     that we modelled normalisation as a function, not a relation).
--   * FUEL-MONOTONICITY — once the run is DECIDED (CONVERGENT / DIVERGENT /
--     STUCK), MORE fuel does not change the verdict; only ONGOING can flip.
--     `loop-mono`, `interact-mono-suc`, `interact-mono-≤`.
--   * ORTHOGONALITY IS FUEL-INDEPENDENT — `D ⊥ E` (convergence at SOME fuel)
--     ⇒ convergence at EVERY larger fuel (`⊥-upward`, `⊥-eventually`).  This
--     is exactly what M4's biorthogonal closure needs: `_⊥_` does not depend
--     on the budget, so `B = B^⊥⊥` is over a genuine relation.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/Interaction.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.Interaction where

open import Data.Nat using (ℕ; zero; suc; _+_; _≤_; z≤n; s≤s; _≤″_; less-than-or-equal)
open import Data.Nat.Properties using (+-identityʳ; +-suc; ≤⇒≤″)
open import Data.List using ([]; _∷_)
open import Data.Product using (_,_; ∃-syntax; proj₁; proj₂)
open import Data.Empty using (⊥-elim) renaming (⊥ to 𝟘)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; subst)

open import ludics.Core

------------------------------------------------------------------------
-- §1.  Determinacy
--
-- Normalisation was modelled as a FUNCTION `interact`, not a relation, so
-- the outcome of a run is determinate by construction.  We record the fact
-- explicitly; its content is the modelling choice, not the (trivial) proof.
------------------------------------------------------------------------

interact-det : ∀ n D E {s s′}
             → interact n D E ≡ s → interact n D E ≡ s′ → s ≡ s′
interact-det n D E p q = trans (sym p) q

------------------------------------------------------------------------
-- §2.  Decided statuses
--
-- A run is DECIDED once it leaves ONGOING.  Monotonicity below says exactly
-- the decided statuses are stable under more fuel.
------------------------------------------------------------------------

data Decided : Status → Set where
  conv  : Decided CONVERGENT
  div   : Decided DIVERGENT
  stuck : Decided STUCK

no-dec-ONGOING : Decided ONGOING → 𝟘
no-dec-ONGOING ()

------------------------------------------------------------------------
-- §3.  Fuel-monotonicity
--
-- The heart of M2: a DECIDED outcome is preserved by one extra unit of fuel.
-- By induction on the fuel of the smaller run, generalised over the state.
-- `loop` iterates `step1`, so a single `with step1 D E st` abstracts the
-- shared first step out of BOTH the goal and the hypothesis `eq`:
--   * `done s′`  — both `loop … (suc f)` and `loop … (suc (suc f))` reduce
--                  to `s′`, so the verdict `eq : s′ ≡ s` already is the goal;
--   * `cont st′` — both shed one unit of fuel onto the same next state `st′`,
--                  so the induction hypothesis closes it.
------------------------------------------------------------------------

loop-mono : ∀ D E f {st s} → Decided s
          → loop D E f st ≡ s → loop D E (suc f) st ≡ s
loop-mono D E zero    dec eq =
  ⊥-elim (no-dec-ONGOING (subst Decided (sym eq) dec))   -- loop _ _ 0 _ = ONGOING
loop-mono D E (suc f) {st} dec eq with step1 D E st
... | done s′  = eq
... | cont st′ = loop-mono D E f dec eq

-- One extra unit of fuel on `interact` (run from the initial state).
interact-mono-suc : ∀ D E n {s} → Decided s
                  → interact n D E ≡ s → interact (suc n) D E ≡ s
interact-mono-suc D E n dec eq = loop-mono D E n dec eq

-- Any amount of extra fuel: a decided outcome survives `n ↦ n + k`.
add-fuel : ∀ D E n k {s} → Decided s
         → interact n D E ≡ s → interact (n + k) D E ≡ s
add-fuel D E n zero    dec eq rewrite +-identityʳ n = eq
add-fuel D E n (suc k) dec eq rewrite +-suc n k =
  interact-mono-suc D E (n + k) dec (add-fuel D E n k dec eq)

-- Monotonicity in the fuel order: a decided outcome at `n` holds at every
-- `m ≥ n`.
interact-mono-≤ : ∀ D E {n m s} → n ≤ m → Decided s
                → interact n D E ≡ s → interact m D E ≡ s
interact-mono-≤ D E {n} n≤m dec eq with ≤⇒≤″ n≤m
... | less-than-or-equal {k} refl = add-fuel D E n k dec eq

------------------------------------------------------------------------
-- §4.  Orthogonality is fuel-independent  (the payoff for M4)
--
-- `D ⊥ E` is "converges to a daimon at SOME fuel".  Monotonicity upgrades
-- that to "at EVERY large-enough fuel", so orthogonality is a property of
-- the design pair, not of the budget — the well-definedness M4's `B = B^⊥⊥`
-- relies on.
------------------------------------------------------------------------

⊥-upward : ∀ {D E n m} → n ≤ m
         → interact n D E ≡ CONVERGENT → interact m D E ≡ CONVERGENT
⊥-upward {D} {E} n≤m eq = interact-mono-≤ D E n≤m conv eq

-- From an orthogonality witness, convergence at every fuel ≥ the witness.
⊥-eventually : ∀ {D E} → (w : D ⊥ E)
             → ∀ {m} → proj₁ w ≤ m → interact m D E ≡ CONVERGENT
⊥-eventually (n , eq) n≤m = ⊥-upward n≤m eq

------------------------------------------------------------------------
-- §5.  Non-vacuity — the theorems fire on real runs
------------------------------------------------------------------------

-- The handshake of ludics.Core converges at fuel 2; monotonicity hands us
-- convergence at fuel 5 for free (2 ≤ 5), WITHOUT recomputing.  (The design
-- arguments are given explicitly: `interact` is a defined function, so Agda
-- cannot invert `interact n _ _` to recover them from the witness type.)
ex-up : interact 5 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ CONVERGENT
ex-up = ⊥-upward {p0 ∷ []} {o0 ∷ dai ∷ []} {2} {5} (s≤s (s≤s z≤n)) ex-conv-handshake

-- The DIVERGENT verdict at fuel 1 is equally stable upward.
ex-div-up : interact 9 (p0 ∷ []) [] ≡ DIVERGENT
ex-div-up = interact-mono-≤ (p0 ∷ []) [] {1} {9} {DIVERGENT} (s≤s z≤n) div ex-div
