export const dynamic = "force-dynamic";

/**
 * DDS Game Simulation API Route
 * 
 * POST: Run game simulations between strategies or AI
 */

import { NextRequest, NextResponse } from "next/server";
import {
  initializeGame,
  simulateGame,
  simulateVsAI,
  simulateRandomGame,
  batchSimulate,
  runTournament,
  analyzeStrategy,
  findBestStrategy,
  encodeGameState,
  makeGameMove,
  getGameAvailableMoves,
  isGameOver,
  getGameWinner,
  computeAIMove,
  computeAIMoveWithLookahead,
  getRandomMove,
} from "@/packages/ludics-core/dds/game";
// Use client-safe imports to avoid pulling in Prisma
import {
  createUniversalArena,
} from "@/packages/ludics-core/dds/arena/client";
import type { LudicsGame, SimulationConfig, AIDifficulty, GamePlayState } from "@/packages/ludics-core/dds/game";
import type { UniversalArena } from "@/packages/ludics-core/dds/arena/client";

// AI vs AI simulation that actually works without pre-defined strategies
function simulateAIvsAI(
  game: LudicsGame,
  pDifficulty: AIDifficulty,
  oDifficulty: AIDifficulty,
  maxMoves: number = 100
): {
  winner: "P" | "O" | "draw";
  moveCount: number;
  duration: number;
  trace: Array<{ moveNumber: number; player: "P" | "O"; address: string; ramification: number[] }>;
} {
  const startTime = Date.now();
  let state = initializeGame(game);
  const trace: Array<{ moveNumber: number; player: "P" | "O"; address: string; ramification: number[] }> = [];

  while (!isGameOver(state) && state.moveLog.length < maxMoves) {
    const currentPlayer = state.currentPosition.currentPlayer;
    const difficulty = currentPlayer === "P" ? pDifficulty : oDifficulty;
    
    // Use lookahead for hard difficulty, regular heuristics otherwise
    let aiResult;
    if (difficulty === "hard") {
      // Calculate arena max depth to ensure full game tree visibility
      const arenaMaxDepth = Math.max(...game.arena.moves.map(m => m.address.length), 0);
      // Use enough lookahead to see all terminals (arenaMaxDepth + 1 for safety)
      const lookaheadDepth = Math.min(arenaMaxDepth + 2, 8); // Cap at 8 for performance
      aiResult = computeAIMoveWithLookahead(state, game, lookaheadDepth);
    } else {
      aiResult = computeAIMove(state, game, difficulty);
    }
    
    if (!aiResult) break;

    const newState = makeGameMove(state, aiResult.move, game, "ai");
    if (!newState) break;

    trace.push({
      moveNumber: state.moveLog.length + 1,
      player: currentPlayer,
      address: aiResult.move.address,
      ramification: aiResult.move.ramification,
    });

    state = newState;
  }

  // Debug: log game trace
  console.log(`[GAME] Winner: ${getGameWinner(state)}, Moves: ${state.moveLog.length}, Path: ${trace.map(t => t.address).join(" → ")}`);

  return {
    winner: getGameWinner(state) ?? "draw",
    moveCount: state.moveLog.length,
    duration: Date.now() - startTime,
    trace,
  };
}

// Batch AI vs AI simulation
function batchSimulateAI(
  game: LudicsGame,
  pDifficulty: AIDifficulty,
  oDifficulty: AIDifficulty,
  gameCount: number = 10
): {
  games: number;
  pWins: number;
  oWins: number;
  draws: number;
  avgMoves: number;
  avgDuration: number;
  results: Array<{ winner: string; moveCount: number }>;
} {
  const results: Array<{ winner: string; moveCount: number; duration: number }> = [];

  for (let i = 0; i < gameCount; i++) {
    const result = simulateAIvsAI(game, pDifficulty, oDifficulty);
    results.push({ winner: result.winner, moveCount: result.moveCount, duration: result.duration });
  }

  const pWins = results.filter(r => r.winner === "P").length;
  const oWins = results.filter(r => r.winner === "O").length;
  const draws = results.filter(r => r.winner === "draw").length;

  return {
    games: gameCount,
    pWins,
    oWins,
    draws,
    avgMoves: results.reduce((sum, r) => sum + r.moveCount, 0) / gameCount,
    avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / gameCount,
    results: results.map(r => ({ winner: r.winner, moveCount: r.moveCount })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      arenaConfig,
      gameId,
      simulationConfig,
    } = body;

    // Build arena
    let arena: UniversalArena;
    if (arenaConfig?.moves) {
      arena = arenaConfig as UniversalArena;
    } else {
      arena = createUniversalArena({
        maxDepth: arenaConfig?.maxDepth ?? 4,
        maxRamification: arenaConfig?.maxRamification ?? 3,
      });
    }

    // Build minimal game object
    const game: LudicsGame = {
      id: gameId || `sim-${Date.now()}`,
      deliberationId: body.deliberationId || "sim",
      positiveBehaviourId: "sim-p",
      negativeBehaviourId: "sim-o",
      arena,
      strategies: [],
    };

    switch (action) {
      case "simulate": {
        // Run a simulation between two strategies
        const { pStrategyId, oStrategyId } = body;
        
        if (!pStrategyId || !oStrategyId) {
          return NextResponse.json(
            { ok: false, error: "pStrategyId and oStrategyId are required" },
            { status: 400 }
          );
        }

        const config: SimulationConfig = simulationConfig || {
          maxMoves: 100,
          timeout: 5000,
        };

        const result = simulateGame(game, pStrategyId, oStrategyId, config);

        return NextResponse.json({
          ok: true,
          result: {
            winner: result.winner,
            moveCount: result.moveCount,
            duration: result.duration,
            trace: result.trace.map(entry => ({
              moveNumber: entry.moveNumber,
              player: entry.player,
              address: entry.move.address,
              source: entry.source,
            })),
          },
        });
      }

      case "simulate_vs_ai": {
        // Run a simulation: strategy vs AI
        const { strategyId, strategyPlayer } = body;
        
        if (!strategyId || !strategyPlayer) {
          return NextResponse.json(
            { ok: false, error: "strategyId and strategyPlayer are required" },
            { status: 400 }
          );
        }

        const config: SimulationConfig = simulationConfig || {
          maxMoves: 100,
          timeout: 5000,
        };

        const result = simulateVsAI(game, strategyId, strategyPlayer, config);

        return NextResponse.json({
          ok: true,
          result: {
            winner: result.winner,
            moveCount: result.moveCount,
            duration: result.duration,
            trace: result.trace.map(entry => ({
              moveNumber: entry.moveNumber,
              player: entry.player,
              address: entry.move.address,
              source: entry.source,
            })),
          },
        });
      }

      case "simulate_random": {
        // Run a random simulation (baseline)
        const config: SimulationConfig = simulationConfig || {
          maxMoves: 100,
        };

        const result = simulateRandomGame(game, config);

        return NextResponse.json({
          ok: true,
          result: {
            winner: result.winner,
            moveCount: result.moveCount,
            duration: result.duration,
          },
        });
      }

      case "batch_simulate": {
        // Run multiple simulations between two strategies
        const { pStrategyId, oStrategyId, gameCount } = body;
        
        if (!pStrategyId || !oStrategyId) {
          return NextResponse.json(
            { ok: false, error: "pStrategyId and oStrategyId are required" },
            { status: 400 }
          );
        }

        const config: SimulationConfig = {
          ...simulationConfig,
          gameCount: gameCount || 10,
        };

        const result = batchSimulate(game, pStrategyId, oStrategyId, config);

        return NextResponse.json({
          ok: true,
          result: {
            pStrategy: result.pStrategy,
            oStrategy: result.oStrategy,
            games: result.games,
            pWins: result.pWins,
            oWins: result.oWins,
            draws: result.draws,
            pWinRate: result.pWins / result.games,
            oWinRate: result.oWins / result.games,
            avgMoves: result.avgMoves,
            avgDuration: result.avgDuration,
          },
        });
      }

      case "tournament": {
        // Run a tournament between all strategy pairs
        const config: SimulationConfig = simulationConfig || {
          gameCount: 5,
        };

        const { results, rankings } = runTournament(game, config);

        return NextResponse.json({
          ok: true,
          tournament: {
            matchups: results.length,
            rankings,
            results: results.map(r => ({
              pStrategy: r.pStrategy,
              oStrategy: r.oStrategy,
              pWins: r.pWins,
              oWins: r.oWins,
              draws: r.draws,
            })),
          },
        });
      }

      case "analyze_strategy": {
        // Analyze a specific strategy's performance
        const { strategyId } = body;
        
        if (!strategyId) {
          return NextResponse.json(
            { ok: false, error: "strategyId is required" },
            { status: 400 }
          );
        }

        const config: SimulationConfig = simulationConfig || {
          gameCount: 10,
        };

        const analysis = analyzeStrategy(game, strategyId, config);

        return NextResponse.json({
          ok: true,
          analysis: {
            strategyId,
            winRate: analysis.winRate,
            avgMoves: analysis.avgMoves,
            vsAI: analysis.vsAI,
            vsRandom: analysis.vsRandom,
          },
        });
      }

      case "find_best": {
        // Find best strategy for a player
        const { player } = body;
        
        if (!player || (player !== "P" && player !== "O")) {
          return NextResponse.json(
            { ok: false, error: "player must be 'P' or 'O'" },
            { status: 400 }
          );
        }

        const config: SimulationConfig = simulationConfig || {
          gameCount: 10,
        };

        const best = findBestStrategy(game, player, config);

        return NextResponse.json({
          ok: true,
          best: best || null,
        });
      }

      case "analyze_arena": {
        // Analyze the arena structure
        return NextResponse.json({
          ok: true,
          analysis: {
            totalMoves: arena.moves.length,
            maxDepth: Math.max(...arena.moves.map(m => m.address.length), 0),
            pMoves: arena.moves.filter(m => m.player === "P").length,
            oMoves: arena.moves.filter(m => m.player === "O").length,
            avgRamification: arena.moves.length > 0 
              ? arena.moves.reduce((sum, m) => sum + m.ramification.length, 0) / arena.moves.length
              : 0,
            strategies: {
              total: game.strategies.length,
              pStrategies: game.strategies.filter(s => s.player === "P").length,
              oStrategies: game.strategies.filter(s => s.player === "O").length,
            },
          },
        });
      }

      case "ai_vs_ai": {
        // Run a single AI vs AI simulation
        const { pDifficulty, oDifficulty }: { pDifficulty?: AIDifficulty; oDifficulty?: AIDifficulty } = body;
        
        const result = simulateAIvsAI(
          game,
          pDifficulty || "medium",
          oDifficulty || "medium",
          simulationConfig?.maxMoves || 100
        );

        return NextResponse.json({
          ok: true,
          result: {
            winner: result.winner,
            moveCount: result.moveCount,
            duration: result.duration,
            trace: result.trace,
          },
        });
      }

      case "batch_ai_vs_ai": {
        // Run batch AI vs AI simulations
        const { pDifficulty, oDifficulty, gameCount }: { 
          pDifficulty?: AIDifficulty; 
          oDifficulty?: AIDifficulty;
          gameCount?: number;
        } = body;

        const result = batchSimulateAI(
          game,
          pDifficulty || "medium",
          oDifficulty || "medium",
          gameCount || 10
        );

        return NextResponse.json({
          ok: true,
          result: {
            games: result.games,
            pWins: result.pWins,
            oWins: result.oWins,
            draws: result.draws,
            pWinRate: result.pWins / result.games,
            oWinRate: result.oWins / result.games,
            avgMoves: result.avgMoves,
            avgDuration: result.avgDuration,
            gameResults: result.results,
          },
        });
      }

      case "analyze_position": {
        // Analyze available moves at current position
        const availableMoves = getGameAvailableMoves(initializeGame(game), game);
        
        // Score each move using AI
        const moveAnalysis = availableMoves.map(move => {
          // Simple scoring based on ramification potential
          const score = move.isInitial ? 10 : 5 + move.ramification.length;
          return {
            address: move.address,
            ramification: move.ramification,
            player: move.player,
            score,
            isInitial: move.isInitial,
          };
        }).sort((a, b) => b.score - a.score);

        return NextResponse.json({
          ok: true,
          analysis: {
            currentPlayer: "P", // Initial position
            availableMoves: moveAnalysis.length,
            topMoves: moveAnalysis.slice(0, 5),
            positionType: moveAnalysis.length === 0 ? "terminal" : "active",
          },
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
