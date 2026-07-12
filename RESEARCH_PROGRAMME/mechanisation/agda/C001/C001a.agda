------------------------------------------------------------------------
-- C001a — JSL-fragment of the Ambler bridge, FORMAL mechanisation
--
-- Statement: Art(Cᵢ) ≅ Hom_{JSL}(𝟐, Art(Cᵢ))
-- where 𝟐 = Gen is the free JSL on one generator, and ≅ is a setoid
-- isomorphism up to set-equality ≈ᴰ on Cone (a setoid layer, finding F2).
--
-- This is the *formal* upgrade of the earlier evidence-level C001a:
--
--   * The design equality ≈ᴰ is exposed as a stdlib `Setoid`
--     (`Designs.Design-setoid`); set-inclusion ⊆ᴰ as an
--     `IsPartialOrder` into that setoid; and set-union ∪ᴰ as a genuine
--     `Supremum`.
--   * The per-cone JSL `Art(Cᵢ)` is packaged as a stdlib
--     `JoinSemilattice` bundle (`Cones.Art`), i.e. the T001 per-cone
--     join-semilattice is now a first-class algebraic object, not an
--     ad-hoc record.
--   * The free 1-generated JSL `𝟐` is likewise a `JoinSemilattice`
--     bundle (`Gen.Gen-joinSemilattice`).
--   * JSL-homomorphism structure is separated into an `IsJSLHom`
--     predicate over the underlying map and a `JSLHom` bundle carrying
--     it (finding F1).
--   * The bridge is stated as a stdlib `Function.Bundles.Inverse`
--     between the cone setoid and the hom setoid (`Bridge.bridge`),
--     i.e. a bona-fide setoid isomorphism, with both triangle equations
--     packaged as its `inverseˡ`/`inverseʳ` components.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES, under `--safe`.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
--
-- This is *evidence* for C001a, not a positive settlement. See
-- C001a-jsl-fragment-bridge.md §Mechanisation for the human-review
-- obligations that remain.
--
-- Substrate cross-references:
--   T001 (per-cone JSL: order is set-inclusion, join is set-union)
--   T002 (Inc(B) is an antichain; cone decomposition)
--   C001  (parent: full Ambler bridge)
--   C001a (this artefact: the JSL fragment, up to ≈ᴰ)
--   C001b (sibling: Ambler-specific remainder, deferred)
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module C001a where

open import Level using (0ℓ)
open import Data.List using (List; []; _∷_; _++_)
open import Data.List.Membership.Propositional using (_∈_)
open import Data.List.Membership.Propositional.Properties
  using (∈-++⁺ˡ; ∈-++⁺ʳ; ∈-++⁻)
open import Data.Product using (Σ; _×_; _,_; proj₁; proj₂)
open import Data.Sum using (inj₁; inj₂)
open import Data.Nat using (ℕ)
open import Function using (id; _∘_)
open import Relation.Binary.PropositionalEquality
  using (_≡_; refl) renaming (isEquivalence to ≡-isEquivalence)
open import Relation.Binary.Bundles using (Setoid)
open import Relation.Binary.Structures
  using (IsEquivalence; IsPreorder; IsPartialOrder)
open import Relation.Binary.Lattice.Definitions using (Supremum)
open import Relation.Binary.Lattice.Bundles using (JoinSemilattice)
open import Function.Bundles using (Inverse)

------------------------------------------------------------------------
-- §1.  Toy signature A_Γ
--
-- Confidence annotations from the earlier Toy.agda are *dropped* here:
-- they are C001b's territory (the erasure square does not live in the
-- JSL fragment).
------------------------------------------------------------------------

module Sig where

  data Op : Set where
    pro : Op
    con : Op

  arity : Op → ℕ
  arity pro = 1
  arity con = 2

------------------------------------------------------------------------
-- §2.  Toy designs, inclusion, and the design SETOID / POSET
--
-- _⊆ᴰ_ is functional ("every move of D is a move of D'"); ≈ᴰ is mutual
-- inclusion (finding F2).  Both are now bundled: ≈ᴰ as a `Setoid`,
-- ⊆ᴰ as an `IsPartialOrder` into it, and ∪ᴰ as a `Supremum`.
------------------------------------------------------------------------

module Designs where

  open Sig

  data Move : Set where
    mv : (op : Op) (children : List Move) → Move

  Design : Set
  Design = List Move

  -- Set-inclusion: every member of D is a member of D'.
  _⊆ᴰ_ : Design → Design → Set
  D ⊆ᴰ D' = ∀ {m} → m ∈ D → m ∈ D'

  ⊆ᴰ-refl : ∀ {D} → D ⊆ᴰ D
  ⊆ᴰ-refl = id

  ⊆ᴰ-trans : ∀ {D₁ D₂ D₃} → D₁ ⊆ᴰ D₂ → D₂ ⊆ᴰ D₃ → D₁ ⊆ᴰ D₃
  ⊆ᴰ-trans p q = q ∘ p

  -- Set-union as join (T001, literal chronicle-set union inside a cone).
  _∪ᴰ_ : Design → Design → Design
  _∪ᴰ_ = _++_

  -- Left/right injection lemmas for ∪ᴰ.
  ⊆ᴰ-++ˡ : ∀ {D₁ D} D' → D₁ ⊆ᴰ D → D₁ ⊆ᴰ (D ++ D')
  ⊆ᴰ-++ˡ D' p x = ∈-++⁺ˡ (p x)

  ⊆ᴰ-++ʳ : ∀ {D₂ D'} D → D₂ ⊆ᴰ D' → D₂ ⊆ᴰ (D ++ D')
  ⊆ᴰ-++ʳ D p x = ∈-++⁺ʳ D (p x)

  -- Universal property of join: D₁ ∪ D₂ ⊆ D whenever both fit in D.
  -- This is the key lemma for the iso's pres-⊔ obligations.
  ⊆ᴰ-++-collapse : ∀ {D₁ D₂ D} → D₁ ⊆ᴰ D → D₂ ⊆ᴰ D → (D₁ ++ D₂) ⊆ᴰ D
  ⊆ᴰ-++-collapse {D₁} p q m∈ with ∈-++⁻ D₁ m∈
  ... | inj₁ m∈D₁ = p m∈D₁
  ... | inj₂ m∈D₂ = q m∈D₂

  -- Set-equality on Design (finding F2).
  _≈ᴰ_ : Design → Design → Set
  D ≈ᴰ D' = (D ⊆ᴰ D') × (D' ⊆ᴰ D)

  ≈ᴰ-refl : ∀ {D} → D ≈ᴰ D
  ≈ᴰ-refl = ⊆ᴰ-refl , ⊆ᴰ-refl

  ≈ᴰ-sym : ∀ {D D'} → D ≈ᴰ D' → D' ≈ᴰ D
  ≈ᴰ-sym (p , q) = q , p

  ≈ᴰ-trans : ∀ {D₁ D₂ D₃} → D₁ ≈ᴰ D₂ → D₂ ≈ᴰ D₃ → D₁ ≈ᴰ D₃
  ≈ᴰ-trans (p , q) (p' , q') = ⊆ᴰ-trans p p' , ⊆ᴰ-trans q' q

  -- ≈ᴰ as an explicit equivalence / Setoid bundle.
  ≈ᴰ-isEquivalence : IsEquivalence _≈ᴰ_
  ≈ᴰ-isEquivalence = record
    { refl = ≈ᴰ-refl ; sym = ≈ᴰ-sym ; trans = ≈ᴰ-trans }

  Design-setoid : Setoid 0ℓ 0ℓ
  Design-setoid = record
    { Carrier = Design ; _≈_ = _≈ᴰ_ ; isEquivalence = ≈ᴰ-isEquivalence }

  -- ⊆ᴰ as a partial order into the ≈ᴰ setoid (antisymmetry = pairing).
  ⊆ᴰ-isPartialOrder : IsPartialOrder _≈ᴰ_ _⊆ᴰ_
  ⊆ᴰ-isPartialOrder = record
    { isPreorder = record
        { isEquivalence = ≈ᴰ-isEquivalence
        ; reflexive     = proj₁
        ; trans         = ⊆ᴰ-trans
        }
    ; antisym = _,_
    }

  -- ∪ᴰ is a supremum for ⊆ᴰ: the three components are the join lemmas.
  ∪ᴰ-supremum : Supremum _⊆ᴰ_ _∪ᴰ_
  ∪ᴰ-supremum D D' =
      ⊆ᴰ-++ˡ D' ⊆ᴰ-refl
    , ⊆ᴰ-++ʳ D  ⊆ᴰ-refl
    , λ _ p q → ⊆ᴰ-++-collapse p q

------------------------------------------------------------------------
-- §3.  Cones and the per-cone JSL Art(Cᵢ) as a bundle (T001, T002)
------------------------------------------------------------------------

module Cones where

  open Designs

  -- The cone above Dᵢ packages the inclusion witness.
  Cone : Design → Set
  Cone Dᵢ = Σ Design (λ D → Dᵢ ⊆ᴰ D)

  cone-bot : ∀ Dᵢ → Cone Dᵢ
  cone-bot Dᵢ = Dᵢ , ⊆ᴰ-refl

  cone-join : ∀ {Dᵢ} → Cone Dᵢ → Cone Dᵢ → Cone Dᵢ
  cone-join (D , p) (D' , _) = (D ++ D') , ⊆ᴰ-++ˡ D' p

  -- Setoid on the cone: equal up to ≈ᴰ on underlying designs.
  _≈ᶜ_ : ∀ {Dᵢ} → Cone Dᵢ → Cone Dᵢ → Set
  p ≈ᶜ q = proj₁ p ≈ᴰ proj₁ q

  ≈ᶜ-refl : ∀ {Dᵢ} {p : Cone Dᵢ} → p ≈ᶜ p
  ≈ᶜ-refl = ≈ᴰ-refl

  ≈ᶜ-sym : ∀ {Dᵢ} {p q : Cone Dᵢ} → p ≈ᶜ q → q ≈ᶜ p
  ≈ᶜ-sym = ≈ᴰ-sym

  ≈ᶜ-trans : ∀ {Dᵢ} {p q r : Cone Dᵢ} → p ≈ᶜ q → q ≈ᶜ r → p ≈ᶜ r
  ≈ᶜ-trans = ≈ᴰ-trans

  ≈ᶜ-isEquivalence : ∀ {Dᵢ} → IsEquivalence (_≈ᶜ_ {Dᵢ})
  ≈ᶜ-isEquivalence = record
    { refl = λ {x} → ≈ᴰ-refl ; sym = ≈ᴰ-sym ; trans = ≈ᴰ-trans }

  Cone-setoid : Design → Setoid 0ℓ 0ℓ
  Cone-setoid Dᵢ = record
    { Carrier = Cone Dᵢ ; _≈_ = _≈ᶜ_ {Dᵢ} ; isEquivalence = ≈ᶜ-isEquivalence }

  -- Inclusion order on the cone, lifted from ⊆ᴰ on underlying designs.
  _⊑ᶜ_ : ∀ {Dᵢ} → Cone Dᵢ → Cone Dᵢ → Set
  p ⊑ᶜ q = proj₁ p ⊆ᴰ proj₁ q

  ⊑ᶜ-isPartialOrder : ∀ {Dᵢ} → IsPartialOrder (_≈ᶜ_ {Dᵢ}) _⊑ᶜ_
  ⊑ᶜ-isPartialOrder = record
    { isPreorder = record
        { isEquivalence = ≈ᶜ-isEquivalence
        ; reflexive     = proj₁
        ; trans         = ⊆ᴰ-trans
        }
    ; antisym = _,_
    }

  -- cone-join is the supremum of the cone order: same three lemmas.
  cone-supremum : ∀ {Dᵢ} → Supremum (_⊑ᶜ_ {Dᵢ}) cone-join
  cone-supremum (D , _) (D' , _) =
      ⊆ᴰ-++ˡ D' ⊆ᴰ-refl
    , ⊆ᴰ-++ʳ D  ⊆ᴰ-refl
    , λ _ p q → ⊆ᴰ-++-collapse p q

  -- Art(Cᵢ): the per-cone JSL (T001) as a first-class JoinSemilattice.
  Art : Design → JoinSemilattice 0ℓ 0ℓ 0ℓ
  Art Dᵢ = record
    { Carrier = Cone Dᵢ
    ; _≈_     = _≈ᶜ_
    ; _≤_     = _⊑ᶜ_
    ; _∨_     = cone-join
    ; isJoinSemilattice = record
        { isPartialOrder = ⊑ᶜ-isPartialOrder
        ; supremum       = cone-supremum
        }
    }

------------------------------------------------------------------------
-- §4.  Gen — the free JSL on one generator (finding F3), as a bundle
--
-- Two elements: ⊥g (bottom), *g (the generator/top).
-- Join: ⊥g ⊔ y = y;  *g ⊔ y = *g.  The order is the two-element chain
-- {⊥g ≤ *g}, and (Gen, ≡, ≤g, ⊔g) is packaged as a JoinSemilattice.
------------------------------------------------------------------------

module Gen where

  data Gen : Set where
    ⊥g : Gen
    *g : Gen

  _⊔g_ : Gen → Gen → Gen
  ⊥g ⊔g y = y
  *g ⊔g _ = *g

  data _≤g_ : Gen → Gen → Set where
    ⊥g≤  : ∀ {y} → ⊥g ≤g y
    *g≤*g :        *g ≤g *g

  ≤g-refl : ∀ {x} → x ≤g x
  ≤g-refl {⊥g} = ⊥g≤
  ≤g-refl {*g} = *g≤*g

  ≤g-trans : ∀ {x y z} → x ≤g y → y ≤g z → x ≤g z
  ≤g-trans ⊥g≤   _     = ⊥g≤
  ≤g-trans *g≤*g *g≤*g = *g≤*g

  ≤g-antisym : ∀ {x y} → x ≤g y → y ≤g x → x ≡ y
  ≤g-antisym ⊥g≤   ⊥g≤   = refl
  ≤g-antisym *g≤*g *g≤*g = refl

  ⊔g-supremum : Supremum _≤g_ _⊔g_
  ⊔g-supremum ⊥g y  = ⊥g≤  , ≤g-refl , λ _ _ q → q
  ⊔g-supremum *g ⊥g = *g≤*g , ⊥g≤    , λ _ p _ → p
  ⊔g-supremum *g *g = *g≤*g , *g≤*g  , λ _ p _ → p

  Gen-joinSemilattice : JoinSemilattice 0ℓ 0ℓ 0ℓ
  Gen-joinSemilattice = record
    { Carrier = Gen
    ; _≈_     = _≡_
    ; _≤_     = _≤g_
    ; _∨_     = _⊔g_
    ; isJoinSemilattice = record
        { isPartialOrder = record
            { isPreorder = record
                { isEquivalence = ≡-isEquivalence
                ; reflexive     = λ { refl → ≤g-refl }
                ; trans         = ≤g-trans
                }
            ; antisym = ≤g-antisym
            }
        ; supremum = ⊔g-supremum
        }
    }

------------------------------------------------------------------------
-- §5.  JSL homomorphisms Gen → Art(Cᵢ)
--
-- The hom structure is separated (finding F1): `IsJSLHom` is the
-- predicate "this map preserves ⊥ and ⊔" over a bare underlying map,
-- and `JSLHom` bundles a map with its `IsJSLHom` witness.  Equality on
-- the codomain is up to ≈ᶜ (finding F2).
------------------------------------------------------------------------

module JSL-Hom where

  open Designs
  open Cones
  open Gen

  record IsJSLHom (Dᵢ : Design) (map : Gen → Cone Dᵢ) : Set where
    field
      pres-bot : map ⊥g ≈ᶜ cone-bot Dᵢ
      pres-⊔   : ∀ x y → map (x ⊔g y) ≈ᶜ cone-join (map x) (map y)

  record JSLHom (Dᵢ : Design) : Set where
    field
      map      : Gen → Cone Dᵢ
      isJSLHom : IsJSLHom Dᵢ map
    open IsJSLHom isJSLHom public

  -- Hom-set equality: pointwise up to ≈ᶜ.
  _≈H_ : ∀ {Dᵢ} → JSLHom Dᵢ → JSLHom Dᵢ → Set
  h ≈H k = ∀ g → JSLHom.map h g ≈ᶜ JSLHom.map k g

  ≈H-refl : ∀ {Dᵢ} {h : JSLHom Dᵢ} → h ≈H h
  ≈H-refl _ = ≈ᴰ-refl

  ≈H-sym : ∀ {Dᵢ} {h k : JSLHom Dᵢ} → h ≈H k → k ≈H h
  ≈H-sym h≈k g = ≈ᴰ-sym (h≈k g)

  ≈H-trans : ∀ {Dᵢ} {h k l : JSLHom Dᵢ} → h ≈H k → k ≈H l → h ≈H l
  ≈H-trans h≈k k≈l g = ≈ᴰ-trans (h≈k g) (k≈l g)

  ≈H-isEquivalence : ∀ {Dᵢ} → IsEquivalence (_≈H_ {Dᵢ})
  ≈H-isEquivalence {Dᵢ} = record
    { refl  = λ {h}     → ≈H-refl  {Dᵢ} {h}
    ; sym   = λ {h k}   → ≈H-sym   {Dᵢ} {h} {k}
    ; trans = λ {h k l} → ≈H-trans {Dᵢ} {h} {k} {l}
    }

  Hom-setoid : Design → Setoid 0ℓ 0ℓ
  Hom-setoid Dᵢ = record
    { Carrier = JSLHom Dᵢ ; _≈_ = _≈H_ {Dᵢ} ; isEquivalence = ≈H-isEquivalence }

------------------------------------------------------------------------
-- §6.  The bridge: Art(Cᵢ) ≅ Hom_{JSL}(Gen, Art Cᵢ) as a setoid Inverse
--
--   fromHom h := h(*g)         (a cone element)
--   toHom   c := the unique JSL-hom sending *g to c
--                              (forced: ⊥g must go to cone-bot Dᵢ)
--
-- `bridge Dᵢ : Inverse (Cone-setoid Dᵢ) (Hom-setoid Dᵢ)` packages both
-- triangle equations as the inverse's inverseˡ/inverseʳ.
------------------------------------------------------------------------

module Bridge where

  open Designs
  open Cones
  open Gen
  open JSL-Hom

  fromHom : ∀ {Dᵢ} → JSLHom Dᵢ → Cone Dᵢ
  fromHom h = JSLHom.map h *g

  -- toHom: each of the four pres-⊔ cases is discharged by a pair
  --   (forward ⊆, backward ⊆) built from ⊆ᴰ-++-collapse, ⊆ᴰ-++ˡ /
  --   ⊆ᴰ-++ʳ, ⊆ᴰ-refl, and the cone witness proj₂ c.
  toHom : ∀ {Dᵢ} → Cone Dᵢ → JSLHom Dᵢ
  toHom {Dᵢ} c = record
    { map      = m
    ; isJSLHom = record { pres-bot = ≈ᴰ-refl ; pres-⊔ = pres }
    }
    where
      m : Gen → Cone Dᵢ
      m ⊥g = cone-bot Dᵢ
      m *g = c

      pres : ∀ x y → m (x ⊔g y) ≈ᶜ cone-join (m x) (m y)
      -- ⊥g ⊔ ⊥g = ⊥g.  LHS = Dᵢ;     RHS = Dᵢ ++ Dᵢ.
      pres ⊥g ⊥g = ⊆ᴰ-++ˡ Dᵢ ⊆ᴰ-refl
                 , ⊆ᴰ-++-collapse ⊆ᴰ-refl ⊆ᴰ-refl
      -- ⊥g ⊔ *g = *g.  LHS = proj₁ c; RHS = Dᵢ ++ proj₁ c.
      pres ⊥g *g = ⊆ᴰ-++ʳ Dᵢ ⊆ᴰ-refl
                 , ⊆ᴰ-++-collapse (proj₂ c) ⊆ᴰ-refl
      -- *g ⊔ ⊥g = *g.  LHS = proj₁ c; RHS = proj₁ c ++ Dᵢ.
      pres *g ⊥g = ⊆ᴰ-++ˡ Dᵢ ⊆ᴰ-refl
                 , ⊆ᴰ-++-collapse ⊆ᴰ-refl (proj₂ c)
      -- *g ⊔ *g = *g.  LHS = proj₁ c; RHS = proj₁ c ++ proj₁ c.
      pres *g *g = ⊆ᴰ-++ˡ (proj₁ c) ⊆ᴰ-refl
                 , ⊆ᴰ-++-collapse ⊆ᴰ-refl ⊆ᴰ-refl

  -- Triangle 1: fromHom ∘ toHom ≡ id (propositionally, by reduction).
  from-to : ∀ {Dᵢ} (c : Cone Dᵢ) → fromHom (toHom c) ≡ c
  from-to _ = refl

  -- Congruence of the two maps over the setoids.
  toHom-cong : ∀ {Dᵢ} {c c' : Cone Dᵢ} → c ≈ᶜ c' → toHom c ≈H toHom c'
  toHom-cong c≈c' ⊥g = ≈ᴰ-refl
  toHom-cong c≈c' *g = c≈c'

  fromHom-cong : ∀ {Dᵢ} {h k : JSLHom Dᵢ} → h ≈H k → fromHom h ≈ᶜ fromHom k
  fromHom-cong h≈k = h≈k *g

  -- Triangle 2: toHom ∘ fromHom ≈H id (pointwise up to ≈ᶜ).
  -- At ⊥g: both sides give cone-bot Dᵢ up to ≈ᶜ-sym pres-bot.
  -- At *g: both sides give h(*g) definitionally.
  to-from : ∀ {Dᵢ} (h : JSLHom Dᵢ) → toHom (fromHom h) ≈H h
  to-from h ⊥g = ≈ᴰ-sym (JSLHom.pres-bot h)
  to-from h *g = ≈ᴰ-refl

  -- The bridge as a setoid isomorphism.  inverseˡ/inverseʳ are exactly
  -- the two triangles, transported along the congruences.
  bridge : ∀ Dᵢ → Inverse (Cone-setoid Dᵢ) (Hom-setoid Dᵢ)
  bridge Dᵢ = record
    { to        = toHom
    ; from      = fromHom
    ; to-cong   = λ {c}{c'} → toHom-cong {Dᵢ} {c} {c'}
    ; from-cong = λ {h}{k} → fromHom-cong {Dᵢ} {h} {k}
    ; inverse   = (λ {x}{y} y≈ → ≈H-trans {Dᵢ} {toHom {Dᵢ} y} {toHom {Dᵢ} (fromHom x)} {x} (toHom-cong {Dᵢ} {y} {fromHom x} y≈) (to-from {Dᵢ} x))
                , (λ {x}{y} y≈ → fromHom-cong {Dᵢ} {y} {toHom {Dᵢ} x} y≈)
    }

------------------------------------------------------------------------
-- §7.  What this proves and what it doesn't
--
-- PROVED (formally, no postulates, no holes, --safe):
--   - The per-cone JSL Art(Cᵢ) is a stdlib `JoinSemilattice` bundle
--     (`Cones.Art`), and the free 1-generator JSL Gen is too
--     (`Gen.Gen-joinSemilattice`); the design equality ≈ᴰ is a `Setoid`
--     and ⊆ᴰ an `IsPartialOrder` with ∪ᴰ a `Supremum`.
--   - The JSL-fragment of the Ambler bridge as the unit of the
--     free/forgetful adjunction between Set and JSL, instantiated at
--     Art(Cᵢ), is a `Function.Bundles.Inverse` between the cone setoid
--     and the hom setoid (`Bridge.bridge`).
--   - All four cases of pres-⊔ discharge from the universal property
--     of set-union (⊆ᴰ-++-collapse) plus the cone witness.
--
-- NOT PROVED (deferred to C001b or human review):
--   - Faithfulness of the toy signature Sig to Ambler 1996.
--   - The confidence-erasure square (the toy drops Conf entirely).
--   - The cartesian-closed and additive structure of A_Γ beyond JSL.
--   - The match between the toy's flat List Move designs and the
--     substrate's chronicle-tree designs.
--
-- See C001a-jsl-fragment-bridge.md §Mechanisation for the full list.
------------------------------------------------------------------------
