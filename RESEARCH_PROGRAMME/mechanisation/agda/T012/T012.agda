------------------------------------------------------------------------
-- T012 — Reading-C conservativity: multi-agent convergence verdicts
--        coincide with bilateral Reading A, nesting- and shift-invariant,
--        for ALL |W| = k (k-unbounded), mechanised
--
-- Statement (per 02_THEOREMS_AND_PROOFS/T012-reading-c-conservative.md):
-- for a Proponent resolution ρ and a witness set W = {τ₁,…,τ_k} of CON
-- tests, with `conv ρ τ` the bilateral Reading-A verdict ⟨ρ∣τ⟩⇓† (the
-- daimon's existence), the Reading-C verdict is the &-superposition
-- orthogonality, which by T015 Step A is the CONJUNCTION over branches:
--
--   RC(ρ, W) = ∀ τ ∈ W. conv ρ τ        (= All (conv ρ) W)
--
-- The theorem's four clauses are then ELEMENTARY ⋀-algebra, and crucially
-- they hold for EVERY list length, discharging the "(c) k-unbounded
-- mechanisation" item carried as non-blocking in the T012 cross-check
-- (the corroborating tests run only n ≤ 3, |W| ≤ 6):
--
--   (1) Fidelity        RC(ρ,W) ⇔ the nested bilateral conjunction
--                       (any bilateralisation tree over W).
--   (2) Nesting inv.    any two bilateralisations whose witness lists are
--                       permutation-equal give equivalent verdicts
--                       (bracketing- and order-independent).
--   (3) Shift neutral.  reordering the active-witness schedule (a
--                       permutation) leaves the verdict fixed.
--   (4) Conservativity  acceptance ∃ρ. RC(ρ,W) computed by ANY
--                       bilateralisation = Reading-C acceptance; no
--                       emergent multi-agent daimon, for every k.
--
-- WHAT IS A PARAMETER (the inherited obligations, faithful to T012's
-- honest scope, NOT re-proved here):
--   * `conv` — the per-pair bilateral verdict ⟨ρ∣τ⟩⇓†; its settlement is
--     T005 (the grounded base case), abstract here.
--   * RC = All (conv ρ), i.e. the `&`-superposition reads off as ∀ over
--     branches: that is T015 Step A (one-shot LB), `established` and
--     signed off, taken as the bridge fact.  T012's NEW content is the
--     aggregation algebra below, which is what this file mechanises.
--   * The shift is modelled as a reorder of the witness schedule (clause
--     3), not a full mid-proof polarity re-typing — the abstract-AF /
--     reorder limit T012 §Scope flags; ASPIC+/structured-`B` is item 1.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T012/T012.agda`.
--
-- This is *evidence* for T012 under the Theorem Register policy
-- (02_THEOREMS_AND_PROOFS/README.md): T012 is already `established`
-- (human proof, cross-checked 2026-06-28); this artefact mechanises its
-- load-bearing ⋀-aggregation k-unbounded.  The `&`=∀ bridge (T015) and the
-- per-pair `conv` (T005) are the human-review obligations (see README).
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T012.T012 where

open import Data.Product using (_×_; _,_; proj₁; proj₂; ∃; ∃-syntax)
open import Data.List using (List; []; _∷_; _++_)
open import Data.List.Relation.Unary.All using (All; []; _∷_)
open import Data.List.Relation.Binary.Permutation.Propositional
  using (_↭_; refl; prep; swap; trans; ↭-sym)

------------------------------------------------------------------------
-- §0.  Logical equivalence of propositions (mutual implication; the F2
--      "set-equality" style used throughout the mechanisation, never ≡).
------------------------------------------------------------------------

infix 1 _⇔_
_⇔_ : Set → Set → Set
P ⇔ Q = (P → Q) × (Q → P)

⇔-refl : ∀ {P} → P ⇔ P
⇔-refl = (λ p → p) , (λ p → p)

⇔-sym : ∀ {P Q} → P ⇔ Q → Q ⇔ P
⇔-sym (p , q) = q , p

⇔-trans : ∀ {P Q R} → P ⇔ Q → Q ⇔ R → P ⇔ R
⇔-trans (p , p') (q , q') = (λ x → q (p x)) , (λ z → p' (q' z))

------------------------------------------------------------------------
-- §1.  Generic ⋀-over-a-list lemmas (`All` is the proof-relevant ∀).
--
-- These are the entire mathematical content: conjunction over a list
-- splits/joins across ++ and is invariant under permutation.  Every later
-- clause is a corollary, and each is proved by induction on a list/`All`
-- of ARBITRARY length — this is where k-unboundedness comes from.
------------------------------------------------------------------------

module ListConj {A : Set} (P : A → Set) where

  -- Conjunction distributes over concatenation (both directions).
  all-++→ : ∀ {xs ys} → All P (xs ++ ys) → All P xs × All P ys
  all-++→ {[]}     a        = [] , a
  all-++→ {x ∷ xs} (px ∷ a) with all-++→ {xs} a
  ... | l , r = (px ∷ l) , r

  all-++← : ∀ {xs ys} → All P xs → All P ys → All P (xs ++ ys)
  all-++← []        b = b
  all-++← (px ∷ a)  b = px ∷ all-++← a b

  -- Permutation invariance, by induction on the ↭ derivation.
  All-↭ : ∀ {xs ys} → xs ↭ ys → All P xs → All P ys
  All-↭ refl         a            = a
  All-↭ (prep x p)   (px ∷ a)     = px ∷ All-↭ p a
  All-↭ (swap x y p) (px ∷ py ∷ a) = py ∷ px ∷ All-↭ p a
  All-↭ (trans p q)  a            = All-↭ q (All-↭ p a)

  -- …hence an equivalence (↭ is symmetric).
  All-↭⇔ : ∀ {xs ys} → xs ↭ ys → All P xs ⇔ All P ys
  All-↭⇔ p = All-↭ p , All-↭ (↭-sym p)

------------------------------------------------------------------------
-- §2.  Reading C over a witness list, and its bilateralisations.
------------------------------------------------------------------------

module ReadingC
  (Resolution Test : Set)
  (conv : Resolution → Test → Set)   -- the per-pair verdict ⟨ρ∣τ⟩⇓† (T005)
  where

  -- A witness set W = {τ₁,…,τ_k}: a (finite) list of CON tests, |W| = k.
  W : Set
  W = List Test

  -- The Reading-C verdict: ρ orthogonal to the &-superposition τ₁&⋯&τ_k,
  -- which by T015 Step A is the conjunction over the branches.
  RC : Resolution → W → Set
  RC ρ = All (conv ρ)

  open ListConj using (all-++→; all-++←; All-↭; All-↭⇔)

  -- A bilateralisation: a binary nesting of pairwise interactions ⟨ρ∣τ_i⟩.
  data Bilat : Set where
    leaf : Test → Bilat            -- a single bilateral pair ⟨ρ∣τ⟩
    node : Bilat → Bilat → Bilat   -- a nesting of two sub-deliberations

  -- The witnesses a bilateralisation visits, left to right.
  flatten : Bilat → W
  flatten (leaf τ)   = τ ∷ []
  flatten (node l r) = flatten l ++ flatten r

  -- The bilateral verdict: conv at each leaf, conjunction at each nesting.
  bverdict : Resolution → Bilat → Set
  bverdict ρ (leaf τ)   = conv ρ τ
  bverdict ρ (node l r) = bverdict ρ l × bverdict ρ r

  --------------------------------------------------------------------
  -- §2.1  Clause 1 — Verdict fidelity.
  --
  -- The verdict of ANY bilateralisation equals the Reading-C verdict over
  -- the witnesses it visits.  By induction on the nesting tree.
  --------------------------------------------------------------------

  fidelity : ∀ ρ t → bverdict ρ t ⇔ RC ρ (flatten t)
  fidelity ρ (leaf τ)   = (λ c → c ∷ []) , (λ { (c ∷ []) → c })
  fidelity ρ (node l r) =
    let l⇔ = fidelity ρ l
        r⇔ = fidelity ρ r
    in (λ { (bl , br) → all-++← (conv ρ) (proj₁ l⇔ bl) (proj₁ r⇔ br) })
     , (λ a → let lr = all-++→ (conv ρ) {flatten l} a
              in proj₂ l⇔ (proj₁ lr) , proj₂ r⇔ (proj₂ lr))

  --------------------------------------------------------------------
  -- §2.2  Clause 2 — Nesting invariance (bracketing + order).
  --
  -- Two bilateralisations whose witness lists are permutation-equal give
  -- equivalent verdicts.  Pure re-bracketing of the SAME order is the
  -- special case `flatten s ≡ flatten t` (so the ↭ is `refl`), since
  -- `flatten` of any bracketing of an ordered sequence is the same list
  -- (++ associativity); reordering is the genuine permutation content.
  --------------------------------------------------------------------

  nesting-invariant : ∀ ρ s t → flatten s ↭ flatten t
                    → bverdict ρ s ⇔ bverdict ρ t
  nesting-invariant ρ s t fp =
    ⇔-trans (fidelity ρ s)
      (⇔-trans (All-↭⇔ (conv ρ) fp) (⇔-sym (fidelity ρ t)))

  --------------------------------------------------------------------
  -- §2.3  Clause 3 — Polarity-shift neutrality.
  --
  -- A polarity shift swaps the active witness mid-interaction: it reorders
  -- the schedule in which branches are visited.  Modelled as a permutation
  -- of W, the verdict is invariant — each branch contributes independently
  -- to the conjunction.  (Direct corollary of `All-↭⇔`.)
  --------------------------------------------------------------------

  shift-neutral : ∀ ρ {xs ys} → xs ↭ ys → RC ρ xs ⇔ RC ρ ys
  shift-neutral ρ p = All-↭⇔ (conv ρ) p

  --------------------------------------------------------------------
  -- §2.4  Clause 4 — Conservativity (k-unbounded).
  --
  -- Acceptance is `∃ρ. RC(ρ,W)` = one resolution orthogonal to every
  -- witness.  `conservativity` says the acceptance read off ANY
  -- bilateralisation equals Reading-C acceptance over its witnesses — both
  -- directions, so no deliberation has a Reading-C daimon absent from
  -- every bilateralisation, or vice versa.  `Accept-↭` gives k-independent
  -- order-invariance; `Accept-drop` shows the SAME ρ accepts each
  -- sub-deliberation (no emergent witness).  Every proof is by induction
  -- on the list/tree, so all clauses hold for arbitrary k = |W|.
  --------------------------------------------------------------------

  Accept : W → Set
  Accept w = ∃[ ρ ] RC ρ w

  AcceptBilat : Bilat → Set
  AcceptBilat t = ∃[ ρ ] bverdict ρ t

  conservativity : ∀ t → AcceptBilat t ⇔ Accept (flatten t)
  conservativity t =
      (λ { (ρ , v) → ρ , proj₁ (fidelity ρ t) v })
    , (λ { (ρ , a) → ρ , proj₂ (fidelity ρ t) a })

  Accept-↭ : ∀ {xs ys} → xs ↭ ys → Accept xs ⇔ Accept ys
  Accept-↭ p =
      (λ { (ρ , v) → ρ , proj₁ (All-↭⇔ (conv ρ) p) v })
    , (λ { (ρ , v) → ρ , proj₂ (All-↭⇔ (conv ρ) p) v })

  -- One ρ accepting a joined deliberation accepts each part (the same ρ):
  -- multi-party acceptance reduces to the bilateral parts with no
  -- emergent multi-agent witness.
  Accept-drop : ∀ {xs ys} → Accept (xs ++ ys) → Accept xs × Accept ys
  Accept-drop {xs} (ρ , a) with all-++→ (conv ρ) {xs} a
  ... | al , ar = (ρ , al) , (ρ , ar)

------------------------------------------------------------------------
-- §3.  Non-vacuity: a concrete model exhibiting both verdicts.
--
-- One PRO resolution (⊤); tests are booleans; the bilateral verdict
-- `conv tt b` converges iff the test is `true` (`T true = ⊤`,
-- `T false = ⊥`).  Then RC(tt, W) holds iff every test in W is `true`, so
-- the development is non-empty and BOTH a convergent and a divergent
-- deliberation are exhibited.
------------------------------------------------------------------------

module Model where

  open import Data.Bool using (Bool; true; false; T)
  open import Data.Unit using (⊤; tt)
  open import Data.Empty using (⊥)

  conv : ⊤ → Bool → Set
  conv _ b = T b

  open ReadingC ⊤ Bool conv public

  -- A convergent deliberation: every witness passes.
  ex-accept : RC tt (true ∷ true ∷ [])
  ex-accept = tt ∷ tt ∷ []

  -- …and acceptance of it.
  ex-Accept : Accept (true ∷ true ∷ [])
  ex-Accept = tt , ex-accept

  -- A divergent deliberation: a failing witness blocks the verdict.
  ex-diverge : RC tt (false ∷ []) → ⊥
  ex-diverge (pf ∷ []) = pf
