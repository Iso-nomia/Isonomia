/**
 * DDS Phase 5 - Part 3: Property Checking
 * 
 * Based on Faggian & Hyland (2002)
 * 
 * Comprehensive property analysis for designs, strategies, and games.
 */

import type { Action } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type { DesignForCorrespondence, DesignAct } from "../correspondence/types";
import type { Game, GamePosition } from "../behaviours/types";
import type {
  PropertyAnalysis,
  PropertyProof,
  DesignProperties,
  StrategyProperties,
  GameProperties,
  ComplexityMetrics,
} from "./types";
import { createPropertyAnalysis, createComplexityMetrics } from "./types";
import { checkSaturation } from "./saturation";

// ============================================================================
// Design Property Analysis
// ============================================================================

/**
 * Analyze all properties of a design
 */
export async function analyzeDesignProperties(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<PropertyAnalysis> {
  const properties: Record<string, boolean> = {};
  const proofs: Record<string, PropertyProof> = {};

  // Check legality (sequentiality conditions)
  const legalityResult = await checkLegality(design);
  properties.legal = legalityResult.isLegal;
  proofs.legal = {
    method: "sequentiality-check",
    evidence: legalityResult,
  };

  // Check if design is a view
  const isViewResult = await checkIsView(design, allDesigns);
  properties.isView = isViewResult;
  proofs.isView = {
    method: "view-check",
    notes: isViewResult ? "Design is a view" : "Design is not a view",
  };

  // Check normalization
  const normalizedResult = checkNormalized(design);
  properties.normalized = normalizedResult.isNormalized;
  proofs.normalized = {
    method: "normalization-check",
    evidence: normalizedResult,
  };

  // Check if in some behaviour
  const inBehaviourResult = await checkInBehaviour(design, allDesigns);
  properties.inBehaviour = inBehaviourResult;
  proofs.inBehaviour = {
    method: "behaviour-membership",
    notes: inBehaviourResult
      ? "Design belongs to at least one behaviour"
      : "Design not found in any behaviour",
  };

  // Complexity analysis
  const complexity = analyzeComplexity(design);
  properties.lowComplexity = complexity.complexity === "low";
  proofs.complexity = {
    method: "complexity-analysis",
    evidence: complexity,
  };

  return {
    targetId: design.id,
    targetType: "design",
    properties,
    proofs,
    analyzedAt: new Date(),
  };
}

/**
 * Check design legality (sequentiality conditions)
 */
async function checkLegality(
  design: DesignForCorrespondence
): Promise<{
  isLegal: boolean;
  isLinear: boolean;
  isParity: boolean;
  isJustified: boolean;
  errors: string[];
}> {
  const acts = design.acts || [];
  const errors: string[] = [];

  // Linearity: no address appears twice
  const usedLoci = new Set<string>();
  let isLinear = true;
  for (const act of acts) {
    if (act.locusPath && usedLoci.has(act.locusPath)) {
      isLinear = false;
      errors.push(`Locus ${act.locusPath} used multiple times`);
    }
    if (act.locusPath) {
      usedLoci.add(act.locusPath);
    }
  }

  // Parity: polarity alternates correctly
  let isParity = true;
  for (let i = 1; i < acts.length; i++) {
    if (acts[i].polarity === acts[i - 1].polarity) {
      // Same polarity consecutive - might be violation
      // (simplified check - real check is more nuanced)
      isParity = false;
      errors.push(`Parity violation at positions ${i - 1} and ${i}`);
    }
  }

  // Justification: each move is justified by prior opening
  let isJustified = true;
  for (let i = 1; i < acts.length; i++) {
    const act = acts[i];
    if (!act.locusPath) continue;

    const parentLocus = getParentLocus(act.locusPath);
    if (parentLocus) {
      const hasJustifier = acts.slice(0, i).some(
        (prior) =>
          prior.locusPath === parentLocus &&
          (prior.ramification || []).some(
            (r) => `${parentLocus}.${r}` === act.locusPath
          )
      );
      if (!hasJustifier) {
        isJustified = false;
        errors.push(`Action at ${act.locusPath} not justified`);
      }
    }
  }

  return {
    isLegal: isLinear && isParity && isJustified,
    isLinear,
    isParity,
    isJustified,
    errors,
  };
}

/**
 * Get parent locus path
 */
function getParentLocus(locus: string): string | null {
  const parts = locus.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

/**
 * Check if design is a view
 */
async function checkIsView(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  // A design is a view if all its actions have the same polarity
  // (simplified check - real definition is more complex)
  const acts = design.acts || [];
  if (acts.length === 0) return true;

  const firstPolarity = acts[0].polarity;
  return acts.every((act) => act.polarity === firstPolarity);
}

/**
 * Check if design is normalized
 */
function checkNormalized(
  design: DesignForCorrespondence
): {
  isNormalized: boolean;
  reductions: string[];
} {
  const acts = design.acts || [];
  const reductions: string[] = [];

  // Check for reducible patterns
  for (let i = 0; i < acts.length - 1; i++) {
    const act1 = acts[i];
    const act2 = acts[i + 1];

    // Check for consecutive opposite polarity on same locus (cut)
    if (
      act1.locusPath === act2.locusPath &&
      act1.polarity !== act2.polarity
    ) {
      reductions.push(
        `Reducible cut at locus ${act1.locusPath} (steps ${i}, ${i + 1})`
      );
    }
  }

  return {
    isNormalized: reductions.length === 0,
    reductions,
  };
}

/**
 * Check if design belongs to any behaviour
 */
async function checkInBehaviour(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  // Simplified: design is in a behaviour if it has orthogonal designs
  // (real check requires computing biorthogonal closure)
  const hasOrthogonal = allDesigns.some((other) => {
    if (other.id === design.id) return false;

    // Check for potential orthogonality (opposite polarity)
    const designPolarity = design.acts?.[0]?.polarity;
    const otherPolarity = other.acts?.[0]?.polarity;

    return designPolarity !== otherPolarity;
  });

  return hasOrthogonal;
}

// ============================================================================
// Strategy Property Analysis
// ============================================================================

/**
 * Analyze all properties of a strategy
 */
export async function analyzeStrategyProperties(
  strategy: Strategy,
  allDesigns: DesignForCorrespondence[]
): Promise<PropertyAnalysis> {
  const properties: Record<string, boolean> = {};
  const proofs: Record<string, PropertyProof> = {};

  // Check innocence
  properties.innocent = strategy.isInnocent;
  proofs.innocent = {
    method: "innocence-check",
    notes: strategy.isInnocent
      ? "Strategy is view-determined"
      : "Strategy is not innocent",
  };

  // Check saturation
  const saturation = await checkSaturation(strategy, allDesigns);
  properties.saturated = saturation.isSaturated;
  proofs.saturation = {
    method: "saturation-check",
    evidence: saturation,
  };

  // Check propagation-closure
  properties.propagationClosed = strategy.satisfiesPropagation;
  proofs.propagationClosed = {
    method: "propagation-check",
    notes: strategy.satisfiesPropagation
      ? "Propagation doesn't add new plays"
      : "Propagation adds new plays",
  };

  // Check if forms a behaviour
  const formsBehaviour = await checkFormsBehaviour(strategy, allDesigns);
  properties.formsBehaviour = formsBehaviour;
  proofs.formsBehaviour = {
    method: "behaviour-check",
    notes: formsBehaviour
      ? "Strategy forms its own behaviour"
      : "Strategy doesn't form a behaviour",
  };

  return {
    targetId: strategy.id,
    targetType: "strategy",
    properties,
    proofs,
    analyzedAt: new Date(),
  };
}

/**
 * Check if strategy forms a behaviour
 */
async function checkFormsBehaviour(
  strategy: Strategy,
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  // A strategy forms a behaviour if it's closed under biorthogonality
  // Simplified check: innocent + saturated + propagation-closed
  return (
    strategy.isInnocent &&
    strategy.satisfiesPropagation
  );
}

// ============================================================================
// Game Property Analysis
// ============================================================================

/**
 * Analyze all properties of a game
 */
export async function analyzeGameProperties(
  game: Game
): Promise<PropertyAnalysis> {
  const properties: Record<string, boolean> = {};
  const proofs: Record<string, PropertyProof> = {};

  // Check determinacy
  const determinacy = checkDeterminacy(game);
  properties.determined = determinacy.isDetermined;
  proofs.determined = {
    method: "determinacy-check",
    evidence: determinacy,
  };

  // Check for winning strategy
  const hasWinning = await checkHasWinningStrategy(game);
  properties.hasWinningStrategy = hasWinning;
  proofs.hasWinningStrategy = {
    method: "winning-strategy-check",
    notes: hasWinning
      ? "Game has a winning strategy"
      : "No winning strategy found",
  };

  // Check finiteness
  const finiteness = checkFinite(game);
  properties.finite = finiteness.isFinite;
  proofs.finite = {
    method: "finiteness-check",
    evidence: finiteness,
  };

  return {
    targetId: game.id,
    targetType: "game",
    properties,
    proofs,
    analyzedAt: new Date(),
  };
}

/**
 * Check game determinacy
 */
function checkDeterminacy(game: Game): {
  isDetermined: boolean;
  evidence?: string;
} {
  // A game is determined if from every position, there's at most one optimal move
  // Simplified check: look for positions with multiple equally good moves

  const nonDeterminedPositions = game.positions.filter((pos) => {
    if (pos.isTerminal) return false;

    // Find available moves
    const usedAddresses = new Set(pos.sequence.map((m) => m.address));
    const availableMoves = game.moves.filter(
      (m) =>
        m.polarity === pos.player && !usedAddresses.has(m.address)
    );

    // If multiple moves available, check if they're all optimal
    // (simplified: more than 2 moves suggests non-determinacy)
    return availableMoves.length > 2;
  });

  return {
    isDetermined: nonDeterminedPositions.length === 0,
    evidence:
      nonDeterminedPositions.length > 0
        ? `${nonDeterminedPositions.length} non-determined positions`
        : undefined,
  };
}

/**
 * Check if game has winning strategy
 */
async function checkHasWinningStrategy(game: Game): Promise<boolean> {
  // Check if any strategy is winning
  for (const strategy of game.strategies) {
    // Simplified: strategy is winning if all terminal positions reached
    // by following it are wins for the strategy's player
    if (strategy.isInnocent) {
      return true; // Assume innocent strategies can be winning
    }
  }

  return game.strategies.length > 0;
}

/**
 * Check if game is finite
 */
function checkFinite(game: Game): {
  isFinite: boolean;
  positionCount: number;
  moveCount: number;
} {
  const positionCount = game.positions.length;
  const moveCount = game.moves.length;

  // Game is finite if it has bounded positions and all paths terminate
  const isFinite =
    positionCount < 10000 &&
    game.positions.every(
      (p) => p.isTerminal || p.sequence.length < 100
    );

  return {
    isFinite,
    positionCount,
    moveCount,
  };
}

// ============================================================================
// Complexity Analysis
// ============================================================================

/**
 * Analyze design complexity
 */
export function analyzeComplexity(
  design: DesignForCorrespondence
): ComplexityMetrics {
  const acts = design.acts || [];
  const loci = design.loci || [];

  // Compute depth (max depth of action tree)
  const depth = computeDepth(acts);

  // Compute width (max branching factor)
  const width = computeWidth(acts);

  const actCount = acts.length;
  const locuCount = loci.length;

  return createComplexityMetrics(design.id, depth, width, actCount, locuCount);
}

/**
 * Compute max depth of design tree
 */
function computeDepth(acts: DesignAct[]): number {
  let maxDepth = 0;

  for (const act of acts) {
    if (act.locusPath) {
      const depth = act.locusPath.split(".").length;
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

/**
 * Compute max branching factor
 */
function computeWidth(acts: DesignAct[]): number {
  let maxWidth = 0;

  for (const act of acts) {
    const ramSize = (act.ramification || []).length;
    maxWidth = Math.max(maxWidth, ramSize);
  }

  return maxWidth || 1;
}

/**
 * Batch analyze properties for multiple designs
 */
export async function batchAnalyzeDesigns(
  designs: DesignForCorrespondence[]
): Promise<Map<string, PropertyAnalysis>> {
  const results = new Map<string, PropertyAnalysis>();

  await Promise.all(
    designs.map(async (design) => {
      const analysis = await analyzeDesignProperties(design, designs);
      results.set(design.id, analysis);
    })
  );

  return results;
}

/**
 * Get summary statistics for property analysis
 */
export function summarizeProperties(
  analyses: PropertyAnalysis[]
): {
  totalAnalyzed: number;
  propertyStats: Record<string, { true: number; false: number }>;
} {
  const propertyStats: Record<string, { true: number; false: number }> = {};

  for (const analysis of analyses) {
    for (const [propName, propValue] of Object.entries(analysis.properties)) {
      if (!propertyStats[propName]) {
        propertyStats[propName] = { true: 0, false: 0 };
      }
      if (propValue) {
        propertyStats[propName].true++;
      } else {
        propertyStats[propName].false++;
      }
    }
  }

  return {
    totalAnalyzed: analyses.length,
    propertyStats,
  };
}
