/**
 * DDS Phase 5 - Game Module Index
 * 
 * Exports all game-related types and functions.
 */

// Types
export type {
  LudicsGame,
  GameStrategy,
  SerializedMove,
  StrategyAnalysis,
  GamePlayState,
  GameStatus,
  MoveLogEntry,
  GameConstructionOptions,
  GameConstructionResult,
  GameStats,
  AIDifficulty,
  AIMoveResult,
  AIScoringWeights,
  SimulationConfig,
  SimulationResult,
  BatchSimulationResult,
} from "./types";

// Type factory functions
export {
  createGamePlayState,
  createMoveLogEntry,
  getAIScoringWeights,
} from "./types";

// Game construction
export {
  constructGame,
  getStrategyById,
  getStrategiesForPlayer,
  getStrategyResponse,
  canFormGame,
  serializeGame,
  getGameSummary,
} from "./construction";

// Game play
export {
  initializeGame,
  makeGameMove,
  getStrategyMove,
  executeStrategyMove,
  getGameAvailableMoves,
  isGameOver,
  getGameWinner,
  getCurrentPlayer,
  getMoveCount,
  resignGame,
  abandonGame,
  declareDraw,
  undoLastMove,
  getGamePlayStats,
  getMoveHistory,
} from "./play";

// AI
export {
  computeAIMove,
  computeAIMoveWithLookahead,
  getSmartAIMove,
  getRandomMove,
} from "./ai";

// Simulation
export {
  simulateGame,
  simulateVsAI,
  simulateRandomGame,
  batchSimulate,
  runTournament,
  analyzeStrategy,
  findBestStrategy,
} from "./simulation";

// Encoding
export {
  encodeGameState,
  decodeGameState,
  encodeGame,
  encodeMoveSequence,
  decodeMoveSequence,
  encodeMoveLog,
  decodeMoveLog,
  hashPosition,
  positionToKey,
  estimateCompressionRatio,
} from "./encoding";

// Persistence (Phase 4)
export type {
  EncodedGameState,
  ExportedGameState,
} from "./persistence";

export {
  exportGameState,
  importGameState,
  serializeGameState,
  deserializeGameState,
  saveGameToLocalStorage,
  loadGameFromLocalStorage,
  listSavedGames,
  deleteSavedGame,
  clearAllSavedGames,
} from "./persistence";
