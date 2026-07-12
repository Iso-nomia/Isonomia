------------------------------------------------------------------------
-- lib.Order — shared order-theoretic core for the substrate mechanisation
--
-- Both T001 (per-cone join-semilattice) and T002 (Inc(B) antichain + cone
-- decomposition) were built over the *same* abstract setoid partial order
-- and the *same* list-design (designs-as-sets) instantiation.  This module
-- extracts that shared core so the two theorems no longer duplicate it:
--
--   * `Order`           — an abstract setoid poset (Carrier, ≈, ⊑) with the
--                         antisymmetry-into-≈ convention (T001 §Equality
--                         convention).  Its sub-modules are the reusable
--                         order theory:
--       - `JoinFromLUB` — every least-upper-bound operation on a setoid
--                         poset is a join-semilattice up to ≈ (used by T001);
--       - `Cone`        — the per-cone JSL with bottom, from the Daimon-Lock
--                         hypotheses (used by T001);
--       - `Behaviour`   — minimality / Inc(B) / the antichain + cone
--                         decomposition theory (used by T002).
--
--   * `ListSetInclusion` — the C001a list-design model: Carrier = List A,
--                         ⊑ = set-inclusion, ≈ = set-equality (≈ᴰ), every
--                         order axiom discharged, plus the `_++_` LUB
--                         clauses (the C001a lemmas).  Instantiates `Order`,
--                         so both theorems specialise to designs-as-sets.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITHOUT POSTULATES OR HOLES.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module lib.Order where

open import Level using (Level) renaming (_⊔_ to _⊔ˡ_)
open import Data.Empty using (⊥)
open import Data.Product using (Σ; _×_; _,_; proj₁; proj₂; ∃-syntax)
open import Relation.Nullary using (¬_)

------------------------------------------------------------------------
-- §1.  Abstract setoid partial order
--
-- A carrier with a setoid equality _≈_ and a preorder _⊑_ such that mutual
-- ⊑ collapses to ≈ (antisymmetry into the setoid) and ⊑ respects ≈.  This
-- is precisely the structure the substrate's designs carry: ⊑ is literal
-- chronicle-set inclusion and ≈ is chronicle-set equality.
------------------------------------------------------------------------

module Order
  {c ℓ≈ ℓ⊑ : Level}
  (Carrier   : Set c)
  (_≈_       : Carrier → Carrier → Set ℓ≈)
  (_⊑_       : Carrier → Carrier → Set ℓ⊑)
  -- _≈_ is an equivalence
  (≈-refl    : ∀ {a}     → a ≈ a)
  (≈-sym     : ∀ {a b}   → a ≈ b → b ≈ a)
  (≈-trans   : ∀ {a b d} → a ≈ b → b ≈ d → a ≈ d)
  -- _⊑_ is a preorder
  (⊑-refl    : ∀ {a}     → a ⊑ a)
  (⊑-trans   : ∀ {a b d} → a ⊑ b → b ⊑ d → a ⊑ d)
  -- antisymmetry collapses into the setoid equality
  (⊑-antisym : ∀ {a b}   → a ⊑ b → b ⊑ a → a ≈ b)
  -- _⊑_ respects _≈_ on both sides
  (≈-⊑-trans : ∀ {a b d} → a ≈ b → b ⊑ d → a ⊑ d)
  (⊑-≈-trans : ∀ {a b d} → a ⊑ b → b ≈ d → a ⊑ d)
  where

  ----------------------------------------------------------------------
  -- §1.1  JSL axioms from the least-upper-bound property   (T001 §1.1)
  --
  -- A binary operation _⊔_ with the three LUB clauses
  --   ub₁ : a ⊑ a ⊔ b        (left  upper bound)
  --   ub₂ : b ⊑ a ⊔ b        (right upper bound)
  --   lub : a ⊑ c → b ⊑ c → a ⊔ b ⊑ c   (least such)
  -- satisfies every join-semilattice law up to ≈.  Pure order theory:
  -- no behaviour, no cone, no Ludics.
  ----------------------------------------------------------------------

  module JoinFromLUB
    (_⊔_ : Carrier → Carrier → Carrier)
    (ub₁ : ∀ {a b}   → a ⊑ (a ⊔ b))
    (ub₂ : ∀ {a b}   → b ⊑ (a ⊔ b))
    (lub : ∀ {a b c} → a ⊑ c → b ⊑ c → (a ⊔ b) ⊑ c)
    where

    -- Idempotence:  a ⊔ a ≈ a.
    ⊔-idem : ∀ {a} → (a ⊔ a) ≈ a
    ⊔-idem = ⊑-antisym (lub ⊑-refl ⊑-refl) ub₁

    -- Commutativity:  a ⊔ b ≈ b ⊔ a.
    ⊔-comm : ∀ {a b} → (a ⊔ b) ≈ (b ⊔ a)
    ⊔-comm = ⊑-antisym (lub ub₂ ub₁) (lub ub₂ ub₁)

    -- Associativity:  (a ⊔ b) ⊔ c ≈ a ⊔ (b ⊔ c).
    ⊔-assoc : ∀ {a b d} → ((a ⊔ b) ⊔ d) ≈ (a ⊔ (b ⊔ d))
    ⊔-assoc =
      ⊑-antisym
        (lub (lub ub₁ (⊑-trans ub₁ ub₂)) (⊑-trans ub₂ ub₂))
        (lub (⊑-trans ub₁ ub₁) (lub (⊑-trans ub₂ ub₁) ub₂))

    -- ≈-congruence:  _⊔_ is well-defined on the setoid.
    ⊔-cong : ∀ {a a' b b'} → a ≈ a' → b ≈ b' → (a ⊔ b) ≈ (a' ⊔ b')
    ⊔-cong a≈a' b≈b' =
      ⊑-antisym
        (lub (≈-⊑-trans a≈a' ub₁) (≈-⊑-trans b≈b' ub₂))
        (lub (≈-⊑-trans (≈-sym a≈a') ub₁) (≈-⊑-trans (≈-sym b≈b') ub₂))

  ----------------------------------------------------------------------
  -- §1.2  The per-cone JSL   (T001 §1.2)
  --
  -- Fix an incarnation Dᵢ and the cone predicate `InCone`.  The Daimon
  -- Lock Lemma (LUDICS_ORDER_RELATION_DEFINITION.md §4) supplies, as
  -- HYPOTHESES rather than postulates: Dᵢ is the bottom (`cone-bottom`,
  -- = T002's), the cone contains Dᵢ (`Dᵢ∈`), and set-union is closed in
  -- the cone (`⊔-closed`).  Together with the LUB clauses these yield the
  -- full join-semilattice (Cᵢ, ⊑, ⊔) with bottom Dᵢ and neutrality
  -- Dᵢ ⊔ D ≈ D.
  ----------------------------------------------------------------------

  module Cone
    {ℓP : Level}
    (Dᵢ          : Carrier)
    (InCone      : Carrier → Set ℓP)
    (Dᵢ∈         : InCone Dᵢ)
    (cone-bottom : ∀ {D}     → InCone D → Dᵢ ⊑ D)
    (_⊔_         : Carrier → Carrier → Carrier)
    (⊔-closed    : ∀ {D D'}  → InCone D → InCone D' → InCone (D ⊔ D'))
    (ub₁         : ∀ {a b}   → a ⊑ (a ⊔ b))
    (ub₂         : ∀ {a b}   → b ⊑ (a ⊔ b))
    (lub         : ∀ {a b c} → a ⊑ c → b ⊑ c → (a ⊔ b) ⊑ c)
    where

    -- All four JSL axioms, inherited from the LUB property.
    open JoinFromLUB _⊔_ ub₁ ub₂ lub public

    -- Bottom neutrality:  for D in the cone, Dᵢ ⊔ D ≈ D.
    -- (Dᵢ ⊑ D by cone-bottom, so the join collapses to D.)
    ⊔-bot : ∀ {D} → InCone D → (Dᵢ ⊔ D) ≈ D
    ⊔-bot D∈ = ⊑-antisym (lub (cone-bottom D∈) ⊑-refl) ub₂

    -- Dᵢ is a lower bound of the whole cone (restating cone-bottom as the
    -- bottom of the JSL).
    ⊥-least : ∀ {D} → InCone D → Dᵢ ⊑ D
    ⊥-least = cone-bottom

  ----------------------------------------------------------------------
  -- §1.3  Behaviours, minimality, Inc(B), antichain, cones   (T002 §1)
  ----------------------------------------------------------------------

  module Behaviour {ℓB : Level} (B : Carrier → Set ℓB) where

    -- Strictly below: ⊑ but not ⊒.  (The ⊊ of the paper.)
    _⊏_ : Carrier → Carrier → Set ℓ⊑
    a ⊏ b = (a ⊑ b) × (¬ (b ⊑ a))

    -- D is minimal in B (i.e. D ∈ Inc(B)).
    --
    -- Constructive (positive) rendering of "∄ D′ ∈ B, D′ ⊊ D": anything in
    -- B that sits below D also sits above it.  Lemma
    -- `minimal-no-strict-below` confirms this implies the paper's negative
    -- statement.
    record Minimal (D : Carrier) : Set (c ⊔ˡ ℓ⊑ ⊔ˡ ℓB) where
      field
        inB     : B D
        minimal : ∀ {D'} → B D' → D' ⊑ D → D ⊑ D'

    -- The positive minimality really does forbid a strict lower bound.
    minimal-no-strict-below :
      ∀ {D D'} → Minimal D → B D' → ¬ (D' ⊏ D)
    minimal-no-strict-below m bD' (D'⊑D , ¬D⊑D') =
      ¬D⊑D' (Minimal.minimal m bD' D'⊑D)

    ------------------------------------------------------------------
    -- Part 1 — Inc(B) is an antichain  (T002.1)
    --
    -- The load-bearing observation of LUDICS_OQ_JSL_PROOF.md §5.1: two
    -- minimal elements ordered by ⊑ are setoid-equal.
    ------------------------------------------------------------------

    antichain : ∀ {D₁ D₂} → Minimal D₁ → Minimal D₂ → D₁ ⊑ D₂ → D₁ ≈ D₂
    antichain m₁ m₂ D₁⊑D₂ =
      ⊑-antisym D₁⊑D₂ (Minimal.minimal m₂ (Minimal.inB m₁) D₁⊑D₂)

    -- Corollary: distinct incarnations share no upper bound *inside*
    -- Inc(B).  (LUDICS_OQ_JSL_PROOF.md §5.1 Corollary.)
    no-upper-bound-in-Inc :
      ∀ {D₁ D₂} → Minimal D₁ → Minimal D₂ → ¬ (D₁ ≈ D₂) →
      ¬ (∃[ D' ] (Minimal D' × (D₁ ⊑ D') × (D₂ ⊑ D')))
    no-upper-bound-in-Inc m₁ m₂ d≉ (_ , mD' , D₁⊑D' , D₂⊑D') =
      d≉ (≈-trans (antichain m₁ mD' D₁⊑D')
                  (≈-sym (antichain m₂ mD' D₂⊑D')))

    ------------------------------------------------------------------
    -- Uniqueness of incarnation as an explicit hypothesis
    --
    -- Fouqueré–Quatrini 2013: every D ∈ B has a unique smallest
    -- sub-design |D|_B ∈ B.  Packaged as a record so it appears in the
    -- types of the cone results rather than as a postulate.
    ------------------------------------------------------------------

    record Incarnation : Set (c ⊔ˡ ℓ≈ ⊔ˡ ℓ⊑ ⊔ˡ ℓB) where
      field
        inc       : ∀ {D} → B D → Carrier
        inc-inB   : ∀ {D} (d : B D) → B (inc d)
        inc-below : ∀ {D} (d : B D) → inc d ⊑ D
        -- inc d is the *least* element of B below D.
        inc-least : ∀ {D} (d : B D) {D'} → B D' → D' ⊑ D → inc d ⊑ D'

      -- The incarnation is itself minimal (lies in Inc(B)).
      inc-minimal : ∀ {D} (d : B D) → Minimal (inc d)
      inc-minimal d = record
        { inB     = inc-inB d
        ; minimal = λ {D'} bD' D'⊑incd →
                      inc-least d bD' (⊑-trans D'⊑incd (inc-below d))
        }

      -- Uniqueness: any minimal element below D *is* the incarnation.
      inc-unique :
        ∀ {D} (d : B D) {D'} → Minimal D' → D' ⊑ D → D' ≈ inc d
      inc-unique d {D'} mD' D'⊑D =
        ⊑-antisym
          (Minimal.minimal mD' (inc-inB d) (inc-least d (Minimal.inB mD') D'⊑D))
          (inc-least d (Minimal.inB mD') D'⊑D)

      ----------------------------------------------------------------
      -- Part 2 — Cross-cone incompatibility  (T002, §5.2)
      --
      -- Distinct incarnations have no common upper bound anywhere in B.
      -- (LUDICS_OQ_JSL_PROOF.md §5.2 Theorem (Cross-Cone Incompatibility).)
      ----------------------------------------------------------------

      cross-cone-incompat :
        ∀ {D₁ D₂} → Minimal D₁ → Minimal D₂ → ¬ (D₁ ≈ D₂) →
        ∀ {D} → B D → D₁ ⊑ D → D₂ ⊑ D → ⊥
      cross-cone-incompat m₁ m₂ d≉ d D₁⊑D D₂⊑D =
        d≉ (≈-trans (inc-unique d m₁ D₁⊑D)
                    (≈-sym (inc-unique d m₂ D₂⊑D)))

      ----------------------------------------------------------------
      -- Cone decomposition  (T002, §4 Cone Decomposition)
      --
      -- Following the proof: assign each D ∈ B to the cone of its
      -- incarnation.  An "element" of B is a carrier together with a
      -- membership witness; `conf` is the cone-assignment map.
      --
      --   * cone-total : every element lies in the cone of its own
      --     incarnation (the assignment is total).
      --   * cone-disjoint : no element lies in two distinct cones (the
      --     assignment is well-defined / functional).
      --
      -- Totality + functionality is exactly a partition of B into cones.
      ----------------------------------------------------------------

      Element : Set (c ⊔ˡ ℓB)
      Element = Σ Carrier B

      -- Cone-assignment: the incarnation of the element's witness.
      conf : Element → Carrier
      conf (_ , d) = inc d

      -- "e lies in the cone above Dᵢ."
      in-cone : Carrier → Element → Set ℓ≈
      in-cone Dᵢ e = conf e ≈ Dᵢ

      -- Totality: every element lies in the cone of its incarnation.
      cone-total : ∀ e → in-cone (conf e) e
      cone-total _ = ≈-refl

      -- Functionality / disjointness: an element cannot lie in two
      -- distinct cones; if it appears in cones Dᵢ and Dⱼ then Dᵢ ≈ Dⱼ.
      cone-disjoint :
        ∀ {Dᵢ Dⱼ} (e : Element) → in-cone Dᵢ e → in-cone Dⱼ e → Dᵢ ≈ Dⱼ
      cone-disjoint _ p q = ≈-trans (≈-sym p) q

      -- The cone above Dᵢ has Dᵢ as a lower bound (its "bottom"),
      -- matching T001's cone definition Cᵢ = { D ∈ B : Dᵢ ⊆ D, … }.
      cone-bottom :
        ∀ {Dᵢ} (e : Element) → in-cone Dᵢ e → Dᵢ ⊑ proj₁ e
      cone-bottom (_ , d) p =
        ≈-⊑-trans (≈-sym p) (inc-below d)

------------------------------------------------------------------------
-- §2.  The C001a list-design model (designs-as-sets)
--
-- Carrier = List A, ⊑ = set-inclusion (every member of xs is a member of
-- ys), ≈ = mutual inclusion (set-equality, the ≈ᴰ of C001a / finding F2).
-- Every order axiom is discharged, and the `_++_` LUB clauses (the C001a
-- lemmas) are supplied, so the abstract §1 theory specialises to the
-- substrate's actual design representation.
------------------------------------------------------------------------

module ListSetInclusion {a : Level} (A : Set a) where

  open import Data.List using (List; _++_)
  open import Data.List.Membership.Propositional using (_∈_)
  open import Data.List.Membership.Propositional.Properties
    using (∈-++⁺ˡ; ∈-++⁺ʳ; ∈-++⁻)
  open import Data.Sum using (inj₁; inj₂)
  open import Function using (id; _∘_)

  -- Set-inclusion on chronicle lists (= C001a's _⊆ᴰ_).
  _⊑_ : List A → List A → Set a
  xs ⊑ ys = ∀ {x} → x ∈ xs → x ∈ ys

  -- Set-equality (= C001a's _≈ᴰ_, finding F2).
  _≈_ : List A → List A → Set a
  xs ≈ ys = (xs ⊑ ys) × (ys ⊑ xs)

  ≈-refl : ∀ {xs} → xs ≈ xs
  ≈-refl = id , id

  ≈-sym : ∀ {xs ys} → xs ≈ ys → ys ≈ xs
  ≈-sym (p , q) = q , p

  ≈-trans : ∀ {xs ys zs} → xs ≈ ys → ys ≈ zs → xs ≈ zs
  ≈-trans (p , q) (p' , q') = p' ∘ p , q ∘ q'

  ⊑-refl : ∀ {xs} → xs ⊑ xs
  ⊑-refl = id

  ⊑-trans : ∀ {xs ys zs} → xs ⊑ ys → ys ⊑ zs → xs ⊑ zs
  ⊑-trans p q = q ∘ p

  -- Mutual inclusion *is* set-equality, so antisymmetry is the pairing.
  ⊑-antisym : ∀ {xs ys} → xs ⊑ ys → ys ⊑ xs → xs ≈ ys
  ⊑-antisym p q = p , q

  ≈-⊑-trans : ∀ {xs ys zs} → xs ≈ ys → ys ⊑ zs → xs ⊑ zs
  ≈-⊑-trans (p , _) q = q ∘ p

  ⊑-≈-trans : ∀ {xs ys zs} → xs ⊑ ys → ys ≈ zs → xs ⊑ zs
  ⊑-≈-trans p (p' , _) = p' ∘ p

  -- Set-union is `_++_`; the three LUB clauses (the C001a lemmas).
  ++-ub₁ : ∀ {xs ys} → xs ⊑ (xs ++ ys)
  ++-ub₁ x∈ = ∈-++⁺ˡ x∈

  ++-ub₂ : ∀ {xs ys} → ys ⊑ (xs ++ ys)
  ++-ub₂ {xs} x∈ = ∈-++⁺ʳ xs x∈

  ++-lub : ∀ {xs ys zs} → xs ⊑ zs → ys ⊑ zs → (xs ++ ys) ⊑ zs
  ++-lub {xs} p q x∈ with ∈-++⁻ xs x∈
  ... | inj₁ x∈xs = p x∈xs
  ... | inj₂ x∈ys = q x∈ys

  -- Instantiate the abstract order.  Brings JoinFromLUB, Cone and
  -- Behaviour into scope, specialised to list-designs under set-inclusion.
  open Order (List A) _≈_ _⊑_
             ≈-refl ≈-sym ≈-trans
             ⊑-refl ⊑-trans ⊑-antisym ≈-⊑-trans ⊑-≈-trans
       public

  -- The JSL axioms for set-union (= `_++_`), up to ≈ᴰ.  Idempotence here is
  -- the F2 setoid point: `xs ++ xs ≈ xs` even though `xs ++ xs ≢ xs`.
  open JoinFromLUB _++_ ++-ub₁ ++-ub₂ ++-lub public
