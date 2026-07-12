------------------------------------------------------------------------
-- ludics.DaimonOrientation — L3 of Session 20 (Diairesis cross-test):
--   Risk 2 — is convergence-to-daimon definable WITHOUT a directed
--   reduction, purely from the symmetric Player/Opponent structure?
--
-- Direction: cross-program.  Serves Diairesis `q013-approach.md` §2–§3 —
-- the DECISIVE remaining check on Q-B (the arrow): the live "third horn"
-- candidate is "interactive *generation*" of orientation from symmetric
-- materials.  Session 20
-- (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/20-ludics-diairesis-crosstest.md),
-- step L3.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT RISK 2 ASKS (Session 20 §3, and the L3-scope sharpening)
-- ─────────────────────────────────────────────────────────────────────
-- A Risk-2 escape would need a characterisation of `D ⊥ E` that is
-- (i) static (no reduction), (ii) symmetric (no privileged direction), and
-- (iii) daimon-free or with an EMERGENT (not posited) daimon.  If such a
-- characterisation existed, ludics would GENERATE orientation from
-- symmetric P/O materials → a genuine interactive tertium → the dilemma's
-- third horn opens → the arrow is reducible.  Predicted: impossible.
--
-- The L3 decomposition (Session 20 §3): convergence needs three things, and
-- the symmetry supplies only the first —
--   (1) the P/O duality (two swappable sides) — by Q-016 this is
--       duality/morphism-directedness, NOT the arrow (symmetric-capable);
--   (2) the reduction order (the "toward" of normalisation) — L1: imported,
--       the ℕ-index is its visible form;
--   (3) the daimon † as the TERMINAL — convergence *is* reaching †; "reach"
--       is intrinsically directed and † is the orientation point.
-- Orientation is carried by (2)+(3); the symmetric interaction gives only
-- the two sides, never which way the interaction resolves.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS ESTABLISHED HERE (over the real M1 `interact`)
-- ─────────────────────────────────────────────────────────────────────
--   (P) THE DAIMON IS A POSITED TERMINAL, AND CONVERGENCE REQUIRES IT.
--       `no-daimon-no-conv` : if NEITHER design contains a daimon act, the
--       interaction never converges, at ANY fuel.  Convergence is therefore
--       not derivable from the symmetric PROPER-action (P/O) structure
--       alone; it needs the posited primitive † (a constructor of `Kind`,
--       not a derived notion).  This mechanises sub-check (3): the
--       orientation point is posited.
--
--   (U) THE DAIMON ORIENTS UNILATERALLY.  `dai-wins` : a producer that
--       plays † converges against EVERY opponent, at fuel 1 — the verdict
--       does not consult the other side.  So orientation flows from † ALONE,
--       not from the symmetric pair: the "which way it resolves" is fixed by
--       the terminal, independent of the opponent's design.
--
--   (A) THE OPERATIONAL RELATION IS DIRECTED, NOT SYMMETRIC.  `swap-LR` /
--       `swap-RL` : the SAME pair, at the SAME fuel 1, gives ONGOING one way
--       and CONVERGENT the other.  `interact` is producer-first by
--       construction; the symmetry of P/O is a modelling ideal that the
--       concrete convergence-definition does NOT rest on.  This is exactly
--       the Q-016 pattern: the symmetry is the duality; the orientation is
--       imported.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE VERDICT (headline; Diairesis report: L3-daimon-orientation-2026-06-26.md)
-- ─────────────────────────────────────────────────────────────────────
--   RISK 2 DOES NOT FIRE.  Convergence is not definable from the symmetric
--   structure without a directed terminal: (P) the daimon is required and
--   posited, (U) it orients unilaterally, (A) the operative relation is
--   producer-first, not symmetric.  The arrow enters ludics' *definition* of
--   convergence as the posited daimon (orientation) plus the reduction's
--   "toward" — Horn B at the DEFINITIONAL, not merely operational, level.
--   Q-B CLOSES at ludics: the arrow is imported, not generated.
--
--   STEELMAN (Roberts parallel): a Girardian may call the daimon's
--   orientation "constitutive of interaction itself" (primitive) rather than
--   "posited from outside".  That RELOCATES the irreducibility (posited →
--   primitive-constitutive) without making the arrow GENERATED from the
--   symmetric P/O materials — a primitive of the framework is still not
--   produced from the duality.  Either reading corroborates Horn B; they
--   differ only on the mode of the daimon's primitiveness (the same
--   posited-vs-primitive split the two physics arrow-stories already show).
--   No tertium either way.  This is the formalizable boundary; the
--   non-formalizable (T2) remainder stays R3-transcendental.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/DaimonOrientation.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.DaimonOrientation where

open import Data.Nat using (ℕ; zero; suc)
open import Data.List using (List; []; _∷_; drop)
open import Data.Bool using (Bool; true; false)
open import Data.Maybe using (Maybe; just; nothing)
open import Data.Product using (_,_; ∃-syntax; proj₁; proj₂)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; cong)

open import ludics.Core

------------------------------------------------------------------------
-- §1.  "Daimon-free": a design whose every act is a PROPER (non-†) move
--
-- The symmetric P/O *material* is exactly the proper actions; the daimon is
-- the one positive that is NOT part of that duality.  `NoDaimon D` says D is
-- built from the symmetric material alone — no posited terminal.
------------------------------------------------------------------------

data NoDaimon : Design → Set where
  nd[] : NoDaimon []
  nd∷  : ∀ {a as} → kind a ≡ PROPER → NoDaimon as → NoDaimon (a ∷ as)

PROPER≢DAIMON : ¬ (PROPER ≡ DAIMON)
PROPER≢DAIMON ()

-- NoDaimon is closed under dropping a prefix (the producer cursor advances
-- by `drop`-then-scan).
noDaimon-drop : ∀ n {D} → NoDaimon D → NoDaimon (drop n D)
noDaimon-drop zero    nd          = nd
noDaimon-drop (suc n) nd[]        = nd[]
noDaimon-drop (suc n) (nd∷ px nd) = noDaimon-drop n nd

-- The producer is always one of the two designs, so it stays daimon-free.
producer-noDaimon : ∀ {D E} st → NoDaimon D → NoDaimon E
                  → NoDaimon (producerActs D E st)
producer-noDaimon (mkSt LHS _ _ _ _) ndD ndE = ndD
producer-noDaimon (mkSt RHS _ _ _ _) ndD ndE = ndE

------------------------------------------------------------------------
-- §2.  In a daimon-free design, `findNextPositive` only finds PROPER acts
--
-- `findNextPositive` returns a DAIMON or a PROPER-P act.  Over daimon-free
-- material the DAIMON outcome is impossible: the act found is PROPER.  This
-- is the structural reason convergence cannot arise without a posited †.
------------------------------------------------------------------------

scanPos-PROPER : ∀ ix xs {i a} → NoDaimon xs
               → scanPos ix xs ≡ just (i , a) → kind a ≡ PROPER
scanPos-PROPER ix []       nd[]         ()
scanPos-PROPER ix (x ∷ xs) (nd∷ px nd) eq with posOrDaimonᵇ x
... | false = scanPos-PROPER (suc ix) xs nd eq
... | true with eq
...   | refl = px

findNextPositive-PROPER : ∀ from D {i a} → NoDaimon D
                        → findNextPositive from D ≡ just (i , a) → kind a ≡ PROPER
findNextPositive-PROPER from D nd eq =
  scanPos-PROPER from (drop from D) (noDaimon-drop from nd) eq

------------------------------------------------------------------------
-- §3.  (P) One step never converges without a daimon
--
-- `step1` returns `done CONVERGENT` ONLY in its `kind a ≡ DAIMON` branch.
-- Over daimon-free designs that branch is unreachable (§2), so a single
-- interaction step is never a convergence.
------------------------------------------------------------------------

step1-no-conv : ∀ D E st → NoDaimon D → NoDaimon E
              → ¬ (step1 D E st ≡ done CONVERGENT)
step1-no-conv D E st ndD ndE
  with findNextPositive (prodCursor st) (producerActs D E st) in eqFP
... | nothing = λ ()
... | just (pIdx , a) with kind a in eqK
...   | DAIMON = λ _ → PROPER≢DAIMON
                  (trans (sym (findNextPositive-PROPER (prodCursor st)
                                 (producerActs D E st)
                                 (producer-noDaimon st ndD ndE) eqFP))
                         eqK)
...   | PROPER with locus a
...     | nothing  = λ ()
...     | just loc with findNextNegativeAtLocus loc (providerUsed st) (providerActs D E st)
...       | nothing   = λ ()
...       | just nIdx = λ ()

------------------------------------------------------------------------
-- §4.  (P) The whole run never converges without a daimon
--
-- By induction on the fuel: every step is either a non-convergent decision
-- (§3) or a continuation onto the SAME two designs (the producer/provider
-- are always D, E), so daimon-freeness is preserved and the run can never
-- reach CONVERGENT.
------------------------------------------------------------------------

loop-no-conv : ∀ D E f st → NoDaimon D → NoDaimon E
             → ¬ (loop D E f st ≡ CONVERGENT)
loop-no-conv D E zero    st ndD ndE ()
loop-no-conv D E (suc f) st ndD ndE eq with step1 D E st in eqs
... | done s   = step1-no-conv D E st ndD ndE (trans eqs (cong done eq))
... | cont st′ = loop-no-conv D E f st′ ndD ndE eq

-- The constitutive statement: convergence requires the posited daimon.  No
-- pair built purely from the symmetric P/O material is orthogonal.
no-daimon-no-conv : ∀ D E → NoDaimon D → NoDaimon E → ¬ (D ⊥ E)
no-daimon-no-conv D E ndD ndE (n , eq) =
  loop-no-conv D E n (mkSt LHS 0 0 [] []) ndD ndE eq

------------------------------------------------------------------------
-- §5.  (U) The daimon orients UNILATERALLY
--
-- A producer that plays † converges against EVERY opponent, at fuel 1: the
-- verdict is read off the terminal alone and never consults the other side.
-- Orientation flows from †, not from the symmetric pair.
------------------------------------------------------------------------

dai-wins : ∀ E → interact 1 (dai ∷ []) E ≡ CONVERGENT
dai-wins E = refl

------------------------------------------------------------------------
-- §6.  (A) The operational relation is DIRECTED, not symmetric
--
-- The same pair, at the same fuel 1, converges one way and not the other:
-- `interact` is producer-first by construction.  The P/O symmetry is a
-- modelling ideal the convergence-definition does not rest on — the
-- orientation (producer→provider) is built in, exactly the Q-016 pattern.
------------------------------------------------------------------------

-- p0 produces first: the handshake is still pending at fuel 1 ⇒ ONGOING.
swap-LR : interact 1 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ ONGOING
swap-LR = refl

-- (o0 ∷ dai ∷ []) produces first: it reaches † at fuel 1 ⇒ CONVERGENT.
swap-RL : interact 1 (o0 ∷ dai ∷ []) (p0 ∷ []) ≡ CONVERGENT
swap-RL = refl

-- Hence `interact` is not symmetric in its design arguments.
interact-not-symmetric :
  ¬ (interact 1 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ interact 1 (o0 ∷ dai ∷ []) (p0 ∷ []))
interact-not-symmetric ()

------------------------------------------------------------------------
-- §7.  Non-vacuity — a concrete daimon-free, non-converging pair
--
-- Two designs built from PROPER material alone (no †): by §4 they are not
-- orthogonal, however the symmetric handshake proceeds.  The theorem is not
-- vacuous over the real `interact`-orthogonality.
------------------------------------------------------------------------

ex-no-daimon : ¬ ((p0 ∷ []) ⊥ (o0 ∷ []))
ex-no-daimon = no-daimon-no-conv (p0 ∷ []) (o0 ∷ [])
                 (nd∷ refl nd[]) (nd∷ refl nd[])
