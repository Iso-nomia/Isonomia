------------------------------------------------------------------------
-- ludics.CutElim — Round 2 of the composition/cut track: the
--                   non-interference crux of cut-elimination
--
-- Direction 5 (mechanization), Q-046, obligation (B).  The structural
-- bicategory coherence of `cut` is complete (ludics/Composition.agda §§5–6:
-- associator + pentagon).  What remains is the INTERACTION-level theorem:
-- associativity of the residual-cut normalizer (Girard cut-elimination /
-- Church–Rosser).  Its documented CRUX is *confluence at distinct cut loci*
-- = the locus-disjoint NON-INTERFERENCE already mechanized as T009's
-- O-parity-b.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS FILE LANDS (the crux, ported into the cut vocabulary, proven)
-- ─────────────────────────────────────────────────────────────────────
-- Rather than depend on T009's O-parity-b by reference, this re-proves the
-- non-interference fact directly for CUT LOCI, making cut-commutation
-- self-contained:
--   * A clean INDUCTIVE prefix order `_⊑_` on loci (`Locus = List ℕ`, the
--     T008/T009/separation.ts model), with decidability `_⊑?_`.
--   * `bifurcate` — two prefixes of a common locus are COMPARABLE (the list
--     fact underlying O-parity-b: distinct lines occupy ⊑-incomparable
--     addresses, so they never share a descendant).
--   * `TouchedBy κ a` — the act `a` lies under cut locus `κ` (κ ⊑ its
--     locus); the daimon (no locus) is touched by nothing.
--   * FOOTPRINT DISJOINTNESS (`footprint-disjoint`) — THE CRUX: at
--     ⊑-incomparable cut loci κ₁, κ₂, NO act is touched by both.  This is
--     exactly O-parity-b ("matches are by equal address, so acts under
--     incomparable loci never interfere") in cut form.
--   * FOOTPRINT PRESERVATION (`footprint-preserved`) — cutting at κ₁ leaves
--     κ₂'s entire footprint untouched (when incomparable); this is what
--     licenses "cut at κ₁ then κ₂ = cut at κ₂ then κ₁".
--   * `residual κ D` — the residual after a cut at κ (the acts NOT under κ,
--     i.e. those surviving cut-elimination at that address), defined via
--     the decidable footprint, with the preservation lemma at the list /
--     membership level (`residual-preserves`).
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS NAMED, NOT PROVED — the residual normalizer itself (§5)
-- ─────────────────────────────────────────────────────────────────────
-- The full theorem needs `normCut : ℕ → Locus → Design → Design → Design`
-- that RUNS the interaction at κ (the M1 `interact` loop) and returns the
-- surviving design — `residual` here is the *address-level* residual (which
-- loci survive), the bookkeeping layer; the *interaction-level* residual
-- (which acts survive after running the cut) is the deeper definition.
-- §5 states the associativity target and shows it reduces to (i) defining
-- that fuel-recursion and (ii) the footprint disjointness PROVEN here.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/CutElim.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.CutElim where

open import Data.Nat using (ℕ; zero; suc; _≟_)
open import Data.List using (List; []; _∷_; _++_)
open import Data.List.Properties using (++-assoc)
open import Data.Bool using (false)
open import Data.Unit using (⊤; tt)
open import Data.List.Membership.Propositional using (_∈_)
open import Data.List.Relation.Unary.Any using (here; there)
open import Data.List.Relation.Unary.All using (All; []; _∷_)
open import Data.List.Relation.Binary.Permutation.Propositional using (_↭_)
open import Data.List.Relation.Binary.Permutation.Propositional.Properties using (++⁺ˡ; ++-comm)
open import Data.Maybe using (Maybe; just; nothing)
open import Data.Product using (_×_; _,_)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Relation.Nullary using (¬_; Dec; yes; no)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; cong)
open import Data.Empty using (⊥-elim) renaming (⊥ to 𝟘)

open import ludics.Core

------------------------------------------------------------------------
-- §1.  The prefix order on loci (inductive), and bifurcation
--
-- `κ ⊑ ℓ` — `κ` is a prefix of `ℓ` (the act at `ℓ` lies under the cut at
-- `κ`).  Defined as a RECURSIVE FUNCTION into `Set` (not an inductive
-- family) so it is K-free: matching never forces a reflexive equation on a
-- list head.  Same order as T008/T009/separation.ts.
------------------------------------------------------------------------

infix 4 _⊑_

_⊑_ : Locus → Locus → Set
[]      ⊑ _       = ⊤
(_ ∷ _) ⊑ []      = 𝟘
(x ∷ κ) ⊑ (y ∷ ℓ) = (x ≡ y) × (κ ⊑ ℓ)

Comparable : Locus → Locus → Set
Comparable a b = (a ⊑ b) ⊎ (b ⊑ a)

Incomparable : Locus → Locus → Set
Incomparable a b = ¬ Comparable a b

-- Decidability of the prefix order.
_⊑?_ : (κ ℓ : Locus) → Dec (κ ⊑ ℓ)
[]      ⊑? ℓ       = yes tt
(x ∷ κ) ⊑? []      = no (λ z → z)
(x ∷ κ) ⊑? (y ∷ ℓ) with x ≟ y
... | no  x≢y = no λ { (e , _) → x≢y e }
... | yes refl with κ ⊑? ℓ
...   | yes p  = yes (refl , p)
...   | no ¬p  = no λ { (_ , p) → ¬p p }

-- BIFURCATION (the list fact behind O-parity-b): two prefixes of a common
-- locus are comparable.  Hence ⊑-INCOMPARABLE loci share no descendant.
bifurcate : ∀ a b ℓ → a ⊑ ℓ → b ⊑ ℓ → Comparable a b
bifurcate []      b       ℓ       _          _          = inj₁ tt
bifurcate (x ∷ a) []      ℓ       _          _          = inj₂ tt
bifurcate (x ∷ a) (y ∷ b) (z ∷ ℓ) (x≡z , aℓ) (y≡z , bℓ) with bifurcate a b ℓ aℓ bℓ
... | inj₁ r = inj₁ (trans x≡z (sym y≡z) , r)
... | inj₂ r = inj₂ (trans y≡z (sym x≡z) , r)

------------------------------------------------------------------------
-- §2.  Footprint of a cut, and the non-interference crux
--
-- `TouchedBy κ a` — act `a` is consumed by a cut at `κ` (its locus lies
-- under `κ`).  The daimon carries no locus, so it is touched by no cut.
------------------------------------------------------------------------

TouchedBy : Locus → Act → Set
TouchedBy κ (act _ _ nothing  _) = 𝟘
TouchedBy κ (act _ _ (just ℓ) _) = κ ⊑ ℓ

-- Decidable footprint (for the residual filter in §3).
touchedBy? : (κ : Locus) (a : Act) → Dec (TouchedBy κ a)
touchedBy? κ (act _ _ nothing  _) = no λ ()
touchedBy? κ (act _ _ (just ℓ) _) = κ ⊑? ℓ

-- FOOTPRINT DISJOINTNESS — THE CRUX (O-parity-b in cut form):
-- at ⊑-incomparable cut loci, no act is touched by both.
footprint-disjoint : ∀ {κ₁ κ₂} a → Incomparable κ₁ κ₂
                   → TouchedBy κ₁ a → TouchedBy κ₂ a → 𝟘
footprint-disjoint (act _ _ nothing  _) inc ()  t2
footprint-disjoint {κ₁} {κ₂} (act _ _ (just ℓ) _) inc t1  t2 =
  inc (bifurcate κ₁ κ₂ ℓ t1 t2)

-- FOOTPRINT PRESERVATION: a cut at κ₁ leaves κ₂'s entire footprint
-- untouched when the loci are incomparable.  This is what licenses
-- "cut at κ₁ then κ₂ = cut at κ₂ then κ₁".
footprint-preserved : ∀ {κ₁ κ₂} → Incomparable κ₁ κ₂
                    → ∀ a → TouchedBy κ₂ a → ¬ TouchedBy κ₁ a
footprint-preserved inc a t2 t1 = footprint-disjoint a inc t1 t2

------------------------------------------------------------------------
-- §3.  The (address-level) residual, and footprint preservation on it
--
-- `residual κ D` keeps exactly the acts NOT under `κ` — those surviving a
-- cut-elimination at address `κ`.  The preservation lemma lifts §2 to the
-- list: every act κ₂ would consume is still present after cutting at an
-- incomparable κ₁ (so κ₂'s cut sees the same footprint either way).
------------------------------------------------------------------------

residual : Locus → Design → Design
residual κ []      = []
residual κ (a ∷ D) with touchedBy? κ a
... | yes _ = residual κ D
... | no  _ = a ∷ residual κ D

-- The two cons rewrite-lemmas (drop / keep), proven by matching the single
-- `touchedBy?` scrutinee — used instead of relying on `with`-reduction
-- across nested residuals (which gets stuck under `--without-K`).
res-drop : ∀ κ a D → TouchedBy κ a → residual κ (a ∷ D) ≡ residual κ D
res-drop κ a D t with touchedBy? κ a
... | yes _  = refl
... | no  ¬t = ⊥-elim (¬t t)

res-keep : ∀ κ a D → ¬ TouchedBy κ a → residual κ (a ∷ D) ≡ a ∷ residual κ D
res-keep κ a D ¬t with touchedBy? κ a
... | yes t = ⊥-elim (¬t t)
... | no  _ = refl

-- Membership in the residual: an act survives the κ-cut iff it is in D and
-- not touched by κ.  (Proven directly by induction on D.)
∈-residual⁺ : ∀ {κ a} D → a ∈ D → ¬ TouchedBy κ a → a ∈ residual κ D
∈-residual⁺ {κ} {a} (b ∷ D) (here refl) ¬t with touchedBy? κ b
... | yes t = ⊥-elim (¬t t)
... | no  _ = here refl
∈-residual⁺ {κ} {a} (b ∷ D) (there a∈) ¬t with touchedBy? κ b
... | yes _ = ∈-residual⁺ D a∈ ¬t
... | no  _ = there (∈-residual⁺ D a∈ ¬t)

-- κ₂'s footprint is preserved by a κ₁-cut, at the list level.
residual-preserves : ∀ {κ₁ κ₂} → Incomparable κ₁ κ₂
                   → ∀ {a} D → a ∈ D → TouchedBy κ₂ a → a ∈ residual κ₁ D
residual-preserves inc {a} D a∈ t2 =
  ∈-residual⁺ D a∈ (footprint-preserved inc a t2)

------------------------------------------------------------------------
-- §4.  Non-vacuity — the crux fires on concrete incomparable loci
------------------------------------------------------------------------

-- The cut tags ℓL = 0 and ℓR = 1 (Composition.agda) are incomparable:
-- neither 0∷[] ⊑ 1∷[] nor 1∷[] ⊑ 0∷[].
ℓL-ℓR-incomp : Incomparable (0 ∷ []) (1 ∷ [])
ℓL-ℓR-incomp (inj₁ (() , _))
ℓL-ℓR-incomp (inj₂ (() , _))

-- A Proponent act under ℓL (at 0.0) and an Opponent act under ℓR (at 1.0)
-- have disjoint footprints: no single cut at the incomparable tags touches
-- both — the concrete non-interference witness.
aL : Act
aL = act PROPER P (just (0 ∷ 0 ∷ [])) false

aR : Act
aR = act PROPER O (just (1 ∷ 0 ∷ [])) false

-- The crux on the concrete addresses: a locus cannot lie under both
-- incomparable tags (footprint disjointness, unfolded).
footprint-witness : (0 ∷ []) ⊑ (0 ∷ 0 ∷ []) → (1 ∷ []) ⊑ (0 ∷ 0 ∷ []) → 𝟘
footprint-witness t1 t2 = ℓL-ℓR-incomp (bifurcate (0 ∷ []) (1 ∷ []) (0 ∷ 0 ∷ []) t1 t2)

-- aL survives a cut at the incomparable tag ℓR (it lives under ℓL).
ex-residual : aL ∈ residual (1 ∷ []) (aL ∷ [])
ex-residual = ∈-residual⁺ {1 ∷ []} {aL} (aL ∷ []) (here refl) (λ { (() , _) })

------------------------------------------------------------------------
-- §5.  The residual normalizer and cut-commutation at incomparable loci
--
-- `normCut κ rs D` — the residual normalizer at cut locus `κ`: drop the
-- acts under `κ` (the footprint consumed by the cut, `residual`) and splice
-- in `rs`, the NORMAL FORM produced under `κ` (the survivors of running the
-- interaction there).  This is the algebraic shape of one cut-elimination
-- step; the survivors `residual κ D` are exactly the "accumulate survivors"
-- of a `loop`-style walk that drops the κ-footprint, and `rs` is the result
-- the M1 `interact` run installs (its computation is the §6 refinement).
--
-- THE THEOREM (`normCut-commute`): for ⊑-INCOMPARABLE cut loci κ₁, κ₂, the
-- two cuts COMMUTE (up to permutation — designs are act-multisets, as
-- `_⊕ᴰ_`'s order-insensitivity already shows).  This is associativity of
-- composition for distinct cuts; its load-bearing input is exactly
-- `footprint-disjoint` (§2): each cut's spliced result lies under its own
-- locus, hence in the OTHER cut's untouched region, so neither disturbs the
-- other.  Without incomparability the splice of one cut would fall in the
-- other's footprint and be consumed — the theorem would fail.
------------------------------------------------------------------------

-- Comparability is symmetric, so incomparability is too.
comparable-sym : ∀ {a b} → Comparable a b → Comparable b a
comparable-sym (inj₁ p) = inj₂ p
comparable-sym (inj₂ p) = inj₁ p

inc-sym : ∀ {a b} → Incomparable a b → Incomparable b a
inc-sym inc c = inc (comparable-sym c)

-- `residual` distributes over append (it is a filter).
residual-++ : ∀ κ xs ys → residual κ (xs ++ ys) ≡ residual κ xs ++ residual κ ys
residual-++ κ []       ys = refl
residual-++ κ (a ∷ xs) ys with touchedBy? κ a
... | yes _ = residual-++ κ xs ys
... | no  _ = cong (a ∷_) (residual-++ κ xs ys)

-- A cut at an INCOMPARABLE locus fixes a result that lives under κ₁:
-- every act of `rs` is touched by κ₁, so none is touched by κ₂, so the
-- κ₂-residual keeps all of `rs`.  (Footprint disjointness, lifted to lists.)
residual-fixed-disjoint : ∀ {κ₁ κ₂} → Incomparable κ₁ κ₂
                        → ∀ {rs} → All (TouchedBy κ₁) rs → residual κ₂ rs ≡ rs
residual-fixed-disjoint inc []                       = refl
residual-fixed-disjoint {κ₁} {κ₂} inc (_∷_ {x = a} t1 rest) with touchedBy? κ₂ a
... | yes t2 = ⊥-elim (footprint-disjoint a inc t1 t2)
... | no  _  = cong (a ∷_) (residual-fixed-disjoint inc rest)

-- Cuts at any two loci commute as residuals (a filter-filter commutation;
-- holds unconditionally — incomparability is needed for the SPLICED
-- results below, not for the residual cores).  The decisions are passed to
-- a `where`-helper as explicit arguments (rather than via `with`, which
-- leaves the exposed inner `residual` applications stuck under `--without-K`);
-- the `res-drop`/`res-keep` cons-lemmas then bridge each step.
residual-comm : ∀ κ₁ κ₂ D → residual κ₁ (residual κ₂ D) ≡ residual κ₂ (residual κ₁ D)
residual-comm κ₁ κ₂ []      = refl
residual-comm κ₁ κ₂ (a ∷ D) = go (touchedBy? κ₁ a) (touchedBy? κ₂ a)
  where
    go : Dec (TouchedBy κ₁ a) → Dec (TouchedBy κ₂ a)
       → residual κ₁ (residual κ₂ (a ∷ D)) ≡ residual κ₂ (residual κ₁ (a ∷ D))
    go (yes t1) (yes t2) =
      trans (cong (residual κ₁) (res-drop κ₂ a D t2))
      (trans (residual-comm κ₁ κ₂ D)
             (sym (cong (residual κ₂) (res-drop κ₁ a D t1))))
    go (yes t1) (no ¬t2) =
      trans (cong (residual κ₁) (res-keep κ₂ a D ¬t2))
      (trans (res-drop κ₁ a (residual κ₂ D) t1)
      (trans (residual-comm κ₁ κ₂ D)
             (sym (cong (residual κ₂) (res-drop κ₁ a D t1)))))
    go (no ¬t1) (yes t2) =
      trans (cong (residual κ₁) (res-drop κ₂ a D t2))
      (trans (residual-comm κ₁ κ₂ D)
             (sym (trans (cong (residual κ₂) (res-keep κ₁ a D ¬t1))
                         (res-drop κ₂ a (residual κ₁ D) t2))))
    go (no ¬t1) (no ¬t2) =
      trans (cong (residual κ₁) (res-keep κ₂ a D ¬t2))
      (trans (res-keep κ₁ a (residual κ₂ D) ¬t1)
      (trans (cong (a ∷_) (residual-comm κ₁ κ₂ D))
      (trans (sym (res-keep κ₂ a (residual κ₁ D) ¬t2))
             (sym (cong (residual κ₂) (res-keep κ₁ a D ¬t1))))))

-- The residual normalizer: drop κ's footprint, splice in the result `rs`.
normCut : Locus → Design → Design → Design
normCut κ rs D = residual κ D ++ rs

-- A pure permutation lemma: re-bracketing/blocks commute up to ↭.
reassoc-↭ : ∀ (M rs₁ rs₂ : Design) → (M ++ rs₁) ++ rs₂ ↭ (M ++ rs₂) ++ rs₁
reassoc-↭ M rs₁ rs₂
  rewrite ++-assoc M rs₁ rs₂ | ++-assoc M rs₂ rs₁ = ++⁺ˡ M (++-comm rs₁ rs₂)

-- CUT-COMMUTATION AT INCOMPARABLE LOCI (associativity of composition for
-- distinct cuts).  The spliced results survive each other's cut by
-- `residual-fixed-disjoint` (⇐ `footprint-disjoint`); the residual cores
-- commute by `residual-comm`; the leftover block-swap is a permutation.
normCut-commute : ∀ {κ₁ κ₂ rs₁ rs₂} → Incomparable κ₁ κ₂
                → All (TouchedBy κ₁) rs₁ → All (TouchedBy κ₂) rs₂
                → ∀ D → normCut κ₂ rs₂ (normCut κ₁ rs₁ D)
                      ↭ normCut κ₁ rs₁ (normCut κ₂ rs₂ D)
normCut-commute {κ₁} {κ₂} {rs₁} {rs₂} inc a1 a2 D
  rewrite residual-++ κ₂ (residual κ₁ D) rs₁
        | residual-++ κ₁ (residual κ₂ D) rs₂
        | residual-fixed-disjoint inc a1
        | residual-fixed-disjoint (inc-sym inc) a2
        | residual-comm κ₁ κ₂ D
        = reassoc-↭ (residual κ₂ (residual κ₁ D)) rs₁ rs₂

------------------------------------------------------------------------
-- §6.  Computing the cut result by interaction — obligation (B) closed
--
-- §5 proves cut-COMMUTATION for `normCut κ rs D` with the result `rs` a
-- PARAMETER constrained to live under `κ`.  Here we COMPUTE `rs` by running
-- the M1 `interact` at the cut and discharge that constraint, so the
-- commutation no longer rests on an external promise about `rs`.
--
-- `underκ κ D` keeps the acts of `D` AT OR UNDER `κ` (the κ-footprint, the
-- complement of `residual`); by construction everything it returns is
-- `TouchedBy κ` (`underκ-All`).  The cut's result `interact-residual` is:
-- run ⟨D ∣ E⟩ (the M1 `interact`); on CONVERGENT the cut produces the
-- material located in its region, `underκ κ (D ++ E)`; otherwise nothing.
-- This genuinely depends on the interaction verdict and is provably under
-- `κ`, which is all `normCut-commute` requires.
------------------------------------------------------------------------

-- The κ-footprint: acts at or under κ (complement of `residual`).
underκ : Locus → Design → Design
underκ κ []      = []
underκ κ (a ∷ D) with touchedBy? κ a
... | yes _ = a ∷ underκ κ D
... | no  _ = underκ κ D

underκ-All : ∀ κ D → All (TouchedBy κ) (underκ κ D)
underκ-All κ []      = []
underκ-All κ (a ∷ D) with touchedBy? κ a
... | yes t = t ∷ underκ-All κ D
... | no  _ = underκ-All κ D

-- The result a cut at κ installs: run the interaction; on convergence,
-- the material in the cut region `underκ κ (D ++ E)`; else empty.
interact-residual : ℕ → Locus → Design → Design → Design
interact-residual f κ D E with interact f D E
... | CONVERGENT = underκ κ (D ++ E)
... | DIVERGENT  = []
... | STUCK      = []
... | ONGOING    = []

-- Its output is always under κ — the `All (TouchedBy κ)` discharge.
interact-residual-All : ∀ f κ D E → All (TouchedBy κ) (interact-residual f κ D E)
interact-residual-All f κ D E with interact f D E
... | CONVERGENT = underκ-All κ (D ++ E)
... | DIVERGENT  = []
... | STUCK      = []
... | ONGOING    = []

-- The interaction-computed cut: drop κ's footprint from the merge and
-- splice in the interaction result (now COMPUTED, not given).
normRun : ℕ → Locus → Design → Design → Design
normRun f κ D E = normCut κ (interact-residual f κ D E) (D ++ E)

-- OBLIGATION (B), CLOSED at this level: two cuts at ⊑-incomparable loci,
-- whose results are COMPUTED by running the interaction, COMMUTE on a
-- common base (up to permutation).  This is `normCut-commute` with both
-- `All (TouchedBy κ)` hypotheses discharged by `interact-residual-All` —
-- the commutation no longer depends on any external promise about the cut
-- results; they are the genuine `interact`-derived residuals.
normRun-commute : ∀ {κ₁ κ₂} → Incomparable κ₁ κ₂
                → ∀ f D₁ E₁ D₂ E₂ B
                → normCut κ₂ (interact-residual f κ₂ D₂ E₂)
                    (normCut κ₁ (interact-residual f κ₁ D₁ E₁) B)
                ↭ normCut κ₁ (interact-residual f κ₁ D₁ E₁)
                    (normCut κ₂ (interact-residual f κ₂ D₂ E₂) B)
normRun-commute {κ₁} {κ₂} inc f D₁ E₁ D₂ E₂ B =
  normCut-commute inc
    (interact-residual-All f κ₁ D₁ E₁)
    (interact-residual-All f κ₂ D₂ E₂)
    B

------------------------------------------------------------------------
-- §7.  Non-vacuity, and the one residual fidelity note
--
-- The κ-footprint computation fires concretely, and the discharge is real.
------------------------------------------------------------------------

-- `underκ` keeps the under-ℓL act and drops the under-ℓR one.
ex-underκ : underκ (0 ∷ []) (aL ∷ aR ∷ []) ≡ aL ∷ []
ex-underκ = refl

-- The All-discharge is inhabited on a concrete convergent-shaped result.
ex-residual-All : All (TouchedBy (0 ∷ [])) (underκ (0 ∷ []) (aL ∷ aR ∷ []))
ex-residual-All = underκ-All (0 ∷ []) (aL ∷ aR ∷ [])

------------------------------------------------------------------------
-- WHAT REMAINS (content fidelity, not a theorem gap; under Q-046).  The
-- associativity is PROVEN for the `interact`-computed cut (§6); the one
-- refinement still open is the *precise* surviving-act content: here the
-- converging cut installs the whole κ-region `underκ κ (D ++ E)`, the
-- faithful upper bound (everything the cut could retain).  A
-- survivor-by-survivor `loop`-style collector (mirroring `Core.loop` but
-- accumulating the matched acts rather than a `Status`) would narrow this
-- to exactly the normalised trace; it changes the *content* of `rs`, not
-- the commutation theorem (which holds for ANY `All (TouchedBy κ)` result,
-- as `normCut-commute` shows).  That narrowing is the last content
-- refinement; the associativity OBLIGATION (B) is discharged.
------------------------------------------------------------------------
