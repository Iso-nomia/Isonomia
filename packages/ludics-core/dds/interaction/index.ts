/**
 * ============================================
 * INTERACTION MODULE
 * ============================================
 * 
 * Core interaction engine for ludic deliberations.
 * Implements Faggian-Hyland game semantics.
 * 
 * Main exports:
 * - Stepper: Core interaction stepping
 * - Outcome: Convergence/divergence detection
 * - Play: Game session management
 * - Strategy: Strategy and design management
 */

// ============================================
// STEPPER EXPORTS
// ============================================

export {
  // State creation
  createInitialState,
  
  // Move validation
  validateMove,
  
  // Stepping
  stepInteraction,
  
  // Legal moves
  getLegalMoves,
  
  // State queries
  isTerminated,
  hasLegalMoves,
  getCurrentPosition,
  getMoveCount,
  getLastAction,
  isFirstMove,
} from "./stepper";

// ============================================
// OUTCOME EXPORTS
// ============================================

export {
  // Outcome detection
  detectOutcome,
  
  // Convergence/divergence checks
  isConvergent,
  isDivergent,
  
  // Winner determination
  determineWinner,
  
  // Path construction
  buildVisitablePath,
  computeIncarnation,
  computeView,
  
  // Result utilities
  describeOutcome,
  getResultStatistics,
} from "./outcome";

// ============================================
// PLAY EXPORTS
// ============================================

export {
  // Play creation
  createPlay,
  
  // Move management
  makeMove,
  undoMove,
  undoMoves,
  replayUpTo,
  
  // Play completion
  completePlay,
  forfeitPlay,
  
  // Serialization
  serializePlay,
  deserializePlay,
  
  // Play queries
  isPlayComplete,
  isParticipantsTurn,
  getCurrentPlayer,
  getWinner,
  getMoveHistory,
  getPlayDuration,
  getTotalThinkTime,
  
  // Play cloning
  clonePlay,
  branchFromMove,
} from "./play";

// ============================================
// STRATEGY EXPORTS
// ============================================

export {
  // Strategy creation
  createStrategy,
  setResponse,
  getResponse,
  hasResponse,
  
  // Strategy application
  applyStrategy,
  getStrategyMoves,
  
  // Chronicle management
  createChronicle,
  extendChronicle,
  isPositiveChronicle,
  chronicleHasDaimon,
  getChronicleDepth,
  isChroniclePrefix,
  
  // Design management
  createDesign,
  addChronicle,
  strategyToDesign,
  
  // Strategy generation
  generateAllStrategies,
  generateRandomStrategy,
  
  // Strategy evaluation
  evaluateStrategy,
} from "./strategy";
