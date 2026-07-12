export const dynamic = "force-dynamic";

/**
 * DDS Interaction Detail API Route
 * 
 * GET /api/ludics/interactions/[id] - Get interaction state
 * POST /api/ludics/interactions/[id] - Make a move or control interaction
 * 
 * Provides move-by-move control of ludic interactions.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  makeGameMove,
  getGameAvailableMoves,
  isGameOver,
  getGameWinner,
  encodeGameState,
  getMoveHistory,
  computeAIMove,
} from "@/packages/ludics-core/dds/game";
// Use client-safe imports to avoid pulling in Prisma
import { createArenaMove } from "@/packages/ludics-core/dds/arena/client";
import { interactionStore, type InteractionState } from "../store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ludics/interactions/[id]
 * Get current state of an interaction
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Interaction ID is required" },
        { status: 400 }
      );
    }

    const interaction = interactionStore.get(id);
    if (!interaction) {
      return NextResponse.json(
        { ok: false, error: "Interaction not found" },
        { status: 404 }
      );
    }

    const { gameState, game } = interaction;
    const availableMoves = getGameAvailableMoves(gameState, game);
    const gameOver = isGameOver(gameState);
    const moveHistory = interaction.moveHistory || [];

    return NextResponse.json({
      ok: true,
      interaction: {
        id: interaction.id,
        arenaId: interaction.arenaId,
        posDesignId: interaction.posDesignId,
        negDesignId: interaction.negDesignId,
        mode: interaction.mode,
        status: interaction.status,
        createdAt: interaction.createdAt,
        updatedAt: interaction.updatedAt,
      },
      state: {
        currentPlayer: gameState.currentPosition.currentPlayer,
        status: gameState.status,
        moveCount: moveHistory.length,
        isGameOver: gameOver,
        winner: gameOver ? getGameWinner(gameState) : null,
      },
      position: {
        address: gameState.currentPosition.sequence.length > 0 
          ? gameState.currentPosition.sequence[gameState.currentPosition.sequence.length - 1].address 
          : "",
        depth: gameState.currentPosition.length,
      },
      moveHistory: moveHistory,
      availableMoves: availableMoves.map(m => ({
        id: m.id,
        address: m.address,
        ramification: m.ramification,
        player: m.player,
      })),
      encoded: encodeGameState(gameState),
      result: interaction.result,
    });
  } catch (error: any) {
    console.error("[Interaction GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ludics/interactions/[id]
 * Make a move or control the interaction
 * 
 * Body:
 * - action: "move" | "step" | "auto-complete" | "pause" | "reset"
 * - move?: { address, ramification?, id? } - for "move" action
 * - maxSteps?: number - for "auto-complete" action
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, move, maxSteps = 100 } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Interaction ID is required" },
        { status: 400 }
      );
    }

    const interaction = interactionStore.get(id);
    if (!interaction) {
      return NextResponse.json(
        { ok: false, error: "Interaction not found" },
        { status: 404 }
      );
    }

    // Ensure moveHistory is initialized (for backward compatibility)
    if (!interaction.moveHistory) {
      interaction.moveHistory = [];
    }

    const { game } = interaction;
    let { gameState } = interaction;

    switch (action) {
      case "move": {
        // Make a manual move
        // Note: empty string "" is a valid address (root position)
        if (!move || move.address === undefined || move.address === null) {
          return NextResponse.json(
            { ok: false, error: "move.address is required for move action" },
            { status: 400 }
          );
        }

        if (isGameOver(gameState)) {
          return NextResponse.json(
            { ok: false, error: "Game is already over" },
            { status: 400 }
          );
        }

        const arenaMove = createArenaMove(
          move.address,
          move.ramification || [],
          { id: move.id }
        );

        const newState = makeGameMove(gameState, arenaMove, game, "manual");

        if (!newState) {
          return NextResponse.json(
            { ok: false, error: `Invalid move: address "${move.address}" not available` },
            { status: 400 }
          );
        }

        // Record move in history
        interaction.moveHistory.push({
          moveNumber: interaction.moveHistory.length + 1,
          player: gameState.currentPosition.currentPlayer,
          address: move.address,
          ramification: move.ramification || [],
          timestamp: new Date(),
        });

        interaction.gameState = newState;
        interaction.updatedAt = new Date();

        // Check if game ended
        const gameOver = isGameOver(newState);

        if (gameOver) {
          const winner = getGameWinner(newState);
          interaction.status = "completed";
          interaction.result = {
            winner: winner,
            totalMoves: interaction.moveHistory.length,
            endReason: "terminal",
          };
        }

        const availableMoves = getGameAvailableMoves(newState, game);

        return NextResponse.json({
          ok: true,
          action: "move",
          moveMade: {
            player: gameState.currentPosition.currentPlayer,
            address: move.address,
          },
          state: {
            currentPlayer: newState.currentPosition.currentPlayer,
            status: newState.status,
            moveCount: interaction.moveHistory.length,
            isGameOver: isGameOver(newState),
            winner: isGameOver(newState) ? getGameWinner(newState) : null,
          },
          moveHistory: interaction.moveHistory.map(m => ({
            moveNumber: m.moveNumber,
            player: m.player,
            address: m.address,
            ramification: m.ramification,
          })),
          availableMoves: availableMoves.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded: encodeGameState(newState),
          result: interaction.result,
        });
      }

      case "step": {
        // Make one AI move
        if (isGameOver(gameState)) {
          return NextResponse.json(
            { ok: false, error: "Game is already over" },
            { status: 400 }
          );
        }

        const currentPlayer = gameState.currentPosition.currentPlayer;

        const aiResult = computeAIMove(gameState, game, "medium");

        if (!aiResult) {
          // No moves available - player is stuck, other player wins
          interaction.status = "completed";
          interaction.result = {
            winner: currentPlayer === "P" ? "O" : "P",
            totalMoves: interaction.moveHistory.length,
            endReason: "stuck",
          };

          return NextResponse.json({
            ok: true,
            action: "step",
            stepResult: "stuck",
            state: {
              currentPlayer,
              status: "stuck",
              moveCount: interaction.moveHistory.length,
              isGameOver: true,
              winner: interaction.result.winner,
            },
            moveHistory: interaction.moveHistory.map(m => ({
              moveNumber: m.moveNumber,
              player: m.player,
              address: m.address,
              ramification: m.ramification,
            })),
            result: interaction.result,
          });
        }

        const newState = makeGameMove(gameState, aiResult.move, game, "ai");
        if (!newState) {
          return NextResponse.json(
            { ok: false, error: "AI move failed unexpectedly" },
            { status: 500 }
          );
        }

        // Record move
        interaction.moveHistory.push({
          moveNumber: interaction.moveHistory.length + 1,
          player: currentPlayer,
          address: aiResult.move.address,
          ramification: aiResult.move.ramification,
          timestamp: new Date(),
        });

        interaction.gameState = newState;
        interaction.updatedAt = new Date();

        if (isGameOver(newState)) {
          interaction.status = "completed";
          interaction.result = {
            winner: getGameWinner(newState),
            totalMoves: interaction.moveHistory.length,
            endReason: "terminal",
          };
        }

        const availableMoves = getGameAvailableMoves(newState, game);

        return NextResponse.json({
          ok: true,
          action: "step",
          stepResult: "moved",
          moveMade: {
            player: currentPlayer,
            address: aiResult.move.address,
            reasoning: aiResult.reason,
          },
          state: {
            currentPlayer: newState.currentPosition.currentPlayer,
            status: newState.status,
            moveCount: interaction.moveHistory.length,
            isGameOver: isGameOver(newState),
            winner: isGameOver(newState) ? getGameWinner(newState) : null,
          },
          moveHistory: interaction.moveHistory.map(m => ({
            moveNumber: m.moveNumber,
            player: m.player,
            address: m.address,
            ramification: m.ramification,
          })),
          availableMoves: availableMoves.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded: encodeGameState(newState),
          result: interaction.result,
        });
      }

      case "auto-complete": {
        // Run interaction to completion
        const trace: Array<{ player: "P" | "O"; address: string }> = [];
        let steps = 0;

        while (!isGameOver(gameState) && steps < maxSteps) {
          const currentPlayer = gameState.currentPosition.currentPlayer;
          const aiResult = computeAIMove(gameState, game, "medium");

          if (!aiResult) {
            // Stuck
            break;
          }

          const newState = makeGameMove(gameState, aiResult.move, game, "ai");
          if (!newState) break;

          trace.push({
            player: currentPlayer,
            address: aiResult.move.address,
          });

          interaction.moveHistory.push({
            moveNumber: interaction.moveHistory.length + 1,
            player: currentPlayer,
            address: aiResult.move.address,
            ramification: aiResult.move.ramification,
            timestamp: new Date(),
          });

          gameState = newState;
          interaction.gameState = newState;
          steps++;
        }

        interaction.status = "completed";
        interaction.updatedAt = new Date();
        interaction.result = {
          winner: getGameWinner(gameState),
          totalMoves: interaction.moveHistory.length,
          endReason: steps >= maxSteps ? "max-moves" : (isGameOver(gameState) ? "terminal" : "stuck"),
        };

        return NextResponse.json({
          ok: true,
          action: "auto-complete",
          stepsExecuted: steps,
          trace,
          state: {
            currentPlayer: gameState.currentPosition.currentPlayer,
            status: gameState.status,
            moveCount: interaction.moveHistory.length,
            isGameOver: true,
            winner: interaction.result.winner,
          },
          result: interaction.result,
          encoded: encodeGameState(gameState),
        });
      }

      case "pause": {
        interaction.status = "paused";
        interaction.updatedAt = new Date();

        return NextResponse.json({
          ok: true,
          action: "pause",
          status: "paused",
        });
      }

      case "reset": {
        // Re-initialize from beginning
        const { initializeGame } = await import("@/packages/ludics-core/dds/game");
        const freshState = initializeGame(game);

        interaction.gameState = freshState;
        interaction.moveHistory = [];
        interaction.status = "active";
        interaction.result = undefined;
        interaction.updatedAt = new Date();

        const availableMoves = getGameAvailableMoves(freshState, game);

        return NextResponse.json({
          ok: true,
          action: "reset",
          state: {
            currentPlayer: freshState.currentPosition.currentPlayer,
            status: freshState.status,
            moveCount: 0,
            isGameOver: false,
          },
          availableMoves: availableMoves.map(m => ({
            id: m.id,
            address: m.address,
            ramification: m.ramification,
            player: m.player,
          })),
          encoded: encodeGameState(freshState),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}. Valid actions: move, step, auto-complete, pause, reset` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[Interaction POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
