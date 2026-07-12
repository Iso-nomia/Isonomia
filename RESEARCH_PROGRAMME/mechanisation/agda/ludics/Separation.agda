------------------------------------------------------------------------
-- ludics.Separation — M3: behavioural separation of designs
--
-- Direction 5 (mechanization), session 09 step M3 — the planned "crown",
-- fused with Direction 2 (separation / locus of disagreement).
--
-- ─────────────────────────────────────────────────────────────────────
-- ROUTE NOTE — why separation, and why it needs no composition
-- ─────────────────────────────────────────────────────────────────────
-- M2 (ludics/Interaction.agda) found that *associativity proper* is not
-- statable over the M1 `interact` without a COMPOSITION / cut operation
-- (designs → residual design), which M1 lacks; that obligation is parked
-- under Q-046.  Separation does NOT share that obstruction: Girard's
-- separation theorem is the statement that designs are distinguished by
-- their behaviour *under interaction* — and interaction-as-Status is
-- exactly what M1 provides.  So M3 proceeds directly over `interact`,
-- with no composition required.  This is also the Direction-2 deliverable
-- (separation as the locus-of-disagreement theorem) and the strongest
-- check on the minimality argument T006–T009 carry on paper.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS PROVED (the sound, constitutive core)
-- ─────────────────────────────────────────────────────────────────────
--   * The behaviour of a design, `Beh D = λ E → D ⊥ E`, and the
--     observational preorder `_≼_` / equivalence `_≈_` (orthogonal to the
--     same tests).  Preorder / equivalence laws.
--   * BEHAVIOURAL CHARACTERISATION via biorthogonality: instantiating the
--     already-built lib.Closure.Biorthogonal at `_⊥_` makes `Beh D` the
--     right polar `pol⁺ ⟨D⟩` of the design's singleton, so observational
--     equivalence is EXACTLY equality of polars, and the biorthogonal
--     closure `clo = (·)^⊥⊥` and the closed behaviours `Closed` are now
--     available over designs — the M4 object, delivered early.
--   * SOUNDNESS HALF of separation: structurally equal designs are
--     observationally equivalent (`≡⇒≈`); and the TESTING characterisation,
--     sound directions: a separating test refutes equivalence
--     (`separates⇒≉`) and equivalent designs admit none (`≈⇒no-separator`).
--   * Behaviour is FUEL-ROBUST (inherited from M2): membership in `Beh D`
--     holds at every budget past its witness — behaviour is a property of
--     the pair, not the fuel.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS NAMED, NOT PROVED (the deep half — obligations under Q-046)
-- ─────────────────────────────────────────────────────────────────────
--   * BÖHM / GIRARD SEPARATION PROPER: `≈ ⇒ structural equality of
--     incarnations`.  The easy half (`≡⇒≈`) is here; the hard half needs
--     INCARNATION (the material design), absent in M1.  Named, not assumed.
--   * THE DIRECTION-2 MINIMAL LOCUS: that a separating test's failure has a
--     determinate FIRST-DIVERGENCE locus, and that this locus is MINIMAL,
--     is exactly T008 / T009 — already mechanised on the SAME `Locus =
--     List ℕ` model (T009/T009.agda).  Bridging it here needs a locus-
--     returning interaction (`interact` exposes only `Status`; the engine's
--     `stepCore` also returns `divergenceLocus`).  Named as the fusion
--     point; see §6.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/Separation.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.Separation where

open import Data.Nat using (ℕ; zero; suc; _≤_; z≤n; s≤s)
open import Data.List using (List; []; _∷_)
open import Data.Product using (_×_; _,_; ∃-syntax; proj₁; proj₂)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; subst)

open import ludics.Core
open import ludics.Interaction
open import lib.Closure using (module Biorthogonal)

------------------------------------------------------------------------
-- §1.  Tests, behaviour, the observational preorder and equivalence
--
-- A TEST is a counter-design; the BEHAVIOUR of a design is the set of
-- tests it passes (is orthogonal to).  `D₁ ≼ D₂` says every test D₁ passes
-- D₂ also passes; `≈` is mutual `≼`.  (Implicit test argument so these
-- line up on the nose with the Powerset ⊆ / ≐ of lib.Closure.)
------------------------------------------------------------------------

Test : Set
Test = Design

Beh : Design → Test → Set
Beh D E = D ⊥ E

infix 4 _≼_ _≈_

_≼_ : Design → Design → Set
D₁ ≼ D₂ = ∀ {E} → D₁ ⊥ E → D₂ ⊥ E

_≈_ : Design → Design → Set
D₁ ≈ D₂ = (D₁ ≼ D₂) × (D₂ ≼ D₁)

-- Preorder laws for ≼.
≼-refl : ∀ {D} → D ≼ D
≼-refl p = p

≼-trans : ∀ {A B C} → A ≼ B → B ≼ C → A ≼ C
≼-trans f g p = g (f p)

-- Equivalence laws for ≈.
≈-refl : ∀ {D} → D ≈ D
≈-refl = ≼-refl , ≼-refl

≈-sym : ∀ {A B} → A ≈ B → B ≈ A
≈-sym (f , g) = g , f

≈-trans : ∀ {A B C} → A ≈ B → B ≈ C → A ≈ C
≈-trans (f , f') (g , g') = ≼-trans f g , ≼-trans g' f'

------------------------------------------------------------------------
-- §2.  Behavioural characterisation via biorthogonality  (the M4 preview)
--
-- Instantiate the already-built lib.Closure.Biorthogonal at the design
-- orthogonality `_⊥_`.  This is the constitutive `(·)^⊥⊥` over designs:
-- the right polar of a design's SINGLETON is precisely its behaviour, so
-- observational equivalence is equality of polars, and the closure `clo`
-- and the biorthogonally-closed behaviours `Closed` are now in scope —
-- exactly the object M4 was scheduled to deliver.
------------------------------------------------------------------------

module B = Biorthogonal Design Design _⊥_
open B using (pol⁺; pol⁻; clo; Closed)

-- The singleton predicate of a design (a Powerset Design subset).
⟨_⟩ : Design → (Design → Set)
⟨ D ⟩ D′ = D′ ≡ D

-- Behaviour IS the right polar of the singleton:  Beh D ≐ pol⁺ ⟨D⟩.
--   pol⁺ ⟨D⟩ E  =  ∀ {x} → x ≡ D → x ⊥ E
-- so passing E (D ⊥ E) and being in the polar are interderivable.
Beh→pol : ∀ {D E} → Beh D E → (pol⁺ ⟨ D ⟩) E
Beh→pol {D} {E} DE {x} x≡D = subst (λ z → z ⊥ E) (sym x≡D) DE

pol→Beh : ∀ {D E} → (pol⁺ ⟨ D ⟩) E → Beh D E
pol→Beh f = f refl

------------------------------------------------------------------------
-- §3.  ≈ is exactly equality of behaviours
--
-- The observational equivalence unfolds, on the nose, to mutual inclusion
-- of behaviour sets — i.e. equality of polars.  This is the behavioural
-- characterisation: two designs are observationally equal iff they pass
-- the same tests.
------------------------------------------------------------------------

≈→Beh⊆ : ∀ {A B} → A ≈ B → (∀ {E} → Beh A E → Beh B E)
≈→Beh⊆ (f , _) = f

≈→Beh⊇ : ∀ {A B} → A ≈ B → (∀ {E} → Beh B E → Beh A E)
≈→Beh⊇ (_ , g) = g

Beh≡→≈ : ∀ {A B}
        → (∀ {E} → Beh A E → Beh B E)
        → (∀ {E} → Beh B E → Beh A E)
        → A ≈ B
Beh≡→≈ f g = f , g

------------------------------------------------------------------------
-- §4.  Separation, sound half
--
-- (i) Structural equality ⇒ observational equivalence (the EASY half of
--     the separation theorem; the hard converse needs incarnation, §6).
-- (ii) The TESTING characterisation, sound directions: a test that one
--      design passes and the other fails refutes equivalence, and
--      equivalent designs admit no such test.
------------------------------------------------------------------------

-- (i)  ≡ ⇒ ≈.
≡⇒≈ : ∀ {A B} → A ≡ B → A ≈ B
≡⇒≈ refl = ≈-refl

-- A test E SEPARATES A and B when exactly one of them passes it.
Separates : Test → Design → Design → Set
Separates E A B = (A ⊥ E × ¬ (B ⊥ E)) ⊎ (B ⊥ E × ¬ (A ⊥ E))

-- (ii.a)  A separating test refutes observational equivalence.
separates⇒≉ : ∀ {E A B} → Separates E A B → ¬ (A ≈ B)
separates⇒≉ (inj₁ (A⊥E , ¬B⊥E)) (f , _) = ¬B⊥E (f A⊥E)
separates⇒≉ (inj₂ (B⊥E , ¬A⊥E)) (_ , g) = ¬A⊥E (g B⊥E)

-- (ii.b)  Equivalent designs admit no separating test.
≈⇒no-separator : ∀ {A B} → A ≈ B → ∀ {E} → ¬ (Separates E A B)
≈⇒no-separator A≈B sep = separates⇒≉ sep A≈B

------------------------------------------------------------------------
-- §5.  Behaviour is fuel-robust  (inherited from M2)
--
-- Membership in `Beh D` is "converges at SOME fuel"; M2's fuel-
-- monotonicity makes it "converges at EVERY budget past the witness".  So
-- behaviour — hence ≼, ≈, and the whole separation apparatus — is a
-- property of the design pair, not of the budget.
------------------------------------------------------------------------

Beh-eventually : ∀ {D E} → (DE : Beh D E)
               → ∀ {m} → proj₁ DE ≤ m → interact m D E ≡ CONVERGENT
Beh-eventually DE = ⊥-eventually DE

------------------------------------------------------------------------
-- §6.  The named obligations (the deep half — under Q-046)
--
-- (A)  BÖHM / GIRARD SEPARATION PROPER:  A ≈ B ⇒ |A| ≡ |B|, equality of
--      INCARNATIONS (material designs).  §4(i) gives the easy converse.
--      The hard direction needs an incarnation/material-design operation,
--      not present in M1.  Stated as the obligation, never assumed.
--
-- (B)  THE DIRECTION-2 MINIMAL LOCUS:  when `Separates E A B` via a failing
--      side (say ¬ (B ⊥ E)), the run ⟨B ∣ E⟩ does not converge; over the
--      finite fragment it is eventually DIVERGENT (or STUCK), and on
--      DIVERGENT it has a determinate FIRST-DIVERGENCE locus.  A SINGLE run's
--      locus is the E0 of T006, single-chronicle-minimal per T008; the
--      PER-LINE antichain of T009 (Smyth-least separating set) is assembled
--      by per-line runs fed to T009's already-mechanised order theory
--      (`maximalLoci`).  All three are multiplicative additive-free — the
--      same fragment as M1 — so the parked additive cut is NOT a dependency.
--      Bridging needs a locus-returning interaction (the engine's `stepCore`
--      returns both `status` and `divergenceLocus`; M1's `interact` returns
--      only `Status`): an `interactL : ℕ → Design → Design → Status × Maybe
--      Locus` with `proj₁ ∘ interactL ≡ interact`, plus an EVENTUAL-
--      DECIDEDNESS lemma for finite designs (the run leaves ONGOING within
--      fuel ≈ length A + length E — the substantive step, complementary to
--      M2's fuel-monotonicity).  The off-thread `O-faithful` gate stays
--      parked (as in T008/T009).  This is the concrete fusion step.
--
-- Both are tracked under Q-046; neither is used above.
------------------------------------------------------------------------

------------------------------------------------------------------------
-- §7.  Non-vacuity — the apparatus fires on real designs
------------------------------------------------------------------------

-- The Core handshake passes the test (o0 ∷ dai ∷ []); behaviour is
-- inhabited there, and fuel-robustness lifts the witness (2) to fuel 7.
ex-beh : Beh (p0 ∷ []) (o0 ∷ dai ∷ [])
ex-beh = ex-orth

ex-beh-up : interact 7 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ CONVERGENT
ex-beh-up = Beh-eventually {p0 ∷ []} {o0 ∷ dai ∷ []} ex-orth {7} (s≤s (s≤s z≤n))

-- A concrete, fully-constructive SEPARATION.  The empty test `[]`:
--   * is passed by `o0 ∷ dai ∷ []` (Opponent skipped, Proponent plays † at
--     once ⇒ CONVERGENT at fuel 1);
--   * is failed by the bare positive `p0 ∷ []` (a Proponent P-act with no
--     dual ⇒ DIVERGENT at every fuel ≥ 1, ONGOING at 0 — never CONVERGENT).
-- So `[]` separates the two designs, and they are NOT observationally
-- equivalent.  The failure is proved by absurd-pattern on the fuel: the run
-- is ONGOING (fuel 0) or DIVERGENT (fuel ≥ 1), neither CONVERGENT.
¬orth-bare : ¬ ((p0 ∷ []) ⊥ [])
¬orth-bare (zero  , ())
¬orth-bare (suc _ , ())

sep-[] : Separates [] (o0 ∷ dai ∷ []) (p0 ∷ [])
sep-[] = inj₁ ((1 , refl) , ¬orth-bare)

ex-not-≈ : ¬ ((o0 ∷ dai ∷ []) ≈ (p0 ∷ []))
ex-not-≈ = separates⇒≉ sep-[]

-- Reflexivity is genuinely inhabited (sanity: ≈ is not empty).
ex-≈-refl : (p0 ∷ []) ≈ (p0 ∷ [])
ex-≈-refl = ≈-refl
