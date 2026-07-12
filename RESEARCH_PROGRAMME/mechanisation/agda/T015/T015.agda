------------------------------------------------------------------------
-- T015 — The additive realizability keystone: stable and preferred-
--        admissibility are interactive; ⊆-maximality is a constraint.
--        Mechanised (n-unbounded for the abstract clauses; concrete
--        witnesses for the two no-go / boundary clauses).
--
-- Statement (per 02_THEOREMS_AND_PROOFS/T015-additive-realizability-
-- keystone.md): for a finite AF `F = (A, ⇝)` and the additive translation
-- ⟦·⟧₊, under the one-shot reading LB1 + universal test LB2,
--
--   (1) Stable.        E conflict-free is orthogonal to the universal
--                      &-test ⟺ E all-attacking ⟺ E stable.
--   (2) Admissibility. E conflict-free defends every member ⟺ every
--                      &-branch attacking a committed e is answered by a
--                      committed counter — admissibility, one-shot, NO
--                      recursive descent (witnessed by stable ⇒ admissible
--                      and ∅ admissible).
--   (3) Preferred.     preferred = the ⊆-maximal admissible sets.
--   (4) Maximality.    NO per-pair orthogonality predicate separates
--                      preferred from non-maximal admissible: a↔b, c
--                      isolated has {c} ⊊ {a,c} both admissible, so
--                      maximality is a global selection, not an
--                      interaction verdict.
--   (5) Boundary.      grounded interactive descent (PRO-no-repeat) does
--                      NOT compute stable: 2-cycle a↔b has {a} stable yet
--                      a is not defended by ∅, so the grounded descent
--                      from ∅ never admits it.
--
-- The two universal tests are DISTINCT and clause 4 turns on it: the
-- STABLE test (clause 1) ranges over all of A (`Orth`/`AllAttacking`); the
-- ADMISSIBILITY test (clause 2) ranges only over attackers of committed
-- members (`Defends`).  {c} passes the defense test (admissible) but fails
-- the all-attacking test (a, b unanswered) — it is admissible, not stable.
--
-- WHAT IS A PARAMETER / inherited obligation (T015's honest scope, NOT
-- re-proved here):
--   * LB1 (one-shot reading): acceptance via commit-set + one-shot
--     orthogonality, modelled here as the per-attacker `Defends` /
--     `Answered` predicates — not the fuel-bounded grounded descent.  The
--     `&`=∀ reading (the pool superposition = conjunction) is T015 Step A.
--   * LB2 (universal test ranges over all of A): built into `Orth`.
--   * The kernel-faithfulness of ⟦·⟧₊ / `stepCore` ⇓ † to these set-level
--     predicates is human review (the dispute encoding, disputeAdditive.ts).
--   Subsets are modelled as DECIDABLE (Bool-valued) extensions, matching
--   the substrate's finite, classical Dung semantics.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T015/T015.agda`.
--
-- This is *evidence* for T015 under the Theorem Register policy: T015 is
-- already `established` (human proof, cross-checked 2026-06-28); this
-- artefact mechanises the realizability trichotomy n-unbounded for the
-- abstract clauses (1)–(3) and on the canonical witnesses for the no-go
-- (4) and boundary (5), discharging the cross-check's non-blocking item
-- (d).  LB1/LB2 and ⟦·⟧₊-faithfulness are the human-review obligations.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T015.T015 where

open import Data.Bool using (Bool; true; false; T)
open import Data.Unit using (⊤; tt)
open import Data.Empty using (⊥; ⊥-elim)
open import Data.Product using (_×_; _,_; proj₁; proj₂; ∃; ∃-syntax)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Relation.Nullary using (¬_)

------------------------------------------------------------------------
-- §0.  Logical equivalence (mutual implication; the F2 style, never ≡).
------------------------------------------------------------------------

infix 1 _⇔_
_⇔_ : Set → Set → Set
P ⇔ Q = (P → Q) × (Q → P)

-- Decidability of T (the only "classical" ingredient — membership in a
-- Bool-valued extension is decidable).
T-dec : (x : Bool) → T x ⊎ (T x → ⊥)
T-dec true  = inj₁ tt
T-dec false = inj₂ (λ z → z)

------------------------------------------------------------------------
-- §1.  Abstract AF: Dung semantics and the additive (one-shot) predicates,
--      parametric over an arbitrary argument set and attack relation —
--      hence the clauses below are n-unbounded.
------------------------------------------------------------------------

module AF (Arg : Set) (_⇝_ : Arg → Arg → Set) where

  -- An extension is a decidable subset of arguments.
  Ext : Set
  Ext = Arg → Bool

  infix 4 _∈_
  _∈_ : Arg → Ext → Set
  a ∈ E = T (E a)

  -- Membership is decidable (E is Bool-valued).
  mem-dec : ∀ (E : Ext) a → (a ∈ E) ⊎ (a ∈ E → ⊥)
  mem-dec E a = T-dec (E a)

  -- Dung's basic notions.
  ConflictFree : Ext → Set
  ConflictFree E = ∀ {a b} → a ∈ E → b ∈ E → a ⇝ b → ⊥

  AllAttacking : Ext → Set
  AllAttacking E = ∀ {b} → (b ∈ E → ⊥) → ∃[ e ] ((e ∈ E) × (e ⇝ b))

  Stable : Ext → Set
  Stable E = ConflictFree E × AllAttacking E

  -- `E` defends `x`: every attacker of `x` has a committed counter — one
  -- &-round over att(x), no recursive descent (LB1).
  Defends : Ext → Arg → Set
  Defends E x = ∀ {y} → y ⇝ x → ∃[ e ] ((e ∈ E) × (e ⇝ y))

  Admissible : Ext → Set
  Admissible E = ConflictFree E × (∀ {x} → x ∈ E → Defends E x)

  --------------------------------------------------------------------
  -- §1.1  The universal &-test (LB2) and orthogonality to it.
  --
  -- The stable test raises every b ∈ A: a branch is `Answered` iff b is
  -- committed or countered in one step.  Orthogonality = all answered.
  --------------------------------------------------------------------

  Answered : Ext → Arg → Set
  Answered E b = (b ∈ E) ⊎ (∃[ e ] ((e ∈ E) × (e ⇝ b)))

  Orth : Ext → Set
  Orth E = ∀ b → Answered E b

  --------------------------------------------------------------------
  -- §1.2  Clause 1 — Stable = conflict-free + orthogonal to the universal
  --       test = conflict-free + all-attacking.
  --------------------------------------------------------------------

  -- Orthogonality forces all-attacking (no decidability needed).
  orth→allatt : ∀ {E} → Orth E → AllAttacking E
  orth→allatt orth {b} b∉E with orth b
  ... | inj₁ b∈E    = ⊥-elim (b∉E b∈E)
  ... | inj₂ counter = counter

  -- All-attacking gives orthogonality (uses decidable membership).
  allatt→orth : ∀ {E} → AllAttacking E → Orth E
  allatt→orth {E} aa b with mem-dec E b
  ... | inj₁ b∈E = inj₁ b∈E
  ... | inj₂ b∉E = inj₂ (aa b∉E)

  stable⇔cf×orth : ∀ {E} → Stable E ⇔ (ConflictFree E × Orth E)
  stable⇔cf×orth =
      (λ { (cf , aa)   → cf , allatt→orth aa })
    , (λ { (cf , orth) → cf , orth→allatt orth })

  --------------------------------------------------------------------
  -- §1.3  Clause 2 — Admissibility is interactive (one-shot), no descent.
  --
  -- Every stable extension is admissible: the committed all-attacking set
  -- supplies each member's defense in ONE round (the would-be attacker is
  -- either in E — impossible by conflict-freedom — or already countered).
  -- This is exactly T015's "no PRO-no-repeat trap" (clause 5 cannot arise
  -- for the committed reading).
  --------------------------------------------------------------------

  stable→admissible : ∀ {E} → Stable E → Admissible E
  stable→admissible {E} (cf , aa) = cf , defends
    where
    defends : ∀ {x} → x ∈ E → Defends E x
    defends {x} x∈E {y} y⇝x with mem-dec E y
    ... | inj₁ y∈E = ⊥-elim (cf y∈E x∈E y⇝x)
    ... | inj₂ y∉E = aa y∉E

  -- The empty extension is admissible — so a preferred extension always
  -- exists (the skeptical-preferred guard is sound).
  ∅E : Ext
  ∅E _ = false

  ∅-admissible : Admissible ∅E
  ∅-admissible = (λ a∈∅ _ _ → a∈∅) , (λ x∈∅ → ⊥-elim x∈∅)

  --------------------------------------------------------------------
  -- §1.4  Clause 3 — Preferred = the ⊆-maximal admissible sets.
  --------------------------------------------------------------------

  infix 4 _⊆_
  _⊆_ : Ext → Ext → Set
  E ⊆ E' = ∀ {a} → a ∈ E → a ∈ E'

  Preferred : Ext → Set
  Preferred E = Admissible E × (∀ E' → Admissible E' → E ⊆ E' → E' ⊆ E)

  preferred→admissible : ∀ {E} → Preferred E → Admissible E
  preferred→admissible = proj₁

------------------------------------------------------------------------
-- §2.  Clause 4 — Maximality is non-interactive (the no-go), on the
--      canonical witness: a ↔ b with c isolated.
--
-- {c} and {a,c} are BOTH conflict-free and defend every member (both pass
-- every per-attacker defense test), yet {c} ⊊ {a,c}, so {c} is admissible
-- but not preferred.  No per-pair orthogonality verdict separates them —
-- only the global ⊆-relation does.  Maximality is a selection.
------------------------------------------------------------------------

module NoGo where

  data A4 : Set where a b c : A4

  -- a ⇝ b, b ⇝ a (a ↔ b); c attacks nothing and is unattacked.
  _⇝4_ : A4 → A4 → Set
  a ⇝4 a = ⊥
  a ⇝4 b = ⊤
  a ⇝4 c = ⊥
  b ⇝4 a = ⊤
  b ⇝4 b = ⊥
  b ⇝4 c = ⊥
  c ⇝4 _ = ⊥

  open AF A4 _⇝4_

  -- {c} and {a, c}.
  Ec : Ext
  Ec a = false
  Ec b = false
  Ec c = true

  Eac : Ext
  Eac a = true
  Eac b = false
  Eac c = true

  -- {c} is admissible (conflict-free; c has no attacker, defends vacuous).
  Ec-cf : ConflictFree Ec
  Ec-cf {a} {_} () _ _
  Ec-cf {b} {_} () _ _
  Ec-cf {c} {a} _ () _
  Ec-cf {c} {b} _ () _
  Ec-cf {c} {c} _ _ ()

  Ec-admissible : Admissible Ec
  Ec-admissible = Ec-cf , defends
    where
    defends : ∀ {x} → x ∈ Ec → Defends Ec x
    defends {a} ()
    defends {b} ()
    defends {c} _ {a} ()
    defends {c} _ {b} ()
    defends {c} _ {c} ()

  -- {a, c} is admissible: conflict-free, and a is defended (its only
  -- attacker b is countered by the committed a ⇝ b).
  Eac-cf : ConflictFree Eac
  Eac-cf {a} {a} _ _ ()
  Eac-cf {a} {b} _ () _
  Eac-cf {a} {c} _ _ ()
  Eac-cf {b} {_} () _ _
  Eac-cf {c} {a} _ _ ()
  Eac-cf {c} {b} _ () _
  Eac-cf {c} {c} _ _ ()

  Eac-admissible : Admissible Eac
  Eac-admissible = Eac-cf , defends
    where
    defends : ∀ {x} → x ∈ Eac → Defends Eac x
    defends {a} _ {a} ()
    defends {a} _ {b} _ = a , tt , tt    -- attacker b countered by a ⇝ b
    defends {a} _ {c} ()
    defends {b} ()
    defends {c} _ {a} ()
    defends {c} _ {b} ()
    defends {c} _ {c} ()

  -- {c} ⊊ {a, c}: contained, properly (a ∈ {a,c}, a ∉ {c}).
  Ec⊆Eac : Ec ⊆ Eac
  Ec⊆Eac {a} ()
  Ec⊆Eac {b} ()
  Ec⊆Eac {c} _ = tt

  a∈Eac : a ∈ Eac
  a∈Eac = tt

  a∉Ec : ¬ (a ∈ Ec)
  a∉Ec ()

  -- The no-go: {c} is admissible but NOT preferred — an admissible proper
  -- superset exists, and only the global ⊆ distinguishes them.
  Ec-not-preferred : ¬ (Preferred Ec)
  Ec-not-preferred (_ , maximal) =
    a∉Ec (maximal Eac Eac-admissible Ec⊆Eac {a} a∈Eac)

  -- …whereas {a, c} IS preferred-eligible (admissible); the witness pair
  -- (Ec-admissible , Eac-admissible , Ec⊆Eac) is the realizability gap.

------------------------------------------------------------------------
-- §3.  Clause 5 — Boundary: grounded descent ≠ stable, on the 2-cycle.
--
-- a ↔ b.  {a} is stable, but a is NOT defended by ∅, so the grounded
-- least-fixpoint descent from ∅ never admits a (grounded(a↔b) = ∅).  The
-- commit-set reading accepts {a}; the PRO-no-repeat descent does not.
------------------------------------------------------------------------

module Boundary where

  data A2 : Set where a b : A2

  _⇝2_ : A2 → A2 → Set
  a ⇝2 a = ⊥
  a ⇝2 b = ⊤
  b ⇝2 a = ⊤
  b ⇝2 b = ⊥

  open AF A2 _⇝2_

  -- {a}.
  Ea : Ext
  Ea a = true
  Ea b = false

  Ea-cf : ConflictFree Ea
  Ea-cf {a} {a} _ _ ()
  Ea-cf {a} {b} _ () _
  Ea-cf {b} {_} () _ _

  Ea-allatt : AllAttacking Ea
  Ea-allatt {a} a∉Ea = ⊥-elim (a∉Ea tt)
  Ea-allatt {b} _     = a , tt , tt      -- b is attacked by the committed a

  Ea-stable : Stable Ea
  Ea-stable = Ea-cf , Ea-allatt

  -- a is in the stable extension {a}…
  a∈Ea : a ∈ Ea
  a∈Ea = tt

  -- …but a is not defended by ∅: its attacker b has no counter in ∅, so
  -- the grounded descent (built upward from ∅) cannot admit a.
  a-not-defended-by-∅ : ¬ (Defends ∅E a)
  a-not-defended-by-∅ d with d {b} tt
  ... | (_ , e∈∅ , _) = e∈∅              -- e ∈ ∅ ≡ ⊥

  -- The boundary, packaged: a is stable-accepted yet grounded-rejected.
  boundary : (a ∈ Ea) × ¬ (Defends ∅E a)
  boundary = a∈Ea , a-not-defended-by-∅
