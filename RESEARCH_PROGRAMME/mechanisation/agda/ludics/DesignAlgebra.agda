------------------------------------------------------------------------
-- ludics.DesignAlgebra — L0 of Session 20 (Diairesis cross-test):
--   "designs are (co)algebraic" — the Q-A(D) classification of the design
--   carrier as the INITIAL ALGEBRA (μ-pole) of the action functor.
--
-- Direction: cross-program.  Serves the Diairesis "Removing the Bound"
-- Precision Lemma (R2): every precise account of self-differentiation is
-- (co)algebraic.  Session 20
-- (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/20-ludics-diairesis-crosstest.md),
-- step L0 — the last object needed for a full Q-A CONFIRM.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT L0 ASKS (Session 20 §3 (D))
-- ─────────────────────────────────────────────────────────────────────
-- Classify the first Ludics primitive — DESIGNS.  Predicted: COALGEBRAIC —
-- the (possibly-infinite) Böhm-tree/strategy presentation is the FINAL
-- coalgebra of a "ludics action" functor, with the FINITE fragment
-- (`ludics/Core`, `Design = List Act`) its well-founded μ-part (the INITIAL
-- algebra).  Designs therefore span both poles of the bidirectional arrow
-- (Q-015's μ/ν), both imported.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS ESTABLISHED HERE (over the real M0 carrier `Design = List Act`)
-- ─────────────────────────────────────────────────────────────────────
--   The action functor (linear/chronicle fragment):
--       F Y = ⊤ ⊎ (Act × Y)          -- "stop, or one action then the rest"
--   is the list functor over `Act`.  (The branching Böhm-tree presentation
--   is `F Y = ⊤ ⊎ (Act × (ramification → Y))`; the M0 carrier is its
--   chronicle-as-sequence projection — see the carrier audit.  We mechanise
--   the real carrier.)  Over it:
--
--   (μ) `Design = List Act` IS THE INITIAL F-ALGEBRA:
--       * `into : F Design → Design` is the structure map ([]-or-∷);
--       * the catamorphism `⟦ A ⟧ = foldr (μ A) (η A)` is an F-algebra
--         homomorphism into ANY algebra A (`fold-hom`);
--       * it is the UNIQUE such homomorphism (`foldr-unique`) — initiality.
--
--   (Lambek) `Design ≅ F Design`:  `into` and `uncons` are mutually inverse
--       (`into-uncons`, `uncons-into`).  So the design carrier is a literal
--       FIXED POINT of the action functor — `X ≅ F(X)`, the precise form of
--       self-differentiation Diairesis quantifies over.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE VERDICT (headline; Diairesis report: L0-design-algebra-2026-06-26.md)
-- ─────────────────────────────────────────────────────────────────────
--   Q-A(D): CONFIRM.  The finite design carrier is the initial algebra (μ)
--   of the action functor and satisfies the fixed-point iso `Design ≅
--   F Design`; the fold is the unique mediating morphism (initiality).  It
--   is (co)algebraic — the well-founded μ-pole, IMPORTED (List's recursion
--   is the structural induction the carrier presupposes).  The infinitary
--   M1′ extension is the FINAL coalgebra (ν-pole), the other imported pole;
--   stated here, mechanised under coinduction elsewhere (L4 residual).
--
--   With L1 (N, recursion over ℕ) and L2 (O, closure monad), Q-A is
--   CONFIRM at all three objects: ludics — the strongest exotic candidate —
--   falls wholly inside the (co)algebra paradigm.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/DesignAlgebra.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.DesignAlgebra where

open import Data.Unit using (⊤; tt)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Data.Product using (_×_; _,_)
open import Data.Nat using (ℕ; zero; suc)
open import Data.List using (List; []; _∷_; foldr)
open import Function using (id; _∘_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; cong; trans)

open import ludics.Core using (Act; Design; p0; o0)

------------------------------------------------------------------------
-- §1.  The action functor  F Y = ⊤ ⊎ (Act × Y)
--
-- "Either the chronicle stops (⊤), or one action `Act` is taken and the
-- rest `Y` follows."  This is the list functor over `Act`; its initial
-- algebra is `List Act = Design`.
------------------------------------------------------------------------

F : Set → Set
F Y = ⊤ ⊎ (Act × Y)

Fmap : ∀ {Y Z} → (Y → Z) → F Y → F Z
Fmap f (inj₁ tt)      = inj₁ tt
Fmap f (inj₂ (a , y)) = inj₂ (a , f y)

-- Functoriality (identity and composition laws), by case analysis.
Fmap-id : ∀ {Y} (x : F Y) → Fmap id x ≡ x
Fmap-id (inj₁ tt)      = refl
Fmap-id (inj₂ (a , y)) = refl

Fmap-∘ : ∀ {Y Z W} (g : Z → W) (f : Y → Z) (x : F Y)
       → Fmap (g ∘ f) x ≡ Fmap g (Fmap f x)
Fmap-∘ g f (inj₁ tt)      = refl
Fmap-∘ g f (inj₂ (a , y)) = refl

------------------------------------------------------------------------
-- §2.  F-algebras, and the design carrier as one
--
-- An F-algebra is a carrier with a structure map `F Car → Car`, here split
-- into its nil (⊤) and cons (Act ×) components.
------------------------------------------------------------------------

record Algebra : Set₁ where
  field
    Car : Set
    η   : Car            -- the ⊤ component  (nil)
    μ   : Act → Car → Car -- the Act × component (cons)
open Algebra

-- The structure map of an algebra, assembled from η / μ.
algMap : (A : Algebra) → F (Car A) → Car A
algMap A (inj₁ tt)       = η A
algMap A (inj₂ (a , c))  = μ A a c

-- The DESIGN algebra: carrier = Design, structure = the constructors.
DesignAlg : Algebra
DesignAlg = record { Car = Design ; η = [] ; μ = _∷_ }

-- Its structure map is the canonical `into`.
into : F Design → Design
into = algMap DesignAlg

------------------------------------------------------------------------
-- §3.  The catamorphism — fold — and its homomorphism property
--
-- `⟦ A ⟧ = foldr (μ A) (η A)` maps designs into any algebra A.  The two
-- computation laws hold by `refl`, and together they ARE the F-algebra
-- homomorphism square `⟦ A ⟧ ∘ into ≗ algMap A ∘ Fmap ⟦ A ⟧`.
------------------------------------------------------------------------

⟦_⟧ : (A : Algebra) → Design → Car A
⟦ A ⟧ = foldr (μ A) (η A)

⟦⟧-nil : ∀ A → ⟦ A ⟧ [] ≡ η A
⟦⟧-nil A = refl

⟦⟧-cons : ∀ A a as → ⟦ A ⟧ (a ∷ as) ≡ μ A a (⟦ A ⟧ as)
⟦⟧-cons A a as = refl

-- The homomorphism square: `⟦ A ⟧` commutes with the structure maps.
fold-hom : ∀ A (x : F Design) → ⟦ A ⟧ (into x) ≡ algMap A (Fmap ⟦ A ⟧ x)
fold-hom A (inj₁ tt)       = refl
fold-hom A (inj₂ (a , as)) = refl

------------------------------------------------------------------------
-- §4.  Initiality — the fold is the UNIQUE mediating morphism
--
-- Any `h : Design → Car A` that is an F-algebra homomorphism (commutes with
-- nil and cons) equals the catamorphism.  This is the universal property
-- that makes `Design` the INITIAL F-algebra, i.e. the LEAST fixed point
-- `μF` — the well-founded (inductive) pole.
------------------------------------------------------------------------

foldr-unique : ∀ (A : Algebra) (h : Design → Car A)
             → h [] ≡ η A
             → (∀ a as → h (a ∷ as) ≡ μ A a (h as))
             → ∀ ds → h ds ≡ ⟦ A ⟧ ds
foldr-unique A h hnil hcons []        = hnil
foldr-unique A h hnil hcons (a ∷ as)  =
  trans (hcons a as) (cong (μ A a) (foldr-unique A h hnil hcons as))

------------------------------------------------------------------------
-- §5.  Lambek's lemma, concretely:  Design ≅ F Design
--
-- The initial algebra's structure map is an ISO: `into` and `uncons` are
-- mutually inverse.  So the design carrier is a literal FIXED POINT of the
-- action functor — `X ≅ F(X)` — the precise form of "self-differentiation"
-- Diairesis quantifies over.  The differentiating (the functor `F`) and the
-- differentiated (the carrier `Design`) coincide up to this iso.
------------------------------------------------------------------------

uncons : Design → F Design
uncons []        = inj₁ tt
uncons (a ∷ as)  = inj₂ (a , as)

into-uncons : ∀ ds → into (uncons ds) ≡ ds
into-uncons []        = refl
into-uncons (a ∷ as)  = refl

uncons-into : ∀ x → uncons (into x) ≡ x
uncons-into (inj₁ tt)       = refl
uncons-into (inj₂ (a , as)) = refl

------------------------------------------------------------------------
-- §6.  Non-vacuity — the catamorphism computes on real designs
--
-- The "count the actions" algebra folds a concrete design to its length:
-- `⟦_⟧` is a genuine recursion over the well-founded carrier.
------------------------------------------------------------------------

lengthAlg : Algebra
lengthAlg = record { Car = ℕ ; η = zero ; μ = λ _ n → suc n }

ex-fold : ⟦ lengthAlg ⟧ (p0 ∷ o0 ∷ []) ≡ suc (suc zero)
ex-fold = refl
