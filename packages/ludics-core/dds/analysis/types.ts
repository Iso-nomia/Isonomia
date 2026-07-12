/**
 * DDS Phase 5 - Part 3: Analysis Types
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.17
 * 
 * Types for saturation analysis, property checking, correspondence
 * validation, and performance tracking.
 */

import type { Action, View, Chronicle, Dispute, Position } from "../types";
import type { Strategy, Play } from "../strategy/types";

// ============================================================================
// Saturation Types (Proposition 4.17)
// ============================================================================

/**
 * Saturation result
 * 
 * Strategy S is saturated if Views(S) = S
 * i.e., extracting views and reconstructing gives back the same strategy
 */
export type SaturationResult = {
  strategyId: string;
  /** Whether strategy is saturated */
  isSaturated: boolean;
  /** Proof/evidence of saturation */
  proof?: SaturationProof;
  /** Violations if not saturated */
  violations?: SaturationViolation[];
};

/**
 * Proof of saturation
 */
export type SaturationProof = {
  /** Number of iterations to verify */
  iterations: number;
  /** Views extracted */
  viewCount: number;
  /** Plays in reconstructed strategy */
  playCount: number;
  /** Original play count */
  originalPlayCount: number;
};

/**
 * Saturation violation
 */
export type SaturationViolation = {
  type: "missing" | "extra";
  /** IDs of problematic plays/views */
  itemIds: string[];
  /** Description of violation */
  description: string;
};

/**
 * Saturation closure result
 */
export type SaturationClosureResult = {
  originalStrategyId: string;
  saturatedStrategy: Strategy;
  iterations: number;
  converged: boolean;
  addedPlays: number;
  isSaturated: boolean;
};

// ============================================================================
// Property Analysis Types
// ============================================================================

/**
 * Property analysis result
 */
export type PropertyAnalysis = {
  targetId: string;
  targetType: "design" | "strategy" | "game";
  /** Map of property name to boolean value */
  properties: Record<string, boolean>;
  /** Proofs/evidence for properties */
  proofs?: Record<string, PropertyProof>;
  /** Timestamp of analysis */
  analyzedAt?: Date;
};

/**
 * Proof for a property
 */
export type PropertyProof = {
  method: string;
  evidence?: any;
  notes?: string;
};

/**
 * Design properties to check
 */
export type DesignProperties = {
  /** Satisfies sequentiality conditions */
  legal: boolean;
  /** Is a view */
  isView: boolean;
  /** Cannot be reduced further */
  normalized: boolean;
  /** Belongs to some behaviour */
  inBehaviour: boolean;
  /** Low complexity */
  lowComplexity: boolean;
};

/**
 * Strategy properties to check
 */
export type StrategyProperties = {
  /** Same view → same response */
  innocent: boolean;
  /** Views(S) = S */
  saturated: boolean;
  /** Propagation doesn't add designs */
  propagationClosed: boolean;
  /** Forms a behaviour */
  formsBehaviour: boolean;
};

/**
 * Game properties to check
 */
export type GameProperties = {
  /** Every position has at most one optimal move */
  determined: boolean;
  /** Winning strategy exists */
  hasWinningStrategy: boolean;
  /** Game tree is finite */
  finite: boolean;
};

// ============================================================================
// Correspondence Validation Types
// ============================================================================

/**
 * Correspondence validation result
 */
export type CorrespondenceValidation = {
  designId: string;
  strategyId?: string;
  gameId?: string;
  typeId?: string;
  /** Level of validation performed */
  level: CorrespondenceLevel;
  /** Whether correspondence holds */
  isValid: boolean;
  /** Full transformation chain */
  chain: CorrespondenceStep[];
  /** Timestamp */
  validatedAt?: Date;
};

export type CorrespondenceLevel =
  | "design-strategy"
  | "strategy-game"
  | "design-game"
  | "full"; // All levels

/**
 * Single step in correspondence chain
 */
export type CorrespondenceStep = {
  stage: string;
  input: any;
  output: any;
  success: boolean;
  duration?: number;
  error?: string;
};

// ============================================================================
// Complexity Metrics Types
// ============================================================================

/**
 * Complexity metrics for a design
 */
export type ComplexityMetrics = {
  designId: string;
  /** Max depth of design tree */
  depth: number;
  /** Max branching factor */
  width: number;
  /** Total actions */
  actCount: number;
  /** Total loci */
  locuCount: number;
  /** Complexity classification */
  complexity: "low" | "medium" | "high";
};

/**
 * Complexity thresholds
 */
export type ComplexityThresholds = {
  lowActMax: number;
  lowDepthMax: number;
  mediumActMax: number;
  mediumDepthMax: number;
};

// ============================================================================
// Performance Tracking Types
// ============================================================================

/**
 * Performance metric for an operation
 */
export type PerformanceMetric = {
  id: string;
  /** Operation name */
  operation: string;
  /** Size of input */
  inputSize: number;
  /** Duration in seconds */
  duration: number;
  /** Memory used in MB */
  memoryUsed?: number;
  /** Whether operation succeeded */
  successful: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp */
  recordedAt: Date;
};

/**
 * Performance statistics for an operation
 */
export type PerformanceStats = {
  operation: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  successRate: number;
  sampleCount: number;
};

/**
 * Performance bottleneck analysis
 */
export type BottleneckAnalysis = {
  slowOperations: string[];
  memoryIntensive: string[];
  failureProneOperations: string[];
  recommendations: string[];
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a saturation result
 */
export function createSaturationResult(
  strategyId: string,
  isSaturated: boolean,
  options?: Partial<SaturationResult>
): SaturationResult {
  return {
    strategyId,
    isSaturated,
    proof: options?.proof,
    violations: options?.violations,
  };
}

/**
 * Create a property analysis result
 */
export function createPropertyAnalysis(
  targetId: string,
  targetType: "design" | "strategy" | "game",
  properties: Record<string, boolean>,
  proofs?: Record<string, PropertyProof>
): PropertyAnalysis {
  return {
    targetId,
    targetType,
    properties,
    proofs,
    analyzedAt: new Date(),
  };
}

/**
 * Create a correspondence validation result
 */
export function createCorrespondenceValidation(
  designId: string,
  level: CorrespondenceLevel,
  isValid: boolean,
  chain: CorrespondenceStep[],
  options?: Partial<CorrespondenceValidation>
): CorrespondenceValidation {
  return {
    designId,
    level,
    isValid,
    chain,
    strategyId: options?.strategyId,
    gameId: options?.gameId,
    typeId: options?.typeId,
    validatedAt: new Date(),
  };
}

/**
 * Create complexity metrics
 */
export function createComplexityMetrics(
  designId: string,
  depth: number,
  width: number,
  actCount: number,
  locuCount: number,
  thresholds?: ComplexityThresholds
): ComplexityMetrics {
  const t = thresholds ?? {
    lowActMax: 20,
    lowDepthMax: 5,
    mediumActMax: 50,
    mediumDepthMax: 10,
  };

  let complexity: "low" | "medium" | "high" = "low";
  if (actCount > t.mediumActMax || depth > t.mediumDepthMax) {
    complexity = "high";
  } else if (actCount > t.lowActMax || depth > t.lowDepthMax) {
    complexity = "medium";
  }

  return {
    designId,
    depth,
    width,
    actCount,
    locuCount,
    complexity,
  };
}

/**
 * Create a performance metric
 */
export function createPerformanceMetric(
  operation: string,
  inputSize: number,
  duration: number,
  successful: boolean,
  options?: Partial<PerformanceMetric>
): PerformanceMetric {
  return {
    id: options?.id ?? `perf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation,
    inputSize,
    duration,
    memoryUsed: options?.memoryUsed,
    successful,
    metadata: options?.metadata,
    recordedAt: new Date(),
  };
}

/**
 * Compute performance statistics from metrics
 */
export function computePerformanceStats(
  operation: string,
  metrics: PerformanceMetric[]
): PerformanceStats {
  const opMetrics = metrics.filter((m) => m.operation === operation);

  if (opMetrics.length === 0) {
    return {
      operation,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      successRate: 0,
      sampleCount: 0,
    };
  }

  const durations = opMetrics.map((m) => m.duration);
  const successCount = opMetrics.filter((m) => m.successful).length;

  return {
    operation,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    successRate: successCount / opMetrics.length,
    sampleCount: opMetrics.length,
  };
}
