/**
 * DDS Phase 5 - Part 1: Behaviours Module Index
 * 
 * Based on Faggian & Hyland (2002) - §6: Orthogonality and Behaviours
 * 
 * Key Definitions:
 * - Definition 6.1: S ⊥ T if S ∩ T = p (strategies orthogonal if one play in intersection)
 * - Definition 6.2: A behaviour/game G is a set of innocent strategies equal to G⊥⊥
 * 
 * This module implements:
 * - Orthogonality checking (strategy-level and design-level)
 * - Biorthogonal closure computation (S⊥⊥)
 * - Behaviour creation and validation
 * - Game construction from behaviours
 */

// Types
export * from "./types";

// Orthogonality operations
export {
  checkStrategyOrthogonality,  // Definition 6.1: S ⊥ T
  checkOrthogonalityRefined,
  checkOrthogonalityBasic,
  areOrthogonal,
  findOrthogonalDesigns,
  verifyOrthogonalitySymmetry,
} from "./orthogonality";

// Closure operations
export {
  // Strategy-level (Definition 6.2)
  computeStrategyOrthogonal,
  computeStrategyBiorthogonal,
  // Design-level (legacy compatibility)
  computeOrthogonal,
  computeBiorthogonal,
  isBehaviour,
  validateBehaviour,
  createBehaviourFromDesigns,
  computeBehaviourComplement,
  intersectBehaviours,
  behaviourContainedIn,
  behavioursEqual,
  smallestBehaviourContaining,
} from "./closure";

// Game operations
export {
  behaviourToGame,
  isGame,
  isWinningPosition,
  getAvailableMoves,
  applyMove,
  findWinningStrategy,
} from "./game";
