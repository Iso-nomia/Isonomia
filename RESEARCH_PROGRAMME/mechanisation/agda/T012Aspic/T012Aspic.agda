------------------------------------------------------------------------
-- T012-Aspic — Structured (ASPIC+) argument trees: deriving the three
--              attack types from argument STRUCTURE, the restricted-rebut
--              / axiom-protection laws, and the re-typing symmetry
--              classification.  Deepening of handoff item 1.
--
-- T012Struct lifted Reading-C conservativity to structured witnesses but
-- modelled the argument only by an OPAQUE attack-type label + read-
-- polarity.  This file gives that label genuine PROVENANCE: structured
-- arguments are inference TREES (premises / strict+defeasible rules /
-- conclusions over a contrariness relation), and the three ASPIC+ attack
-- types are DERIVED from where in the tree the conflict lands
-- (Modgil & Prakken 2013; faithful to lib/aspic/attacks.ts):
--
--   • undermine — `conc A` is contrary to a FALLIBLE PREMISE of B
--                 (ordinary/assumption; axioms are protected);
--   • rebut     — `conc A` is contrary to the CONCLUSION of a DEFEASIBLY-
--                 topped sub-argument of B (strict conclusions protected);
--   • undercut  — `conc A` is contrary to the RULE-NAME of a DEFEASIBLY-
--                 topped sub-argument of B.
--
-- RESULTS.
--   §3  Faithfulness of the ASPIC+ restrictions, as structural theorems:
--       `firm-not-underminable` (an all-axiom argument cannot be
--       undermined) and `strict-not-rebuttable` / `strict-not-undercuttable`
--       (a defeasible-free argument cannot be rebut/undercut).
--   §4  The re-typing symmetry classification — the structural justification
--       of T012Struct's `conv-pol-sym` residual:
--       `rebut-sym` — under symmetric contrariness a mutual defeasible
--         rebut has a STRUCTURAL converse (rebut ↦ rebut, the fixed point);
--       `Witness` — a concrete theory where A UNDERMINES B but B's role-flip
--         attack on A is a REBUT, not an undermine: the attack TYPE is NOT
--         preserved under re-typing for the asymmetric attacks.  This is
--         exactly why `conv-pol-sym` is structural for rebut and load-
--         bearing for undermine/undercut (T012Struct (C)).
--   §5  `typeOf` derives a T012Struct-style `AType` from a structural
--       attack — the provenance map feeding the conservativity lift.
--
-- WHAT THIS IS NOT.  It models argument trees + contrariness + the attack
-- derivations and their structural laws; it does NOT compute defeats /
-- preferences / extensions (that is the labelling engine), nor does it
-- re-run the Reading-C ⋀-lift (T012Struct does, now with `AType` derivable
-- here).  Contrariness symmetry is a hypothesis where used, not assumed
-- globally (ASPIC+ contraries may be asymmetric).
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T012Aspic/T012Aspic.agda`.
-- Evidence under the Theorem Register policy (T012 is established).
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T012Aspic.T012Aspic where

open import Data.List using (List; []; _∷_; _++_)
open import Data.List.Relation.Unary.Any using (Any; here; there)
open import Data.List.Relation.Unary.All using (All; []; _∷_)
open import Data.Product using (_×_; _,_; proj₁; proj₂)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Data.Bool using (Bool; true; false; T)
open import Data.Unit using (⊤; tt)
open import Data.Empty using (⊥)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; subst)

------------------------------------------------------------------------
-- §0.  Generic list glue and the ASPIC+ tags (contrariness-independent).
------------------------------------------------------------------------

-- KB partition (fallibility) and rule mode.
data PremKind : Set where axiom ordinary assumption : PremKind
data RuleType : Set where strict defeasible : RuleType

isDef : RuleType → Bool
isDef strict     = false
isDef defeasible = true

-- Ordinary premises and assumptions are fallible (underminable); axioms
-- are necessary (protected).
Fallible : PremKind → Set
Fallible axiom      = ⊥
Fallible ordinary   = ⊤
Fallible assumption = ⊤

-- The three attack types (lib/aspic/types.ts AttackType).
data AType : Set where rebut undercut undermine : AType

------------------------------------------------------------------------
-- §1.  Structured arguments over a language with contrariness.
------------------------------------------------------------------------

module Core (Formula : Set) (_⌣_ : Formula → Formula → Set) where

  -- An inference rule: antecedents, consequent, mode, and a name formula
  -- (ASPIC+ n : Rd → L, used by undercut).
  record Rule : Set where
    constructor rule
    field
      ante   : List Formula
      conseq : Formula
      rtype  : RuleType
      rname  : Formula

  -- An argument is a premise leaf or an inference from sub-arguments.
  data Arg : Set where
    prem  : Formula → PremKind → Arg
    infer : Rule → List Arg → Arg

  conc : Arg → Formula
  conc (prem φ _)   = φ
  conc (infer r _)  = Rule.conseq r

  -- "Has a defeasible top rule" (premises do not).
  topDef : Arg → Bool
  topDef (prem _ _)  = false
  topDef (infer r _) = isDef (Rule.rtype r)

  ruleNameOf : Arg → Formula
  ruleNameOf (prem φ _)  = φ            -- dummy; guarded by `topDef` below
  ruleNameOf (infer r _) = Rule.rname r

  -- Sub-arguments (reflexive: an argument is its own sub-argument).
  subs     : Arg → List Arg
  subsList : List Arg → List Arg
  subs a@(prem _ _)   = a ∷ []
  subs a@(infer _ as) = a ∷ subsList as
  subsList []        = []
  subsList (a ∷ as)  = subs a ++ subsList as

  -- The premises of an argument (with their KB kind).
  prems     : Arg → List (Formula × PremKind)
  premsList : List Arg → List (Formula × PremKind)
  prems (prem φ k)   = (φ , k) ∷ []
  prems (infer _ as) = premsList as
  premsList []       = []
  premsList (a ∷ as) = prems a ++ premsList as

  -- An argument is always among its own sub-arguments (the head).
  here-self : ∀ a {P : Arg → Set} → P a → Any P (subs a)
  here-self (prem _ _)  p = here p
  here-self (infer _ _) p = here p

  --------------------------------------------------------------------
  -- §2.  The three attack types, DERIVED from structure.
  --------------------------------------------------------------------

  -- A undermines B: `conc A` is contrary to a fallible premise of B.
  Undermines : Arg → Arg → Set
  Undermines A B =
    Any (λ pr → Fallible (proj₂ pr) × (conc A ⌣ proj₁ pr)) (prems B)

  -- A rebuts B: `conc A` is contrary to the conclusion of a defeasibly-
  -- topped sub-argument of B.
  Rebuts : Arg → Arg → Set
  Rebuts A B =
    Any (λ B' → T (topDef B') × (conc A ⌣ conc B')) (subs B)

  -- A undercuts B: `conc A` is contrary to the rule-name of a defeasibly-
  -- topped sub-argument of B.
  Undercuts : Arg → Arg → Set
  Undercuts A B =
    Any (λ B' → T (topDef B') × (conc A ⌣ ruleNameOf B')) (subs B)

  -- An attack is one of the three.
  Attacks : Arg → Arg → Set
  Attacks A B = Undermines A B ⊎ (Rebuts A B ⊎ Undercuts A B)

  -- §5  The attack-type provenance map (feeds T012Struct's `AType`).
  typeOf : ∀ {A B} → Attacks A B → AType
  typeOf (inj₁ _)        = undermine
  typeOf (inj₂ (inj₁ _)) = rebut
  typeOf (inj₂ (inj₂ _)) = undercut

  --------------------------------------------------------------------
  -- §3.  The ASPIC+ restrictions, as structural theorems.
  --------------------------------------------------------------------

  -- Axioms cannot be undermined: an argument all of whose premises are
  -- axioms admits no undermining attack ("firm" arguments).
  firm-not-underminable : ∀ {A B}
                        → All (λ pr → proj₂ pr ≡ axiom) (prems B)
                        → ¬ Undermines A B
  firm-not-underminable {A} axs um = go axs um
    where
    go : ∀ {xs} → All (λ pr → proj₂ pr ≡ axiom) xs
       → Any (λ pr → Fallible (proj₂ pr) × (conc A ⌣ proj₁ pr)) xs → ⊥
    go (eq ∷ _)  (here (fal , _)) = subst Fallible eq fal   -- Fallible axiom ≡ ⊥
    go (_  ∷ as) (there a)        = go as a

  -- Strict (defeasible-free) conclusions cannot be rebut or undercut.
  strict-not-rebuttable : ∀ {A B}
                        → All (λ B' → topDef B' ≡ false) (subs B)
                        → ¬ Rebuts A B
  strict-not-rebuttable {A} df rb = go df rb
    where
    go : ∀ {xs} → All (λ B' → topDef B' ≡ false) xs
       → Any (λ B' → T (topDef B') × (conc A ⌣ conc B')) xs → ⊥
    go (eq ∷ _)  (here (td , _)) = subst T eq td             -- T false ≡ ⊥
    go (_  ∷ as) (there a)       = go as a

  strict-not-undercuttable : ∀ {A B}
                           → All (λ B' → topDef B' ≡ false) (subs B)
                           → ¬ Undercuts A B
  strict-not-undercuttable {A} df uc = go df uc
    where
    go : ∀ {xs} → All (λ B' → topDef B' ≡ false) xs
       → Any (λ B' → T (topDef B') × (conc A ⌣ ruleNameOf B')) xs → ⊥
    go (eq ∷ _)  (here (td , _)) = subst T eq td
    go (_  ∷ as) (there a)       = go as a

  --------------------------------------------------------------------
  -- §4.  Re-typing symmetry classification — the structural ground of
  --      T012Struct's `conv-pol-sym` residual.
  --
  -- REBUT is the fixed point: under symmetric contrariness, two mutually-
  -- contrary defeasibly-topped arguments rebut EACH OTHER — so a polarity
  -- re-typing of a rebut is again a rebut, structurally (no substrate
  -- symmetry needed).
  --------------------------------------------------------------------

  rebut-sym : ∀ {A B}
            → (∀ {φ ψ} → φ ⌣ ψ → ψ ⌣ φ)        -- contrariness symmetric
            → T (topDef A) → T (topDef B)
            → conc A ⌣ conc B
            → Rebuts A B × Rebuts B A
  rebut-sym {A} {B} ⌣sym tdA tdB cAB =
      here-self B (tdB , cAB)
    , here-self A (tdA , ⌣sym cAB)

------------------------------------------------------------------------
-- §4'.  Witness: undermine's role-flip is NOT an undermine (it reorients
--       to a rebut).  So the attack TYPE is not preserved by re-typing for
--       the asymmetric attacks — the residual T012Struct isolates.
------------------------------------------------------------------------

module Witness where

  data F0 : Set where
    p np q rA nrA : F0

  -- Contrariness: p ↔ np (symmetric), and nrA contrary to the rule name rA.
  data _⌣0_ : F0 → F0 → Set where
    np⌣p   : np  ⌣0 p
    p⌣np   : p   ⌣0 np
    nrA⌣rA : nrA ⌣0 rA

  open Core F0 _⌣0_

  -- B: the ordinary premise `p`.
  B : Arg
  B = prem p ordinary

  -- A: defeasibly infer `np` from the ordinary premise `q` (rule named rA).
  A : Arg
  A = infer (rule (q ∷ []) np defeasible rA) (prem q ordinary ∷ [])

  -- A undermines B (conc A = np contrary to the ordinary premise p of B).
  A-undermines-B : Undermines A B
  A-undermines-B = here (tt , np⌣p)

  -- B does NOT undermine A: A's only premise is q, and p is not contrary
  -- to q (no such constructor).
  ¬B-undermines-A : ¬ Undermines B A
  ¬B-undermines-A (here (_ , ()))
  ¬B-undermines-A (there ())

  -- …yet B DOES attack A — as a REBUT (conc B = p contrary to conc A = np,
  -- and A is defeasibly topped).  The role-flip reorients undermine ↦ rebut.
  B-rebuts-A : Rebuts B A
  B-rebuts-A = here-self A (tt , p⌣np)

  -- For completeness, an undercutter U of A (conc nrA contrary to A's rule
  -- name rA) — exhibiting the third derived type.
  U : Arg
  U = prem nrA ordinary

  U-undercuts-A : Undercuts U A
  U-undercuts-A = here-self A (tt , nrA⌣rA)

  -- The three derived attacks classify as the three ASPIC+ types.
  type-undermine : typeOf {A} {B} (inj₁ A-undermines-B) ≡ undermine
  type-undermine = refl

  type-rebut : typeOf {B} {A} (inj₂ (inj₁ B-rebuts-A)) ≡ rebut
  type-rebut = refl

  type-undercut : typeOf {U} {A} (inj₂ (inj₂ U-undercuts-A)) ≡ undercut
  type-undercut = refl
