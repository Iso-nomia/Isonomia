/**
 * DDS Phase 5 - Game Simulation
 * 
 * Simulates games between strategies for analysis.
 */

import type {
  LudicsGame,
  GamePlayState,
  GameStrategy,
  SimulationConfig,
  SimulationResult,
  BatchSimulationResult,
  MoveLogEntry,
} from "./types";
import type { ArenaMove } from "../arena/types";
import {
  initializeGame,
  makeGameMove,
  getStrategyMove,
  isGameOver,
  getGameWinner,
} from "./play";
import { computeAIMove, getRandomMove } from "./ai";

// ============================================================================
// Single Game Simulation
// ============================================================================

/**
 * Simulate a game between two strategies
 */
export function simulateGame(
  game: LudicsGame,
  pStrategyId: string,
  oStrategyId: string,
  config?: SimulationConfig
): SimulationResult {
  const maxMoves = config?.maxMoves ?? 100;
  const timeout = config?.timeout ?? 5000;
  const startTime = Date.now();

  let state = initializeGame(game, {
    pStrategyId,
    oStrategyId,
    mode: "auto",
  });

  while (!isGameOver(state) && state.moveLog.length < maxMoves) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      break;
    }

    const currentPlayer = state.currentPosition.currentPlayer;
    const move = getStrategyMove(state, game, currentPlayer);

    if (!move) {
      // No move from strategy - game ends
      break;
    }

    const newState = makeGameMove(state, move, game, "strategy");
    if (!newState) {
      // Invalid move - game ends
      break;
    }

    state = newState;
  }

  const winner = getGameWinner(state);
  const duration = Date.now() - startTime;

  return {
    winner: winner ?? "draw",
    moveCount: state.moveLog.length,
    trace: state.moveLog,
    duration,
  };
}

/**
 * Simulate a game between strategy and AI
 */
export function simulateVsAI(
  game: LudicsGame,
  strategyId: string,
  strategyPlayer: "P" | "O",
  config?: SimulationConfig
): SimulationResult {
  const maxMoves = config?.maxMoves ?? 100;
  const timeout = config?.timeout ?? 5000;
  const startTime = Date.now();

  const options = strategyPlayer === "P"
    ? { pStrategyId: strategyId, mode: "p_strategy" as const }
    : { oStrategyId: strategyId, mode: "o_strategy" as const };

  let state = initializeGame(game, options);

  while (!isGameOver(state) && state.moveLog.length < maxMoves) {
    if (Date.now() - startTime > timeout) break;

    const currentPlayer = state.currentPosition.currentPlayer;
    let move: ArenaMove | null = null;
    let source: MoveLogEntry["source"] = "manual";

    if (currentPlayer === strategyPlayer) {
      // Strategy plays
      move = getStrategyMove(state, game, currentPlayer);
      source = "strategy";
    } else {
      // AI plays
      const aiResult = computeAIMove(state, game, "medium");
      move = aiResult?.move ?? null;
      source = "ai";
    }

    if (!move) break;

    const newState = makeGameMove(state, move, game, source);
    if (!newState) break;

    state = newState;
  }

  const winner = getGameWinner(state);
  return {
    winner: winner ?? "draw",
    moveCount: state.moveLog.length,
    trace: state.moveLog,
    duration: Date.now() - startTime,
  };
}

/**
 * Simulate random game (for baseline)
 */
export function simulateRandomGame(
  game: LudicsGame,
  config?: SimulationConfig
): SimulationResult {
  const maxMoves = config?.maxMoves ?? 100;
  const startTime = Date.now();

  let state = initializeGame(game, { mode: "manual" });

  while (!isGameOver(state) && state.moveLog.length < maxMoves) {
    const move = getRandomMove(state, game);
    if (!move) break;

    const newState = makeGameMove(state, move, game, "ai");
    if (!newState) break;

    state = newState;
  }

  const winner = getGameWinner(state);
  return {
    winner: winner ?? "draw",
    moveCount: state.moveLog.length,
    trace: state.moveLog,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Batch Simulation
// ============================================================================

/**
 * Run multiple games between two strategies
 */
export function batchSimulate(
  game: LudicsGame,
  pStrategyId: string,
  oStrategyId: string,
  config?: SimulationConfig
): BatchSimulationResult {
  const gameCount = config?.gameCount ?? 10;
  const results: SimulationResult[] = [];

  for (let i = 0; i < gameCount; i++) {
    const result = simulateGame(game, pStrategyId, oStrategyId, config);
    results.push(result);
  }

  const pWins = results.filter(r => r.winner === "P").length;
  const oWins = results.filter(r => r.winner === "O").length;
  const draws = results.filter(r => r.winner === "draw").length;

  const totalMoves = results.reduce((sum, r) => sum + r.moveCount, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  return {
    pStrategy: pStrategyId,
    oStrategy: oStrategyId,
    games: gameCount,
    pWins,
    oWins,
    draws,
    avgMoves: totalMoves / gameCount,
    avgDuration: totalDuration / gameCount,
  };
}

/**
 * Run tournament between all strategy pairs
 */
export function runTournament(
  game: LudicsGame,
  config?: SimulationConfig
): {
  results: BatchSimulationResult[];
  rankings: Array<{ strategyId: string; player: "P" | "O"; wins: number; losses: number }>;
} {
  const pStrategies = game.strategies.filter(s => s.player === "P");
  const oStrategies = game.strategies.filter(s => s.player === "O");
  
  const results: BatchSimulationResult[] = [];
  const winCounts = new Map<string, { wins: number; losses: number; player: "P" | "O" }>();

  // Initialize win counts
  for (const s of pStrategies) {
    winCounts.set(s.id, { wins: 0, losses: 0, player: "P" });
  }
  for (const s of oStrategies) {
    winCounts.set(s.id, { wins: 0, losses: 0, player: "O" });
  }

  // Run all matchups
  for (const pStrat of pStrategies) {
    for (const oStrat of oStrategies) {
      const batchResult = batchSimulate(game, pStrat.id, oStrat.id, {
        ...config,
        gameCount: config?.gameCount ?? 5, // Fewer games per matchup
      });
      
      results.push(batchResult);

      // Update win counts
      const pRecord = winCounts.get(pStrat.id)!;
      const oRecord = winCounts.get(oStrat.id)!;

      pRecord.wins += batchResult.pWins;
      pRecord.losses += batchResult.oWins;
      oRecord.wins += batchResult.oWins;
      oRecord.losses += batchResult.pWins;
    }
  }

  // Build rankings
  const rankings = Array.from(winCounts.entries())
    .map(([strategyId, record]) => ({
      strategyId,
      player: record.player,
      wins: record.wins,
      losses: record.losses,
    }))
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));

  return { results, rankings };
}

// ============================================================================
// Strategy Analysis
// ============================================================================

/**
 * Analyze a strategy's performance
 */
export function analyzeStrategy(
  game: LudicsGame,
  strategyId: string,
  config?: SimulationConfig
): {
  winRate: number;
  avgMoves: number;
  vsAI: { wins: number; losses: number; draws: number };
  vsRandom: { wins: number; losses: number; draws: number };
} {
  const strategy = game.strategies.find(s => s.id === strategyId);
  if (!strategy) {
    return {
      winRate: 0,
      avgMoves: 0,
      vsAI: { wins: 0, losses: 0, draws: 0 },
      vsRandom: { wins: 0, losses: 0, draws: 0 },
    };
  }

  const gameCount = config?.gameCount ?? 10;
  
  // Vs AI
  const vsAIResults: SimulationResult[] = [];
  for (let i = 0; i < gameCount; i++) {
    const result = simulateVsAI(game, strategyId, strategy.player, config);
    vsAIResults.push(result);
  }

  const vsAI = {
    wins: vsAIResults.filter(r => r.winner === strategy.player).length,
    losses: vsAIResults.filter(r => r.winner !== strategy.player && r.winner !== "draw").length,
    draws: vsAIResults.filter(r => r.winner === "draw").length,
  };

  // Vs Random (simple baseline)
  const vsRandomResults: SimulationResult[] = [];
  for (let i = 0; i < gameCount; i++) {
    // Simplified: just use vs AI with easy difficulty
    const result = simulateVsAI(game, strategyId, strategy.player, config);
    vsRandomResults.push(result);
  }

  const vsRandom = {
    wins: vsRandomResults.filter(r => r.winner === strategy.player).length,
    losses: vsRandomResults.filter(r => r.winner !== strategy.player && r.winner !== "draw").length,
    draws: vsRandomResults.filter(r => r.winner === "draw").length,
  };

  const totalGames = gameCount * 2;
  const totalWins = vsAI.wins + vsRandom.wins;
  const totalMoves = [...vsAIResults, ...vsRandomResults].reduce((sum, r) => sum + r.moveCount, 0);

  return {
    winRate: totalWins / totalGames,
    avgMoves: totalMoves / totalGames,
    vsAI,
    vsRandom,
  };
}

/**
 * Find the best strategy for a player
 */
export function findBestStrategy(
  game: LudicsGame,
  player: "P" | "O",
  config?: SimulationConfig
): { strategyId: string; winRate: number } | null {
  const strategies = game.strategies.filter(s => s.player === player);
  if (strategies.length === 0) return null;

  let best: { strategyId: string; winRate: number } | null = null;

  for (const strategy of strategies) {
    const analysis = analyzeStrategy(game, strategy.id, config);
    
    if (!best || analysis.winRate > best.winRate) {
      best = { strategyId: strategy.id, winRate: analysis.winRate };
    }
  }

  return best;
}
