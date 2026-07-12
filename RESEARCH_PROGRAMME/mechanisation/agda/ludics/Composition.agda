------------------------------------------------------------------------
-- ludics.Composition — the composition / cut track (M2-associativity, step 1)
--
-- Direction 5 (mechanization), Q-046, the parked "composition/cut →
-- associativity" obligation named at M2 (ludics/Interaction.agda).  M2
-- found associativity *proper* is not statable over the Status-valued
-- `interact` because it needs a COMPOSITION operation taking two designs
-- to a residual DESIGN.  This file starts that operation, bottom-up.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS FILE LANDS (the structural backbone of cut, fully proven)
-- ─────────────────────────────────────────────────────────────────────
--   * RELOCATION `relocate p D` — prepend a locus prefix `p` to every act
--     of `D` (the abstract form of the engine's delocation /
--     `cloneDesignWithShift`, packages/ludics-engine/delocate.ts, which
--     maps a source path under a target locus).  Proven FUNCTORIAL:
--     `relocate [] = id` (`relocate-[]`) and `relocate p ∘ relocate q =
--     relocate (p ++ q)` (`relocate-assoc`).
--   * DISJOINT MERGE `_⊕ᴰ_` — juxtaposition of designs on disjoint
--     sub-addresses (the multiplicative par / `𝒫_fin` merge one level up
--     from designs).  Proven a MONOID: `⊕-assoc`, `⊕-identityˡ/ʳ`; and
--     relocation distributes over it (`relocate-⊕`).
--   * CUT `cut D E` — place `D` under the left tag `ℓL` and `E` under the
--     right tag `ℓR` and merge (the engine's `spiritual`-mode composition,
--     packages/ludics-engine/compose.ts: `cloneDesignWithShift(_,'L'/'R')`
--     then join under disjoint directories).  Proven well-behaved under
--     relocation (`relocate-cut`).
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS NAMED, NOT PROVED — the two genuine remaining theorems (§5)
-- ─────────────────────────────────────────────────────────────────────
--   (A) STRICT ASSOCIATIVITY of `cut` FAILS — `cut` is associative only up
--       to the bicategory ASSOCIATOR (a per-operand locus renaming
--       LL/LR/R ↦ L/RL/RR).  The strictly-associative operation is the
--       disjoint MERGE `_⊕ᴰ_` (proven); the tagged `cut` inherits the
--       associator obstruction, named precisely in §5.
--   (B) ASSOCIATIVITY OF THE RESIDUAL-CUT NORMALIZER — the deep theorem.
--       It needs a normalizer `normCut : ℕ → Locus → Design → Design →
--       Design` that runs the interaction at a cut locus and returns the
--       SURVIVING design (M1's `interact` collapses the run to a `Status`;
--       this produces a residual design).  Its associativity is the
--       Church–Rosser / cut-elimination fact, whose crux is CONFLUENCE AT
--       DISTINCT CUT LOCI = the locus-disjoint NON-INTERFERENCE already
--       mechanized as T009's O-parity-b.  Stated, not postulated; the
--       multi-session piece tracked under Q-046.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/Composition.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.Composition where

open import Data.Nat using (ℕ; zero; suc)
open import Data.List using (List; []; _∷_; _++_; map)
open import Data.List.Properties using (++-assoc; ++-identityʳ; map-++)
open import Data.Maybe using (Maybe; just; nothing)
import Data.Maybe as M
open import Data.Bool using (false)
open import Relation.Binary.PropositionalEquality
  using (_≡_; refl; sym; trans; cong; cong₂; module ≡-Reasoning)
open ≡-Reasoning

open import ludics.Core

------------------------------------------------------------------------
-- §1.  Relocation  (delocation under a locus prefix)
--
-- `relocAct p a` prepends `p` to `a`'s locus; a DAIMON's `nothing` locus
-- is left untouched.  `relocate p` maps it over a design.  This is the
-- abstract form of the engine's delocation: a source path `0.r` placed
-- under target locus `p` becomes `p.r` (delocate.ts §faxFromScope).
------------------------------------------------------------------------

relocAct : Locus → Act → Act
relocAct p (act k pol loc add) = act k pol (M.map (p ++_) loc) add

relocate : Locus → Design → Design
relocate p = map (relocAct p)

-- Functoriality, act level.
relocAct-[] : ∀ a → relocAct [] a ≡ a
relocAct-[] (act k pol nothing  add) = refl
relocAct-[] (act k pol (just ℓ) add) = refl

relocAct-assoc : ∀ p q a → relocAct p (relocAct q a) ≡ relocAct (p ++ q) a
relocAct-assoc p q (act k pol nothing  add) = refl
relocAct-assoc p q (act k pol (just ℓ) add) =
  cong (λ z → act k pol (just z) add) (sym (++-assoc p q ℓ))

-- Functoriality, design level: relocation is a monoid action of (List ℕ, ++).
relocate-[] : ∀ D → relocate [] D ≡ D
relocate-[] []      = refl
relocate-[] (a ∷ D) = cong₂ _∷_ (relocAct-[] a) (relocate-[] D)

relocate-assoc : ∀ p q D → relocate p (relocate q D) ≡ relocate (p ++ q) D
relocate-assoc p q []      = refl
relocate-assoc p q (a ∷ D) = cong₂ _∷_ (relocAct-assoc p q a) (relocate-assoc p q D)

------------------------------------------------------------------------
-- §2.  Disjoint merge  (multiplicative par, the strictly-associative core)
--
-- `_⊕ᴰ_` juxtaposes two designs.  When the operands live on disjoint
-- sub-addresses (as they do after the L/R tagging of §3) this is the
-- Ludics merge one level up from designs — and it is a MONOID on the nose.
------------------------------------------------------------------------

infixr 5 _⊕ᴰ_

_⊕ᴰ_ : Design → Design → Design
D ⊕ᴰ E = D ++ E

⊕-assoc : ∀ D E F → (D ⊕ᴰ E) ⊕ᴰ F ≡ D ⊕ᴰ (E ⊕ᴰ F)
⊕-assoc = ++-assoc

⊕-identityˡ : ∀ D → [] ⊕ᴰ D ≡ D
⊕-identityˡ D = refl

⊕-identityʳ : ∀ D → D ⊕ᴰ [] ≡ D
⊕-identityʳ = ++-identityʳ

-- Relocation distributes over merge (relocate is a merge homomorphism).
relocate-⊕ : ∀ p D E → relocate p (D ⊕ᴰ E) ≡ relocate p D ⊕ᴰ relocate p E
relocate-⊕ p D E = map-++ (relocAct p) D E

------------------------------------------------------------------------
-- §3.  Cut  (the engine's spiritual-mode composition)
--
-- `cut D E` shifts `D` under the left tag `ℓL` and `E` under the right tag
-- `ℓR`, then merges — exactly the `compose.ts` `spiritual` branch
-- (`cloneDesignWithShift(pos,'L')` / `(neg,'R')` then join under disjoint
-- directories `ρL`/`ρR`).  The disjoint tags guarantee the directory-
-- collision check the engine runs always passes.
------------------------------------------------------------------------

ℓL ℓR : Locus
ℓL = 0 ∷ []
ℓR = 1 ∷ []

cut : Design → Design → Design
cut D E = relocate ℓL D ⊕ᴰ relocate ℓR E

-- Cut is natural under relocation: relocating a cut pushes the prefix into
-- both tagged operands.  (trans of merge-distribution then the two
-- relocation-composition laws.)
relocate-cut : ∀ p D E
             → relocate p (cut D E) ≡ relocate (p ++ ℓL) D ⊕ᴰ relocate (p ++ ℓR) E
relocate-cut p D E =
  trans (relocate-⊕ p (relocate ℓL D) (relocate ℓR E))
        (cong₂ _⊕ᴰ_ (relocate-assoc p ℓL D) (relocate-assoc p ℓR E))

------------------------------------------------------------------------
-- §4.  Non-vacuity — the operations compute on real designs
------------------------------------------------------------------------

-- Relocation by the empty prefix is the identity, on a concrete design.
ex-relocate-[] : relocate [] (p0 ∷ []) ≡ (p0 ∷ [])
ex-relocate-[] = refl

-- Merge associativity fires on concrete designs.
ex-⊕-assoc : ((p0 ∷ []) ⊕ᴰ (o0 ∷ [])) ⊕ᴰ (dai ∷ [])
           ≡ (p0 ∷ []) ⊕ᴰ ((o0 ∷ []) ⊕ᴰ (dai ∷ []))
ex-⊕-assoc = ⊕-assoc (p0 ∷ []) (o0 ∷ []) (dai ∷ [])

-- A concrete cut: the daimon (no locus) stays at the left tag; the
-- Proponent positive at "0" lands at "1.0" under the right tag.
ex-cut : cut (dai ∷ []) (p0 ∷ [])
       ≡ (act DAIMON daimon nothing false
          ∷ act PROPER P (just (1 ∷ 0 ∷ [])) false
          ∷ [])
ex-cut = refl

------------------------------------------------------------------------
-- §5.  The associator: cut-associativity up to a locus isomorphism
--
-- (Obligation (A) of the original plan, now DISCHARGED.)  `cut` is NOT
-- strictly associative: `cut (cut D E) F` tags its operands at the
-- addresses LL = 0.0, LR = 0.1, R = 1, whereas `cut D (cut E F)` tags them
-- at L = 0, RL = 1.0, RR = 1.1.  The two designs differ exactly by the
-- per-operand locus renaming
--     LL ↦ L ,   LR ↦ RL ,   R ↦ RR
-- which is the bicategory ASSOCIATOR.  It is a genuine locus ISOMORPHISM
-- `assocL` (inverse `assocL⁻¹`), NOT a uniform `relocate p` (it acts by a
-- different prefix on each operand, so no single prefix realises it).  We
-- prove `cut` associative UP TO this renaming in BOTH directions — so the
-- associator is a real iso and the strictly-associative core is `_⊕ᴰ_`.
------------------------------------------------------------------------

-- Generic renaming of every act's locus by a function on loci.
renameAct : (Locus → Locus) → Act → Act
renameAct r (act k pol loc add) = act k pol (M.map r loc) add

renameDesign : (Locus → Locus) → Design → Design
renameDesign r = map (renameAct r)

renameDesign-⊕ : ∀ r D E → renameDesign r (D ⊕ᴰ E) ≡ renameDesign r D ⊕ᴰ renameDesign r E
renameDesign-⊕ r D E = map-++ (renameAct r) D E

-- Fusion: renaming after relocation is relocation by a shifted prefix,
-- whenever the renaming sends the produced prefix `p ++ _` to `p′ ++ _`.
renameAct-relocAct : ∀ (r : Locus → Locus) (p p′ : Locus)
                   → (∀ ℓ → r (p ++ ℓ) ≡ p′ ++ ℓ)
                   → ∀ a → renameAct r (relocAct p a) ≡ relocAct p′ a
renameAct-relocAct r p p′ h (act k pol nothing  add) = refl
renameAct-relocAct r p p′ h (act k pol (just ℓ) add) =
  cong (λ z → act k pol (just z) add) (h ℓ)

rename-reloc : ∀ (r : Locus → Locus) (p p′ : Locus) (D : Design)
             → (∀ ℓ → r (p ++ ℓ) ≡ p′ ++ ℓ)
             → renameDesign r (relocate p D) ≡ relocate p′ D
rename-reloc r p p′ []      h = refl
rename-reloc r p p′ (a ∷ D) h =
  cong₂ _∷_ (renameAct-relocAct r p p′ h a) (rename-reloc r p p′ D h)

-- The tagging addresses (LL/LR/R produced by left-nested cut; L/RL/RR by
-- the right-nested cut).
pLL pLR pR pL pRL pRR : Locus
pLL = 0 ∷ 0 ∷ []
pLR = 0 ∷ 1 ∷ []
pR  = 1 ∷ []
pL  = 0 ∷ []
pRL = 1 ∷ 0 ∷ []
pRR = 1 ∷ 1 ∷ []

-- The associator, as a locus isomorphism on the produced addresses.
assocL : Locus → Locus
assocL (0 ∷ 0 ∷ r) = 0 ∷ r          -- LL ↦ L
assocL (0 ∷ 1 ∷ r) = 1 ∷ 0 ∷ r      -- LR ↦ RL
assocL (1 ∷ r)     = 1 ∷ 1 ∷ r      -- R  ↦ RR
assocL ℓ           = ℓ

assocL⁻¹ : Locus → Locus
assocL⁻¹ (0 ∷ r)     = 0 ∷ 0 ∷ r    -- L  ↦ LL
assocL⁻¹ (1 ∷ 0 ∷ r) = 0 ∷ 1 ∷ r    -- RL ↦ LR
assocL⁻¹ (1 ∷ 1 ∷ r) = 1 ∷ r        -- RR ↦ R
assocL⁻¹ ℓ           = ℓ

-- Normal forms of the two bracketings (each one relocate-cut rewrite).
nfL : Design → Design → Design → Design
nfL D E F = (relocate pLL D ⊕ᴰ relocate pLR E) ⊕ᴰ relocate pR F

nfR : Design → Design → Design → Design
nfR D E F = relocate pL D ⊕ᴰ (relocate pRL E ⊕ᴰ relocate pRR F)

cut-nfL : ∀ D E F → cut (cut D E) F ≡ nfL D E F
cut-nfL D E F = cong (λ z → z ⊕ᴰ relocate ℓR F) (relocate-cut ℓL D E)

cut-nfR : ∀ D E F → cut D (cut E F) ≡ nfR D E F
cut-nfR D E F = cong (λ z → relocate ℓL D ⊕ᴰ z) (relocate-cut ℓR E F)

-- Forward: the associator carries the left bracketing to the right.
cut-assoc : ∀ D E F → renameDesign assocL (cut (cut D E) F) ≡ cut D (cut E F)
cut-assoc D E F = begin
    renameDesign assocL (cut (cut D E) F)
  ≡⟨ cong (renameDesign assocL) (cut-nfL D E F) ⟩
    renameDesign assocL (nfL D E F)
  ≡⟨ renameDesign-⊕ assocL (relocate pLL D ⊕ᴰ relocate pLR E) (relocate pR F) ⟩
    renameDesign assocL (relocate pLL D ⊕ᴰ relocate pLR E)
      ⊕ᴰ renameDesign assocL (relocate pR F)
  ≡⟨ cong (_⊕ᴰ renameDesign assocL (relocate pR F))
          (renameDesign-⊕ assocL (relocate pLL D) (relocate pLR E)) ⟩
    (renameDesign assocL (relocate pLL D) ⊕ᴰ renameDesign assocL (relocate pLR E))
      ⊕ᴰ renameDesign assocL (relocate pR F)
  ≡⟨ cong₂ _⊕ᴰ_ (cong₂ _⊕ᴰ_ (rename-reloc assocL pLL pL D (λ _ → refl))
                              (rename-reloc assocL pLR pRL E (λ _ → refl)))
                (rename-reloc assocL pR pRR F (λ _ → refl)) ⟩
    (relocate pL D ⊕ᴰ relocate pRL E) ⊕ᴰ relocate pRR F
  ≡⟨ ⊕-assoc (relocate pL D) (relocate pRL E) (relocate pRR F) ⟩
    relocate pL D ⊕ᴰ (relocate pRL E ⊕ᴰ relocate pRR F)
  ≡⟨ sym (cut-nfR D E F) ⟩
    cut D (cut E F)
  ∎

-- Backward: the inverse associator carries the right bracketing to the left.
cut-assoc⁻¹ : ∀ D E F → renameDesign assocL⁻¹ (cut D (cut E F)) ≡ cut (cut D E) F
cut-assoc⁻¹ D E F = begin
    renameDesign assocL⁻¹ (cut D (cut E F))
  ≡⟨ cong (renameDesign assocL⁻¹) (cut-nfR D E F) ⟩
    renameDesign assocL⁻¹ (nfR D E F)
  ≡⟨ renameDesign-⊕ assocL⁻¹ (relocate pL D) (relocate pRL E ⊕ᴰ relocate pRR F) ⟩
    renameDesign assocL⁻¹ (relocate pL D)
      ⊕ᴰ renameDesign assocL⁻¹ (relocate pRL E ⊕ᴰ relocate pRR F)
  ≡⟨ cong (renameDesign assocL⁻¹ (relocate pL D) ⊕ᴰ_)
          (renameDesign-⊕ assocL⁻¹ (relocate pRL E) (relocate pRR F)) ⟩
    renameDesign assocL⁻¹ (relocate pL D)
      ⊕ᴰ (renameDesign assocL⁻¹ (relocate pRL E) ⊕ᴰ renameDesign assocL⁻¹ (relocate pRR F))
  ≡⟨ cong₂ _⊕ᴰ_ (rename-reloc assocL⁻¹ pL pLL D (λ _ → refl))
                (cong₂ _⊕ᴰ_ (rename-reloc assocL⁻¹ pRL pLR E (λ _ → refl))
                            (rename-reloc assocL⁻¹ pRR pR F (λ _ → refl))) ⟩
    relocate pLL D ⊕ᴰ (relocate pLR E ⊕ᴰ relocate pR F)
  ≡⟨ sym (⊕-assoc (relocate pLL D) (relocate pLR E) (relocate pR F)) ⟩
    (relocate pLL D ⊕ᴰ relocate pLR E) ⊕ᴰ relocate pR F
  ≡⟨ sym (cut-nfL D E F) ⟩
    cut (cut D E) F
  ∎

-- Non-vacuity: the associator round-trips on a concrete left-nested cut.
ex-assoc : renameDesign assocL (cut (cut (dai ∷ []) (p0 ∷ [])) (o0 ∷ []))
         ≡ cut (dai ∷ []) (cut (p0 ∷ []) (o0 ∷ []))
ex-assoc = cut-assoc (dai ∷ []) (p0 ∷ []) (o0 ∷ [])

------------------------------------------------------------------------
-- §6.  The associator pentagon  (Mac Lane coherence for `cut`)
--
-- The pentagon: the two routes re-bracketing FOUR operands from the fully
-- LEFT-nested ((AB)C)D to the fully RIGHT-nested A(B(CD)) agree.  In this
-- concrete encoding every associator is the SAME content-independent locus
-- relabeling `assocL` — applied at top level, or WHISKERED under a tag when
-- the re-bracketed triple sits inside an outer cut.  We show BOTH routes
-- send ((AB)C)D to A(B(CD)), hence (by `trans`) agree:
--
--   top    : ((AB)C)D --assocL--> (AB)(CD) --assocL--> A(B(CD))
--   bottom : ((AB)C)D --whiskerL assocL--> (A(BC))D --assocL--> A((BC)D)
--                     --whiskerR assocL--> A(B(CD))
------------------------------------------------------------------------

-- Whiskering: apply a locus renaming only under the left (resp. right) tag.
whiskerL : (Locus → Locus) → Locus → Locus
whiskerL r []          = []
whiskerL r (zero  ∷ x) = zero  ∷ r x
whiskerL r (suc n ∷ x) = suc n ∷ x

whiskerR : (Locus → Locus) → Locus → Locus
whiskerR r []          = []
whiskerR r (zero  ∷ x) = zero  ∷ x
whiskerR r (suc n ∷ x) = suc n ∷ r x

-- Generic fusion of a renaming after a relocation: if `f (p ++ y) = p′ ++ r y`,
-- then renaming-after-relocate is relocate-after-renaming.
renameAct-reloc-fusion : ∀ (f r : Locus → Locus) (p p′ : Locus)
                       → (∀ y → f (p ++ y) ≡ p′ ++ r y)
                       → ∀ a → renameAct f (relocAct p a) ≡ relocAct p′ (renameAct r a)
renameAct-reloc-fusion f r p p′ h (act k pol nothing  add) = refl
renameAct-reloc-fusion f r p p′ h (act k pol (just ℓ) add) =
  cong (λ z → act k pol (just z) add) (h ℓ)

renameDesign-reloc-fusion : ∀ (f r : Locus → Locus) (p p′ : Locus) (D : Design)
                          → (∀ y → f (p ++ y) ≡ p′ ++ r y)
                          → renameDesign f (relocate p D) ≡ relocate p′ (renameDesign r D)
renameDesign-reloc-fusion f r p p′ []      h = refl
renameDesign-reloc-fusion f r p p′ (a ∷ D) h =
  cong₂ _∷_ (renameAct-reloc-fusion f r p p′ h a)
            (renameDesign-reloc-fusion f r p p′ D h)

-- The identity renaming is the identity on designs.
renameAct-id : ∀ a → renameAct (λ x → x) a ≡ a
renameAct-id (act k pol nothing  add) = refl
renameAct-id (act k pol (just ℓ) add) = refl

renameDesign-id : ∀ D → renameDesign (λ x → x) D ≡ D
renameDesign-id []      = refl
renameDesign-id (a ∷ D) = cong₂ _∷_ (renameAct-id a) (renameDesign-id D)

-- Whiskering acts under its own tag and is the identity on the other.
whiskerL-ℓL : ∀ r D → renameDesign (whiskerL r) (relocate ℓL D) ≡ relocate ℓL (renameDesign r D)
whiskerL-ℓL r D = renameDesign-reloc-fusion (whiskerL r) r ℓL ℓL D (λ _ → refl)

whiskerL-ℓR : ∀ r E → renameDesign (whiskerL r) (relocate ℓR E) ≡ relocate ℓR E
whiskerL-ℓR r E =
  trans (renameDesign-reloc-fusion (whiskerL r) (λ x → x) ℓR ℓR E (λ _ → refl))
        (cong (relocate ℓR) (renameDesign-id E))

whiskerR-ℓL : ∀ r D → renameDesign (whiskerR r) (relocate ℓL D) ≡ relocate ℓL D
whiskerR-ℓL r D =
  trans (renameDesign-reloc-fusion (whiskerR r) (λ x → x) ℓL ℓL D (λ _ → refl))
        (cong (relocate ℓL) (renameDesign-id D))

whiskerR-ℓR : ∀ r E → renameDesign (whiskerR r) (relocate ℓR E) ≡ relocate ℓR (renameDesign r E)
whiskerR-ℓR r E = renameDesign-reloc-fusion (whiskerR r) r ℓR ℓR E (λ _ → refl)

-- Whiskered renaming commutes with `cut` (renames one operand, fixes the other).
renameDesign-whiskerL-cut : ∀ r Y D → renameDesign (whiskerL r) (cut Y D) ≡ cut (renameDesign r Y) D
renameDesign-whiskerL-cut r Y D =
  trans (renameDesign-⊕ (whiskerL r) (relocate ℓL Y) (relocate ℓR D))
        (cong₂ _⊕ᴰ_ (whiskerL-ℓL r Y) (whiskerL-ℓR r D))

renameDesign-whiskerR-cut : ∀ r A E → renameDesign (whiskerR r) (cut A E) ≡ cut A (renameDesign r E)
renameDesign-whiskerR-cut r A E =
  trans (renameDesign-⊕ (whiskerR r) (relocate ℓL A) (relocate ℓR E))
        (cong₂ _⊕ᴰ_ (whiskerR-ℓL r A) (whiskerR-ℓR r E))

-- Top route: two top-level associators take ((AB)C)D to A(B(CD)).
pentagon-top : ∀ A B C D
             → renameDesign assocL (renameDesign assocL (cut (cut (cut A B) C) D))
             ≡ cut A (cut B (cut C D))
pentagon-top A B C D = begin
    renameDesign assocL (renameDesign assocL (cut (cut (cut A B) C) D))
  ≡⟨ cong (renameDesign assocL) (cut-assoc (cut A B) C D) ⟩
    renameDesign assocL (cut (cut A B) (cut C D))
  ≡⟨ cut-assoc A B (cut C D) ⟩
    cut A (cut B (cut C D))
  ∎

-- Bottom route: whiskerL assocL, then assocL, then whiskerR assocL.
pentagon-bottom : ∀ A B C D
                → renameDesign (whiskerR assocL)
                    (renameDesign assocL
                      (renameDesign (whiskerL assocL) (cut (cut (cut A B) C) D)))
                ≡ cut A (cut B (cut C D))
pentagon-bottom A B C D = begin
    renameDesign (whiskerR assocL)
      (renameDesign assocL
        (renameDesign (whiskerL assocL) (cut (cut (cut A B) C) D)))
  ≡⟨ cong (λ z → renameDesign (whiskerR assocL) (renameDesign assocL z))
          (renameDesign-whiskerL-cut assocL (cut (cut A B) C) D) ⟩
    renameDesign (whiskerR assocL)
      (renameDesign assocL (cut (renameDesign assocL (cut (cut A B) C)) D))
  ≡⟨ cong (λ z → renameDesign (whiskerR assocL) (renameDesign assocL (cut z D)))
          (cut-assoc A B C) ⟩
    renameDesign (whiskerR assocL) (renameDesign assocL (cut (cut A (cut B C)) D))
  ≡⟨ cong (renameDesign (whiskerR assocL)) (cut-assoc A (cut B C) D) ⟩
    renameDesign (whiskerR assocL) (cut A (cut (cut B C) D))
  ≡⟨ renameDesign-whiskerR-cut assocL A (cut (cut B C) D) ⟩
    cut A (renameDesign assocL (cut (cut B C) D))
  ≡⟨ cong (cut A) (cut-assoc B C D) ⟩
    cut A (cut B (cut C D))
  ∎

-- The PENTAGON: the two routes agree.
pentagon : ∀ A B C D
         → renameDesign assocL (renameDesign assocL (cut (cut (cut A B) C) D))
         ≡ renameDesign (whiskerR assocL)
             (renameDesign assocL
               (renameDesign (whiskerL assocL) (cut (cut (cut A B) C) D)))
pentagon A B C D = trans (pentagon-top A B C D) (sym (pentagon-bottom A B C D))

------------------------------------------------------------------------
-- §7.  The remaining obligation (B)  (under Q-046, not postulated)
--
-- Obligations (A) [cut-associativity up to the associator, §5] and the
-- associator PENTAGON [§6] are DISCHARGED, so the STRUCTURAL bicategory
-- coherence of `cut` is complete (the strictly-associative core is the
-- merge `_⊕ᴰ_`, §2).  What remains is the interaction-level theorem:
--
-- (B)  ASSOCIATIVITY OF THE RESIDUAL-CUT NORMALIZER — the deep theorem
--      (Girard cut-elimination / Church–Rosser).  It needs
--          normCut : ℕ → Locus → Design → Design → Design
--      that, given a cut locus κ, runs ⟨D ∣ E⟩ at κ (the M1 `interact`
--      loop) and returns the RESIDUAL design — the acts surviving on the
--      non-κ loci — rather than collapsing to a `Status`.  The target law
--          normCut κ₂ (normCut κ₁ D E) F  ≈  normCut κ₁ D (normCut κ₂ E F)
--      (for distinct cut loci κ₁, κ₂) is associativity of composition.
--      Its CRUX is confluence at DISTINCT cut loci, which is precisely the
--      locus-disjoint NON-INTERFERENCE already mechanized as T009's
--      O-parity-b (matches are by EQUAL address, so acts under
--      ⊑-incomparable cut loci never interfere).  So the hard content is
--      already in hand abstractly; what remains is (i) defining `normCut`
--      as a residual-producing fuel-recursion (mirroring `loop`, but
--      retaining surviving acts), and (ii) porting the O-parity-b argument
--      from "no cross-line match" to "cuts at incomparable loci commute".
--      This is the multi-session cut-elimination piece; tracked under
--      Q-046, parked, NOT postulated here.
------------------------------------------------------------------------
