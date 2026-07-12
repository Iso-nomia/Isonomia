export const dynamic = "force-dynamic";

/**
 * DDS Game Play API Route
 * 
 * POST: Make a move, get AI move, or manage game state
 */

import { NextRequest, NextResponse } from "next/server";
import {
  initializeGame,
  makeGameMove,
  getGameAvailableMoves,
  computeAIMove,
  getSmartAIMove,
  encodeGameState,
  decodeGameState,
  isGameOver,
  getGameWinner,
  getMoveHistory,
  getGamePlayStats,
} from "@/packages/ludics-core/dds/game";
// Use client-safe imports to avoid pulling in Prisma
import {
  createUniversalArena,
  createArenaMove,
} from "@/packages/ludics-core/dds/arena/client";
import type { LudicsGame, GamePlayState, AIDifficulty } from "@/packages/ludics-core/dds/game";
import type { UniversalArena } from "@/packages/ludics-core/dds/arena/client";

// In-memory game state storage (for demo purposes)
const gameStates = new Map<string, GamePlayState>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      action, 
      gameId, 
      move, 
      difficulty,
      encodedState,
      arenaConfig,
    } = body;

    // Build or fetch arena
    let arena: UniversalArena;
    if (arenaConfig?.moves) {
      arena = arenaConfig as UniversalArena;
    } else {
      arena = createUniversalArena({
        maxDepth: arenaConfig?.maxDepth ?? 4,
        maxRamification: arenaConfig?.maxRamification ?? 3,
      });
    }

    // Build minimal game object for operations
    const game: LudicsGame = {
      id: gameId || `game-temp-${Date.now()}`,
      deliberationId: body.deliberationId || "temp",
      positiveBehaviourId: "temp-p",
      negativeBehaviourId: "temp-o",
      arena,
      strategies: [],
    };

    // Decode, retrieve from cache, or initialize game state
    let state: GamePlayState;
    if (encodedState) {
      state = decodeGameState(encodedState, arena);
    } else if (gameStates.has(game.id)) {
      // Use cached state for this game
      state = gameStates.get(game.id)!;
    } else {
      state = initializeGame(game);
    }

    switch (action) {
      case "initialize": {
        // Initialize and cache state
        state = initializeGame(game);
        gameStates.set(game.id, state);
        
        const encoded = encodeGameState(state);
        const available = getGameAvailableMoves(state, game);

        return NextResponse.json({
          ok: true,
          state: {
            gameId: state.gameId,
            currentPlayer: state.currentPosition.currentPlayer,
            status: state.status,
            moveCount: state.moveLog.length,
            isGameOver: isGameOver(state),
          },
          availableMoves: available.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded,
        });
      }

      case "move": {
        // Make a player move
        if (!move) {
          return NextResponse.json(
            { ok: false, error: "move is required" },
            { status: 400 }
          );
        }

        const arenaMove = createArenaMove(
          move.address,
          move.ramification || [],
          { id: move.id }
        );

        const newState = makeGameMove(state, arenaMove, game, "manual");
        if (!newState) {
          return NextResponse.json(
            { ok: false, error: `Invalid move: expected ${state.currentPosition.currentPlayer} to move, got address "${move.address}" (player ${arenaMove.player})` },
            { status: 400 }
          );
        }

        // Cache the new state
        gameStates.set(game.id, newState);

        const encoded = encodeGameState(newState);
        const available = getGameAvailableMoves(newState, game);

        return NextResponse.json({
          ok: true,
          state: {
            gameId: newState.gameId,
            currentPlayer: newState.currentPosition.currentPlayer,
            status: newState.status,
            moveCount: newState.moveLog.length,
            isGameOver: isGameOver(newState),
            winner: getGameWinner(newState),
          },
          availableMoves: available.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded,
          history: getMoveHistory(newState),
        });
      }

      case "ai_move": {
        // Get AI's move
        const aiDifficulty: AIDifficulty = difficulty || "medium";
        const aiResult = computeAIMove(state, game, aiDifficulty);

        if (!aiResult) {
          return NextResponse.json(
            { ok: false, error: "No valid AI move available" },
            { status: 400 }
          );
        }

        // Apply AI move
        const newState = makeGameMove(state, aiResult.move, game, "ai", aiResult.computeTime);
        if (!newState) {
          return NextResponse.json(
            { ok: false, error: "AI generated invalid move" },
            { status: 500 }
          );
        }

        // Cache the new state
        gameStates.set(game.id, newState);

        const encoded = encodeGameState(newState);
        const available = getGameAvailableMoves(newState, game);

        return NextResponse.json({
          ok: true,
          aiMove: {
            address: aiResult.move.address,
            ramification: aiResult.move.ramification,
            score: aiResult.score,
            reason: aiResult.reason,
            computeTime: aiResult.computeTime,
          },
          state: {
            gameId: newState.gameId,
            currentPlayer: newState.currentPosition.currentPlayer,
            status: newState.status,
            moveCount: newState.moveLog.length,
            isGameOver: isGameOver(newState),
            winner: getGameWinner(newState),
          },
          availableMoves: available.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded,
          history: getMoveHistory(newState),
        });
      }

      case "analyze": {
        // Get AI analysis of current position
        const available = getGameAvailableMoves(state, game);
        
        const analysis = available.map(m => {
          // Score each move
          const tempResult = computeAIMove(
            { ...state, currentPosition: { ...state.currentPosition } },
            game,
            "hard"
          );
          return {
            move: {
              address: m.address,
              ramification: m.ramification,
            },
            score: tempResult?.move.address === m.address ? tempResult.score : 0,
          };
        }).sort((a, b) => b.score - a.score);

        return NextResponse.json({
          ok: true,
          currentPlayer: state.currentPosition.currentPlayer,
          analysis,
          stats: getGamePlayStats(state),
        });
      }

      case "status": {
        // Get current game status
        return NextResponse.json({
          ok: true,
          state: {
            gameId: state.gameId,
            currentPlayer: state.currentPosition.currentPlayer,
            status: state.status,
            moveCount: state.moveLog.length,
            isGameOver: isGameOver(state),
            winner: getGameWinner(state),
          },
          stats: getGamePlayStats(state),
          history: getMoveHistory(state),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Game play error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
