/**
 * ============================================
 * POSITION ANALYZER
 * ============================================
 * 
 * Analyze strategic strength of positions in the arena.
 * 
 * This module computes:
 * - Position strength (win rate, winning designs, depth)
 * - Winning strategy detection
 * - Simulation-based analysis
 * 
 * From Girard's ludics:
 * - A winning design has no daimon - it forces the opponent to give up
 * - Position strength indicates how favorable a position is
 * - Strategic landscape shows all possible outcomes from each position
 */

import type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Chronicle,
  DialogueAct,
  Polarity,
  DeliberationArena,
  ArenaPositionTheory,
  InteractionResult,
  PositionStrength,
  VisitablePath,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  keyToAddress,
  isAddressPrefix,
  flipPolarity,
} from "../types/ludics-theory";

import { converges, checkConvergence, type ConvergenceResult } from "./behaviour-computer";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position analysis result (tree structure)
 */
export interface PositionAnalysis {
  /** The analyzed position */
  position: PositionStrength;

  /** Analysis of child positions */
  children: PositionAnalysis[];

  /** Parent position (if not root) */
  parent?: PositionAnalysis;

  /** Depth in tree */
  depth: number;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  /** Winner of simulation */
  winner: "P" | "O" | null;

  /** Number of moves */
  moveCount: number;

  /** Did interaction converge? */
  convergent: boolean;

  /** The path taken */
  path: VisitablePath;

  /** How simulation ended */
  termination: "daimon" | "stuck" | "max_depth";

  /** Who played last move */
  lastPlayer: "P" | "O";
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Number of simulations per position */
  simulations?: number;

  /** Maximum depth to analyze */
  maxDepth?: number;

  /** Include child position analysis */
  includeChildren?: boolean;

  /** Use cached results */
  useCache?: boolean;

  /** Timeout per position (ms) */
  timeout?: number;
}

/**
 * Analysis statistics
 */
export interface AnalysisStatistics {
  /** Total positions analyzed */
  positionsAnalyzed: number;

  /** Total simulations run */
  simulationsRun: number;

  /** Time taken (ms) */
  computeTime: number;

  /** Cache hit rate (0-1) */
  cacheHitRate?: number;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  /** All position analyses */
  positions: PositionStrength[];

  /** Statistics about the analysis */
  statistics: AnalysisStatistics;

  /** Any errors encountered */
  errors?: string[];
}

// ============================================================================
// POSITION ANALYSIS
// ============================================================================

// Analysis cache
const analysisCache = new Map<string, PositionStrength>();

/**
 * Analyze the strategic strength of a position
 * 
 * @param arena The deliberation arena
 * @param address Position address to analyze
 * @param designs Available designs
 * @param options Analysis options
 * @returns Position strength analysis
 */
export function analyzePositionStrength(
  arena: DeliberationArena,
  address: LudicAddress,
  designs: LudicDesignTheory[],
  options?: AnalysisOptions
): PositionStrength {
  const cacheKey = `${arena.id ?? arena.deliberationId}:${addressToKey(address)}`;

  // Check cache
  if (options?.useCache !== false && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  const simulationCount = options?.simulations ?? 100;
  const maxDepth = options?.maxDepth ?? 50;

  // Get designs that start at or include this address
  const relevantDesigns = getDesignsStartingAt(designs, address);

  // Count winning designs (no daimon)
  const winningDesigns = relevantDesigns.filter((d) => !d.hasDaimon);
  const winningDesignCount = winningDesigns.length;

  // Run simulations to compute win rate
  const simResults = runSimulations(
    relevantDesigns,
    address,
    simulationCount,
    maxDepth
  );

  // Compute metrics
  const pWins = simResults.filter((r) => r.winner === "P").length;
  const totalComplete = simResults.filter((r) => r.winner !== null).length;
  const winRate = totalComplete > 0 ? pWins / totalComplete : 0.5;

  // Compute average depth
  const depth = computeAverageDepth(simResults);

  // Check for winning strategy
  const hasWinning = hasWinningStrategy(designs, address);

  const result: PositionStrength = {
    address,
    winningDesignCount,
    totalDesignCount: relevantDesigns.length,
    winRate,
    hasWinningStrategy: hasWinning,
    depth,
  };

  // Cache result
  if (options?.useCache !== false) {
    analysisCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Analyze all positions in an arena
 * 
 * @param arena The deliberation arena
 * @param designs Available designs
 * @param options Analysis options
 * @returns Batch analysis result
 */
export function analyzeAllPositions(
  arena: DeliberationArena,
  designs: LudicDesignTheory[],
  options?: AnalysisOptions
): BatchAnalysisResult {
  const startTime = Date.now();
  const positions: PositionStrength[] = [];
  const errors: string[] = [];
  let simulationsRun = 0;

  // Get all position addresses from arena
  const addresses = getAllArenaAddresses(arena);

  for (const address of addresses) {
    try {
      const strength = analyzePositionStrength(arena, address, designs, options);
      positions.push(strength);
      simulationsRun += options?.simulations ?? 100;
    } catch (error) {
      errors.push(`Failed to analyze ${addressToKey(address)}: ${error}`);
    }
  }

  return {
    positions,
    statistics: {
      positionsAnalyzed: positions.length,
      simulationsRun,
      computeTime: Date.now() - startTime,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Build position analysis tree
 * 
 * @param arena The arena
 * @param designs Available designs
 * @param rootAddress Starting address (default: root)
 * @param options Analysis options
 * @returns Tree of position analyses
 */
export function buildAnalysisTree(
  arena: DeliberationArena,
  designs: LudicDesignTheory[],
  rootAddress: LudicAddress = [],
  options?: AnalysisOptions
): PositionAnalysis {
  const maxDepth = options?.maxDepth ?? 10;

  function buildNode(
    address: LudicAddress,
    depth: number,
    parent?: PositionAnalysis
  ): PositionAnalysis {
    const position = analyzePositionStrength(arena, address, designs, options);
    
    const node: PositionAnalysis = {
      position,
      children: [],
      parent,
      depth,
    };

    // Get children if not at max depth
    if (options?.includeChildren !== false && depth < maxDepth) {
      const arenaPos = arena.positions.get(addressToKey(address));
      
      if (arenaPos) {
        for (const ramIndex of arenaPos.ramification) {
          const childAddr = [...address, ramIndex];
          node.children.push(buildNode(childAddr, depth + 1, node));
        }
      }
    }

    return node;
  }

  return buildNode(rootAddress, 0);
}

// ============================================================================
// DESIGN QUERIES
// ============================================================================

/**
 * Get designs that start at or include a specific address
 * 
 * @param designs All available designs
 * @param address Target address
 * @returns Designs relevant to this address
 */
export function getDesignsStartingAt(
  designs: LudicDesignTheory[],
  address: LudicAddress
): LudicDesignTheory[] {
  return designs.filter((design) => {
    // Check if design base includes this address
    for (const base of design.base) {
      if (addressEquals(base, address) || isAddressPrefix(base, address)) {
        return true;
      }
    }

    // Check if any chronicle includes this address
    for (const chronicle of design.chronicles) {
      for (const action of chronicle.actions) {
        if (
          addressEquals(action.focus, address) ||
          isAddressPrefix(action.focus, address)
        ) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Get designs that can respond at a specific address
 */
export function getResponsiveDesigns(
  designs: LudicDesignTheory[],
  address: LudicAddress,
  polarity: Polarity
): LudicDesignTheory[] {
  return designs.filter((design) => {
    // Must have matching polarity
    if (design.polarity !== polarity) return false;

    // Must have a response at this address
    for (const chronicle of design.chronicles) {
      for (const action of chronicle.actions) {
        if (
          addressEquals(action.focus, address) &&
          action.polarity === polarity
        ) {
          return true;
        }
      }
    }

    return false;
  });
}

// ============================================================================
// SIMULATIONS
// ============================================================================

/**
 * Run simulations from a position
 * 
 * @param designs Available designs
 * @param startAddress Starting position
 * @param count Number of simulations
 * @param maxDepth Maximum simulation depth
 * @returns Simulation results
 */
export function runSimulations(
  designs: LudicDesignTheory[],
  startAddress: LudicAddress,
  count: number,
  maxDepth: number = 50
): SimulationResult[] {
  const results: SimulationResult[] = [];

  // Get designs starting from this position
  const pDesigns = designs.filter((d) => d.polarity === "+");
  const oDesigns = designs.filter((d) => d.polarity === "-");

  // If no designs for either side, can't simulate
  if (pDesigns.length === 0 || oDesigns.length === 0) {
    return results;
  }

  for (let i = 0; i < count; i++) {
    // Randomly select designs for each player
    const pDesign = pDesigns[Math.floor(Math.random() * pDesigns.length)];
    const oDesign = oDesigns[Math.floor(Math.random() * oDesigns.length)];

    // Run simulation
    const simResult = runSingleSimulation(pDesign, oDesign, startAddress, maxDepth);
    results.push(simResult);
  }

  return results;
}

/**
 * Run a single simulation between two designs
 */
function runSingleSimulation(
  pDesign: LudicDesignTheory,
  oDesign: LudicDesignTheory,
  startAddress: LudicAddress,
  maxDepth: number
): SimulationResult {
  const convergenceResult = checkConvergence(pDesign, oDesign, maxDepth);

  // Determine winner
  let winner: "P" | "O" | null = null;
  if (convergenceResult.termination === "daimon") {
    // Daimon player loses
    winner = convergenceResult.terminatedBy === "P" ? "O" : "P";
  } else if (convergenceResult.termination === "stuck") {
    // Stuck player loses
    winner = convergenceResult.terminatedBy === "P" ? "O" : "P";
  }

  // Build visitable path
  const path: VisitablePath = {
    actions: convergenceResult.trace ?? [],
    convergent: convergenceResult.converges,
    winner,
    incarnation: convergenceResult.trace ?? [],
  };

  return {
    winner,
    moveCount: convergenceResult.depth,
    convergent: convergenceResult.converges,
    path,
    termination: convergenceResult.termination as "daimon" | "stuck" | "max_depth",
    lastPlayer: convergenceResult.terminatedBy ?? "P",
  };
}

/**
 * Compute average depth from simulation results
 */
export function computeAverageDepth(results: SimulationResult[]): number {
  if (results.length === 0) return 0;

  const totalDepth = results.reduce((sum, r) => sum + r.moveCount, 0);
  return totalDepth / results.length;
}

/**
 * Compute win rate from simulation results
 */
export function computeWinRate(
  results: SimulationResult[],
  polarity: Polarity
): number {
  const player = polarity === "+" ? "P" : "O";
  const wins = results.filter((r) => r.winner === player).length;
  const completed = results.filter((r) => r.winner !== null).length;

  return completed > 0 ? wins / completed : 0.5;
}

// ============================================================================
// WINNING STRATEGY DETECTION
// ============================================================================

/**
 * Check if a winning strategy exists from a position
 * 
 * A winning strategy exists if there's a design without daimon
 * that can respond at this position.
 * 
 * @param designs Available designs
 * @param address Position to check
 * @returns True if winning strategy exists
 */
export function hasWinningStrategy(
  designs: LudicDesignTheory[],
  address: LudicAddress
): boolean {
  const relevant = getDesignsStartingAt(designs, address);
  
  // A position has a winning strategy if there's a design that:
  // 1. Has no daimon (isWinning = true)
  // 2. Has a response at this address
  return relevant.some((d) => d.isWinning && !d.hasDaimon);
}

/**
 * Find all winning designs from a position
 */
export function findWinningDesigns(
  designs: LudicDesignTheory[],
  address: LudicAddress
): LudicDesignTheory[] {
  const relevant = getDesignsStartingAt(designs, address);
  return relevant.filter((d) => !d.hasDaimon);
}

/**
 * Analyze winning potential from a position
 */
export interface WinningPotential {
  /** Position address */
  address: LudicAddress;

  /** Does a winning strategy exist? */
  hasWinning: boolean;

  /** Number of winning designs */
  winningCount: number;

  /** Total designs from here */
  totalCount: number;

  /** Ratio of winning designs */
  winningRatio: number;
}

/**
 * Analyze winning potential at a position
 */
export function analyzeWinningPotential(
  designs: LudicDesignTheory[],
  address: LudicAddress
): WinningPotential {
  const relevant = getDesignsStartingAt(designs, address);
  const winning = findWinningDesigns(relevant, address);

  return {
    address,
    hasWinning: winning.length > 0,
    winningCount: winning.length,
    totalCount: relevant.length,
    winningRatio: relevant.length > 0 ? winning.length / relevant.length : 0,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all addresses from an arena
 */
export function getAllArenaAddresses(arena: DeliberationArena): LudicAddress[] {
  const addresses: LudicAddress[] = [];

  for (const key of arena.positions.keys()) {
    addresses.push(keyToAddress(key));
  }

  return addresses;
}

/**
 * Get arena position at address
 */
export function getArenaPosition(
  arena: DeliberationArena,
  address: LudicAddress
): ArenaPositionTheory | undefined {
  return arena.positions.get(addressToKey(address));
}

/**
 * Clear the analysis cache
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: analysisCache.size,
    keys: [...analysisCache.keys()],
  };
}

/**
 * Compare position strengths
 */
export function comparePositions(
  a: PositionStrength,
  b: PositionStrength
): number {
  // Primary: win rate
  const winDiff = b.winRate - a.winRate;
  if (Math.abs(winDiff) > 0.01) return winDiff;

  // Secondary: winning design count
  const countDiff = b.winningDesignCount - a.winningDesignCount;
  if (countDiff !== 0) return countDiff;

  // Tertiary: shorter depth is better
  return a.depth - b.depth;
}

/**
 * Sort positions by strength (strongest first)
 */
export function sortByStrength(positions: PositionStrength[]): PositionStrength[] {
  return [...positions].sort(comparePositions);
}

/**
 * Find the strongest position
 */
export function findStrongestPosition(
  positions: PositionStrength[]
): PositionStrength | null {
  if (positions.length === 0) return null;
  return sortByStrength(positions)[0];
}

/**
 * Find the weakest position
 */
export function findWeakestPosition(
  positions: PositionStrength[]
): PositionStrength | null {
  if (positions.length === 0) return null;
  const sorted = sortByStrength(positions);
  return sorted[sorted.length - 1];
}
