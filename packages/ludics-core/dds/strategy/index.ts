/**
 * DDS Phase 2: Strategy Module
 * Based on Faggian & Hyland (2002)
 * 
 * Exports all strategy-related types and functions for:
 * - Strategy construction
 * - Innocence checking (Definition 4.8)
 * - Propagation checking (Definition 4.25)
 * - Views(S) and Plays(V) operations (Definitions 4.10, 4.11)
 */

// Types
export type {
  Strategy,
  Play,
  DeterminismCheck,
  DeterminismViolation,
  InnocenceCheck,
  InnocenceViolation,
  PropagationCheck,
  PropagationViolation,
  ViewsResult,
  PlaysResult,
  StrategyConstructionOptions,
  ViewExtensionCheck,
  StrategyComparison,
  StrategyAnalysis,
} from "./types";

// Strategy Construction
export {
  constructStrategy,
  createEmptyStrategy,
  strategyFromPlay,
  mergeStrategies,
  filterPositivePlays,
  filterNegativePlays,
  getMaximalPlays,
  getMinimalPlays,
  computeStrategyStats,
} from "./construct";

// Innocence Checking
export {
  checkInnocence,
  checkDeterminism,
  isLikelyInnocent,
  makeInnocent,
} from "./innocence";

// Propagation Checking
export {
  checkPropagation,
  checkLinearityInSlices,
  checkFullPropagation,
  groupViewsByTerminal,
  analyzePropagationStructure,
} from "./propagation";

// Views(S) and Plays(V) Operations
export {
  computeViews,
  computePlays,
  verifyPlaysViewsIdentity,
  verifyViewsPlaysIdentity,
} from "./operations";
