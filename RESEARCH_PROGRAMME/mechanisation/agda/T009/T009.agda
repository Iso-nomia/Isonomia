------------------------------------------------------------------------
-- T009 — The two load-bearing lemmas of the branching Smyth-minimal
--        separating context, mechanised
--
-- Statement (per 02_THEOREMS_AND_PROOFS/T009-branching-smyth-minimal-
-- separating-context.md, the abstract proof of C013):
--
--   Over daimon-closed concession-TREES, the Smyth-least separating set of
--   a branching dispute is the per-line first-divergence antichain M(D,E).
--
-- The session-06 scope (10_IDEATION_SESSIONS/06-c013-abstract-proof-
-- scoping-2026-06-05.md §3) identified TWO load-bearing lemmas; this file
-- mechanises exactly those, on a concrete locus model:
--
--   * O-parity-b — locus-disjoint NON-INTERFERENCE (THE CRUX): below a
--     branch node, two distinct lines occupy ⊑-incomparable (hence
--     UNEQUAL) addresses, so — since Ludics normalisation matches a
--     positive only against a dual at the SAME address (match-by-equal-
--     address: `findNextNegativeAtLocus`) — no act of one line can ever
--     match an act of another.  This is what licenses the factorisation
--     (O-parity-c) "run per line and aggregate".
--
--   * O-smyth — the powerdomain order fact: for a ⊑-antichain M, the
--     subset-refusal family { U : ∅ ≠ U ⊆ M } has a UNIQUE Smyth-least
--     element, and it is M itself.  Pure order theory; the fragment enters
--     only upstream (to make M an antichain), never here.
--
-- Object model (faithful to the TS substrate):
--   Locus      = List ℕ          (a dot-path "0.1.2" ↦ its segment list;
--                                  the root is [])
--   _⊑_        = the prefix order (segment-wise), mirroring
--                `packages/ludics-engine/separation.ts` `isPrefixLocus`
--   Antichain  = the ⊑→≡ form, mirroring `maximalLoci`
--   _≤ˢ_       = the Smyth (upper powerdomain) order, mirroring the
--                harness `smythLeq` in
--                `tests/bridge/branching-normalization.test.ts`
--
-- The per-line obligations O-parity-a / O-perline are a verbatim reduction
-- to the LINEAR T008 case (the single-chronicle base case); they are NOT
-- re-mechanised here — they add no content beyond T008, which is the
-- human-checked base case this branching companion sits atop.  O-faithful
-- is the kernel-bridge spec (the off-thread mis-divergence is EXPECTED and
-- parked), not an abstract lemma.  So the two lemmas below are precisely
-- the new, load-bearing, abstract content of T009.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T009/T009.agda`.
--
-- This is *evidence* for T009 under the Theorem Register policy
-- (02_THEOREMS_AND_PROOFS/README.md), not a positive settlement on its own:
-- T009 is already `established` (human proof, cross-checked 2026-06-05);
-- this artefact is the parallel Direction-5 mechanised check of its two
-- load-bearing lemmas.  The match-by-equal-address rule and the per-line
-- reduction to T008 are the human-review obligations (see README).
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T009.T009 where

open import Data.Nat using (ℕ)
open import Data.List using (List; []; _∷_; _++_)
open import Data.List.Properties using (++-assoc; ++-identityʳ; ++-cancelˡ; ∷-injectiveˡ)
open import Data.Product using (_×_; _,_; ∃-syntax)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Data.Empty using (⊥; ⊥-elim)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality
  using (_≡_; _≢_; refl; sym; trans; cong; subst)

------------------------------------------------------------------------
-- §1.  The locus model: List ℕ with the segment-wise prefix order
--
-- A locus is its list of path segments ("0.1.2" ↦ 0 ∷ 1 ∷ 2 ∷ []).  `a ⊑ b`
-- iff `a` is an initial segment of `b`, i.e. ∃ c, a ++ c ≡ b.  This is the
-- segment-wise prefix order of `separation.isPrefixLocus` (so "0.1" ⊑
-- "0.1.2" but "0.1" ⋢ "0.12", because segments are compared, not strings).
------------------------------------------------------------------------

Locus : Set
Locus = List ℕ

infix 4 _⊑_
_⊑_ : Locus → Locus → Set
a ⊑ b = ∃[ c ] (a ++ c ≡ b)

-- A list that splits off as a suffix of itself is empty (conicality, left).
++≡[]ˡ : ∀ {A : Set} {xs ys : List A} → xs ++ ys ≡ [] → xs ≡ []
++≡[]ˡ {xs = []}    _  = refl
++≡[]ˡ {xs = _ ∷ _} ()

-- _⊑_ is a partial order (reflexive, transitive, antisymmetric into ≡).

⊑-refl : ∀ {a} → a ⊑ a
⊑-refl {a} = [] , ++-identityʳ a

⊑-trans : ∀ {a b d} → a ⊑ b → b ⊑ d → a ⊑ d
⊑-trans {a} (c₁ , p₁) (c₂ , p₂) =
  c₁ ++ c₂ , trans (sym (++-assoc a c₁ c₂)) (trans (cong (_++ c₂) p₁) p₂)

⊑-antisym : ∀ {a b} → a ⊑ b → b ⊑ a → a ≡ b
⊑-antisym {a} {b} (c₁ , p₁) (c₂ , p₂) =
  let q : a ++ (c₁ ++ c₂) ≡ a
      q = trans (sym (++-assoc a c₁ c₂)) (trans (cong (_++ c₂) p₁) p₂)
      c₁++c₂≡[] : c₁ ++ c₂ ≡ []
      c₁++c₂≡[] = ++-cancelˡ a (c₁ ++ c₂) [] (trans q (sym (++-identityʳ a)))
      c₁≡[] : c₁ ≡ []
      c₁≡[] = ++≡[]ˡ c₁++c₂≡[]
  in sym (trans (sym p₁) (trans (cong (a ++_) c₁≡[]) (++-identityʳ a)))

-- Comparability and its negation (the ⊑-incomparable / "off-thread" relation).

Comparable : Locus → Locus → Set
Comparable a b = (a ⊑ b) ⊎ (b ⊑ a)

Incomp : Locus → Locus → Set
Incomp a b = ¬ (Comparable a b)

-- Incomparable ⟹ unequal: equal loci are trivially comparable (refl).
-- This is the bridge from the order fact to match-by-equal-address.
incomp⇒≢ : ∀ {a b} → Incomp a b → a ≢ b
incomp⇒≢ {a} inc a≡b = inc (inj₁ (subst (λ z → a ⊑ z) a≡b ⊑-refl))

------------------------------------------------------------------------
-- §2.  O-parity-b — locus-disjoint non-interference (THE CRUX)
--
-- A "branch node" is a stem β below which two lines descend into DISTINCT
-- children i ≠ j (T005: distinct subaddresses per argument).  A locus
-- "below child k" has the shape β ++ (k ∷ rest).  The crux: below-branch
-- loci of distinct children are ⊑-incomparable, hence unequal, hence — by
-- match-by-equal-address — never match.
------------------------------------------------------------------------

-- Below the stem β, on child k, at some depth (`rest`).
BelowChild : Locus → ℕ → Locus → Set
BelowChild β k ℓ = ∃[ rest ] (ℓ ≡ β ++ (k ∷ rest))

-- From equal addresses below a shared stem, the children agree.
headEq : ∀ {β : Locus} {i j : ℕ} {u v : Locus}
       → β ++ (i ∷ u) ≡ β ++ (j ∷ v) → i ≡ j
headEq {β} {i} {j} {u} {v} eq = ∷-injectiveˡ (++-cancelˡ β (i ∷ u) (j ∷ v) eq)

-- THE CRUX.  Distinct children ⟹ incomparable below-branch loci.
branch-incomp : ∀ {β i j a b} → i ≢ j
              → BelowChild β i a → BelowChild β j b → Incomp a b
branch-incomp {β} {i} {j} i≢j (ra , refl) (rb , refl) (inj₁ (c , p)) =
  i≢j (headEq {β} (trans (sym (++-assoc β (i ∷ ra) c)) p))
branch-incomp {β} {i} {j} i≢j (ra , refl) (rb , refl) (inj₂ (c , p)) =
  i≢j (sym (headEq {β} (trans (sym (++-assoc β (j ∷ rb) c)) p)))

-- Match-by-equal-address: Ludics normalisation matches a positive at locus
-- `a` only against a dual at the SAME locus `b ≡ a` (`findNextNegativeAtLocus`).
record Matches (a b : Locus) : Set where
  constructor match-by-address
  field same-address : a ≡ b

-- O-parity-b (the conclusion): across two DISTINCT lines below a branch
-- node, NO act can match any act of the other line.  This is exactly what
-- makes the per-line factorisation (O-parity-c) faithful: there is no
-- cross-line interaction below the branch point.
no-cross-line-match : ∀ {β i j a b} → i ≢ j
                    → BelowChild β i a → BelowChild β j b → ¬ Matches a b
no-cross-line-match i≢j ai bj (match-by-address a≡b) =
  incomp⇒≢ (branch-incomp i≢j ai bj) a≡b

------------------------------------------------------------------------
-- §3.  O-smyth — Smyth-least of the subset-refusal family is M
--
-- Locus SETS are Lists with propositional membership.  A ⊑-antichain M is
-- the set of per-line first-divergence loci (the `maximalLoci` of D's
-- grants).  The separating-test family is the subset-refusal family
-- { U : ∅ ≠ U ⊆ M }, with separating set U.  The Smyth (upper powerdomain)
-- order is S ≤ˢ T ⟺ ∀ t∈T ∃ s∈S, s ⊑ t.  Claim: M is the UNIQUE
-- ≤ˢ-least separating set.
------------------------------------------------------------------------

infix 4 _∈_
data _∈_ : Locus → List Locus → Set where
  here  : ∀ {x xs}   → x ∈ (x ∷ xs)
  there : ∀ {x y xs} → x ∈ xs → x ∈ (y ∷ xs)

_⊆_ : List Locus → List Locus → Set
S ⊆ T = ∀ {x} → x ∈ S → x ∈ T

-- An antichain, in the directly-usable ⊑→≡ form (mirrors lib.Order's
-- `antichain` and `separation.maximalLoci`): the only ⊑-relation among
-- members is equality.
Antichain : List Locus → Set
Antichain M = ∀ {u m} → u ∈ M → m ∈ M → u ⊑ m → u ≡ m

-- The Smyth (upper powerdomain) lifting of ⊑ to sets (harness `smythLeq`).
infix 4 _≤ˢ_
_≤ˢ_ : List Locus → List Locus → Set
S ≤ˢ T = ∀ {t} → t ∈ T → ∃[ s ] (s ∈ S × (s ⊑ t))

-- (i)  M is ≤ˢ-least: for every separating U ⊆ M, M ≤ˢ U.
--      (each t ∈ U lies in M and t ⊑ t.)
M-smyth-below : ∀ {M U} → U ⊆ M → M ≤ˢ U
M-smyth-below U⊆M {t} t∈U = t , U⊆M t∈U , ⊑-refl

-- (ii) Uniqueness: any separating U ⊆ M with U ≤ˢ M equals M (M ⊆ U).
--      (for m ∈ M, get u ∈ U ⊆ M with u ⊑ m; antichain forces u ≡ m.)
M-smyth-unique : ∀ {M U} → Antichain M → U ⊆ M → U ≤ˢ M → M ⊆ U
M-smyth-unique {U = U} ac U⊆M U≤M {m} m∈M with U≤M m∈M
... | u , u∈U , u⊑m = subst (_∈ U) (ac (U⊆M u∈U) m∈M u⊑m) u∈U

-- O-smyth (headline): for any ⊑-antichain M, the full antichain M is the
-- UNIQUE Smyth-least element of its subset-refusal family — it is ≤ˢ-below
-- every separating set, and the only separating set ≤ˢ-below it is M
-- itself (as a set: mutual ⊆).
SmythLeast-is-M :
  ∀ {M} → Antichain M →
    (∀ {U} → U ⊆ M → M ≤ˢ U)                          -- ≤ˢ-least
  × (∀ {U} → U ⊆ M → U ≤ˢ M → (M ⊆ U) × (U ⊆ M))      -- unique = M
SmythLeast-is-M ac =
  (λ U⊆M → M-smyth-below U⊆M) ,
  (λ U⊆M U≤M → M-smyth-unique ac U⊆M U≤M , U⊆M)

------------------------------------------------------------------------
-- §4.  Non-vacuity: a concrete two-line branching dispute
--
-- Mirroring the harness fixture `["0.1.2", "0.2.2"]` (two lines branching
-- at the root, deepest grants on distinct children 1 and 2): both lemmas
-- fire on the nose.  The branch node is β = [] (the root); the two lines
-- descend into children 1 and 2; the per-line deepest grants are
--   a = 1 ∷ 2 ∷ []   and   b = 2 ∷ 2 ∷ []
-- — a genuine ⊑-antichain, and M = a ∷ b ∷ [] is its Smyth-least
-- separating set.
------------------------------------------------------------------------

a b : Locus
a = 1 ∷ 2 ∷ []
b = 2 ∷ 2 ∷ []

-- O-parity-b on the fixture: a and b are incomparable (distinct children
-- 1 ≠ 2 below the root), so the two lines never cross-match.
incomp-ab : Incomp a b
incomp-ab = branch-incomp {[]} {1} {2} (λ ()) (2 ∷ [] , refl) (2 ∷ [] , refl)

a⋢b : ¬ (a ⊑ b)
a⋢b a⊑b = incomp-ab (inj₁ a⊑b)

b⋢a : ¬ (b ⊑ a)
b⋢a b⊑a = incomp-ab (inj₂ b⊑a)

M : List Locus
M = a ∷ b ∷ []

-- M is a genuine ⊑-antichain (the only ⊑-relation among members is identity).
ac-M : Antichain M
ac-M here               here               _   = refl
ac-M here               (there here)       a⊑b = ⊥-elim (a⋢b a⊑b)
ac-M (there here)       here               b⊑a = ⊥-elim (b⋢a b⊑a)
ac-M (there here)       (there here)       _   = refl
ac-M here               (there (there ())) _
ac-M (there here)       (there (there ())) _
ac-M (there (there ())) _                  _

-- O-smyth on the fixture: the full antichain M is the unique Smyth-least
-- separating set of its subset-refusal family.
M-is-smyth-least :
    (∀ {U} → U ⊆ M → M ≤ˢ U)
  × (∀ {U} → U ⊆ M → U ≤ˢ M → (M ⊆ U) × (U ⊆ M))
M-is-smyth-least = SmythLeast-is-M ac-M

------------------------------------------------------------------------
-- §5.  What this mechanises and what it does not
--
-- MECHANISED (no postulates, no holes):
--   - §1: the locus model (List ℕ, segment-wise prefix order) is a partial
--     order — refl / trans / antisym-into-≡ all discharged.
--   - §2 O-parity-b (THE CRUX): distinct children below a stem give
--     ⊑-incomparable, hence unequal, hence (match-by-equal-address)
--     never-matching below-branch loci.  This is the non-interference that
--     licenses the per-line factorisation O-parity-c.
--   - §3 O-smyth: for any ⊑-antichain M, M is the unique Smyth-least
--     element of the subset-refusal family.  Pure powerdomain order theory.
--   - §4: a concrete two-line antichain (the harness fixture) on which both
--     lemmas fire — non-vacuity.
--
-- NOT MECHANISED (human-review obligations, per Register policy; T009 is
-- already `established` by the human proof + cross-check):
--   - That `Matches` faithfully captures the kernel's match-by-equal-address
--     rule (`findNextNegativeAtLocus`) — it is asserted as the matching
--     primitive, mirrored from the source, not built from `stepCore`.
--   - O-parity-a / O-perline: the per-line reduction to the LINEAR T008
--     base case (Lemma 0 parity; concessions converge / refusal diverges at
--     ξ_ℓ) — verbatim T008, not re-proved here.
--   - O-faithful: that `stepCore`'s least-index scheduler is unfaithful on
--     the COMBINED tree (the expected, parked off-thread mis-divergence) —
--     a kernel-bridge spec, characterised in T009 §Faithfulness, not an
--     abstract lemma.
------------------------------------------------------------------------
