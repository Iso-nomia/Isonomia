// lib/argumentation/logodds.ts
//
// Log-odds / weight-of-evidence confidence kernel.
//
// Phase 1 of the "Confidence algebra — log-odds semiring migration" track
// (RESEARCH_PROGRAMME/IMPLEMENTATION_TRACKS.md). Pure, dependency-free, and not
// yet wired into any caller — the lawful composition primitive that later phases
// route the evidential reducers through.
//
// The algebra (session 01, 2026-06-02): confidence composes by **addition in
// log-odds space**, the weight-of-evidence semiring's additive monoid
//
//     w(p) = log( p / (1 - p) )           (logit; the "weight of evidence")
//     p(w) = 1 / (1 + e^{-w})             (logistic; its inverse)
//
// Corroboration ⊕ is `+` in ℝ: associative, commutative, monotone, with identity
// w = 0 (⇔ p = 0.5, "no evidence"). A counter-argument is *negative* evidence, so
// pro/con combine as signed addition (w₊ − w₋). This is lawful, unbounded
// stacking — unlike the deprecated noisy-OR `product` reducer, which is not a
// semiring (× does not distribute over noisy-OR).
//
// Storage stays in [0,1] (schema decision, Option B): callers convert at the
// reducer boundary — `weight` on read, add in ℝ, `prob` on write/display.

/**
 * Clamp guard keeping `logit` finite at the probability extremes. With
 * `EPS = 1e-6`, `weight(0) ≈ -13.8` and `weight(1) ≈ +13.8` (both finite), and
 * the round-trip `prob(weight(p))` is accurate to well within 1e-6 for any
 * `p ∈ [EPS, 1 - EPS]`.
 */
export const EPS = 1e-6;

/** The weight-of-evidence identity: `w = 0` ⇔ `p = 0.5` ("no evidence"). */
export const NEUTRAL_WEIGHT = 0;

/** Clamp a probability into `[EPS, 1 - EPS]` so `logit` stays finite. */
export function clampProb(p: number): number {
  if (Number.isNaN(p)) return 0.5;
  return Math.max(EPS, Math.min(1 - EPS, p));
}

/**
 * Weight of evidence (logit): `[0,1] → ℝ`. Maps a confidence to its log-odds.
 * `weight(0.5) === 0`. Input is clamped to `[EPS, 1 - EPS]` first.
 */
export function weight(p: number): number {
  const c = clampProb(p);
  return Math.log(c / (1 - c));
}

/**
 * Confidence (logistic): `ℝ → (0,1)`. The total inverse of {@link weight}.
 * `prob(0) === 0.5`. Defined for every finite `w`; saturates toward 0 / 1.
 */
export function prob(w: number): number {
  // Numerically stable two-branch logistic.
  if (w >= 0) {
    const z = Math.exp(-w);
    return 1 / (1 + z);
  }
  const z = Math.exp(w);
  return z / (1 + z);
}

/**
 * Corroboration ⊕ in weight space: the sum of weights. Associative,
 * commutative, identity {@link NEUTRAL_WEIGHT}. The empty sum is `0` ("no
 * evidence"), *not* `-∞` — absence of support is neutral, not disconfirming.
 */
export function corroborate(weights: number[]): number {
  let acc = NEUTRAL_WEIGHT;
  for (const w of weights) acc += w;
  return acc;
}

/**
 * Corroborate a set of independent supporting confidences and return the
 * combined confidence in `[0,1]`. Convenience wrapper:
 * `prob(corroborate(ps.map(weight)))`. Order-independent; empty ⇒ `0.5`.
 */
export function corroborateProbs(ps: number[]): number {
  return prob(corroborate(ps.map(weight)));
}

/**
 * Signed combination of pro and con evidence: `w₊ − w₋`, returned as a
 * confidence in `[0,1]`. Counter-arguments enter as negative weight, so equal
 * pro and con cancel to `0.5`. This is the structural replacement for the
 * Dempster–Shafer conflict band — conflict is just `prob(proW - conW)`, with no
 * normalisation and no Zadeh high-conflict pathology.
 */
export function combineSignedProbs(pros: number[], cons: number[]): number {
  const proW = corroborate(pros.map(weight));
  const conW = corroborate(cons.map(weight));
  return prob(proW - conW);
}
