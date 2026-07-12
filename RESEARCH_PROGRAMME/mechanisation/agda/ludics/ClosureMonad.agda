------------------------------------------------------------------------
-- ludics.ClosureMonad — L2 of Session 20 (Diairesis cross-test):
--   "behaviours are the closure monad of the orthogonality Galois
--    connection" — the Q-A(O) classification + the Risk-1 discharge.
--
-- Direction: cross-program.  Serves the Diairesis "Removing the Bound"
-- Precision Lemma (R2) and Q-013 §3, via Session 20
-- (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/20-ludics-diairesis-crosstest.md),
-- step L2.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT L2 ASKS (Session 20 §3 (O), §4 Risk 1)
-- ─────────────────────────────────────────────────────────────────────
-- Classify the third Ludics primitive — orthogonality + behaviours — and
-- decide whether "definition by testing" (B = B^⊥⊥) is a genuine CLOSURE
-- OPERATOR (the signature of Diairesis' Horn A: a climb in a pre-given
-- inclusion order, terminating at a fixed point) or a THIRD mode of
-- definition that would refute the Precision Lemma.
--
-- Risk 1 (the higher-stakes escape): the bi-orthogonal completion might be
-- something OTHER than the closure of a Galois connection when instantiated
-- at the *real* convergence-orthogonality `_⊥_` (ludics.Core), rather than
-- at an opaque abstract relation.  This file runs that instantiation and
-- names the two checks Risk 1 turns on.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS ESTABLISHED HERE (all by REUSE of already-`--safe` lemmas)
-- ─────────────────────────────────────────────────────────────────────
--   (G) GALOIS CONNECTION at the real `_⊥_`:
--         S ⊆ pol⁻ T  ⇔  T ⊆ pol⁺ S
--       i.e. the defining antitone polarity `A ⊆ B^⊥ ⇔ B ⊆ A^⊥`, holding
--       definitionally because both sides unfold to "∀ D∈S, ∀ E∈T, D ⊥ E".
--       (`galois` / `galois⁻¹`.)  This is the check Session 20 §4 Risk 1
--       names as "never done" at the real relation — M3/M4 instantiated
--       `Biorthogonal` but never surfaced the Galois equivalence itself.
--
--   (C) CLOSURE OPERATOR at the real `_⊥_`:  clo = pol⁻ ∘ pol⁺ is
--         extensive   (clo-extensive  : S ⊆ clo S),
--         monotone    (clo-monotone   : S ⊆ S' → clo S ⊆ clo S'),
--         idempotent  (clo-idempotent : clo (clo S) ≐ clo S).
--       These three ARE the closure-operator axioms (lib.Closure.ClosureOp),
--       so `clo` is a closure operator on the powerset poset 𝒫(Design),
--       ordered by ⊆.  A behaviour is precisely a fixed point `clo G ≐ G`.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE VERDICT (recorded as the module's headline; the Diairesis report is
-- the companion note L2-closure-monad-2026-06-25.md)
-- ─────────────────────────────────────────────────────────────────────
--   RISK 1 DOES NOT FIRE.  At the real convergence-orthogonality, (G) and
--   (C) both hold — and hold *definitionally*, not by any added structure.
--   "Definition by testing" is therefore the closure of the orthogonality
--   Galois connection: a monotone-extensive-idempotent climb in the
--   PRE-GIVEN inclusion order ⊆ on 𝒫(Design), terminating at a fixed point
--   (the behaviour).  By the negation-algebras pre-study (closure operator =
--   Horn A), Q-A(O) is CONFIRM: behaviours are (co)algebraic — the closure
--   monad's algebras (Eilenberg–Moore fixed points).  No third mode of
--   definition appears at ludics' most exotic primitive.
--
-- This does NOT settle Q-B (the arrow): the inclusion order ⊆ that `clo`
-- climbs is imported, exactly as Horn A predicts — see ludics.Interaction
-- (the directedness is the ℕ-fuel) and the L1/L3 notes.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/ClosureMonad.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.ClosureMonad where

open import Data.List using ([]; _∷_)
open import Data.Product using (_×_; _,_; proj₁; proj₂)
open import Relation.Binary.PropositionalEquality using (_≡_; refl)

open import ludics.Core
open import lib.Closure using (module Biorthogonal)

------------------------------------------------------------------------
-- §1.  Instantiate the abstract Biorthogonal at the REAL orthogonality
--
-- X = Y = Design, and `_⊥_` is ludics.Core's `interact`-convergence
--   D ⊥ E  :=  ∃ n, interact n D E ≡ CONVERGENT
-- (M1, proved fuel-independent by M2).  This is the same instantiation
-- M3/M4 used; here we surface from it the two facts Risk 1 turns on.
------------------------------------------------------------------------

module B = Biorthogonal Design Design _⊥_
open B

open B.PX using () renaming (Pred to PredX; _∈_ to _∈ˣ_; _⊆_ to _⊆ˣ_; _≐_ to _≐ˣ_)
open B.PY using () renaming (Pred to PredY; _∈_ to _∈ʸ_; _⊆_ to _⊆ʸ_; _≐_ to _≐ʸ_)

------------------------------------------------------------------------
-- §2.  (G) The Galois connection at the real `_⊥_`   [Risk-1 check, ½]
--
-- The defining antitone polarity of the bi-orthogonal:  a set S of designs
-- sits below the left polar of a test-set T iff T sits below the right
-- polar of S — both sides being "every design in S is orthogonal to every
-- test in T".  This is `A ⊆ B^⊥ ⇔ B ⊆ A^⊥` at the convergence relation.
------------------------------------------------------------------------

-- pol⁺ S = S^⊥ (the tests beating all of S); pol⁻ T = ^⊥T (designs beating
-- all of T).  Re-exported with the orthogonal-superscript reading.
_^⊥ : PredX → PredY
_^⊥ = pol⁺

⊥^_ : PredY → PredX
⊥^_ = pol⁻

-- The Galois connection, both directions.  `galois` is `galois-→` and
-- `galois⁻¹` is `galois-←` of lib.Closure, now pinned at `Design`.
galois : ∀ {S T} → S ⊆ˣ (⊥^ T) → T ⊆ʸ (S ^⊥)
galois = galois-→

galois⁻¹ : ∀ {S T} → T ⊆ʸ (S ^⊥) → S ⊆ˣ (⊥^ T)
galois⁻¹ = galois-←

-- Antitone on both sides (order-reversing), the structural half of the
-- connection: more designs to beat ⇒ fewer tests survive, and dually.
^⊥-antitone : ∀ {S S'} → S ⊆ˣ S' → (S' ^⊥) ⊆ʸ (S ^⊥)
^⊥-antitone = pol⁺-antitone

⊥^-antitone : ∀ {T T'} → T ⊆ʸ T' → (⊥^ T') ⊆ˣ (⊥^ T)
⊥^-antitone = pol⁻-antitone

------------------------------------------------------------------------
-- §3.  (C) The closure operator at the real `_⊥_`   [Risk-1 check, 2/2]
--
-- clo = pol⁻ ∘ pol⁺ = (·)^⊥⊥.  The three closure-operator axioms
-- (lib.Closure.ClosureOp: extensive, monotone, idempotent) on the powerset
-- poset (𝒫(Design), ⊆).  Their conjunction IS "clo is a closure operator".
------------------------------------------------------------------------

-- (·)^⊥⊥, named for the Diairesis reading.
_^⊥⊥ : PredX → PredX
_^⊥⊥ = clo

-- (C1) Extensive:  S ⊆ S^⊥⊥.
clo-extensive : ∀ {S} → S ⊆ˣ (S ^⊥⊥)
clo-extensive = clo-ext

-- (C2) Monotone:  S ⊆ S' ⇒ S^⊥⊥ ⊆ S'^⊥⊥.
clo-monotone : ∀ {S S'} → S ⊆ˣ S' → (S ^⊥⊥) ⊆ˣ (S' ^⊥⊥)
clo-monotone = clo-mono

-- (C3) Idempotent:  S^⊥⊥^⊥⊥ ≐ S^⊥⊥  (the climb terminates at one step —
-- the fixed-point character that makes this Horn A, not progression).
clo-idempotent : ∀ {S} → ((S ^⊥⊥) ^⊥⊥) ≐ˣ (S ^⊥⊥)
clo-idempotent = clo-idem

------------------------------------------------------------------------
-- §4.  Behaviours are exactly the closure's fixed points
--
-- A behaviour `G = G^⊥⊥` is an algebra of the closure (an Eilenberg–Moore
-- fixed point).  The closure of any set is the LEAST behaviour above it —
-- the free algebra / generation map.  (Both reused from the closure laws;
-- this is the Q-A(O) "closure monad" statement, made explicit.)
------------------------------------------------------------------------

-- A behaviour is a fixed point of (·)^⊥⊥.
Behaviour : PredX → Set
Behaviour G = (G ^⊥⊥) ≐ˣ G

-- Every closed set is a behaviour, and it is the least one above its seed:
-- `S^⊥⊥` is the behaviour GENERATED by S (the monad unit composed with the
-- algebra structure).
clo-is-behaviour : ∀ {S} → Behaviour (S ^⊥⊥)
clo-is-behaviour = clo-idem

clo-least-behaviour : ∀ {S G} → Behaviour G → S ⊆ˣ G → (S ^⊥⊥) ⊆ˣ G
clo-least-behaviour beh S⊆G = clo-below beh S⊆G

------------------------------------------------------------------------
-- §5.  Non-vacuity — the Galois/closure facts hold of a REAL behaviour
--
-- The Core handshake `p0 ∷ []` ⊥ `o0 ∷ dai ∷ []` witnesses an inhabited
-- co-design behaviour, so §2–§4 are not vacuous over the genuine
-- `interact`-orthogonality (not a toy relation).
------------------------------------------------------------------------

-- The singleton test-set of a design.
⟨_⟩ : Design → PredY
⟨ E ⟩ E′ = E′ ≡ E

-- The handshake pair is orthogonal (witness fuel 2, from ludics.Core).
handshake-⊥ : (p0 ∷ []) ⊥ (o0 ∷ dai ∷ [])
handshake-⊥ = ex-orth

-- Hence `p0 ∷ []` lies in the behaviour ⊥^⟨o0 ∷ dai ∷ []⟩, which §4 makes a
-- genuine closure fixed point: the classification has a non-empty model.
handshake-in-behaviour : (⊥^ ⟨ o0 ∷ dai ∷ [] ⟩) (p0 ∷ [])
handshake-in-behaviour {y} y≡E rewrite y≡E = handshake-⊥
