export const dynamic = "force-dynamic";

/**
 * DDS Interactions API Route
 * 
 * POST: Start a new interaction between designs
 * GET: List interactions for an arena/deliberation
 * 
 * Interactions are the normalization (cut-elimination) process between
 * P and O designs. Based on Faggian & Hyland (2002) - disputes and games.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  initializeGame,
  makeGameMove,
  getGameAvailableMoves,
  isGameOver,
  getGameWinner,
  encodeGameState,
  decodeGameState,
} from "@/packages/ludics-core/dds/game";
// Use client-safe imports to avoid pulling in Prisma
import {
  createUniversalArena,
} from "@/packages/ludics-core/dds/arena/client";
import type { LudicsGame, GamePlayState } from "@/packages/ludics-core/dds/game";
import type { UniversalArena } from "@/packages/ludics-core/dds/arena/client";
import { arenaById } from "../arenas/store";
import { 
  interactionStore, 
  interactionsByArena, 
  type InteractionState,
} from "./store";

/**
 * POST /api/ludics/interactions
 * Start a new interaction
 * 
 * Body:
 * - arenaId: required (or arenaConfig to create inline)
 * - posDesignId: required
 * - negDesignId: required
 * - mode?: "manual" | "auto" | "step" (default: "manual")
 * - arenaConfig?: { maxDepth, maxRamification } for inline arena creation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      arenaId,
      arenaConfig,
      posDesignId,
      negDesignId,
      mode = "manual",
    } = body;

    if (!posDesignId || !negDesignId) {
      return NextResponse.json(
        { ok: false, error: "posDesignId and negDesignId are required" },
        { status: 400 }
      );
    }

    // Get or create arena
    let arena: UniversalArena;
    let finalArenaId: string;

    if (arenaId && arenaById.has(arenaId)) {
      arena = arenaById.get(arenaId)!;
      finalArenaId = arenaId;
    } else if (arenaConfig) {
      // Create inline arena
      arena = createUniversalArena({
        maxDepth: arenaConfig.maxDepth ?? 4,
        maxRamification: arenaConfig.maxRamification ?? 3,
      });
      finalArenaId = `arena-inline-${uuidv4().slice(0, 8)}`;
      arena.id = finalArenaId;
    } else {
      // Create default arena
      arena = createUniversalArena({
        maxDepth: 4,
        maxRamification: 3,
      });
      finalArenaId = `arena-default-${uuidv4().slice(0, 8)}`;
      arena.id = finalArenaId;
    }

    // Build game object
    const game: LudicsGame = {
      id: `game-${uuidv4().slice(0, 8)}`,
      deliberationId: (arena as any).deliberationId || "interaction",
      positiveBehaviourId: posDesignId,
      negativeBehaviourId: negDesignId,
      arena,
      strategies: [],
    };

    // Initialize game state
    const gameState = initializeGame(game);

    // Create interaction
    const interactionId = `interaction-${uuidv4().slice(0, 8)}`;
    const interaction: InteractionState = {
      id: interactionId,
      arenaId: finalArenaId,
      posDesignId,
      negDesignId,
      mode,
      status: "active",
      gameState,
      game,
      moveHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store interaction
    interactionStore.set(interactionId, interaction);

    // Index by arena
    if (!interactionsByArena.has(finalArenaId)) {
      interactionsByArena.set(finalArenaId, []);
    }
    interactionsByArena.get(finalArenaId)!.push(interactionId);

    // Get available moves
    const availableMoves = getGameAvailableMoves(gameState, game);

    return NextResponse.json({
      ok: true,
      interaction: {
        id: interactionId,
        arenaId: finalArenaId,
        posDesignId,
        negDesignId,
        mode,
        status: interaction.status,
        currentPlayer: gameState.currentPosition.currentPlayer,
        moveCount: 0,
        createdAt: interaction.createdAt,
      },
      state: {
        gameId: gameState.gameId,
        currentPlayer: gameState.currentPosition.currentPlayer,
        status: gameState.status,
        isGameOver: isGameOver(gameState),
      },
      availableMoves: availableMoves.map(m => ({
        id: m.id,
        address: m.address,
        ramification: m.ramification,
        player: m.player,
      })),
      encoded: encodeGameState(gameState),
    });
  } catch (error: any) {
    console.error("[Interactions POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/interactions
 * List interactions
 * 
 * Query params:
 * - arenaId: filter by arena
 * - status: filter by status
 * - limit: max results (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const arenaId = searchParams.get("arenaId");
    const status = searchParams.get("status") as InteractionState["status"] | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let interactionIds: string[] = [];

    if (arenaId) {
      interactionIds = interactionsByArena.get(arenaId) || [];
    } else {
      interactionIds = Array.from(interactionStore.keys());
    }

    let interactions = interactionIds
      .map(id => interactionStore.get(id))
      .filter((i): i is InteractionState => i !== undefined);

    // Filter by status
    if (status) {
      interactions = interactions.filter(i => i.status === status);
    }

    // Sort by updatedAt desc
    interactions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Limit
    const limited = interactions.slice(0, limit);

    return NextResponse.json({
      ok: true,
      interactions: limited.map(i => ({
        id: i.id,
        arenaId: i.arenaId,
        posDesignId: i.posDesignId,
        negDesignId: i.negDesignId,
        mode: i.mode,
        status: i.status,
        currentPlayer: i.gameState.currentPosition.currentPlayer,
        moveCount: (i.moveHistory || []).length,
        isGameOver: isGameOver(i.gameState),
        winner: i.result?.winner,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
      count: limited.length,
      total: interactions.length,
    });
  } catch (error: any) {
    console.error("[Interactions GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// Re-export stores and types for use by other routes
// re-exports removed: not valid in Next.js route files
