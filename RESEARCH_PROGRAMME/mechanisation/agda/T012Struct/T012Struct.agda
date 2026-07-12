------------------------------------------------------------------------
-- T012-Struct — Reading-C conservativity lifted to STRUCTURED (ASPIC+)
--               witnesses, with full mid-proof polarity RE-TYPING (not
--               merely branch-reorder).  A partial increment of handoff
--               item 1 (T012 ASPIC+/structured-`B`).
--
-- T012 (abstract AF) established that multi-agent Reading C = the
-- conjunction `⋀ᵢ` of bilateral pairs, invariant under nesting and under a
-- branch-REORDER shift, for all `|W|`.  Two honest limits were carried:
--   • abstract AF only (witnesses are opaque CON tests);
--   • the shift is a reorder of the witness schedule, NOT a genuine
--     mid-proof polarity re-typing (Dung edges are polarity/type-free, so
--     abstract AF could hide it).
-- This file addresses both, on the structured fragment:
--
--   (A) THE ⋀-AGGREGATION LIFTS VERBATIM.  Structured witnesses carry an
--       ASPIC+ attack TYPE (rebut / undercut / undermine, per
--       lib/aspic/attacks.ts) and a read-POLARITY.  Instantiating T012's
--       `ReadingC` at the structured witness type re-uses the SAME
--       `⋀`-algebra: `fidelity`, `nesting-invariant`, `conservativity`
--       (and the permutation `shift-neutral`) hold for structured
--       witnesses with no new proof — the aggregation is transparent to
--       argument structure.  This is the "lift past abstract AF".
--
--   (B) FULL MID-PROOF RE-TYPING.  A polarity re-typing flips the read-
--       polarity of a witness (an INVOLUTION, `retype1`).  `retype-neutral`
--       proves Reading C is invariant under an ARBITRARY per-witness
--       re-typing schedule `bs : List Bool` — strictly stronger than
--       T012's permutation shift (it changes polarities, not just order).
--       It rides on ONE parameter, `conv-pol-sym`: the per-pair verdict is
--       symmetric under read-polarity reflection — the inherited Ludics
--       cut-symmetry (interaction/orthogonality is symmetric in the two
--       designs).  `retype-then` composes re-typing with any further
--       verdict-equivalence (e.g. the permutation shift), so the full
--       clause-3 symmetry group = reorder ∘ re-type.
--
--   (C) THE PARAMETER IS NON-VACUOUS (honest scope).  For the SYMMETRIC
--       fragment (rebut / any polarity-blind verdict) `conv-pol-sym` holds
--       structurally (`Sym` model).  For an ASYMMETRIC, polarity-SENSITIVE
--       verdict (undercut/undermine) it can FAIL: `conv-pol-sym-fails`
--       exhibits a concrete `convAsym` with `convAsym ρ w` but not
--       `convAsym ρ (retype1 w)`.  So full re-typing genuinely RIDES ON the
--       substrate orthogonality-symmetry for the asymmetric attack types —
--       exactly the content abstract AF could not see.
--
-- WHAT THIS IS NOT.  It does NOT close item 1: the structured argument is
-- modelled only by its attack type + polarity (not full premise/rule/
-- conclusion trees), `conv-pol-sym` is asserted not derived from a kernel
-- model, and the `&`=∀ reading is inherited from T015.  It is the first
-- mechanised increment: the verbatim ⋀-lift + the re-typing clause with
-- its load-bearing symmetry isolated and shown non-trivial.
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T012Struct/T012Struct.agda`.
-- Evidence under the Theorem Register policy (T012 is established).
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T012Struct.T012Struct where

open import Data.Product using (_×_; _,_; proj₁; proj₂)
open import Data.List using (List; []; _∷_)
open import Data.List.Relation.Unary.All using (All; []; _∷_)
open import Data.Bool using (Bool; true; false)
open import Data.Empty using (⊥)
open import Relation.Nullary using (¬_)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; cong)

-- Re-use the abstract-AF ⋀-algebra: the equivalence combinators and the
-- whole `ReadingC` development (fidelity / nesting / shift / conservativity).
open import T012.T012 using (_⇔_; ⇔-refl; ⇔-sym; ⇔-trans; module ReadingC)

------------------------------------------------------------------------
-- §1.  Structured (ASPIC+) witnesses: an attack type and a read-polarity.
--
-- The three ASPIC+ attack types (Modgil & Prakken 2013; lib/aspic/attacks.ts):
--   rebut     — attacks a defeasible CONCLUSION (symmetric: contrary
--               conclusions, both defeasible);
--   undercut  — attacks a defeasible RULE  (asymmetric);
--   undermine — attacks an ordinary PREMISE (asymmetric).
-- A read-polarity P/O records which side the witness is read as; a
-- mid-proof re-typing flips it.
------------------------------------------------------------------------

data AType : Set where
  rebut undercut undermine : AType

data Pol : Set where
  P O : Pol

flipPol : Pol → Pol
flipPol P = O
flipPol O = P

flipPol-invol : ∀ p → flipPol (flipPol p) ≡ p
flipPol-invol P = refl
flipPol-invol O = refl

record SW : Set where
  constructor sw
  field
    atype : AType
    pol   : Pol

-- Re-typing a single witness: flip its read-polarity (an involution).
retype1 : SW → SW
retype1 (sw t p) = sw t (flipPol p)

retype1-invol : ∀ w → retype1 (retype1 w) ≡ w
retype1-invol (sw t p) = cong (sw t) (flipPol-invol p)

------------------------------------------------------------------------
-- §2.  The structured Reading-C development.
------------------------------------------------------------------------

module Struct
  (Resolution : Set)
  (convS : Resolution → SW → Set)
  -- (C) load-bearing PARAMETER: the per-pair verdict is symmetric under a
  -- read-polarity reflection — the inherited Ludics cut/orthogonality
  -- symmetry.  Non-vacuous: it FAILS for polarity-sensitive verdicts
  -- (`conv-pol-sym-fails`, §3); it HOLDS for the symmetric fragment (§3).
  (conv-pol-sym : ∀ ρ w → convS ρ w ⇔ convS ρ (retype1 w))
  where

  --------------------------------------------------------------------
  -- (A) The ⋀-aggregation lifts VERBATIM: instantiate T012's ReadingC at
  -- the structured witness type.  `fidelity`, `nesting-invariant`,
  -- `shift-neutral` (permutation), `conservativity`, `Accept-↭`,
  -- `Accept-drop`, `RC`, `Bilat`, … are now available for STRUCTURED
  -- witnesses with no new proof — the aggregation ignores argument
  -- structure.
  --------------------------------------------------------------------

  open ReadingC Resolution SW convS public

  --------------------------------------------------------------------
  -- (B) Full mid-proof polarity re-typing.
  --------------------------------------------------------------------

  -- Re-type a witness list along a per-witness schedule (`true` = flip the
  -- read-polarity of that witness, `false` = leave it).  A genuine
  -- mid-proof re-typing: any subset of the witnesses changes polarity.
  -- (Matching the witness list first keeps the empty cases reducing for a
  -- variable schedule.)
  retypeSched : List Bool → W → W
  retypeSched _           []       = []
  retypeSched []          (w ∷ ws) = w ∷ ws
  retypeSched (true  ∷ bs) (w ∷ ws) = retype1 w ∷ retypeSched bs ws
  retypeSched (false ∷ bs) (w ∷ ws) = w         ∷ retypeSched bs ws

  -- Re-typing neutrality: Reading C is invariant under ANY re-typing
  -- schedule.  At each flipped position `conv-pol-sym` converts the
  -- branch verdict; the conjunction is preserved pointwise.  This is the
  -- full clause 3 — strictly stronger than the permutation `shift-neutral`.
  retype-neutral : ∀ ρ bs (w : W) → RC ρ w ⇔ RC ρ (retypeSched bs w)
  retype-neutral ρ (true ∷ bs) (w ∷ ws) =
    let h = conv-pol-sym ρ w
        t = retype-neutral ρ bs ws
    in (λ { (pw ∷ pws) → proj₁ h pw ∷ proj₁ t pws })
     , (λ { (pw ∷ pws) → proj₂ h pw ∷ proj₂ t pws })
  retype-neutral ρ (false ∷ bs) (w ∷ ws) =
    let t = retype-neutral ρ bs ws
    in (λ { (pw ∷ pws) → pw ∷ proj₁ t pws })
     , (λ { (pw ∷ pws) → pw ∷ proj₂ t pws })
  retype-neutral ρ []      (w ∷ ws) = ⇔-refl
  retype-neutral ρ bs      []       = ⇔-refl

  -- Compose re-typing with ANY further verdict-equivalence — in
  -- particular the permutation `shift-neutral` from T012.  Hence the full
  -- clause-3 symmetry group is generated by reorder ∘ re-type.
  retype-then : ∀ ρ bs (w : W) {v : W}
              → RC ρ (retypeSched bs w) ⇔ RC ρ v → RC ρ w ⇔ RC ρ v
  retype-then ρ bs w r = ⇔-trans (retype-neutral ρ bs w) r

------------------------------------------------------------------------
-- §3.  Non-vacuity and the honesty witness (C).
------------------------------------------------------------------------

module Models where

  open import Data.Unit using (⊤; tt)

  -- Symmetric model: the verdict is polarity-blind (the `rebut`/symmetric
  -- fragment), so `conv-pol-sym` holds STRUCTURALLY.
  convSym : ⊤ → SW → Set
  convSym _ _ = ⊤

  conv-pol-sym-holds : ∀ ρ w → convSym ρ w ⇔ convSym ρ (retype1 w)
  conv-pol-sym-holds _ _ = ⇔-refl

  -- The structured development is inhabited (clauses (A) + re-typing (B)
  -- all available on this model).
  open Struct ⊤ convSym conv-pol-sym-holds public

  -- A convergent structured deliberation and its re-typing both accept.
  ex-RC : RC tt (sw rebut P ∷ sw undercut O ∷ [])
  ex-RC = tt ∷ tt ∷ []

  ex-retyped : RC tt (retypeSched (true ∷ true ∷ []) (sw rebut P ∷ sw undercut O ∷ []))
  ex-retyped = proj₁ (retype-neutral tt (true ∷ true ∷ []) _) ex-RC

  -- Asymmetric model: a polarity-SENSITIVE verdict (an undercut converges
  -- only when read with polarity P).  `conv-pol-sym` then FAILS — so full
  -- re-typing is NOT automatic for the asymmetric attack types; it
  -- genuinely rides on the substrate cut-symmetry.
  convAsym : ⊤ → SW → Set
  convAsym _ (sw undercut P) = ⊤
  convAsym _ (sw undercut O) = ⊥
  convAsym _ _               = ⊤

  conv-pol-sym-fails : ¬ (∀ ρ w → convAsym ρ w ⇔ convAsym ρ (retype1 w))
  conv-pol-sym-fails h with h tt (sw undercut P)
  ... | (to , _) = to tt    -- to : ⊤ → ⊥ (convAsym _ (sw undercut O) = ⊥)
