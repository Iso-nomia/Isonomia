------------------------------------------------------------------------
-- ludics.Core — the constitutive Ludics core (M1: interaction defined)
--
-- Direction 5 (mechanization), session 09 steps M0–M1.
--
--   M0 (2026-06-09) fixed the carrier (audit
--       RESEARCH_PROGRAMME/audits/m0-design-carrier-ludics-core-2026-06-09.md):
--       Design = List Act mirroring the engine `CoreAct[]`
--       (packages/ludics-engine/stepCore.ts), Locus = List ℕ (the T009 /
--       separation.ts model), interaction FUEL-INDEXED and TOTAL.
--
--   M1 (2026-06-09) DEFINES `interact` by fuel-recursion, faithfully
--       transcribing the MULTIPLICATIVE fragment of the engine loop
--       `stepCore`.  The M0 `postulate interact` is DISCHARGED and `--safe`
--       is RESTORED: this file is now part of the safe corpus.
--
-- WHAT IS MODELLED (the multiplicative finite fragment, audit §4):
--   * `findNextPositive` — from the producer's cursor, the next DAIMON or
--     PROPER-P act.
--   * `findNextNegativeAtLocus` — search ALL of the provider's acts for an
--     unused PROPER-O act at the EQUAL locus (match-by-equal-address, the
--     T009 rule `findNextNegativeAtLocus`).
--   * the alternating A·B handshake (producer/provider swap each match,
--     both cursors advance), and the four-way status
--     CONVERGENT / DIVERGENT / STUCK / ONGOING.
--   * Orthogonality read off exactly as checkOrthogonal.ts does it
--     (`orthogonal = status === 'CONVERGENT'`):
--         D ⊥ E  :=  ∃ n, interact n D E ≡ CONVERGENT.
--
-- WHAT IS DELIBERATELY OUT OF M1 (audit §4 scope cuts; the `additive` field
-- is kept on the carrier but NOT read here):
--   * the additive fragment (isAdditive / usedAdditive / additive-violation)
--     — staged between M2 and M3 (branching parity, Q-039);
--   * the consensus testers (virtualNegPaths / drawAt / consensus-draw)
--     — a bridge-layer feature, never the abstract interaction;
--   * the focus / phase gate (phase / focusAt / allowInPhase)
--     — optional, post-M4.
-- Excluding these is why the only DIVERGENT cause here is an unmatched
-- positive (the engine's `incoherent-move`); the others cannot arise.
--
-- The engine tracks "already-used" O-acts by act `id`; the pure model has
-- no ids, so the no-reuse discipline is recovered STRUCTURALLY by a set of
-- used provider INDICES (`usedA` / `usedB`).  Since A and B are distinct
-- lists, two index sets are equivalent to the engine's single id set.
--
-- §6 factors the single-step decision into `step1 : … → Step` so that the
-- loop is a plain iterator; this is purely so the M2 theorems
-- (ludics/Interaction.agda) are structural.  `interact` is unchanged.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/Core.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.Core where

open import Data.Nat using (ℕ; zero; suc; _≡ᵇ_)
open import Data.List using (List; []; _∷_; drop)
open import Data.Bool using (Bool; true; false; if_then_else_; _∧_; _∨_; not)
open import Data.Maybe using (Maybe; just; nothing)
open import Data.Product using (_×_; _,_; ∃-syntax)
open import Relation.Binary.PropositionalEquality using (_≡_; refl)

------------------------------------------------------------------------
-- §1.  Loci
--
-- A locus is its dot-path, taken segment-wise: "0.1.2" ↦ 0 ∷ 1 ∷ 2 ∷ [].
-- Identical to T009's `Locus` and to separation.ts's segment model.  The
-- prefix order `_⊑_` lives in the separation work (T009/T009.agda); the
-- core needs only the carrier and EQUALITY of loci (the match-by-equal-
-- address rule), realised by the boolean `locEqᵇ`.
------------------------------------------------------------------------

Locus : Set
Locus = List ℕ

-- Boolean equality on loci (segment-wise on List ℕ).
locEqᵇ : Locus → Locus → Bool
locEqᵇ []       []       = true
locEqᵇ []       (_ ∷ _)  = false
locEqᵇ (_ ∷ _)  []       = false
locEqᵇ (x ∷ xs) (y ∷ ys) = (x ≡ᵇ y) ∧ locEqᵇ xs ys

------------------------------------------------------------------------
-- §2.  Acts and designs  (carrier = engine `CoreAct`, minus `id`)
------------------------------------------------------------------------

-- Polarity: the engine's 'P' | 'O' | 'daimon'.
data Polarity : Set where
  P O daimon : Polarity

-- Kind: the engine's 'PROPER' | 'DAIMON'.  A DAIMON act is the
-- convergence witness (reaching it ⇒ CONVERGENT).
data Kind : Set where
  PROPER DAIMON : Kind

-- An act is exactly the structural subset the interaction loop reads.
-- `locus` is `Maybe` because the engine's DAIMON acts carry no locus;
-- `additive` mirrors `isAdditive` (kept on the carrier but NOT read in M1).
record Act : Set where
  constructor act
  field
    kind     : Kind
    polarity : Polarity
    locus    : Maybe Locus
    additive : Bool
open Act public

-- A design is a list of acts (engine: `CoreAct[]`).
Design : Set
Design = List Act

------------------------------------------------------------------------
-- §3.  Interaction outcome  (engine `StepResult.status`)
------------------------------------------------------------------------

data Status : Set where
  CONVERGENT DIVERGENT STUCK ONGOING : Status

------------------------------------------------------------------------
-- §4.  Finders  (the two `stepCore` helpers, multiplicative fragment)
------------------------------------------------------------------------

-- An act `findNextPositive` will return: a DAIMON, or a PROPER P-act.
posOrDaimonᵇ : Act → Bool
posOrDaimonᵇ (act DAIMON _      _ _) = true
posOrDaimonᵇ (act PROPER P      _ _) = true
posOrDaimonᵇ (act PROPER O      _ _) = false
posOrDaimonᵇ (act PROPER daimon _ _) = false

-- An act `findNextNegativeAtLocus` will match: a PROPER O-act.
properOᵇ : Act → Bool
properOᵇ (act PROPER O      _ _) = true
properOᵇ (act PROPER P      _ _) = false
properOᵇ (act PROPER daimon _ _) = false
properOᵇ (act DAIMON _      _ _) = false

-- Does this (negative) act sit at the locus we are matching?
locMatchᵇ : Maybe Locus → Locus → Bool
locMatchᵇ nothing  _   = false
locMatchᵇ (just l) loc = locEqᵇ l loc

-- Boolean membership of an index in a used-set.
memᵇ : ℕ → List ℕ → Bool
memᵇ _ []       = false
memᵇ x (y ∷ ys) = (x ≡ᵇ y) ∨ memᵇ x ys

-- `findNextPositive from acts` — scan from absolute index `from` for the
-- first DAIMON or PROPER-P act, returning its index and the act.  Realised
-- by dropping the first `from` and scanning with the index seeded at `from`,
-- so absolute indices are preserved (`drop`-then-offset).
scanPos : ℕ → List Act → Maybe (ℕ × Act)
scanPos _  []       = nothing
scanPos ix (a ∷ as) = if posOrDaimonᵇ a then just (ix , a) else scanPos (suc ix) as

findNextPositive : ℕ → Design → Maybe (ℕ × Act)
findNextPositive from acts = scanPos from (drop from acts)

-- `findNextNegativeAtLocus loc used acts` — search ALL acts (from 0) for the
-- first unused PROPER-O act at the equal locus.  Mirrors the engine comment
-- "search ALL acts … not just from cursor"; `used` carries the indices
-- already consumed as duals.
scanNeg : Locus → List ℕ → ℕ → List Act → Maybe ℕ
scanNeg _   _    _  []       = nothing
scanNeg loc used ix (a ∷ as) =
  if (properOᵇ a ∧ (locMatchᵇ (locus a) loc ∧ not (memᵇ ix used)))
  then just ix
  else scanNeg loc used (suc ix) as

findNextNegativeAtLocus : Locus → List ℕ → Design → Maybe ℕ
findNextNegativeAtLocus loc used acts = scanNeg loc used 0 acts

------------------------------------------------------------------------
-- §5.  Traversal state and the alternating handshake
--
-- `side` says which design is currently the PRODUCER of positives; the
-- other is the PROVIDER of duals.  Both cursors advance on every match
-- (the producer's past its positive, the provider's past the dual), and
-- the dual's index is recorded in the provider's used-set.
------------------------------------------------------------------------

data Side : Set where
  LHS RHS : Side

record St : Set where
  constructor mkSt
  field
    side : Side
    curA curB : ℕ
    usedA usedB : List ℕ

-- Producer / provider views (side = LHS ⇒ producer is D, provider is E).
producerActs : Design → Design → St → Design
producerActs D _ (mkSt LHS _ _ _ _) = D
producerActs _ E (mkSt RHS _ _ _ _) = E

providerActs : Design → Design → St → Design
providerActs _ E (mkSt LHS _ _ _ _) = E
providerActs D _ (mkSt RHS _ _ _ _) = D

prodCursor : St → ℕ
prodCursor (mkSt LHS cA _  _ _) = cA
prodCursor (mkSt RHS _  cB _ _) = cB

-- The provider's used-set (LHS produces ⇒ provider is B/E ⇒ `usedB`).
providerUsed : St → List ℕ
providerUsed (mkSt LHS _ _ _  uB) = uB
providerUsed (mkSt RHS _ _ uA _ ) = uA

-- Advance after a match at producer-index `pIdx`, provider-index `nIdx`:
-- both cursors step past, the dual index joins the provider's used-set,
-- and the side flips.
advance : St → ℕ → ℕ → St
advance (mkSt LHS _ _ uA uB) pIdx nIdx = mkSt RHS (suc pIdx) (suc nIdx) uA         (nIdx ∷ uB)
advance (mkSt RHS _ _ uA uB) pIdx nIdx = mkSt LHS (suc nIdx) (suc pIdx) (nIdx ∷ uA) uB

------------------------------------------------------------------------
-- §6.  The interaction loop  (fuel-recursive transcription of stepCore)
------------------------------------------------------------------------

-- One interaction step, as an explicit decision: either it DECIDES the run
-- now (`done s`) or it yields the next state (`cont st'`).  Factoring the
-- single-step logic out of `loop` is what makes the determinacy / fuel-
-- monotonicity theorems (ludics/Interaction.agda, step M2) STRUCTURAL —
-- `loop` becomes a plain `step1`-iterator with a single recursive call.
data Step : Set where
  done : Status → Step
  cont : St → Step

-- The body of one engine `for`-iteration (multiplicative fragment):
--   * no next positive             ⇒ done STUCK   (engine `no-response`)
--   * next positive is a DAIMON     ⇒ done CONVERGENT
--   * PROPER-P with no locus        ⇒ done DIVERGENT (cannot match)
--   * PROPER-P, no dual O at locus  ⇒ done DIVERGENT (engine `incoherent-move`)
--   * PROPER-P matched              ⇒ cont (advanced state)
step1 : Design → Design → St → Step
step1 D E st with findNextPositive (prodCursor st) (producerActs D E st)
... | nothing         = done STUCK
... | just (pIdx , a) with kind a
...   | DAIMON = done CONVERGENT
...   | PROPER with locus a
...     | nothing  = done DIVERGENT
...     | just loc with findNextNegativeAtLocus loc (providerUsed st) (providerActs D E st)
...       | nothing   = done DIVERGENT
...       | just nIdx = cont (advance st pIdx nIdx)

-- The DIVERGENCE LOCUS CANDIDATE of one step: the locus of the offending
-- positive at the moment `step1` decides DIVERGENT via an unmatched positive
-- (the engine `stepCore`'s `divergenceLocus`, set on the `incoherent-move`
-- break).  `nothing` in every other case, INCLUDING the no-locus DIVERGENT
-- (the engine's `p` is then `undefined`).  Mirrors `step1`'s case analysis on
-- the nose, so it is read off the SAME scrutinees — see `ludics/Locus.agda`.
divLocus1 : Design → Design → St → Maybe Locus
divLocus1 D E st with findNextPositive (prodCursor st) (producerActs D E st)
... | nothing         = nothing
... | just (_ , a) with kind a
...   | DAIMON = nothing
...   | PROPER with locus a
...     | nothing  = nothing
...     | just loc with findNextNegativeAtLocus loc (providerUsed st) (providerActs D E st)
...       | nothing   = just loc
...       | just _    = nothing

-- Iterate `step1` for at most `fuel` steps; exhausted fuel ⇒ ONGOING.
loop : Design → Design → ℕ → St → Status
loop _ _ zero    _  = ONGOING
loop D E (suc f) st with step1 D E st
... | done s   = s
... | cont st' = loop D E f st'

-- `interact fuel D E` — run ⟨D ∣ E⟩ from the initial state (D produces
-- first, both cursors at 0, nothing used) for at most `fuel` alternations.
-- This is the M0 signature, now DEFINED.
interact : ℕ → Design → Design → Status
interact fuel D E = loop D E fuel (mkSt LHS 0 0 [] [])

------------------------------------------------------------------------
-- §7.  Orthogonality  (engine: `orthogonal = status === 'CONVERGENT'`)
--
-- `_⊥_` is a real DEFINITION (only `interact` carried any content): two
-- designs are orthogonal iff their interaction converges to a daimon within
-- SOME fuel budget — the faithful reading of "run to quiescence".  This is
-- the relation M4 feeds into lib/Closure.agda's `Biorthogonal` to obtain
-- `B = B^⊥⊥` for designs.
------------------------------------------------------------------------

infix 4 _⊥_

_⊥_ : Design → Design → Set
D ⊥ E = ∃[ n ] interact n D E ≡ CONVERGENT

------------------------------------------------------------------------
-- §8.  Non-vacuity — the function computes, and each status is reachable
--
-- Concrete designs over locus ℓ0 = 0 ∷ [] ("0"), checked by `refl`, so the
-- definition is not vacuously satisfiable and the four statuses are all
-- genuinely produced.
------------------------------------------------------------------------

ℓ0 : Locus
ℓ0 = 0 ∷ []

p0 : Act              -- a PROPER Proponent act at locus "0"
p0 = act PROPER P (just ℓ0) false

o0 : Act              -- a PROPER Opponent act at locus "0"
o0 = act PROPER O (just ℓ0) false

dai : Act             -- the daimon
dai = act DAIMON daimon nothing false

-- STUCK: no positive to play.
ex-stuck : interact 1 [] [] ≡ STUCK
ex-stuck = refl

-- CONVERGENT (trivial): Proponent plays † immediately.
ex-conv-trivial : interact 1 (dai ∷ []) [] ≡ CONVERGENT
ex-conv-trivial = refl

-- DIVERGENT: a Proponent positive with no Opponent dual at its locus.
ex-div : interact 1 (p0 ∷ []) [] ≡ DIVERGENT
ex-div = refl

-- CONVERGENT (handshake): P@0 matches O@0, then Opponent plays † on its turn.
-- Exercises the alternation, the equal-address match, and both cursors.
ex-conv-handshake : interact 2 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ CONVERGENT
ex-conv-handshake = refl

-- ONGOING: a real handshake is pending but the fuel budget is 0.
ex-ongoing : interact 0 (p0 ∷ []) (o0 ∷ dai ∷ []) ≡ ONGOING
ex-ongoing = refl

-- The handshake pair is orthogonal (∃ fuel, converges).  Witness: 2.
ex-orth : (p0 ∷ []) ⊥ (o0 ∷ dai ∷ [])
ex-orth = 2 , refl
