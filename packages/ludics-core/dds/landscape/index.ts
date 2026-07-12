/**
 * ============================================
 * LANDSCAPE MODULE
 * ============================================
 * 
 * Phase 4: Strategic Landscape Mapping
 * 
 * This module provides comprehensive analysis of the strategic landscape
 * over a deliberation arena, including:
 * 
 * - Behaviour computation via biorthogonal closure
 * - Position strength analysis
 * - Visualization data for UI rendering
 * - Completeness checking
 * 
 * Key theoretical foundations:
 * - Girard's ludics: Behaviours, orthogonals, biorthogonal closure
 * - Faggian & Hyland: Designs, disputes, convergence
 * - Strategic analysis: Winning strategies, position strength
 * 
 * Main exports:
 * - Behaviour: computeBehaviour, computeOrthogonal, converges
 * - Analysis: analyzePositionStrength, analyzeAllPositions, hasWinningStrategy
 * - Visualization: generateLandscapeData, layoutAsTree, findCriticalPoints
 * - Completeness: checkBehaviourCompleteness, validateBehaviourStructure
 */

// ============================================================================
// BEHAVIOUR COMPUTER EXPORTS
// ============================================================================

export {
  // Core functions
  converges,
  checkConvergence,
  computeOrthogonal,
  computeBiorthogonalClosure,
  computeBehaviour,

  // Design set operations
  designSetsEqual,
  designsEquivalent,

  // Candidate generation
  generateCandidateDesigns,

  // Utility functions
  getAllAddresses,
  getMaxDesignDepth,
  getTotalActionCount,

  // Types
  type BehaviourComputationResult,
  type ClosureStatistics,
  type ConvergenceResult,
  type BehaviourComputationOptions,
} from "./behaviour-computer";

// ============================================================================
// POSITION ANALYZER EXPORTS
// ============================================================================

export {
  // Core analysis functions
  analyzePositionStrength,
  analyzeAllPositions,
  buildAnalysisTree,

  // Design queries
  getDesignsStartingAt,
  getResponsiveDesigns,

  // Simulations
  runSimulations,
  computeAverageDepth,
  computeWinRate,

  // Winning strategy
  hasWinningStrategy,
  findWinningDesigns,
  analyzeWinningPotential,

  // Arena utilities
  getAllArenaAddresses,
  getArenaPosition,

  // Cache management
  clearAnalysisCache,
  getCacheStats,

  // Comparison utilities
  comparePositions,
  sortByStrength,
  findStrongestPosition,
  findWeakestPosition,

  // Types
  type PositionAnalysis,
  type SimulationResult,
  type AnalysisOptions,
  type AnalysisStatistics,
  type BatchAnalysisResult,
  type WinningPotential,
} from "./position-analyzer";

// ============================================================================
// VISUALIZATION DATA EXPORTS
// ============================================================================

export {
  // Core generation
  generateLandscapeData,

  // Layout functions
  layoutAsTree,

  // Critical points
  findCriticalPoints,
  isCriticalPoint,

  // Flow paths
  extractFlowPaths,
  findMostCommonPath,
  getPathsThrough,

  // Statistics
  computeLandscapeStatistics,

  // Export formats
  landscapeToJSON,
  landscapeToSVG,

  // Types
  type HeatMapPosition,
  type LayoutBounds,
  type ExtendedHeatMapData,
  type HeatMapEdge,
  type LandscapeStatistics,
  type LayoutOptions,
  type CompleteLandscapeData,
} from "./visualization-data";

// ============================================================================
// COMPLETENESS CHECKER EXPORTS
// ============================================================================

export {
  // Behaviour completeness
  checkBehaviourCompleteness,
  checkInternalCompleteness,

  // Design completeness
  checkDesignCompleteness,

  // Missing design detection
  findMissingDesigns,
  suggestDesigns,

  // Structure validation
  validateBehaviourStructure,
  validateDesignStructure,

  // Utility functions
  getCompletenessSummary,
  isMinimallyComplete,
  getCoverageReport,

  // Types
  type CompletenessResult,
  type CompletenessDialognostic,
  type CompletenessStatistics,
  type DesignCompletenessResult,
  type MissingResponse,
  type ValidationResult,
  type ValidationError,
  type CoverageReport,
} from "./completeness-checker";

// ============================================================================
// MODULE-LEVEL TYPES (Re-exports from ludics-theory for convenience)
// ============================================================================

// These types are commonly used with landscape functions
export type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  DeliberationArena,
  PositionStrength,
  LandscapeData,
  HeatMapData,
  FlowPath,
  VisitablePath,
} from "../types/ludics-theory";

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import {
  computeBehaviour,
  type BehaviourComputationOptions,
} from "./behaviour-computer";
import {
  analyzeAllPositions,
  type AnalysisOptions,
} from "./position-analyzer";
import { generateLandscapeData, type CompleteLandscapeData } from "./visualization-data";
import { checkBehaviourCompleteness, type CompletenessResult } from "./completeness-checker";
import type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  DeliberationArena,
} from "../types/ludics-theory";

/**
 * Full landscape analysis in one call
 * 
 * Computes behaviour, analyzes positions, and generates visualization data.
 * 
 * @param arena The deliberation arena
 * @param designs Initial designs
 * @param options Combined options
 * @returns Complete landscape analysis
 */
export async function analyzeFullLandscape(
  arena: DeliberationArena,
  designs: LudicDesignTheory[],
  options?: {
    behaviour?: BehaviourComputationOptions;
    analysis?: AnalysisOptions;
    runSimulations?: boolean;
    simulationCount?: number;
  }
): Promise<{
  behaviour: LudicBehaviourTheory;
  landscape: CompleteLandscapeData;
  completeness: CompletenessResult;
  computeTime: number;
}> {
  const startTime = Date.now();

  // Step 1: Compute behaviour
  const behaviourResult = computeBehaviour(designs, options?.behaviour);
  const behaviour = behaviourResult.behaviour;

  // Step 2: Analyze all positions
  const analysisResult = analyzeAllPositions(
    arena,
    behaviour.designs,
    options?.analysis
  );

  // Step 3: Generate landscape data
  // Note: Could include simulation results if requested
  const landscape = generateLandscapeData(arena, analysisResult.positions);

  // Step 4: Check completeness
  const completeness = checkBehaviourCompleteness(behaviour);

  return {
    behaviour,
    landscape,
    completeness,
    computeTime: Date.now() - startTime,
  };
}

/**
 * Quick strength check for a single position
 * 
 * @param arena The arena
 * @param designs Available designs
 * @param address Position to check
 * @returns Quick strength assessment
 */
export function quickStrengthCheck(
  arena: DeliberationArena,
  designs: LudicDesignTheory[],
  address: import("../types/ludics-theory").LudicAddress
): {
  winRate: number;
  hasWinningStrategy: boolean;
  designCount: number;
} {
  const { analyzePositionStrength, hasWinningStrategy, getDesignsStartingAt } =
    require("./position-analyzer");

  const strength = analyzePositionStrength(arena, address, designs, {
    simulations: 20, // Quick check with fewer simulations
  });

  return {
    winRate: strength.winRate,
    hasWinningStrategy: strength.hasWinningStrategy,
    designCount: strength.totalDesignCount,
  };
}
