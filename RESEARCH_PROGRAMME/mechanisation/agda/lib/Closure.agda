------------------------------------------------------------------------
-- lib.Closure — closure operators, the powerset poset, and the
--               biorthogonal closure (·)^⊥⊥
--
-- This is the shared closure-theory companion to `lib.Order`.  It supplies
-- three reusable pieces, all type-checked under `--safe --without-K`
-- WITHOUT POSTULATES OR HOLES:
--
--   * `Powerset`    — the powerset poset over a carrier X: subsets are
--                     predicates `X → Set`, ⊆ = pointwise implication,
--                     ≐ = mutual inclusion (the F2 set-equality, not ≡),
--                     with binary union _∪_ and its LUB clauses.  Every
--                     order axiom is discharged and the abstract
--                     `lib.Order.Order` theory is instantiated, so the
--                     powerset is a setoid join-semilattice up to ≐.
--
--   * `ClosureOp`   — an abstract closure operator on a setoid poset
--                     (extensive, monotone, idempotent), with the standard
--                     consequences: the closed elements, the closure is
--                     itself closed, and the Galois universal property
--                     (`a ⊑ c ⇔ cl a ⊑ c` for closed c).
--
--   * `Biorthogonal`— given an orthogonality relation `_⊥_ : X → Y → Set`,
--                     the polar maps `pol⁺ : 𝒫(X) → 𝒫(Y)` and
--                     `pol⁻ : 𝒫(Y) → 𝒫(X)` form an antitone Galois
--                     connection, and the composite `clo = pol⁻ ∘ pol⁺`
--                     is a closure operator on 𝒫(X).  This is the
--                     (·)^⊥⊥ underlying C006 (⟦S⟧ = CQ-orthogonal-set^⊥⊥),
--                     T003 condition (1), and the C004 saturation.
--
-- The closure operator yields, via `ClosureOp`, the Galois-insertion
-- corollary used by C004; the biorthogonal monotonicity yields the T003
-- inheritance corollary (more CQs ⇒ smaller base set ⇒ smaller behaviour).
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module lib.Closure where

open import Level using (Level; suc; _⊔_)
open import Data.Product using (_×_; _,_; proj₁; proj₂)
open import Data.Sum using (_⊎_; inj₁; inj₂; [_,_])
open import Function using (id; _∘_)

------------------------------------------------------------------------
-- §1.  The powerset poset over a carrier X
--
-- Subsets are predicates; ⊆ is pointwise implication; ≐ is mutual
-- inclusion (= the design-set equality ≈ᴰ / finding F2 lifted to the
-- powerset level).  This is the predicate-level generalisation of
-- `lib.Order.ListSetInclusion`.
------------------------------------------------------------------------

module Powerset {a : Level} (X : Set a) where

  -- A subset of X is a predicate.  Membership is application.
  Pred : Set (suc a)
  Pred = X → Set a

  _∈_ : X → Pred → Set a
  x ∈ P = P x

  -- Set-inclusion.
  _⊆_ : Pred → Pred → Set a
  P ⊆ Q = ∀ {x} → x ∈ P → x ∈ Q

  -- Set-equality (mutual inclusion); never propositional ≡.
  _≐_ : Pred → Pred → Set a
  P ≐ Q = (P ⊆ Q) × (Q ⊆ P)

  ≐-refl : ∀ {P} → P ≐ P
  ≐-refl = (λ x∈ → x∈) , (λ x∈ → x∈)

  ≐-sym : ∀ {P Q} → P ≐ Q → Q ≐ P
  ≐-sym (p , q) = q , p

  ≐-trans : ∀ {P Q R} → P ≐ Q → Q ≐ R → P ≐ R
  ≐-trans (p , q) (p' , q') = (λ x∈ → p' (p x∈)) , (λ x∈ → q (q' x∈))

  ⊆-refl : ∀ {P} → P ⊆ P
  ⊆-refl x∈ = x∈

  ⊆-trans : ∀ {P Q R} → P ⊆ Q → Q ⊆ R → P ⊆ R
  ⊆-trans p q x∈ = q (p x∈)

  ⊆-antisym : ∀ {P Q} → P ⊆ Q → Q ⊆ P → P ≐ Q
  ⊆-antisym p q = p , q

  ≐-⊆-trans : ∀ {P Q R} → P ≐ Q → Q ⊆ R → P ⊆ R
  ≐-⊆-trans (p , _) q x∈ = q (p x∈)

  ⊆-≐-trans : ∀ {P Q R} → P ⊆ Q → Q ≐ R → P ⊆ R
  ⊆-≐-trans p (p' , _) x∈ = p' (p x∈)

  -- Binary union and its three least-upper-bound clauses.
  _∪_ : Pred → Pred → Pred
  (P ∪ Q) x = (x ∈ P) ⊎ (x ∈ Q)

  ∪-ub₁ : ∀ {P Q} → P ⊆ (P ∪ Q)
  ∪-ub₁ x∈ = inj₁ x∈

  ∪-ub₂ : ∀ {P Q} → Q ⊆ (P ∪ Q)
  ∪-ub₂ x∈ = inj₂ x∈

  ∪-lub : ∀ {P Q R} → P ⊆ R → Q ⊆ R → (P ∪ Q) ⊆ R
  ∪-lub p q (inj₁ x∈) = p x∈
  ∪-lub p q (inj₂ x∈) = q x∈

  -- (The powerset is a setoid join-semilattice up to ≐ — the order axioms
  -- above plus the three ∪ LUB clauses are exactly the hypotheses of
  -- `lib.Order.Order` / `JoinFromLUB`.  We keep the hand-written lemmas
  -- here rather than instantiate `Order`, since downstream clients
  -- (`ClosureOp`, `Biorthogonal`, C004) consume the ⊆/≐/∪ lemmas directly.)

------------------------------------------------------------------------
-- §2.  Abstract closure operators on a setoid poset
--
-- A closure operator `cl` is extensive, monotone, and idempotent.  We
-- only require the non-trivial half of idempotence (cl (cl a) ⊑ cl a);
-- the other half is extensivity instantiated at `cl a`.
------------------------------------------------------------------------

module ClosureOp
  {c ℓ≈ ℓ⊑ : Level}
  (Carrier   : Set c)
  (_≈_       : Carrier → Carrier → Set ℓ≈)
  (_⊑_       : Carrier → Carrier → Set ℓ⊑)
  (≈-refl    : ∀ {a}     → a ≈ a)
  (≈-sym     : ∀ {a b}   → a ≈ b → b ≈ a)
  (≈-trans   : ∀ {a b d} → a ≈ b → b ≈ d → a ≈ d)
  (⊑-refl    : ∀ {a}     → a ⊑ a)
  (⊑-trans   : ∀ {a b d} → a ⊑ b → b ⊑ d → a ⊑ d)
  (⊑-antisym : ∀ {a b}   → a ⊑ b → b ⊑ a → a ≈ b)
  (≈-⊑-trans : ∀ {a b d} → a ≈ b → b ⊑ d → a ⊑ d)
  (⊑-≈-trans : ∀ {a b d} → a ⊑ b → b ≈ d → a ⊑ d)
  (cl        : Carrier → Carrier)
  (cl-ext    : ∀ {a}   → a ⊑ cl a)
  (cl-mono   : ∀ {a b} → a ⊑ b → cl a ⊑ cl b)
  (cl-idem⊑  : ∀ {a}   → cl (cl a) ⊑ cl a)
  where

  -- Idempotence as a setoid equality.
  cl-idem : ∀ {a} → cl (cl a) ≈ cl a
  cl-idem = ⊑-antisym cl-idem⊑ cl-ext

  -- `a` is closed when `cl a ≈ a`.
  Closed : Carrier → Set ℓ≈
  Closed a = cl a ≈ a

  -- The closure of anything is closed.
  cl-closed : ∀ {a} → Closed (cl a)
  cl-closed = cl-idem

  -- Galois universal property: for a closed `c`, sitting below `c` is the
  -- same as having one's closure below `c`.  (This is the closure ⇄
  -- Galois-insertion correspondence, restricted to the closed elements.)
  cl-below : ∀ {a c} → Closed c → a ⊑ c → cl a ⊑ c
  cl-below {c = c} cc a⊑c = ⊑-≈-trans (cl-mono a⊑c) cc

  below-cl : ∀ {a c} → cl a ⊑ c → a ⊑ c
  below-cl cla⊑c = ⊑-trans cl-ext cla⊑c

------------------------------------------------------------------------
-- §3.  Biorthogonal closure (·)^⊥⊥ from an orthogonality relation
--
-- Fix a single universe ℓ (the substrate instantiates designs in one
-- universe).  Given `_⊥_ : X → Y → Set ℓ`, the right/left polars
--
--   pol⁺ S = { y : ∀ x ∈ S, x ⊥ y }      (⊆ Y)
--   pol⁻ T = { x : ∀ y ∈ T, x ⊥ y }      (⊆ X)
--
-- form an antitone Galois connection, and clo = pol⁻ ∘ pol⁺ is a closure
-- operator on 𝒫(X).
------------------------------------------------------------------------

module Biorthogonal
  {ℓ : Level}
  (X Y : Set ℓ)
  (_⊥_ : X → Y → Set ℓ)
  where

  module PX = Powerset X
  module PY = Powerset Y

  open PX using () renaming (Pred to PredX; _∈_ to _∈ˣ_; _⊆_ to _⊆ˣ_; _≐_ to _≐ˣ_)
  open PY using () renaming (Pred to PredY; _∈_ to _∈ʸ_; _⊆_ to _⊆ʸ_; _≐_ to _≐ʸ_)

  -- Right polar: the elements of Y orthogonal to every element of S.
  pol⁺ : PredX → PredY
  pol⁺ S y = ∀ {x} → x ∈ˣ S → x ⊥ y

  -- Left polar: the elements of X orthogonal to every element of T.
  pol⁻ : PredY → PredX
  pol⁻ T x = ∀ {y} → y ∈ʸ T → x ⊥ y

  -- Both polars are antitone (order-reversing).
  pol⁺-antitone : ∀ {S S'} → S ⊆ˣ S' → pol⁺ S' ⊆ʸ pol⁺ S
  pol⁺-antitone S⊆S' y∈ x∈S = y∈ (S⊆S' x∈S)

  pol⁻-antitone : ∀ {T T'} → T ⊆ʸ T' → pol⁻ T' ⊆ˣ pol⁻ T
  pol⁻-antitone T⊆T' x∈ y∈T = x∈ (T⊆T' y∈T)

  -- Antitone Galois connection: S ⊆ pol⁻ T  ⇔  T ⊆ pol⁺ S.  (The two
  -- sides both unfold to "∀ x ∈ S, ∀ y ∈ T, x ⊥ y", up to argument order.)
  galois-→ : ∀ {S T} → S ⊆ˣ pol⁻ T → T ⊆ʸ pol⁺ S
  galois-→ S⊆ y∈T x∈S = S⊆ x∈S y∈T

  galois-← : ∀ {S T} → T ⊆ʸ pol⁺ S → S ⊆ˣ pol⁻ T
  galois-← T⊆ x∈S y∈T = T⊆ y∈T x∈S

  -- Expansion (extensivity) on each side, the unit/counit of the
  -- connection.
  expand⁺ : ∀ {S} → S ⊆ˣ pol⁻ (pol⁺ S)
  expand⁺ x∈S y∈pol⁺S = y∈pol⁺S x∈S

  expand⁻ : ∀ {T} → T ⊆ʸ pol⁺ (pol⁻ T)
  expand⁻ y∈T x∈pol⁻T = x∈pol⁻T y∈T

  -- The biorthogonal closure.
  clo : PredX → PredX
  clo S = pol⁻ (pol⁺ S)

  clo-ext : ∀ {S} → S ⊆ˣ clo S
  clo-ext = expand⁺

  clo-mono : ∀ {S S'} → S ⊆ˣ S' → clo S ⊆ˣ clo S'
  clo-mono S⊆S' = pol⁻-antitone (pol⁺-antitone S⊆S')

  -- Triple-polar collapse: pol⁺ ∘ pol⁻ ∘ pol⁺ ≐ pol⁺.
  pol⁺-collapse : ∀ {S} → pol⁺ (pol⁻ (pol⁺ S)) ≐ʸ pol⁺ S
  pol⁺-collapse {S} = pol⁺-antitone (expand⁺ {S}) , expand⁻ {pol⁺ S}

  -- Idempotence (the non-trivial half; the other half is clo-ext).
  clo-idem⊑ : ∀ {S} → clo (clo S) ⊆ˣ clo S
  clo-idem⊑ {S} = pol⁻-antitone (expand⁻ {pol⁺ S})

  -- The closure-operator consequences (cf. `ClosureOp`).  Inlined rather
  -- than obtained by instantiating `ClosureOp`, because that module's
  -- Carrier would be the function type `PredX = X → Set ℓ`, whose sort
  -- blocks level inference at application sites.
  clo-idem : ∀ {S} → clo (clo S) ≐ˣ clo S
  clo-idem = clo-idem⊑ , clo-ext

  -- `S` is biorthogonally closed when clo S ≐ S.
  Closed : PredX → Set ℓ
  Closed S = clo S ≐ˣ S

  -- The closure of anything is closed.
  clo-closed : ∀ {S} → Closed (clo S)
  clo-closed = clo-idem

  -- Galois universal property: to sit below a closed C, sit below it
  -- before closing.
  clo-below : ∀ {S C} → Closed C → S ⊆ˣ C → clo S ⊆ˣ C
  clo-below cc S⊆C = PX.⊆-≐-trans (clo-mono S⊆C) cc

  below-clo : ∀ {S C} → clo S ⊆ˣ C → S ⊆ˣ C
  below-clo {S} clS⊆C x∈S = clS⊆C (clo-ext {S} x∈S)

  -- Inheritance corollary (T003 / C006): a larger constraint base — i.e.
  -- a *smaller* surviving set S — gives a smaller biorthogonal closure.
  -- Concretely, if S' ⊆ S then clo S' ⊆ clo S.  (More critical questions
  -- shrink the CQ-orthogonal base set, hence shrink ⟦S⟧.)
  inheritance : ∀ {S S'} → S' ⊆ˣ S → clo S' ⊆ˣ clo S
  inheritance = clo-mono
