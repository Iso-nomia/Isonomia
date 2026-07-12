------------------------------------------------------------------------
-- hott.Smoke — cubical toolchain smoke-test (M5 scaffolding)
--
-- Direction 5, M5 (the HoTT scheme proof-of-concept).  This file exists
-- only to confirm the segregated cubical tree builds: `--cubical` is on,
-- the cubical library (cubical-0.8, matched to Agda 2.7.0.1) resolves, and
-- univalence (`ua`) is importable.  It is NOT M5 content — the Expert-
-- Opinion scheme type lives in a sibling module.
--
-- This tree is DELIBERATELY SEGREGATED from the `--safe --without-K`
-- `ludics/` corpus: `mesh-hott.agda-lib` depends on `cubical-0.8`, and
-- `mesh-substrate.agda-lib` must NEVER depend on it.  The two type-theory
-- regimes (cubical vs --without-K) cannot share a module.
--
-- Build (from mechanisation/agda/hott): `agda Smoke.agda`.
------------------------------------------------------------------------

{-# OPTIONS --cubical #-}

module Smoke where

open import Cubical.Foundations.Prelude using (_≡_; refl)
open import Cubical.Foundations.Equiv using (_≃_; idEquiv)
open import Cubical.Foundations.Univalence using (ua)

-- `ua` turns an equivalence into a path: the univalence primitive M5 needs.
-- Smoke witness: the identity equivalence on a type yields a path A ≡ A.
ua-id : ∀ {ℓ} (A : Set ℓ) → A ≡ A
ua-id A = ua (idEquiv A)
