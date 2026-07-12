/**
 * DDS Phase 5 - Game Play
 * 
 * Manages game play state, move application, and turn management.
 */

import type {
  LudicsGame,
  GamePlayState,
  GameStatus,
  MoveLogEntry,
  GameStrategy,
  SerializedMove,
} from "./types";
import type {
  UniversalArena,
  ArenaMove,
  LegalPosition,
} from "../arena/types";
import {
  createGamePlayState,
  createMoveLogEntry,
} from "./types";
import {
  createInitialPosition,
  serializePosition,
  createArenaMove,
} from "../arena/types";
import {
  applyMove,
  getAvailableMoves,
  isTerminalPosition,
  getWinner,
} from "../arena/positions";
import { getStrategyById, getStrategyResponse } from "./construction";

// ============================================================================
// Game Play Initialization
// ============================================================================

/**
 * Initialize a new game play session
 */
export function initializeGame(
  game: LudicsGame,
  options?: {
    pStrategyId?: string;
    oStrategyId?: string;
    mode?: GamePlayState["mode"];
  }
): GamePlayState {
  const initialPosition = createInitialPosition(game.arena.id);
  
  return createGamePlayState(game.id, initialPosition, {
    pStrategyId: options?.pStrategyId,
    oStrategyId: options?.oStrategyId,
    mode: options?.mode ?? "manual",
  });
}

// ============================================================================
// Move Application
// ============================================================================

/**
 * Make a move in the game
 */
export function makeGameMove(
  state: GamePlayState,
  move: ArenaMove,
  game: LudicsGame,
  source: MoveLogEntry["source"] = "manual",
  thinkTime?: number
): GamePlayState | null {
  // Validate game is in playing state
  if (state.status !== "playing") {
    return null;
  }

  // Validate it's the correct player's turn
  if (move.player !== state.currentPosition.currentPlayer) {
    return null;
  }

  // Apply the move
  const newPosition = applyMove(state.currentPosition, move, game.arena);
  if (!newPosition) {
    return null;
  }

  // Create move log entry
  const logEntry = createMoveLogEntry(
    state.moveLog.length + 1,
    move.player,
    move,
    source,
    thinkTime
  );

  // Determine new status
  let newStatus: GameStatus = "playing";
  if (newPosition.isTerminal) {
    const winner = getWinner(newPosition);
    if (winner === "P") {
      newStatus = "p_wins";
    } else if (winner === "O") {
      newStatus = "o_wins";
    } else {
      newStatus = "draw";
    }
  }

  return {
    ...state,
    currentPosition: newPosition,
    status: newStatus,
    moveLog: [...state.moveLog, logEntry],
    lastMoveAt: new Date(),
  };
}

/**
 * Get the next move from a strategy
 */
export function getStrategyMove(
  state: GamePlayState,
  game: LudicsGame,
  player: "P" | "O"
): ArenaMove | null {
  const strategyId = player === "P" ? state.pStrategyId : state.oStrategyId;
  if (!strategyId) return null;

  const strategy = getStrategyById(game, strategyId);
  if (!strategy) return null;

  // Get position key
  const positionKey = serializePosition(state.currentPosition);

  // Get response from strategy
  const response = getStrategyResponse(strategy, positionKey);
  if (!response) return null;

  // Convert to ArenaMove
  const move = createArenaMove(response.address, response.ramification);
  
  // Validate move is available
  const available = getAvailableMoves(state.currentPosition, game.arena);
  const isValid = available.some(
    m => m.address === move.address && 
         arraysEqual(m.ramification, move.ramification)
  );

  if (!isValid) return null;

  // Find the actual move from available (to get proper ID)
  return available.find(
    m => m.address === move.address && 
         arraysEqual(m.ramification, move.ramification)
  ) || null;
}

/**
 * Execute strategy move if applicable
 */
export function executeStrategyMove(
  state: GamePlayState,
  game: LudicsGame
): GamePlayState | null {
  const currentPlayer = state.currentPosition.currentPlayer;
  
  // Check if strategy should play
  const shouldUseStrategy = 
    (state.mode === "auto") ||
    (state.mode === "p_strategy" && currentPlayer === "P") ||
    (state.mode === "o_strategy" && currentPlayer === "O");

  if (!shouldUseStrategy) return null;

  const move = getStrategyMove(state, game, currentPlayer);
  if (!move) return null;

  return makeGameMove(state, move, game, "strategy");
}

// ============================================================================
// Game State Queries
// ============================================================================

/**
 * Get available moves for current position
 */
export function getGameAvailableMoves(
  state: GamePlayState,
  game: LudicsGame
): ArenaMove[] {
  if (state.status !== "playing") return [];
  return getAvailableMoves(state.currentPosition, game.arena);
}

/**
 * Check if game is over
 */
export function isGameOver(state: GamePlayState): boolean {
  return state.status !== "playing" && state.status !== "setup";
}

/**
 * Get the winner of a finished game
 */
export function getGameWinner(state: GamePlayState): "P" | "O" | null {
  if (state.status === "p_wins") return "P";
  if (state.status === "o_wins") return "O";
  return null;
}

/**
 * Get current player
 */
export function getCurrentPlayer(state: GamePlayState): "P" | "O" {
  return state.currentPosition.currentPlayer;
}

/**
 * Get move count
 */
export function getMoveCount(state: GamePlayState): number {
  return state.moveLog.length;
}

// ============================================================================
// Game Control
// ============================================================================

/**
 * Resign the game (current player loses)
 */
export function resignGame(state: GamePlayState): GamePlayState {
  const currentPlayer = state.currentPosition.currentPlayer;
  return {
    ...state,
    status: currentPlayer === "P" ? "o_wins" : "p_wins",
    lastMoveAt: new Date(),
  };
}

/**
 * Abandon the game
 */
export function abandonGame(state: GamePlayState): GamePlayState {
  return {
    ...state,
    status: "abandoned",
    lastMoveAt: new Date(),
  };
}

/**
 * Request draw (both players must agree - simplified: just set draw)
 */
export function declareDraw(state: GamePlayState): GamePlayState {
  return {
    ...state,
    status: "draw",
    lastMoveAt: new Date(),
  };
}

/**
 * Undo last move (if possible)
 */
export function undoLastMove(
  state: GamePlayState,
  game: LudicsGame
): GamePlayState | null {
  if (state.moveLog.length === 0) return null;
  if (state.status !== "playing") return null;

  // Replay all moves except the last one
  let newState = initializeGame(game, {
    pStrategyId: state.pStrategyId,
    oStrategyId: state.oStrategyId,
    mode: state.mode,
  });

  for (let i = 0; i < state.moveLog.length - 1; i++) {
    const entry = state.moveLog[i];
    const result = makeGameMove(newState, entry.move, game, entry.source);
    if (!result) return null;
    newState = result;
  }

  return newState;
}

// ============================================================================
// Game Analysis
// ============================================================================

/**
 * Get game statistics
 */
export function getGamePlayStats(state: GamePlayState): {
  moveCount: number;
  pMoves: number;
  oMoves: number;
  avgThinkTime: number;
  duration: number;
} {
  const pMoves = state.moveLog.filter(m => m.player === "P").length;
  const oMoves = state.moveLog.filter(m => m.player === "O").length;
  
  const thinkTimes = state.moveLog
    .filter(m => m.thinkTime !== undefined)
    .map(m => m.thinkTime!);
  
  const avgThinkTime = thinkTimes.length > 0
    ? thinkTimes.reduce((a, b) => a + b, 0) / thinkTimes.length
    : 0;

  const duration = state.lastMoveAt
    ? state.lastMoveAt.getTime() - state.startedAt.getTime()
    : Date.now() - state.startedAt.getTime();

  return {
    moveCount: state.moveLog.length,
    pMoves,
    oMoves,
    avgThinkTime,
    duration,
  };
}

/**
 * Get move history as readable format
 */
export function getMoveHistory(state: GamePlayState): string[] {
  return state.moveLog.map((entry, idx) => {
    const moveStr = `${entry.move.address}[${entry.move.ramification.join(",")}]`;
    return `${idx + 1}. ${entry.player}: ${moveStr}`;
  });
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
