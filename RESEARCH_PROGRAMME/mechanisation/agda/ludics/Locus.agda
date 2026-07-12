------------------------------------------------------------------------
-- ludics.Locus — the Direction-2 fusion: locus-returning interaction
--
-- Direction 5 (mechanization), session 09 / Q-046, the highest-leverage
-- next step after M3 (ludics/Separation.agda).  This is the bridge that
-- turns the *named* Direction-2 minimal-locus obligation of Separation.agda
-- §6(B) into mechanised content, by giving interaction a FIRST-DIVERGENCE
-- LOCUS and tying it to the already-mechanised T006 / T008 / T009 results
-- on the SAME `Locus = List ℕ` model.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS PROVED
-- ─────────────────────────────────────────────────────────────────────
--   * `interactL : ℕ → Design → Design → Status × Maybe Locus` — the
--     interaction loop, now also returning the divergence-locus candidate
--     (the engine `stepCore`'s `divergenceLocus`).
--   * PROJECTION LAW `proj₁ ∘ interactL ≡ interact` (`interactL-proj`):
--     the status component is byte-for-byte M1's `interact`, so the locus
--     is pure extra information — it never perturbs the verdict.  This is
--     the faithfulness guarantee promised in the M3 gating verdict.
--   * FUEL-MONOTONICITY OF THE PAIR (`interactL-mono-≤`): a decided
--     interactL outcome — status AND locus together — is stable under more
--     fuel.  Hence the divergence locus, once seen, never changes.
--   * FIRST-DIVERGENCE LOCUS, UNIQUE & STABLE (`divLocus-stable`,
--     `divLocus-unique`): this is T006's E0 — the first address at which a
--     non-orthogonal pair ceases to match — now mechanised over the
--     constitutive `interact`.  `ℓ : Locus = List ℕ` is *literally* the
--     T008/T009 locus object, so the extracted locus feeds their minimality
--     theorems with no translation.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT IS NAMED, NOT PROVED — the eventual-decidedness obligation (§5)
-- ─────────────────────────────────────────────────────────────────────
-- To turn "¬ (D ⊥ E)" into "∃ ℓ, the pair diverges at ℓ" one needs that a
-- finite pair LEAVES `ONGOING` within bounded fuel.  This is TRUE but its
-- proof is the substantive step flagged in the M3 gating verdict (2026-06-
-- 09); §5 states it precisely and identifies the genuine crux — a
-- PIGEONHOLE on the provider used-set — together with why the naive
-- cursor-measure fails.  It is left as the next obligation under Q-046, in
-- the same discipline T009 used to park `O-faithful`; it is NOT postulated.
--
-- Tested against: Agda 2.7.0.1, agda-stdlib v2.0.  Type-checks under
-- `--safe --without-K` WITH NO POSTULATES OR HOLES.
-- Build (from mechanisation/agda): `agda ludics/Locus.agda`.
------------------------------------------------------------------------

{-# OPTIONS --without-K --safe #-}

module ludics.Locus where

open import Data.Nat using (ℕ; zero; suc; _+_; _≤_; z≤n; s≤s; _≤″_; less-than-or-equal)
open import Data.Nat.Properties using (+-identityʳ; +-suc; ≤⇒≤″; ≤-total)
open import Data.List using (List; []; _∷_)
open import Data.Product using (_×_; _,_; proj₁; proj₂; ∃-syntax)
open import Data.Sum using (inj₁; inj₂)
open import Data.Maybe using (Maybe; just; nothing)
open import Data.Maybe.Properties using (just-injective)
open import Data.Empty using (⊥-elim)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; cong; subst)

open import ludics.Core
open import ludics.Interaction using (Decided; conv; div; stuck; no-dec-ONGOING)

------------------------------------------------------------------------
-- §1.  Locus-returning interaction
--
-- `loopL` runs exactly `loop`'s control flow (the SAME `with step1 D E st`),
-- but on a DECIDING step it also reads off `divLocus1 D E st` — the locus of
-- the offending positive (the engine `divergenceLocus`).  On CONVERGENT /
-- STUCK / no-locus-DIVERGENT that candidate is `nothing`, faithfully.
------------------------------------------------------------------------

loopL : Design → Design → ℕ → St → Status × Maybe Locus
loopL _ _ zero    _  = ONGOING , nothing
loopL D E (suc f) st with step1 D E st
... | done s   = s , divLocus1 D E st
... | cont st′ = loopL D E f st′

interactL : ℕ → Design → Design → Status × Maybe Locus
interactL fuel D E = loopL D E fuel (mkSt LHS 0 0 [] [])

-- The first-divergence locus, as a thin projection (engine `divergenceLocusOf`).
divergenceLocusOf : ℕ → Design → Design → Maybe Locus
divergenceLocusOf n D E = proj₂ (interactL n D E)

------------------------------------------------------------------------
-- §2.  Projection law:  proj₁ ∘ interactL ≡ interact
--
-- The status component of `interactL` is the M1 `interact` on the nose:
-- both scrutinise the same `step1 D E st`, so the locus is pure extra
-- information that never perturbs the verdict.  This is the faithfulness
-- the M3 gating verdict promised.
------------------------------------------------------------------------

loopL-proj : ∀ D E f st → proj₁ (loopL D E f st) ≡ loop D E f st
loopL-proj D E zero    st = refl
loopL-proj D E (suc f) st with step1 D E st
... | done s   = refl
... | cont st′ = loopL-proj D E f st′

interactL-proj : ∀ n D E → proj₁ (interactL n D E) ≡ interact n D E
interactL-proj n D E = loopL-proj D E n (mkSt LHS 0 0 [] [])

------------------------------------------------------------------------
-- §3.  Fuel-monotonicity of the (status , locus) pair
--
-- The M2 monotonicity argument, replayed for `loopL`: a decided outcome —
-- the WHOLE pair, status and locus — is preserved by more fuel.  So once
-- the divergence locus appears, it is fixed.
------------------------------------------------------------------------

loopL-mono : ∀ D E f {st r} → Decided (proj₁ r)
           → loopL D E f st ≡ r → loopL D E (suc f) st ≡ r
loopL-mono D E zero    {st} {r} dec eq =
  ⊥-elim (no-dec-ONGOING (subst Decided (cong proj₁ (sym eq)) dec))   -- loopL _ _ 0 _ = (ONGOING , _)
loopL-mono D E (suc f) {st} dec eq with step1 D E st
... | done s   = eq
... | cont st′ = loopL-mono D E f dec eq

interactL-mono-suc : ∀ D E n {r} → Decided (proj₁ r)
                   → interactL n D E ≡ r → interactL (suc n) D E ≡ r
interactL-mono-suc D E n dec eq = loopL-mono D E n dec eq

add-fuelL : ∀ D E n k {r} → Decided (proj₁ r)
          → interactL n D E ≡ r → interactL (n + k) D E ≡ r
add-fuelL D E n zero    dec eq rewrite +-identityʳ n = eq
add-fuelL D E n (suc k) dec eq rewrite +-suc n k =
  interactL-mono-suc D E (n + k) dec (add-fuelL D E n k dec eq)

interactL-mono-≤ : ∀ D E {n m r} → n ≤ m → Decided (proj₁ r)
                 → interactL n D E ≡ r → interactL m D E ≡ r
interactL-mono-≤ D E {n} n≤m dec eq with ≤⇒≤″ n≤m
... | less-than-or-equal {k} refl = add-fuelL D E n k dec eq

------------------------------------------------------------------------
-- §4.  The first-divergence locus (T006's E0), unique and stable
--
-- `DivergesAt n D E ℓ` says the run, at fuel `n`, diverges with first-
-- divergence locus `ℓ`.  Because DIVERGENT is a decided status, §3 makes ℓ
-- STABLE under more fuel, and determinacy makes it UNIQUE across all fuels.
-- `ℓ : Locus = List ℕ` is exactly the T008/T009 object, so this is the E0
-- those theorems prove minimal.
------------------------------------------------------------------------

DivergesAt : ℕ → Design → Design → Locus → Set
DivergesAt n D E ℓ = interactL n D E ≡ (DIVERGENT , just ℓ)

-- Stability: a divergence verdict (with its locus) survives more fuel.
divLocus-stable : ∀ {n m D E ℓ} → n ≤ m → DivergesAt n D E ℓ → DivergesAt m D E ℓ
divLocus-stable {n} {m} {D} {E} {ℓ} n≤m dn = interactL-mono-≤ D E n≤m div dn

-- Pair-equality on a divergence outcome collapses to locus-equality.
loc-eq : ∀ {ℓ ℓ′ : Locus}
       → (DIVERGENT , just ℓ) ≡ (DIVERGENT , just ℓ′) → ℓ ≡ ℓ′
loc-eq p = just-injective (cong proj₂ p)

-- Uniqueness: the first-divergence locus does not depend on the fuel.
divLocus-unique : ∀ {n m D E ℓ ℓ′}
                → DivergesAt n D E ℓ → DivergesAt m D E ℓ′ → ℓ ≡ ℓ′
divLocus-unique {n} {m} {D} {E} dn dm with ≤-total n m
... | inj₁ n≤m = loc-eq (trans (sym (divLocus-stable n≤m dn)) dm)
... | inj₂ m≤n = sym (loc-eq (trans (sym (divLocus-stable m≤n dm)) dn))

------------------------------------------------------------------------
-- §5.  The eventual-decidedness obligation  (named, not postulated)
--
-- To upgrade "¬ (D ⊥ E)" to "∃ ℓ, DivergesAt _ D E ℓ" one needs:
--
--   eventually-decided :
--     ∀ D E → Σ[ N ∈ ℕ ] (proj₁ (interactL N D E) ≢ ONGOING)
--
-- This is TRUE for finite designs, by the following measure — and the
-- measure is the whole content, so it is recorded here rather than faked:
--
--   * NAIVE CURSOR MEASURE FAILS.  One might try
--     (length D ∸ curA) + (length E ∸ curB).  It does NOT decrease: a
--     match consults `findNextNegativeAtLocus`, which searches ALL provider
--     acts FROM 0 (engine: "search ALL acts … not just from cursor"), so
--     the provider cursor can jump BACKWARD.  The producer cursor advances,
--     but the provider's does not, so the sum is not monotone.
--
--   * THE CORRECT MEASURE — provider used-set growth.  Each `cont` step
--     records the matched O-act's index in the provider used-set
--     (`advance`: nIdx ∷ usedB / nIdx ∷ usedA), and `scanNeg` SKIPS used
--     indices (`not (memᵇ ix used)`).  So every step consumes a DISTINCT,
--     previously-absent provider index, and every such index is `< length`
--     of that provider.  Hence
--         #cont-steps  ≤  |O-acts D| + |O-acts E|  ≤  length D + length E,
--     and the run is decided within fuel `length D + length E + 1`.
--
--   * THE GENUINE CRUX is the PIGEONHOLE: a list of pairwise-distinct
--     indices all `< L` has length `≤ L`.  Mechanising it (an invariant
--     "usedB is duplicate-free and bounded by length E", carried through
--     `loopL`, discharged by stdlib `Data.List.Relation.Unary.Unique` +
--     a counting lemma) is the next obligation under Q-046 — the analogue
--     of the per-line antichain bound T009 already carries.
--
-- Once `eventually-decided` is in hand, combine with M2 stability and the
-- projection law: a non-orthogonal pair is eventually DIVERGENT or STUCK;
-- on DIVERGENT, §4 hands back the unique stable locus.  Nothing above this
-- line depends on it, so the framework stands and the obligation is sharp.
------------------------------------------------------------------------

------------------------------------------------------------------------
-- §6.  Non-vacuity — extraction fires, and the locus is a T009 object
------------------------------------------------------------------------

-- The bare positive `p0 ∷ []` diverges at the root locus ℓ0 = 0 ∷ [] (a
-- Proponent P-act with no Opponent dual).  The pair, the projection, and
-- the extracted locus are all checked by `refl`.
ex-divL : interactL 1 (p0 ∷ []) [] ≡ (DIVERGENT , just ℓ0)
ex-divL = refl

-- The status component agrees with M1's `interact` (= the ex-div of Core).
ex-projL : proj₁ (interactL 1 (p0 ∷ []) []) ≡ interact 1 (p0 ∷ []) []
ex-projL = interactL-proj 1 (p0 ∷ []) []

-- The first-divergence locus, extracted: ℓ0 : List ℕ — LITERALLY the T009
-- `Locus` (segment-wise prefix model of `separation.ts` / T009/T009.agda),
-- so it feeds T009's `maximalLoci` antichain with no translation.
ex-divergenceLocus : divergenceLocusOf 1 (p0 ∷ []) [] ≡ just ℓ0
ex-divergenceLocus = refl

-- The locus is stable under more fuel: the SAME ℓ0 at fuel 4 (no recompute).
ex-divL-stable : DivergesAt 4 (p0 ∷ []) []  ℓ0
ex-divL-stable = divLocus-stable {1} {4} {p0 ∷ []} {[]} {ℓ0} (s≤s z≤n) ex-divL
