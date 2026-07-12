/**
 * DDS Phase 2 - Game Module Tests
 * 
 * Tests for game construction, play, AI, simulation, and encoding.
 */

import {
  // Types
  type LudicsGame,
  type GamePlayState,
  type GameStrategy,
  type AIDifficulty,
  type SimulationConfig,
  createGamePlayState,
  createMoveLogEntry,
  getAIScoringWeights,
  // Construction
  getStrategyById,
  getStrategiesForPlayer,
  getStrategyResponse,
  serializeGame,
  getGameSummary,
  // Play
  initializeGame,
  makeGameMove,
  getStrategyMove,
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
  // AI
  computeAIMove,
  computeAIMoveWithLookahead,
  getSmartAIMove,
  getRandomMove,
  // Simulation
  simulateGame,
  simulateVsAI,
  simulateRandomGame,
  batchSimulate,
  runTournament,
  analyzeStrategy,
  findBestStrategy,
  // Encoding
  encodeGameState,
  decodeGameState,
  encodeGame,
  encodeMoveSequence,
  decodeMoveSequence,
  hashPosition,
  positionToKey,
  estimateCompressionRatio,
} from "../index";

import {
  createUniversalArena,
  createArenaMove,
  createInitialPosition,
} from "../../arena";

// ============================================================================
// Test Setup
// ============================================================================

function createTestArena() {
  return createUniversalArena({
    maxDepth: 3,
    maxRamification: 2,
  });
}

function createTestGame(arena = createTestArena()): LudicsGame {
  // Create a simple strategy for P
  const pStrategy: GameStrategy = {
    id: "p-strat-1",
    gameId: "test-game",
    sourceDesignId: "source-p",
    player: "P",
    name: "Test P Strategy",
    responseMap: {
      "initial": { address: "0", ramification: [0, 1] },
      "0[0,1]": { address: "0.0", ramification: [] },
    },
  };

  // Create a simple strategy for O
  const oStrategy: GameStrategy = {
    id: "o-strat-1",
    gameId: "test-game",
    sourceDesignId: "source-o",
    player: "O",
    name: "Test O Strategy",
    responseMap: {
      "0[0,1]": { address: "0.0", ramification: [] },
    },
  };

  return {
    id: "test-game",
    deliberationId: "test-delib",
    positiveBehaviourId: "pos-behaviour",
    negativeBehaviourId: "neg-behaviour",
    arena,
    strategies: [pStrategy, oStrategy],
  };
}

// ============================================================================
// Type Factory Tests
// ============================================================================

describe("Type Factory Functions", () => {
  test("createGamePlayState creates valid initial state", () => {
    const arena = createTestArena();
    const position = createInitialPosition(arena.id);
    
    const state = createGamePlayState("game-1", position);
    
    expect(state.gameId).toBe("game-1");
    expect(state.currentPosition).toBe(position);
    expect(state.status).toBe("playing");
    expect(state.mode).toBe("manual");
    expect(state.moveLog).toHaveLength(0);
    expect(state.startedAt).toBeInstanceOf(Date);
  });

  test("createGamePlayState with options", () => {
    const arena = createTestArena();
    const position = createInitialPosition(arena.id);
    
    const state = createGamePlayState("game-1", position, {
      pStrategyId: "p-strat",
      oStrategyId: "o-strat",
      mode: "auto",
    });
    
    expect(state.pStrategyId).toBe("p-strat");
    expect(state.oStrategyId).toBe("o-strat");
    expect(state.mode).toBe("auto");
  });

  test("createMoveLogEntry creates valid entry", () => {
    const move = createArenaMove("0", [1, 2]);
    
    const entry = createMoveLogEntry(1, "P", move, "manual", 150);
    
    expect(entry.moveNumber).toBe(1);
    expect(entry.player).toBe("P");
    expect(entry.move).toBe(move);
    expect(entry.source).toBe("manual");
    expect(entry.thinkTime).toBe(150);
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  test("getAIScoringWeights returns correct weights for difficulties", () => {
    const easy = getAIScoringWeights("easy");
    const medium = getAIScoringWeights("medium");
    const hard = getAIScoringWeights("hard");
    
    // Easy should have highest randomness
    expect(easy.randomness).toBeGreaterThan(medium.randomness);
    expect(medium.randomness).toBeGreaterThan(hard.randomness);
    
    // Hard should have highest winning bonus
    expect(hard.winningBonus).toBeGreaterThanOrEqual(medium.winningBonus);
    expect(medium.winningBonus).toBeGreaterThanOrEqual(easy.winningBonus);
  });
});

// ============================================================================
// Game Construction Tests
// ============================================================================

describe("Game Construction", () => {
  test("getStrategyById finds strategy", () => {
    const game = createTestGame();
    
    const strategy = getStrategyById(game, "p-strat-1");
    
    expect(strategy).toBeDefined();
    expect(strategy?.id).toBe("p-strat-1");
    expect(strategy?.player).toBe("P");
  });

  test("getStrategyById returns undefined for unknown id", () => {
    const game = createTestGame();
    
    const strategy = getStrategyById(game, "unknown");
    
    expect(strategy).toBeUndefined();
  });

  test("getStrategiesForPlayer filters correctly", () => {
    const game = createTestGame();
    
    const pStrategies = getStrategiesForPlayer(game, "P");
    const oStrategies = getStrategiesForPlayer(game, "O");
    
    expect(pStrategies).toHaveLength(1);
    expect(pStrategies[0].player).toBe("P");
    expect(oStrategies).toHaveLength(1);
    expect(oStrategies[0].player).toBe("O");
  });

  test("serializeGame produces object", () => {
    const game = createTestGame();
    
    const serialized = serializeGame(game);
    
    expect(typeof serialized).toBe("object");
    expect(serialized.id).toBe(game.id);
  });

  test("getGameSummary returns stats", () => {
    const game = createTestGame();
    
    const summary = getGameSummary(game);
    
    expect(summary.arenaMoves).toBeGreaterThan(0);
    expect(summary.pStrategies).toBe(1);
    expect(summary.oStrategies).toBe(1);
  });
});

// ============================================================================
// Game Play Tests
// ============================================================================

describe("Game Play", () => {
  test("initializeGame creates playing state", () => {
    const game = createTestGame();
    
    const state = initializeGame(game);
    
    expect(state.gameId).toBe(game.id);
    expect(state.status).toBe("playing");
    expect(state.currentPosition.currentPlayer).toBe("P");
    expect(state.moveLog).toHaveLength(0);
  });

  test("initializeGame with strategy options", () => {
    const game = createTestGame();
    
    const state = initializeGame(game, {
      pStrategyId: "p-strat-1",
      mode: "p_strategy",
    });
    
    expect(state.pStrategyId).toBe("p-strat-1");
    expect(state.mode).toBe("p_strategy");
  });

  test("makeGameMove applies valid move", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const available = getGameAvailableMoves(state, game);
    expect(available.length).toBeGreaterThan(0);
    
    const move = available[0];
    const newState = makeGameMove(state, move, game);
    
    expect(newState).not.toBeNull();
    expect(newState!.moveLog).toHaveLength(1);
    expect(newState!.moveLog[0].move).toBe(move);
  });

  test("makeGameMove rejects wrong player", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    // Create a move for wrong player
    const wrongPlayerMove = createArenaMove("0", [1], { player: "O" });
    
    const newState = makeGameMove(state, wrongPlayerMove, game);
    
    expect(newState).toBeNull();
  });

  test("getGameAvailableMoves returns valid moves", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const moves = getGameAvailableMoves(state, game);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
    moves.forEach(move => {
      expect(move.player).toBe(state.currentPosition.currentPlayer);
    });
  });

  test("isGameOver returns false for playing game", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    expect(isGameOver(state)).toBe(false);
  });

  test("getCurrentPlayer returns correct player", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    expect(getCurrentPlayer(state)).toBe("P");
  });

  test("getMoveCount returns log length", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    expect(getMoveCount(state)).toBe(0);
    
    const move = getGameAvailableMoves(state, game)[0];
    state = makeGameMove(state, move, game)!;
    
    expect(getMoveCount(state)).toBe(1);
  });

  test("resignGame sets correct winner", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    // P resigns, O wins
    state = resignGame(state);
    
    expect(state.status).toBe("o_wins");
    expect(isGameOver(state)).toBe(true);
    expect(getGameWinner(state)).toBe("O");
  });

  test("abandonGame sets abandoned status", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    state = abandonGame(state);
    
    expect(state.status).toBe("abandoned");
    expect(isGameOver(state)).toBe(true);
    expect(getGameWinner(state)).toBeNull();
  });

  test("declareDraw sets draw status", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    state = declareDraw(state);
    
    expect(state.status).toBe("draw");
    expect(isGameOver(state)).toBe(true);
    expect(getGameWinner(state)).toBeNull();
  });

  test("getGamePlayStats returns statistics", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    const move = getGameAvailableMoves(state, game)[0];
    state = makeGameMove(state, move, game, "manual", 100)!;
    
    const stats = getGamePlayStats(state);
    
    expect(stats.moveCount).toBe(1);
    expect(stats.pMoves).toBe(1);
    expect(stats.oMoves).toBe(0);
  });

  test("getMoveHistory returns formatted history", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    const move = getGameAvailableMoves(state, game)[0];
    state = makeGameMove(state, move, game)!;
    
    const history = getMoveHistory(state);
    
    expect(history).toHaveLength(1);
    expect(history[0]).toMatch(/^1\. P:/);
  });
});

// ============================================================================
// AI Tests
// ============================================================================

describe("AI", () => {
  test("computeAIMove returns valid move", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const result = computeAIMove(state, game, "medium");
    
    expect(result).not.toBeNull();
    expect(result!.move).toBeDefined();
    expect(result!.score).toBeDefined();
    expect(result!.reason).toBeDefined();
    expect(result!.computeTime).toBeGreaterThanOrEqual(0);
  });

  test("computeAIMove respects difficulty", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const easyResult = computeAIMove(state, game, "easy");
    const hardResult = computeAIMove(state, game, "hard");
    
    expect(easyResult).not.toBeNull();
    expect(hardResult).not.toBeNull();
    // Hard difficulty should include alternatives
    expect(hardResult!.alternatives).toBeDefined();
  });

  test("computeAIMoveWithLookahead performs minimax", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const result = computeAIMoveWithLookahead(state, game, 2);
    
    expect(result).not.toBeNull();
    expect(result!.reason).toContain("lookahead");
  });

  test("getSmartAIMove auto-selects strategy", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const result = getSmartAIMove(state, game);
    
    expect(result).not.toBeNull();
    expect(result!.move).toBeDefined();
  });

  test("getRandomMove returns valid move", () => {
    const game = createTestGame();
    const state = initializeGame(game);
    
    const move = getRandomMove(state, game);
    
    expect(move).not.toBeNull();
    expect(move!.player).toBe("P");
  });

  test("getRandomMove returns null for terminal position", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    // End the game
    state = declareDraw(state);
    
    // No moves available
    const moves = getGameAvailableMoves(state, game);
    expect(moves).toHaveLength(0);
  });
});

// ============================================================================
// Simulation Tests
// ============================================================================

describe("Simulation", () => {
  test("simulateRandomGame completes", () => {
    const game = createTestGame();
    
    const result = simulateRandomGame(game, { maxMoves: 20 });
    
    expect(result).toBeDefined();
    expect(["P", "O", "draw"]).toContain(result.winner);
    expect(result.moveCount).toBeLessThanOrEqual(20);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test("simulateGame with strategies", () => {
    const game = createTestGame();
    
    const result = simulateGame(
      game,
      "p-strat-1",
      "o-strat-1",
      { maxMoves: 20 }
    );
    
    expect(result).toBeDefined();
    expect(result.trace).toBeDefined();
  });

  test("batchSimulate runs multiple games", () => {
    const game = createTestGame();
    
    const result = batchSimulate(
      game,
      "p-strat-1",
      "o-strat-1",
      { gameCount: 3, maxMoves: 10 }
    );
    
    expect(result.games).toBe(3);
    expect(result.pWins + result.oWins + result.draws).toBe(3);
  });

  test("runTournament runs all matchups", () => {
    const game = createTestGame();
    
    const { results, rankings } = runTournament(game, {
      gameCount: 2,
      maxMoves: 10,
    });
    
    expect(results.length).toBeGreaterThan(0);
    expect(rankings.length).toBe(2); // 1 P strategy + 1 O strategy
  });

  test("analyzeStrategy returns metrics", () => {
    const game = createTestGame();
    
    const analysis = analyzeStrategy(game, "p-strat-1", {
      gameCount: 2,
      maxMoves: 10,
    });
    
    expect(analysis.winRate).toBeGreaterThanOrEqual(0);
    expect(analysis.winRate).toBeLessThanOrEqual(1);
  });

  test("findBestStrategy returns best for player", () => {
    const game = createTestGame();
    
    const best = findBestStrategy(game, "P", {
      gameCount: 2,
      maxMoves: 10,
    });
    
    expect(best).not.toBeNull();
    expect(best!.strategyId).toBe("p-strat-1");
  });
});

// ============================================================================
// Encoding Tests
// ============================================================================

describe("Encoding", () => {
  test("encodeGameState and decodeGameState roundtrip", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    // Make a move
    const move = getGameAvailableMoves(state, game)[0];
    state = makeGameMove(state, move, game)!;
    
    const encoded = encodeGameState(state);
    expect(typeof encoded).toBe("object");
    expect(encoded.g).toBe(state.gameId);
    
    const decoded = decodeGameState(encoded, game.arena);
    
    expect(decoded.gameId).toBe(state.gameId);
    expect(decoded.status).toBe(state.status);
    expect(decoded.moveLog.length).toBe(state.moveLog.length);
  });

  test("encodeMoveSequence and decodeMoveSequence roundtrip", () => {
    const moves = [
      createArenaMove("0", [1, 2]),
      createArenaMove("0.1", [3]),
    ];
    
    const encoded = encodeMoveSequence(moves);
    expect(typeof encoded).toBe("string");
    
    const decoded = decodeMoveSequence(encoded);
    
    expect(decoded).toHaveLength(2);
    expect(decoded[0].address).toBe("0");
    expect(decoded[0].ramification).toEqual([1, 2]);
    expect(decoded[1].address).toBe("0.1");
  });

  test("hashPosition generates consistent hash", () => {
    const arena = createTestArena();
    const position = createInitialPosition(arena.id);
    
    const hash1 = hashPosition(position);
    const hash2 = hashPosition(position);
    
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
  });

  test("positionToKey generates deterministic key", () => {
    const arena = createTestArena();
    const position = createInitialPosition(arena.id);
    
    const key1 = positionToKey(position);
    const key2 = positionToKey(position);
    
    expect(key1).toBe(key2);
  });

  test("estimateCompressionRatio calculates ratio", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    const move = getGameAvailableMoves(state, game)[0];
    state = makeGameMove(state, move, game)!;
    
    const result = estimateCompressionRatio(state);
    
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.encodedSize).toBeGreaterThan(0);
  });

  test("encodeGame serializes full game", () => {
    const game = createTestGame();
    
    const encoded = encodeGame(game);
    
    expect(typeof encoded).toBe("object");
    expect(encoded.id).toBe(game.id);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  test("full game flow: init → moves → end", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    // Play until game ends or max moves
    let moves = 0;
    while (!isGameOver(state) && moves < 20) {
      const available = getGameAvailableMoves(state, game);
      if (available.length === 0) break;
      
      const aiResult = computeAIMove(state, game, "medium");
      if (!aiResult) break;
      
      const newState = makeGameMove(state, aiResult.move, game, "ai");
      if (!newState) break;
      
      state = newState;
      moves++;
    }
    
    // Game should have progressed
    expect(getMoveCount(state)).toBeGreaterThan(0);
  });

  test("encode → decode → continue playing", () => {
    const game = createTestGame();
    let state = initializeGame(game);
    
    // Make some moves
    for (let i = 0; i < 3 && !isGameOver(state); i++) {
      const move = getRandomMove(state, game);
      if (!move) break;
      const newState = makeGameMove(state, move, game);
      if (!newState) break;
      state = newState;
    }
    
    // Encode
    const encoded = encodeGameState(state);
    
    // Decode
    const restored = decodeGameState(encoded, game.arena);
    
    // Continue playing
    if (!isGameOver(restored)) {
      const move = getRandomMove(restored, game);
      if (move) {
        const newState = makeGameMove(restored, move, game);
        expect(newState).not.toBeNull();
        expect(getMoveCount(newState!)).toBe(getMoveCount(restored) + 1);
      }
    }
  });

  test("AI vs AI simulation produces results", () => {
    const game = createTestGame();
    
    // Run simulation
    const result = simulateRandomGame(game, {
      maxMoves: 30,
      timeout: 2000,
    });
    
    expect(result).toBeDefined();
    expect(result.duration).toBeLessThan(2000);
  });
});
