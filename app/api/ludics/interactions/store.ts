/**
 * Shared in-memory store for ludic interactions
 * 
 * This module uses a singleton pattern to ensure the store persists
 * across module reloads in Next.js development mode.
 */

import type { LudicsGame, GamePlayState } from "@/packages/ludics-core/dds/game";

// Types for interaction management
export interface InteractionState {
  id: string;
  arenaId: string;
  posDesignId: string;
  negDesignId: string;
  mode: "manual" | "auto" | "step";
  status: "active" | "completed" | "paused" | "error";
  gameState: GamePlayState;
  game: LudicsGame;
  moveHistory: Array<{
    moveNumber: number;
    player: "P" | "O";
    address: string;
    ramification: number[];
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  result?: {
    winner: "P" | "O" | "draw" | null;
    totalMoves: number;
    endReason: "terminal" | "stuck" | "daimon" | "max-moves" | "manual-stop";
  };
}

// Use global to persist across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __ludicsInteractionStore: Map<string, InteractionState> | undefined;
  // eslint-disable-next-line no-var
  var __ludicsInteractionsByArena: Map<string, string[]> | undefined;
}

// Create or reuse the global stores
export const interactionStore: Map<string, InteractionState> = 
  globalThis.__ludicsInteractionStore ?? new Map();

export const interactionsByArena: Map<string, string[]> = 
  globalThis.__ludicsInteractionsByArena ?? new Map();

// Persist to global in development
if (process.env.NODE_ENV !== "production") {
  globalThis.__ludicsInteractionStore = interactionStore;
  globalThis.__ludicsInteractionsByArena = interactionsByArena;
}

// Debug helper
export function getStoreStats() {
  return {
    interactionCount: interactionStore.size,
    arenaCount: interactionsByArena.size,
    interactionIds: Array.from(interactionStore.keys()),
  };
}
