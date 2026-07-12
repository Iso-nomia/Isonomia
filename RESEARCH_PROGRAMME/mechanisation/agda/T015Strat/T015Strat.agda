------------------------------------------------------------------------
-- T015-Strat — The ⊕-resolution ↔ strategy game isomorphism: the full
--              (branching) preferred dispute game verdict is realized by a
--              winning ⊕-resolution.  Upgrades T015's one-shot reading
--              (handoff item 2).
--
-- T015 settled the stable + preferred-admissibility branch via the
-- ONE-SHOT reading (LB1): acceptance decided by a commit-set + a single
-- round of orthogonality per attacker, asserting `∃ρ` without exhibiting
-- the full game strategy.  Its honest residual (T015 §Scope, C011): a
-- `⊕`-resolution-vs-strategy isomorphism for the GENERAL (branching)
-- preferred game.  This file mechanises that isomorphism.
--
-- THE GAME (faithful to lib/bridge/dispute.ts `interact` + disputeAdditive
-- `buildAdditiveDisputeDesign`).  The dispute is an alternating AND-OR
-- tree over the AF:
--   • CON node  (`con`)  — the opponent's EXTERNAL `&`-choice of attack
--     line: PRO must answer EVERY attacker (an AND / ∀ node).  `con []` =
--     CON stuck → PRO plays the daimon † → CONVERGENT, PRO WINS.
--   • PRO node  (`pro`)  — the proponent's INTERNAL `⊕`-choice of defence:
--     PRO needs SOME winning counter (an OR / ∃ node).  `pro []` = PRO
--     stuck → DIVERGENT, PRO LOSES.
-- The full-game verdict `wins` is the AND-OR fixpoint (Modgil–Caminada
-- preferred / credulous game): `wins (con gs) = ⋀ wins gs`,
-- `wins (pro gs) = ⋁ wins gs`.
--
-- A `⊕`-RESOLUTION = a PRO STRATEGY = a choice of one child at every PRO
-- node together with a resolution of every CON child (the type `Res g`).
-- `evalRes` follows a fixed resolution (the one-shot reading: commit to the
-- chosen defence, conjoin over the answered attacks).  THE ISOMORPHISM:
--
--   strategy-iso :  wins g ≡ true  ⇔  Σ (r : Res g). evalRes r ≡ true
--
-- the branching game verdict (an `∃` over strategies, hidden inside the
-- AND-OR `⋁`) is realized by a CONCRETE winning `⊕`-resolution, and
-- conversely.  `Res` IS the strategy type, so the "isomorphism" is the
-- identity on the shared choice-function type; the content is the
-- verdict-correspondence — the one-shot `∃ρ` upgraded to a full-tree
-- strategy.  n-unbounded: arbitrary finite game trees.
--
-- WHAT THIS IS NOT.  It does NOT re-derive Modgil–Caminada ADEQUACY (that
-- this game equals the Dung preferred extensions) — that stays cited
-- (C011 bibliography); here the game tree is the abstract object and the
-- theorem is the strategy-realization of its verdict.  The `&`/`⊕`
-- placement faithfulness to ⟦·⟧₊ is human review (disputeAdditive.ts).
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T015Strat/T015Strat.agda`.
-- Evidence under the Theorem Register policy (T015 is established).
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T015Strat.T015Strat where

open import Data.Bool using (Bool; true; false; _∧_; _∨_)
open import Data.List using (List; []; _∷_)
open import Data.Product using (Σ; Σ-syntax; _,_; proj₁; proj₂; _×_)
open import Data.Sum using (_⊎_; inj₁; inj₂)
open import Data.Empty using (⊥)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl)

open import T012.T012 using (_⇔_)

------------------------------------------------------------------------
-- §1.  The alternating AND-OR dispute game and its verdict.
------------------------------------------------------------------------

data Game : Set where
  pro : List Game → Game   -- PRO to move (⊕ / OR);  pro []  = PRO stuck (loses)
  con : List Game → Game   -- CON to move (& / AND); con []  = CON stuck (PRO wins)

-- The full-game verdict (PRO wins): ⋁ over PRO's defences, ⋀ over CON's
-- attacks.  Mutually recursive with the list folds so the clauses reduce.
wins : Game → Bool
anyW allW : List Game → Bool

wins (pro gs) = anyW gs
wins (con gs) = allW gs

anyW []       = false
anyW (g ∷ gs) = wins g ∨ anyW gs

allW []       = true
allW (g ∷ gs) = wins g ∧ allW gs

------------------------------------------------------------------------
-- §2.  ⊕-resolutions = PRO strategies.
--
-- A resolution commits PRO to ONE child at each PRO node (`pickHere` /
-- `pickThere` select the defence), and resolves EVERY CON child
-- (`conAll`/`AllRes`).  `pro []` has no resolution (PRO stuck); `con []`
-- has the trivial resolution `conAll []` (CON stuck, PRO daimon).
------------------------------------------------------------------------

data Res    : Game → Set
data AllRes : List Game → Set

data Res where
  pickHere  : ∀ {g gs} → Res g          → Res (pro (g ∷ gs))
  pickThere : ∀ {g gs} → Res (pro gs)   → Res (pro (g ∷ gs))
  conAll    : ∀ {gs}   → AllRes gs       → Res (con gs)

data AllRes where
  []  : AllRes []
  _∷_ : ∀ {g gs} → Res g → AllRes gs → AllRes (g ∷ gs)

-- Evaluate a fixed resolution (the one-shot reading: commit to the chosen
-- defence; conjoin the verdicts of the answered attacks).
evalRes : ∀ {g}  → Res g    → Bool
evalAll : ∀ {gs} → AllRes gs → Bool

evalRes (pickHere r)  = evalRes r
evalRes (pickThere r) = evalRes r
evalRes (conAll rs)   = evalAll rs

evalAll []       = true
evalAll (r ∷ rs) = evalRes r ∧ evalAll rs

------------------------------------------------------------------------
-- §3.  Boolean glue.
------------------------------------------------------------------------

∨-elim : ∀ {a b} → a ∨ b ≡ true → (a ≡ true) ⊎ (b ≡ true)
∨-elim {true}  _ = inj₁ refl
∨-elim {false} p = inj₂ p

∨-introˡ : ∀ {a b} → a ≡ true → a ∨ b ≡ true
∨-introˡ refl = refl

∨-introʳ : ∀ {a b} → b ≡ true → a ∨ b ≡ true
∨-introʳ {a = true}  _    = refl
∨-introʳ {a = false} refl = refl

∧-elim : ∀ {a b} → a ∧ b ≡ true → (a ≡ true) × (b ≡ true)
∧-elim {true} {true} _ = refl , refl

∧-intro : ∀ {a b} → a ≡ true → b ≡ true → a ∧ b ≡ true
∧-intro refl refl = refl

------------------------------------------------------------------------
-- §4.  The isomorphism: the game verdict is realized by a winning
--      ⊕-resolution, and conversely.
------------------------------------------------------------------------

-- Soundness: PRO winning the full game yields a concrete winning strategy.
sound    : ∀ g  → wins g ≡ true → Σ[ r  ∈ Res g    ] (evalRes r  ≡ true)
soundAny : ∀ gs → anyW gs ≡ true → Σ[ r  ∈ Res (pro gs) ] (evalRes r ≡ true)
soundAll : ∀ gs → allW gs ≡ true → Σ[ rs ∈ AllRes gs ] (evalAll rs ≡ true)

sound (pro gs) p = soundAny gs p
sound (con gs) p with soundAll gs p
... | rs , e = conAll rs , e

soundAny (g ∷ gs) p with ∨-elim p
... | inj₁ wg  with sound g wg
...   | r , e = pickHere r , e
soundAny (g ∷ gs) p | inj₂ wgs with soundAny gs wgs
...   | r , e = pickThere r , e

soundAll []       _ = [] , refl
soundAll (g ∷ gs) p with ∧-elim p
... | wg , wgs with sound g wg | soundAll gs wgs
...   | r , er | rs , ers = (r ∷ rs) , ∧-intro er ers

-- Completeness: a winning strategy proves PRO wins the full game.
complete    : ∀ g  → Σ[ r  ∈ Res g    ] (evalRes r  ≡ true) → wins g ≡ true
completePro : ∀ gs → (r  : Res (pro gs)) → evalRes r  ≡ true → anyW gs ≡ true
completeAll : ∀ gs → (rs : AllRes gs)    → evalAll rs ≡ true → allW gs ≡ true

complete (pro gs) (r , e)        = completePro gs r e
complete (con gs) (conAll rs , e) = completeAll gs rs e

completePro (g ∷ gs) (pickHere r)  e = ∨-introˡ (complete g (r , e))
completePro (g ∷ gs) (pickThere r) e = ∨-introʳ (completePro gs r e)

completeAll []       []       _ = refl
completeAll (g ∷ gs) (r ∷ rs) p with ∧-elim p
... | er , ers = ∧-intro (complete g (r , er)) (completeAll gs rs ers)

-- THE ISOMORPHISM.
strategy-iso : ∀ g → (wins g ≡ true) ⇔ (Σ[ r ∈ Res g ] (evalRes r ≡ true))
strategy-iso g = sound g , complete g

------------------------------------------------------------------------
-- §5.  Worked dispute games (non-vacuity + the win/lose boundary).
------------------------------------------------------------------------

module Worked where

  -- PRO asserts; CON has one attack; PRO has a counter whose own attacker
  -- is already used, so CON is then stuck (daimon).  PRO WINS.
  g-win : Game
  g-win = con (pro (con [] ∷ []) ∷ [])

  win-verdict : wins g-win ≡ true
  win-verdict = refl

  -- …and the strategy-iso exhibits the winning ⊕-resolution.
  win-strategy : Σ[ r ∈ Res g-win ] (evalRes r ≡ true)
  win-strategy = proj₁ (strategy-iso g-win) win-verdict

  -- PRO asserts; CON attacks; PRO has NO counter → PRO stuck.  PRO LOSES,
  -- and there is NO winning strategy (Res (pro []) is uninhabited).
  g-lose : Game
  g-lose = con (pro [] ∷ [])

  lose-verdict : wins g-lose ≡ true → ⊥
  lose-verdict ()

  no-strategy : ¬ (Σ[ r ∈ Res g-lose ] (evalRes r ≡ true))
  no-strategy (conAll (() ∷ _) , _)
