/**
 * DDS Phase 4 - Game State Persistence
 * 
 * Save/load game states with compact encoding.
 * Based on design document §8.1.
 */

import type { LudicsGame, GamePlayState } from "./types";
import type { ArenaMove, UniversalArena } from "../arena/types";
import {
  validatePosition,
  computeViewForSequence,
} from "../arena/positions";

/**
 * Compact encoded game state for storage
 * Designed for minimal storage footprint
 */
export type EncodedGameState = {
  /** Version for forward compatibility */
  v: number;
  /** Game ID */
  g: string;
  /** Arena ID reference */
  a: string;
  /** Move sequence as address:ramification pairs (e.g., "0:1,2|01:3|012:1,4") */
  m: string;
  /** Current player: 0=P, 1=O */
  p: 0 | 1;
  /** Status: 0=setup, 1=playing, 2=p_wins, 3=o_wins, 4=draw, 5=abandoned */
  s: 0 | 1 | 2 | 3 | 4 | 5;
  /** Timestamp (unix seconds) */
  t: number;
  /** P Strategy ID (optional) */
  ps?: string;
  /** O Strategy ID (optional) */
  os?: string;
  /** Mode: 0=manual, 1=p_strategy, 2=o_strategy, 3=auto */
  md?: 0 | 1 | 2 | 3;
};

/**
 * Exported game state with full game info for sharing
 */
export type ExportedGameState = {
  version: number;
  exportedAt: string;
  game: {
    id: string;
    name?: string;
    deliberationId: string;
    positiveBehaviourId: string;
    negativeBehaviourId: string;
  };
  arena: {
    id: string;
    base: string;
    moveCount: number;
  };
  state: EncodedGameState;
  metadata?: {
    exportedBy?: string;
    description?: string;
  };
};

const STATUS_MAP = {
  setup: 0,
  playing: 1,
  p_wins: 2,
  o_wins: 3,
  draw: 4,
  abandoned: 5,
} as const;

const STATUS_REVERSE = {
  0: "setup",
  1: "playing",
  2: "p_wins",
  3: "o_wins",
  4: "draw",
  5: "abandoned",
} as const;

const MODE_MAP = {
  manual: 0,
  p_strategy: 1,
  o_strategy: 2,
  auto: 3,
} as const;

const MODE_REVERSE = {
  0: "manual",
  1: "p_strategy",
  2: "o_strategy",
  3: "auto",
} as const;

/**
 * Encode a move to compact string format
 */
function encodeMove(move: ArenaMove): string {
  const ram = move.ramification.length > 0 ? move.ramification.join(",") : "";
  return `${move.address}:${ram}`;
}

/**
 * Decode a move from compact string format
 */
function decodeMove(
  encoded: string,
  arena: UniversalArena,
  index: number
): ArenaMove {
  const [address, ramStr] = encoded.split(":");
  const ramification = ramStr ? ramStr.split(",").map(Number).filter(n => !isNaN(n)) : [];
  
  // Find matching move in arena or create one
  const existingMove = arena.moves.find(
    (m) => m.address === address && 
    m.ramification.length === ramification.length &&
    m.ramification.every((r, i) => r === ramification[i])
  );
  
  if (existingMove) {
    return existingMove;
  }
  
  // Reconstruct move
  const player = address.length % 2 === 0 ? "P" : "O";
  return {
    id: `move-${index}-${address}`,
    address,
    ramification,
    player: player as "P" | "O",
    isInitial: address === "" || address === "<>",
  };
}

/**
 * Encode game state for storage
 * 
 * Storage Estimate:
 * - Typical game (20 moves): ~200 bytes encoded vs ~5KB uncompressed
 * - Can store ~25x more games in same space
 */
export function encodeGameState(state: GamePlayState): EncodedGameState {
  const moveStr = state.moveLog
    .map((entry) => encodeMove(entry.move))
    .join("|");

  return {
    v: 1,
    g: state.gameId,
    a: state.currentPosition.arenaId,
    m: moveStr,
    p: state.currentPosition.currentPlayer === "P" ? 0 : 1,
    s: STATUS_MAP[state.status],
    t: Math.floor(Date.now() / 1000),
    ps: state.pStrategyId,
    os: state.oStrategyId,
    md: MODE_MAP[state.mode],
  };
}

/**
 * Decode game state from storage
 */
export function decodeGameState(
  encoded: EncodedGameState,
  arena: UniversalArena
): GamePlayState {
  // Parse moves
  const moveStrs = encoded.m.split("|").filter(Boolean);
  const moves = moveStrs.map((ms, i) => decodeMove(ms, arena, i));
  
  // Build move log
  const moveLog = moves.map((move, i) => ({
    moveNumber: i + 1,
    player: (i % 2 === 0 ? "P" : "O") as "P" | "O",
    move,
    source: "manual" as const,
    timestamp: new Date(encoded.t * 1000),
  }));

  // Determine current player
  const currentPlayer = encoded.p === 0 ? "P" : "O";

  // Build position
  const position = {
    id: `pos-${encoded.g}-${moves.length}`,
    arenaId: encoded.a,
    sequence: moves,
    length: moves.length,
    currentPlayer: currentPlayer as "P" | "O",
    pView: computeViewForSequence(moves, "P"),
    oView: computeViewForSequence(moves, "O"),
    isTerminal: encoded.s >= 2 && encoded.s <= 4,
    validity: validatePosition(moves, arena),
  };

  return {
    gameId: encoded.g,
    currentPosition: position,
    pStrategyId: encoded.ps,
    oStrategyId: encoded.os,
    mode: MODE_REVERSE[encoded.md || 0],
    status: STATUS_REVERSE[encoded.s],
    moveLog,
    startedAt: new Date(encoded.t * 1000),
  };
}

/**
 * Export game state for sharing
 */
export function exportGameState(
  game: LudicsGame,
  state: GamePlayState,
  metadata?: { exportedBy?: string; description?: string }
): ExportedGameState {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    game: {
      id: game.id,
      name: game.name,
      deliberationId: game.deliberationId,
      positiveBehaviourId: game.positiveBehaviourId,
      negativeBehaviourId: game.negativeBehaviourId,
    },
    arena: {
      id: game.arena.id,
      base: game.arena.base || "<>",
      moveCount: game.arena.moves.length,
    },
    state: encodeGameState(state),
    metadata,
  };
}

/**
 * Import game state from exported format
 */
export function importGameState(
  exported: ExportedGameState,
  arena: UniversalArena
): { game: Partial<LudicsGame>; state: GamePlayState } {
  const state = decodeGameState(exported.state, arena);
  
  return {
    game: {
      id: exported.game.id,
      name: exported.game.name,
      deliberationId: exported.game.deliberationId,
      positiveBehaviourId: exported.game.positiveBehaviourId,
      negativeBehaviourId: exported.game.negativeBehaviourId,
    },
    state,
  };
}

/**
 * Serialize game state to JSON string
 */
export function serializeGameState(state: GamePlayState): string {
  const encoded = encodeGameState(state);
  return JSON.stringify(encoded);
}

/**
 * Deserialize game state from JSON string
 */
export function deserializeGameState(
  json: string,
  arena: UniversalArena
): GamePlayState {
  const encoded = JSON.parse(json) as EncodedGameState;
  return decodeGameState(encoded, arena);
}

/**
 * Estimate compression ratio for a game state
 */
export function estimateCompressionRatio(state: GamePlayState): {
  encodedSize: number;
  fullSize: number;
  ratio: number;
} {
  const encoded = encodeGameState(state);
  const encodedSize = JSON.stringify(encoded).length;
  const fullSize = JSON.stringify(state).length;
  
  return {
    encodedSize,
    fullSize,
    ratio: fullSize / encodedSize,
  };
}

/**
 * Local storage key prefix for saved games
 */
const STORAGE_KEY_PREFIX = "ludics_game_";

/**
 * Save game state to local storage
 */
export function saveGameToLocalStorage(
  gameId: string,
  state: GamePlayState
): void {
  if (typeof window === "undefined") return;
  
  const key = `${STORAGE_KEY_PREFIX}${gameId}`;
  const encoded = encodeGameState(state);
  localStorage.setItem(key, JSON.stringify(encoded));
}

/**
 * Load game state from local storage
 */
export function loadGameFromLocalStorage(
  gameId: string,
  arena: UniversalArena
): GamePlayState | null {
  if (typeof window === "undefined") return null;
  
  const key = `${STORAGE_KEY_PREFIX}${gameId}`;
  const json = localStorage.getItem(key);
  
  if (!json) return null;
  
  try {
    const encoded = JSON.parse(json) as EncodedGameState;
    return decodeGameState(encoded, arena);
  } catch {
    return null;
  }
}

/**
 * List all saved games from local storage
 */
export function listSavedGames(): Array<{ gameId: string; timestamp: number }> {
  if (typeof window === "undefined") return [];
  
  const games: Array<{ gameId: string; timestamp: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      const gameId = key.slice(STORAGE_KEY_PREFIX.length);
      try {
        const json = localStorage.getItem(key);
        if (json) {
          const encoded = JSON.parse(json) as EncodedGameState;
          games.push({ gameId, timestamp: encoded.t });
        }
      } catch {
        // Skip invalid entries
      }
    }
  }
  
  return games.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a saved game from local storage
 */
export function deleteSavedGame(gameId: string): void {
  if (typeof window === "undefined") return;
  
  const key = `${STORAGE_KEY_PREFIX}${gameId}`;
  localStorage.removeItem(key);
}

/**
 * Clear all saved games from local storage
 */
export function clearAllSavedGames(): void {
  if (typeof window === "undefined") return;
  
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
