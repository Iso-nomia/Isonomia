/**
 * DDS Phase 5 - Game Construction
 * 
 * Based on Faggian & Hyland (2002) - Section 6.2
 * 
 * Constructs games from orthogonal behaviours.
 */

import type { Behaviour } from "../behaviours/types";
import type { DesignForCorrespondence } from "../correspondence/types";
import type {
  LudicsGame,
  GameStrategy,
  GameConstructionOptions,
  GameConstructionResult,
  GameStats,
  SerializedMove,
} from "./types";
import type { UniversalArena, ArenaMove } from "../arena/types";
import {
  createUniversalArena,
  createArenaFromDesigns,
  getArenaStats,
} from "../arena/arena";
import { serializePosition } from "../arena/types";

// ============================================================================
// Game Construction
// ============================================================================

/**
 * Construct a game from two orthogonal behaviours
 * 
 * A game G = (A, A⊥) where:
 * - A is the positive behaviour (Proponent's strategies)
 * - A⊥ is the negative behaviour (Opponent's strategies)
 */
export function constructGame(
  positiveBehaviour: Behaviour,
  negativeBehaviour: Behaviour,
  designs: DesignForCorrespondence[],
  options?: GameConstructionOptions
): GameConstructionResult {
  const opts = {
    maxArenaDepth: 4,
    maxRamification: 3,
    extractStrategies: true,
    analyzeStrategies: false,
    ...options,
  };

  const warnings: string[] = [];
  const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Extract arena from both behaviours' designs
  const allDesignIds = [
    ...positiveBehaviour.closureDesignIds,
    ...negativeBehaviour.closureDesignIds,
  ];
  
  const relevantDesigns = designs.filter(d => allDesignIds.includes(d.id));
  
  let arena: UniversalArena;
  
  if (relevantDesigns.length > 0) {
    // Build arena from designs
    const designData = relevantDesigns.map(d => ({
      id: d.id,
      acts: (d.acts || []).map(a => ({
        id: a.id,
        locusPath: a.locusPath || "",
        ramification: (Array.isArray(a.ramification) ? a.ramification : [])
          .map((r) => Number(r))
          .filter((r) => Number.isFinite(r)),
        polarity: a.polarity,
      })),
    }));
    
    arena = createArenaFromDesigns(designData, {
      id: `arena-${gameId}`,
      deliberationId: positiveBehaviour.deliberationId,
    });
  } else {
    // Create default universal arena
    arena = createUniversalArena({
      id: `arena-${gameId}`,
      maxDepth: opts.maxArenaDepth,
      maxRamification: opts.maxRamification,
      deliberationId: positiveBehaviour.deliberationId,
    });
    
    warnings.push("No designs found, using default universal arena");
  }

  // Extract strategies if requested
  const strategies: GameStrategy[] = [];
  
  if (opts.extractStrategies) {
    // Extract P strategies from positive behaviour
    const pStrategies = extractStrategiesFromBehaviour(
      positiveBehaviour,
      designs,
      gameId,
      "P"
    );
    strategies.push(...pStrategies);
    
    // Extract O strategies from negative behaviour
    const oStrategies = extractStrategiesFromBehaviour(
      negativeBehaviour,
      designs,
      gameId,
      "O"
    );
    strategies.push(...oStrategies);
  }

  const game: LudicsGame = {
    id: gameId,
    name: opts.name,
    deliberationId: positiveBehaviour.deliberationId,
    positiveBehaviourId: positiveBehaviour.id,
    negativeBehaviourId: negativeBehaviour.id,
    arena,
    strategies,
    createdAt: new Date(),
  };

  // Compute stats
  const arenaStats = getArenaStats(arena);
  const stats: GameStats = {
    arenaMoveCount: arenaStats.moveCount,
    arenaMaxDepth: arenaStats.maxDepth,
    pStrategyCount: strategies.filter(s => s.player === "P").length,
    oStrategyCount: strategies.filter(s => s.player === "O").length,
    estimatedPositions: estimatePositionCount(arena),
  };

  return {
    game,
    stats,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Extract strategies from a behaviour's designs
 */
function extractStrategiesFromBehaviour(
  behaviour: Behaviour,
  allDesigns: DesignForCorrespondence[],
  gameId: string,
  player: "P" | "O"
): GameStrategy[] {
  const strategies: GameStrategy[] = [];
  
  const behaviourDesigns = allDesigns.filter(
    d => behaviour.closureDesignIds.includes(d.id)
  );
  
  for (const design of behaviourDesigns) {
    const responseMap = buildResponseMapFromDesign(design, player);
    
    strategies.push({
      id: `strategy-${design.id}-${player}`,
      gameId,
      sourceDesignId: design.id,
      player,
      name: `${player}-Strategy-${strategies.length + 1}`,
      responseMap,
    });
  }
  
  return strategies;
}

/**
 * Build a response map from a design's action sequence
 */
function buildResponseMapFromDesign(
  design: DesignForCorrespondence,
  player: "P" | "O"
): Record<string, SerializedMove> {
  const responseMap: Record<string, SerializedMove> = {};
  const acts = design.acts || [];
  
  // Build position prefixes and map responses
  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    const actPlayer = act.polarity === "P" ? "P" : "O";
    
    // Only include responses for this player
    if (actPlayer !== player) continue;
    
    // Build position key from preceding acts
    const precedingActs = acts.slice(0, i);
    const positionKey = precedingActs
      .map(a => `${a.locusPath || ""}:${(a.ramification || []).join(",")}`)
      .join("|");
    
    responseMap[positionKey] = {
      address: act.locusPath || "",
      ramification: (Array.isArray(act.ramification) ? act.ramification : [])
        .map((r) => Number(r))
        .filter((r) => Number.isFinite(r)),
    };
  }
  
  return responseMap;
}

/**
 * Estimate the number of legal positions in a game
 */
function estimatePositionCount(arena: UniversalArena): number {
  // Rough estimate based on branching factor and depth
  const stats = getArenaStats(arena);
  const avgBranching = arena.moves.length > 0 
    ? arena.moves.reduce((sum, m) => sum + m.ramification.length, 0) / arena.moves.length
    : 2;
  
  // Estimate: sum of branching^depth for each depth
  let estimate = 1;
  for (let d = 1; d <= stats.maxDepth; d++) {
    estimate += Math.pow(avgBranching, d);
  }
  
  return Math.min(estimate, 100000); // Cap at 100k
}

// ============================================================================
// Game Queries
// ============================================================================

/**
 * Get strategy by ID
 */
export function getStrategyById(
  game: LudicsGame,
  strategyId: string
): GameStrategy | undefined {
  return game.strategies.find(s => s.id === strategyId);
}

/**
 * Get strategies for a player
 */
export function getStrategiesForPlayer(
  game: LudicsGame,
  player: "P" | "O"
): GameStrategy[] {
  return game.strategies.filter(s => s.player === player);
}

/**
 * Get response from strategy for a position
 */
export function getStrategyResponse(
  strategy: GameStrategy,
  positionKey: string
): SerializedMove | undefined {
  return strategy.responseMap[positionKey];
}

/**
 * Check if two behaviours can form a valid game
 * (they must be orthogonal)
 */
export function canFormGame(
  behaviour1: Behaviour,
  behaviour2: Behaviour
): boolean {
  // Basic check: they should be from the same deliberation
  // Full orthogonality check would require running the orthogonality algorithm
  return behaviour1.deliberationId === behaviour2.deliberationId;
}

// ============================================================================
// Game Serialization
// ============================================================================

/**
 * Serialize game for storage (compact format)
 */
export function serializeGame(game: LudicsGame): object {
  return {
    id: game.id,
    name: game.name,
    deliberationId: game.deliberationId,
    positiveBehaviourId: game.positiveBehaviourId,
    negativeBehaviourId: game.negativeBehaviourId,
    arenaId: game.arena.id,
    strategyCount: game.strategies.length,
    createdAt: game.createdAt?.toISOString(),
  };
}

/**
 * Get game summary
 */
export function getGameSummary(game: LudicsGame): {
  id: string;
  name?: string;
  pStrategies: number;
  oStrategies: number;
  arenaMoves: number;
} {
  return {
    id: game.id,
    name: game.name,
    pStrategies: game.strategies.filter(s => s.player === "P").length,
    oStrategies: game.strategies.filter(s => s.player === "O").length,
    arenaMoves: game.arena.moves.length,
  };
}
