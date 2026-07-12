------------------------------------------------------------------------
-- T012-End2End — closing item 1's self-contained portion: the full
--                pipeline from ASPIC+ structured arguments through
--                STRUCTURALLY-DERIVED attack types to the Reading-C
--                ⋀-lift + re-typing, composed end-to-end.
--
-- The two structured increments of handoff item 1 are wired together:
--
--   T012Aspic : structured argument TREES (premises / strict+defeasible
--               rules / conclusions over contrariness) with the three
--               ASPIC+ attack types DERIVED from structure (`typeOf`);
--   T012Struct: the Reading-C ⋀-aggregation lifted VERBATIM to structured
--               witnesses (clauses 1/2/4) + full mid-proof re-typing
--               (`retype-neutral`), parametric in the per-pair verdict.
--
-- Here `swOf` turns ANY structural attack (`T012Aspic.Attacks`) into a
-- T012Struct witness whose `atype` is the DERIVED `typeOf` of the attack,
-- and the worked instance feeds a behaviour of genuine ASPIC+ attacks
-- (undermine / rebut / undercut, derived from the `T012Aspic.Witness`
-- arguments) through the Reading-C development: the verdict (`rc`) and full
-- re-typing neutrality (`rc-retyped`) hold on the DERIVED witnesses, and
-- the derived attack types are confirmed (`derived-*`).
--
-- This closes the self-contained portion of item 1: the attack-type label
-- T012Struct consumed is no longer opaque — it is computed from argument
-- structure, end-to-end.  The ONE remaining (blocked) piece is deriving
-- T012Struct's `conv-pol-sym` from a kernel ⟦·⟧₊ model, which needs Ludics
-- substrate polarity re-typing that does not yet exist (Action.polarity is
-- static); §4/§4' of T012Aspic already classify WHERE that symmetry is
-- structural (rebut) vs. load-bearing (undermine/undercut).
--
-- Status: type-checks WITHOUT POSTULATES OR HOLES.
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.
-- Build (from mechanisation/agda): `agda T012End2End/T012End2End.agda`.
-- Evidence under the Theorem Register policy.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module T012End2End.T012End2End where

open import Data.List using (List; []; _∷_)
open import Data.List.Relation.Unary.All using (All; []; _∷_)
open import Data.Sum using (inj₁; inj₂)
open import Data.Product using (proj₁)
open import Data.Unit using (⊤; tt)
open import Data.Bool using (true; false)
open import Relation.Binary.PropositionalEquality using (_≡_; refl)

import T012Aspic.T012Aspic  as A
import T012Struct.T012Struct as S

------------------------------------------------------------------------
-- §1.  The derived-type bridge: ASPIC+ attack type → witness attack type.
------------------------------------------------------------------------

-- The two `AType`s share the three constructors; the map is the identity
-- on tags, making the provenance explicit.
atypeMap : A.AType → S.AType
atypeMap A.rebut     = S.rebut
atypeMap A.undercut  = S.undercut
atypeMap A.undermine = S.undermine

------------------------------------------------------------------------
-- §2.  The worked end-to-end instance over the `T012Aspic.Witness` theory.
------------------------------------------------------------------------

module W = A.Witness
open A.Core W.F0 W._⌣0_ using (Attacks; typeOf)

-- A structured witness from a structural attack: derive the attack TYPE
-- (`typeOf`), choose a read-polarity.  This is the general pipeline step.
-- (`typeOf`'s endpoints are threaded explicitly — `Attacks` unfolds past
-- `subs`/`prems`, so they are not inferable from the attack alone.)
swOf : ∀ {X Y} → S.Pol → Attacks X Y → S.SW
swOf {X} {Y} p att = S.sw (atypeMap (typeOf {X} {Y} att)) p

-- Three structured witnesses built from genuine ASPIC+ attacks — the
-- `atype` of each is DERIVED from the argument structure, not stipulated.
-- (The arg endpoints are passed explicitly: `Attacks` unfolds past `subs`/
-- `prems`, so the implicits are not inferable from the attack alone.)
w-undermine : S.SW
w-undermine = swOf {W.A} {W.B} S.P (inj₁ W.A-undermines-B)

w-rebut : S.SW
w-rebut = swOf {W.B} {W.A} S.P (inj₂ (inj₁ W.B-rebuts-A))

w-undercut : S.SW
w-undercut = swOf {W.U} {W.A} S.P (inj₂ (inj₂ W.U-undercuts-A))

-- …and the derived attack types are exactly the three ASPIC+ types.
derived-undermine : S.SW.atype w-undermine ≡ S.undermine
derived-undermine = refl

derived-rebut : S.SW.atype w-rebut ≡ S.rebut
derived-rebut = refl

derived-undercut : S.SW.atype w-undercut ≡ S.undercut
derived-undercut = refl

------------------------------------------------------------------------
-- §3.  The Reading-C development applies to the DERIVED behaviour.
--
-- A behaviour = a list of structured witnesses built from real attacks.
-- Through T012Struct's symmetric model (`S.Models`), the Reading-C verdict
-- and full mid-proof re-typing neutrality hold on it — end-to-end, with
-- the attack types derived in §2.  (fidelity / nesting-invariant /
-- conservativity are equally available, being the same `ReadingC`.)
------------------------------------------------------------------------

behaviour : List S.SW
behaviour = w-undermine ∷ w-rebut ∷ w-undercut ∷ []

-- The Reading-C verdict on the derived behaviour.
rc : S.Models.RC tt behaviour
rc = tt ∷ tt ∷ tt ∷ []

-- Full mid-proof re-typing (flip the polarities of the undermine and
-- undercut witnesses, keep the rebut) preserves the verdict — on the
-- derived structured behaviour.
rc-retyped : S.Models.RC tt (S.Models.retypeSched (true ∷ false ∷ true ∷ []) behaviour)
rc-retyped = proj₁ (S.Models.retype-neutral tt (true ∷ false ∷ true ∷ []) behaviour) rc
