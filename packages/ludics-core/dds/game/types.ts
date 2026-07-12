/**
 * DDS Phase 5 - Game Types
 * 
 * Based on Faggian & Hyland (2002) - Section 6.2
 * 
 * Games are pairs of orthogonal behaviours (A, A⊥).
 */

import type {
  UniversalArena,
  ArenaMove,
  LegalPosition,
  EncodedGameState,
} from "../arena/types";

// ============================================================================
// Game Types
// ============================================================================

/**
 * Ludics Game - Pair of orthogonal behaviours (A, A⊥)
 * 
 * A game represents an interactive structure where:
 * - Proponent (P) plays strategies from behaviour A
 * - Opponent (O) plays strategies from behaviour A⊥
 */
export type LudicsGame = {
  id: string;
  name?: string;
  deliberationId: string;
  /** Positive behaviour (A) - Proponent's strategies */
  positiveBehaviourId: string;
  /** Negative behaviour (A⊥) - Opponent's strategies */
  negativeBehaviourId: string;
  /** The arena structure */
  arena: UniversalArena;
  /** Available strategies for both players */
  strategies: GameStrategy[];
  /** Metadata */
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Strategy within a game context
 */
export type GameStrategy = {
  id: string;
  gameId: string;
  /** Source design/strategy ID from behaviour */
  sourceDesignId: string;
  /** Which player uses this strategy */
  player: "P" | "O";
  /** Name/label for the strategy */
  name?: string;
  /** Response function: position key → move */
  responseMap: Record<string, SerializedMove>;
  /** Analysis results */
  analysis?: StrategyAnalysis;
};

/**
 * Serialized move for response map storage
 */
export type SerializedMove = {
  address: string;
  ramification: number[];
};

/**
 * Strategy analysis results
 */
export type StrategyAnalysis = {
  /** Is this strategy winning for the player? */
  isWinning: boolean;
  /** Win rate against all opponent strategies (0-1) */
  winRate?: number;
  /** Positions where this strategy wins */
  winningPositions?: string[];
  /** Key decision points */
  criticalPositions?: string[];
};

// ============================================================================
// Game Play State
// ============================================================================

/**
 * Live game play state
 */
export type GamePlayState = {
  gameId: string;
  /** Current position in the game */
  currentPosition: LegalPosition;
  /** Selected strategy for P (if using strategy mode) */
  pStrategyId?: string;
  /** Selected strategy for O (if using strategy mode) */
  oStrategyId?: string;
  /** Play mode */
  mode: "manual" | "p_strategy" | "o_strategy" | "auto";
  /** Game status */
  status: GameStatus;
  /** Move history */
  moveLog: MoveLogEntry[];
  /** Timestamps */
  startedAt: Date;
  lastMoveAt?: Date;
};

/**
 * Game status
 */
export type GameStatus = 
  | "setup"      // Game created but not started
  | "playing"    // Game in progress
  | "p_wins"     // Proponent won
  | "o_wins"     // Opponent won
  | "draw"       // No winner (e.g., max moves reached)
  | "abandoned"; // Game abandoned

/**
 * Move log entry
 */
export type MoveLogEntry = {
  moveNumber: number;
  player: "P" | "O";
  move: ArenaMove;
  /** How the move was selected */
  source: "manual" | "strategy" | "ai";
  /** Time taken for this move (ms) */
  thinkTime?: number;
  timestamp: Date;
};

// ============================================================================
// Game Construction Options
// ============================================================================

/**
 * Options for constructing a game
 */
export type GameConstructionOptions = {
  /** Name for the game */
  name?: string;
  /** Maximum arena depth to generate */
  maxArenaDepth?: number;
  /** Maximum ramification per move */
  maxRamification?: number;
  /** Whether to extract strategies from behaviours */
  extractStrategies?: boolean;
  /** Whether to analyze strategies for winning */
  analyzeStrategies?: boolean;
};

/**
 * Result of game construction
 */
export type GameConstructionResult = {
  game: LudicsGame;
  /** Statistics about the constructed game */
  stats: GameStats;
  /** Any warnings during construction */
  warnings?: string[];
};

/**
 * Game statistics
 */
export type GameStats = {
  /** Number of moves in arena */
  arenaMoveCount: number;
  /** Maximum arena depth */
  arenaMaxDepth: number;
  /** Number of P strategies */
  pStrategyCount: number;
  /** Number of O strategies */
  oStrategyCount: number;
  /** Estimated game tree size */
  estimatedPositions?: number;
};

// ============================================================================
// AI Types
// ============================================================================

/**
 * AI difficulty level
 */
export type AIDifficulty = "easy" | "medium" | "hard";

/**
 * AI move selection result
 */
export type AIMoveResult = {
  move: ArenaMove;
  /** Score assigned to this move */
  score: number;
  /** Reason for selection */
  reason: string;
  /** Alternative moves considered */
  alternatives?: Array<{ move: ArenaMove; score: number }>;
  /** Time taken to compute (ms) */
  computeTime: number;
};

/**
 * Move scoring weights for AI
 */
export type AIScoringWeights = {
  /** Weight for opening more sub-addresses */
  ramificationBonus: number;
  /** Weight for central positions (closer to root) */
  centralityBonus: number;
  /** Weight for limiting opponent options */
  restrictionBonus: number;
  /** Bonus for winning moves */
  winningBonus: number;
  /** Random factor (0-1) */
  randomness: number;
};

// ============================================================================
// Game Simulation Types
// ============================================================================

/**
 * Simulation configuration
 */
export type SimulationConfig = {
  /** Maximum moves before declaring draw */
  maxMoves?: number;
  /** Timeout per game (ms) */
  timeout?: number;
  /** Number of games to simulate */
  gameCount?: number;
};

/**
 * Single game simulation result
 */
export type SimulationResult = {
  winner: "P" | "O" | "draw";
  moveCount: number;
  trace: MoveLogEntry[];
  duration: number;
};

/**
 * Batch simulation results
 */
export type BatchSimulationResult = {
  pStrategy: string;
  oStrategy: string;
  games: number;
  pWins: number;
  oWins: number;
  draws: number;
  avgMoves: number;
  avgDuration: number;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new game play state
 */
export function createGamePlayState(
  gameId: string,
  initialPosition: LegalPosition,
  options?: {
    pStrategyId?: string;
    oStrategyId?: string;
    mode?: GamePlayState["mode"];
  }
): GamePlayState {
  return {
    gameId,
    currentPosition: initialPosition,
    pStrategyId: options?.pStrategyId,
    oStrategyId: options?.oStrategyId,
    mode: options?.mode ?? "manual",
    status: "playing",
    moveLog: [],
    startedAt: new Date(),
  };
}

/**
 * Create move log entry
 */
export function createMoveLogEntry(
  moveNumber: number,
  player: "P" | "O",
  move: ArenaMove,
  source: MoveLogEntry["source"],
  thinkTime?: number
): MoveLogEntry {
  return {
    moveNumber,
    player,
    move,
    source,
    thinkTime,
    timestamp: new Date(),
  };
}

/**
 * Get default AI scoring weights for difficulty
 */
export function getAIScoringWeights(difficulty: AIDifficulty): AIScoringWeights {
  switch (difficulty) {
    case "easy":
      return {
        ramificationBonus: 5,
        centralityBonus: 2,
        restrictionBonus: 1,
        winningBonus: 100,
        randomness: 0.5,
      };
    case "medium":
      return {
        ramificationBonus: 10,
        centralityBonus: 5,
        restrictionBonus: 5,
        winningBonus: 500,
        randomness: 0.2,
      };
    case "hard":
      return {
        ramificationBonus: 10,
        centralityBonus: 5,
        restrictionBonus: 10,
        winningBonus: 1000,
        randomness: 0.05,
      };
  }
}
