/**
 * ============================================
 * EXTRACTION MODULE
 * ============================================
 * 
 * Extract visitable paths, compute incarnations, and format narratives.
 * 
 * This module provides the core proof extraction functionality for
 * ludics-based deliberation, implementing the Curry-Howard correspondence
 * for argumentation:
 * 
 * - Visitable Path = Proof Trace
 * - Incarnation = Essential Proof (stripped of non-essential parts)
 * - Justified Narrative = Human-readable proof
 * 
 * Main exports:
 * - Path extraction: Extract paths from interactions and behaviours
 * - Incarnation: Compute essential cores of interaction traces
 * - Completion: Add daimon endings to incomplete designs
 * - Narrative: Format proofs as human-readable narratives
 */

// ============================================================================
// PATH EXTRACTOR EXPORTS
// ============================================================================

export {
  // Main extraction functions
  extractPath,
  extractPaths,
  extractAllPaths,
  extractPathsFromDesign,
  chronicleToPath,
  
  // Validation
  validatePath,
  
  // Comparison and merging
  comparePaths,
  mergePaths,
  
  // Statistics
  getPathStatistics,
  getPathsStatistics,
  
  // Types
  type PathExtractor,
  type PathValidation,
  type PathValidationError,
  type PathComparison,
  type MergedPath,
} from "./path-extractor";

// ============================================================================
// INCARNATION EXPORTS
// ============================================================================

export {
  // Core incarnation functions
  computeIncarnation,
  computeView,
  
  // Justification functions
  hasJustifyingPositive,
  findJustifyingPositive,
  justifies,
  findLastPositive,
  
  // Essential action filtering
  isEssentialAction,
  stripNonEssential,
  
  // Analysis
  getJustificationChain,
  isMinimalIncarnation,
  getCompressionRatio,
  
  // Advanced operations
  mergeIncarnations,
  getIncarnationDepth,
  getIncarnationWidth,
} from "./incarnation";

// ============================================================================
// COMPLETION EXPORTS
// ============================================================================

export {
  // Chronicle completion checks
  isChronicleComplete,
  findIncompleteChronicles,
  getIncompletePositions,
  
  // Design completion
  completeDesign,
  addDaimonEnding,
  completeDesignWithStats,
  
  // Design analysis
  isDesignComplete,
  getCompletionDegree,
  isWinningDesign,
  
  // Batch operations
  completeDesigns,
  completeDesignsWithStats,
  
  // Validation
  validateCompletedDesign,
  
  // Utilities
  stripDaimons,
  countDaimons,
  
  // Types
  type CompletionStats,
  type IncompletePosition,
} from "./completion";

// ============================================================================
// NARRATIVE FORMATTER EXPORTS
// ============================================================================

export {
  // Main formatting function
  formatAsNarrative,
  
  // Justification derivation
  deriveJustification,
  deriveConclusion,
  
  // Output formats
  narrativeToMarkdown,
  narrativeToJSON,
  narrativeToPlainText,
  narrativeToHTML,
  
  // Analysis
  analyzeNarrative,
  compareNarratives,
  
  // Types
  type NarrativeOptions,
} from "./narrative-formatter";

// ============================================================================
// RE-EXPORT TYPES FROM LUDICS-THEORY
// ============================================================================

// Re-export relevant types for convenience
export type {
  VisitablePath,
  JustifiedNarrative,
  NarrativeStep,
  DialogueAct,
  LudicDesignTheory,
  LudicBehaviourTheory,
  Chronicle,
} from "../types/ludics-theory";
