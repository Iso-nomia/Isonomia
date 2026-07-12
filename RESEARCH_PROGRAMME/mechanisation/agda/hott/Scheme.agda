------------------------------------------------------------------------
-- hott.Scheme — M5: a type-theoretic treatment of a Walton scheme,
--               with "scheme identity = behaviour-extensional" via
--               univalence (the §5 slogan, cashed)
--
-- Direction 5 (mechanization), session 09 step M5 / Q-046.  The LAST §5
-- slogan: "a scheme is a typed inference rule whose critical questions are
-- its elimination obligations; an argument instancing a scheme is a term
-- of the corresponding dependent type; and the resolution of the
-- C006/C007/C008 trilemma — 'scheme identity is behaviour-extensional' —
-- is the inferentialist's 'equivalence is equality', made precise in HoTT."
--
-- This is a PROOF-OF-CONCEPT on ONE family (Argument from Expert Opinion,
-- T003's worked example), NOT a catalogue port.  Per the §18 regime
-- decision (option b), behavioural equivalence is kept ABSTRACT: the
-- behaviour denotation `⟦_⟧` is a module parameter, and the tie to the
-- constitutive `_⊥_`-behaviour of ludics/ (T003's C006 𝓑(𝓢)) stays a
-- DOCUMENTED CORRESPONDENCE, not a cross-regime import (cubical and the
-- `--safe --without-K` ludics corpus cannot share a module).
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS FILE LANDS
-- ─────────────────────────────────────────────────────────────────────
--   §1  Atoms (abstract module parameters: agents, domains, statements).
--   §2  `ExpertOpinion` — the scheme AS A DEPENDENT TYPE (premise slots).
--   §3  CQs AS ELIMINATION OBLIGATIONS — each critical question is a type
--       the eliminator demands; `conclude` consumes a scheme instance ONLY
--       given all CQ obligations discharged.  An `Argument` is a term of
--       the corresponding dependent (Σ-)type.
--   §4  BEHAVIOUR-EXTENSIONAL IDENTITY via univalence — with the behaviour
--       denotation abstract, `behaviour-extensional = ua` turns a
--       behavioural EQUIVALENCE (`≃`) into scheme-behaviour IDENTITY (`≡`),
--       and `behaviour-univalence = univalence` gives the full `(≡) ≃ (≃)`
--       correspondence.  This is "equivalence is equality" for schemes.
--
-- This tree is SEGREGATED (`--cubical`, depends on cubical-0.8); the
-- `--safe --without-K` ludics corpus never imports it.
-- Build (from mechanisation/agda/hott): `agda Scheme.agda`.
------------------------------------------------------------------------

{-# OPTIONS --cubical #-}

module Scheme where

open import Cubical.Foundations.Prelude using (Type; _≡_; refl)
open import Cubical.Foundations.Equiv using (_≃_; idEquiv)
open import Cubical.Foundations.Univalence using (ua; univalence)
open import Cubical.Data.Sigma using (Σ-syntax; _×_; _,_)

------------------------------------------------------------------------
-- §1.  Atoms
--
-- The non-logical vocabulary an Expert-Opinion argument quantifies over,
-- kept abstract as module parameters (no commitment to a concrete domain
-- model — the PoC is about the SCHEME's type-theoretic shape).
------------------------------------------------------------------------

module _
  {ℓ : _}
  (Agent     : Type ℓ)   -- who is speaking
  (Domain    : Type ℓ)   -- the field of expertise
  (Statement : Type ℓ)   -- what is asserted
  -- the relational atoms an Expert-Opinion CQ can challenge:
  (ExpertIn      : Agent → Domain → Type ℓ)   -- "E is an expert in D"
  (InDomain      : Statement → Domain → Type ℓ)  -- "A belongs to D"
  (Asserts       : Agent → Statement → Type ℓ)   -- "E asserted A"
  (Trustworthy   : Agent → Type ℓ)               -- "E is reliable"
  (Consistent    : Statement → Type ℓ)           -- "A agrees with other experts"
  (Backed        : Statement → Type ℓ)           -- "A is evidence-backed"
  where

  ----------------------------------------------------------------------
  -- §2.  The scheme as a dependent type
  --
  -- Argument from Expert Opinion: the premise slots of the inference.  A
  -- value of `ExpertOpinion` is a filled scheme instance (the expert, the
  -- domain, the asserted statement, and the two structural premises the
  -- scheme's form asserts: E is an expert in D, and E asserts A).
  ----------------------------------------------------------------------

  record ExpertOpinion : Type ℓ where
    constructor saypert
    field
      expert      : Agent
      domain      : Domain
      statement   : Statement
      -- the scheme's own (defeasible) premises:
      isExpert    : ExpertIn expert domain
      didAssert   : Asserts expert statement
  open ExpertOpinion public

  -- The conclusion an instance licenses: the asserted statement.
  conclusionOf : ExpertOpinion → Statement
  conclusionOf s = statement s

  ----------------------------------------------------------------------
  -- §3.  Critical questions as elimination obligations
  --
  -- Each CQ is a TYPE the use of the scheme must discharge — the
  -- "elimination obligation" reading: to ELIMINATE a scheme instance into
  -- its conclusion you must answer its critical questions.  These are the
  -- classic Walton Expert-Opinion CQs.
  ----------------------------------------------------------------------

  -- CQ1 Expertise / CQ2 Field are already premises (isExpert / the domain
  -- fit); the remaining CQs are the genuine challenge obligations.
  CQ-field : ExpertOpinion → Type ℓ        -- is the statement in the domain?
  CQ-field s = InDomain (statement s) (domain s)

  CQ-trust : ExpertOpinion → Type ℓ        -- is the expert trustworthy?
  CQ-trust s = Trustworthy (expert s)

  CQ-consistency : ExpertOpinion → Type ℓ  -- consistent with other experts?
  CQ-consistency s = Consistent (statement s)

  CQ-backup : ExpertOpinion → Type ℓ       -- backed by evidence?
  CQ-backup s = Backed (statement s)

  -- The bundle of CQ obligations (the scheme's full elimination demand).
  CQs : ExpertOpinion → Type ℓ
  CQs s = CQ-field s × CQ-trust s × CQ-consistency s × CQ-backup s

  -- The ELIMINATOR: a scheme instance yields its conclusion ONLY when all
  -- critical questions are discharged.  (CQs are exactly the obligations of
  -- this elimination — the "typed inference rule" reading.)
  conclude : (s : ExpertOpinion) → CQs s → Statement
  conclude s _ = conclusionOf s

  -- An ARGUMENT instancing the scheme is a TERM of the corresponding
  -- dependent type: a filled instance together with its discharged CQs.
  Argument : Type ℓ
  Argument = Σ[ s ∈ ExpertOpinion ] CQs s

  -- Every argument delivers a conclusion (the eliminator applied).
  argConclusion : Argument → Statement
  argConclusion (s , cqs) = conclude s cqs

  ----------------------------------------------------------------------
  -- §4.  Behaviour-extensional scheme identity, via univalence
  --
  -- The C006/C007/C008 resolution (T003): a scheme's identity is its
  -- BEHAVIOUR, and "scheme identity is behaviour-extensional" is the
  -- inferentialist's "equivalence is equality".  Here the behaviour
  -- denotation `⟦_⟧ : ExpertOpinion → Type` is ABSTRACT (option b); the
  -- univalence cash-out is independent of which concrete behaviour it is.
  ----------------------------------------------------------------------

  module Behaviour {ℓ' : _} (⟦_⟧ : ExpertOpinion → Type ℓ') where

    -- Two schemes are BEHAVIOURALLY EQUIVALENT when their behaviours are
    -- equivalent as types.
    _≈ᵇ_ : ExpertOpinion → ExpertOpinion → Type ℓ'
    s ≈ᵇ s' = ⟦ s ⟧ ≃ ⟦ s' ⟧

    -- THE SLOGAN, CASHED: behavioural equivalence IS behaviour identity.
    -- `ua` (univalence) turns the equivalence `≃` into a path `≡` — schemes
    -- with equivalent behaviour have EQUAL behaviour.  "Equivalence is
    -- equality", applied to scheme identity rather than to mathematical
    -- structure: the inferentialist reading T003 resolved.
    behaviour-extensional : ∀ {s s'} → s ≈ᵇ s' → ⟦ s ⟧ ≡ ⟦ s' ⟧
    behaviour-extensional e = ua e

    -- The full correspondence (univalence): behaviour IDENTITY and
    -- behavioural EQUIVALENCE are themselves equivalent.  This is the
    -- precise sense in which "scheme identity is behaviour-extensional".
    behaviour-univalence : ∀ {s s'} → (⟦ s ⟧ ≡ ⟦ s' ⟧) ≃ (s ≈ᵇ s')
    behaviour-univalence = univalence

    -- Reflexivity is real: a scheme is behaviourally equivalent to itself,
    -- and the induced path is a genuine identity (non-vacuity of `≈ᵇ`).
    ≈ᵇ-refl : ∀ s → s ≈ᵇ s
    ≈ᵇ-refl s = idEquiv ⟦ s ⟧

    self-id : ∀ s → ⟦ s ⟧ ≡ ⟦ s ⟧
    self-id s = behaviour-extensional (≈ᵇ-refl s)
