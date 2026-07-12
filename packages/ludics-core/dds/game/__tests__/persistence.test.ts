/**
 * DDS Phase 4 - Persistence Tests
 * 
 * Tests for game state encoding, persistence, and export/import.
 */

import {
  encodeGameState,
  decodeGameState,
  exportGameState,
  importGameState,
  serializeGameState,
  deserializeGameState,
  estimateCompressionRatio,
} from "../persistence";
import type { GamePlayState, LudicsGame, ArenaMove, UniversalArena } from "../../types";

describe("DDS Phase 4 - Game Persistence", () => {
  // Test data
  const testArena: UniversalArena = {
    id: "arena-test-001",
    base: "<>",
    isUniversal: true,
    moves: [
      { id: "m1", address: "0", ramification: [1, 2], player: "P", isInitial: true },
      { id: "m2", address: "01", ramification: [3], player: "O", isInitial: false },
      { id: "m3", address: "012", ramification: [1, 4], player: "P", isInitial: false },
      { id: "m4", address: "0123", ramification: [], player: "O", isInitial: false },
    ],
  };

  const testMoves: ArenaMove[] = [
    { id: "m1", address: "0", ramification: [1, 2], player: "P", isInitial: true },
    { id: "m2", address: "01", ramification: [3], player: "O", isInitial: false },
    { id: "m3", address: "012", ramification: [1, 4], player: "P", isInitial: false },
  ];

  const testGameState: GamePlayState = {
    gameId: "game-test-001",
    currentPosition: {
      id: "pos-001",
      arenaId: "arena-test-001",
      sequence: testMoves,
      currentPlayer: "O",
      isTerminal: false,
    },
    pStrategyId: "strategy-p-001",
    oStrategyId: "strategy-o-001",
    mode: "manual",
    status: "playing",
    moveLog: testMoves.map((move, i) => ({
      moveNumber: i + 1,
      player: (i % 2 === 0 ? "P" : "O") as "P" | "O",
      move,
      source: "manual" as const,
      timestamp: new Date("2025-01-01T12:00:00Z"),
    })),
    startedAt: new Date("2025-01-01T12:00:00Z"),
  };

  const testGame: LudicsGame = {
    id: "game-test-001",
    name: "Test Game",
    deliberationId: "delib-001",
    positiveBehaviourId: "behaviour-p-001",
    negativeBehaviourId: "behaviour-o-001",
    arena: testArena,
    strategies: [],
  };

  describe("encodeGameState", () => {
    it("encodes game state to compact format", () => {
      const encoded = encodeGameState(testGameState);

      expect(encoded.v).toBe(1);
      expect(encoded.g).toBe("game-test-001");
      expect(encoded.a).toBe("arena-test-001");
      expect(encoded.p).toBe(1); // O's turn
      expect(encoded.s).toBe(1); // playing
      expect(encoded.ps).toBe("strategy-p-001");
      expect(encoded.os).toBe("strategy-o-001");
      expect(encoded.md).toBe(0); // manual
    });

    it("encodes move sequence as compact string", () => {
      const encoded = encodeGameState(testGameState);

      expect(encoded.m).toBe("0:1,2|01:3|012:1,4");
    });

    it("handles empty move sequence", () => {
      const emptyState: GamePlayState = {
        ...testGameState,
        currentPosition: {
          ...testGameState.currentPosition,
          sequence: [],
        },
        moveLog: [],
      };

      const encoded = encodeGameState(emptyState);

      expect(encoded.m).toBe("");
    });

    it("encodes different game statuses correctly", () => {
      const statuses: Array<GamePlayState["status"]> = [
        "setup", "playing", "p_wins", "o_wins", "draw", "abandoned"
      ];

      statuses.forEach((status, i) => {
        const state = { ...testGameState, status };
        const encoded = encodeGameState(state);
        expect(encoded.s).toBe(i);
      });
    });

    it("encodes different play modes correctly", () => {
      const modes: Array<GamePlayState["mode"]> = [
        "manual", "p_strategy", "o_strategy", "auto"
      ];

      modes.forEach((mode, i) => {
        const state = { ...testGameState, mode };
        const encoded = encodeGameState(state);
        expect(encoded.md).toBe(i);
      });
    });
  });

  describe("decodeGameState", () => {
    it("decodes encoded state back to original", () => {
      const encoded = encodeGameState(testGameState);
      const decoded = decodeGameState(encoded, testArena);

      expect(decoded.gameId).toBe(testGameState.gameId);
      expect(decoded.currentPosition.arenaId).toBe(testGameState.currentPosition.arenaId);
      expect(decoded.currentPosition.currentPlayer).toBe("O");
      expect(decoded.status).toBe("playing");
      expect(decoded.mode).toBe("manual");
    });

    it("reconstructs move log from encoded moves", () => {
      const encoded = encodeGameState(testGameState);
      const decoded = decodeGameState(encoded, testArena);

      expect(decoded.moveLog.length).toBe(3);
      expect(decoded.moveLog[0].player).toBe("P");
      expect(decoded.moveLog[1].player).toBe("O");
      expect(decoded.moveLog[2].player).toBe("P");
    });

    it("handles empty move sequence", () => {
      const encoded = encodeGameState({
        ...testGameState,
        moveLog: [],
      });

      const decoded = decodeGameState(encoded, testArena);

      expect(decoded.moveLog.length).toBe(0);
    });

    it("reconstructs moves from arena when available", () => {
      const encoded = encodeGameState(testGameState);
      const decoded = decodeGameState(encoded, testArena);

      // Should find existing moves in arena
      expect(decoded.moveLog[0].move.address).toBe("0");
      expect(decoded.moveLog[0].move.ramification).toEqual([1, 2]);
    });
  });

  describe("exportGameState", () => {
    it("creates exportable format with game metadata", () => {
      const exported = exportGameState(testGame, testGameState, {
        exportedBy: "test-user",
        description: "Test export",
      });

      expect(exported.version).toBe(1);
      expect(exported.exportedAt).toBeDefined();
      expect(exported.game.id).toBe("game-test-001");
      expect(exported.game.name).toBe("Test Game");
      expect(exported.game.deliberationId).toBe("delib-001");
      expect(exported.arena.id).toBe("arena-test-001");
      expect(exported.arena.moveCount).toBe(4);
      expect(exported.metadata?.exportedBy).toBe("test-user");
    });

    it("includes encoded state in export", () => {
      const exported = exportGameState(testGame, testGameState);

      expect(exported.state.v).toBe(1);
      expect(exported.state.g).toBe("game-test-001");
    });
  });

  describe("importGameState", () => {
    it("imports exported state back", () => {
      const exported = exportGameState(testGame, testGameState);
      const imported = importGameState(exported, testArena);

      expect(imported.game.id).toBe("game-test-001");
      expect(imported.game.name).toBe("Test Game");
      expect(imported.state.gameId).toBe("game-test-001");
    });

    it("roundtrips correctly", () => {
      const exported = exportGameState(testGame, testGameState);
      const imported = importGameState(exported, testArena);

      expect(imported.state.status).toBe(testGameState.status);
      expect(imported.state.mode).toBe(testGameState.mode);
      expect(imported.state.moveLog.length).toBe(testGameState.moveLog.length);
    });
  });

  describe("serializeGameState / deserializeGameState", () => {
    it("serializes to JSON string", () => {
      const json = serializeGameState(testGameState);

      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.v).toBe(1);
    });

    it("deserializes from JSON string", () => {
      const json = serializeGameState(testGameState);
      const deserialized = deserializeGameState(json, testArena);

      expect(deserialized.gameId).toBe(testGameState.gameId);
    });

    it("roundtrips correctly", () => {
      const json = serializeGameState(testGameState);
      const deserialized = deserializeGameState(json, testArena);

      expect(deserialized.status).toBe(testGameState.status);
      expect(deserialized.moveLog.length).toBe(testGameState.moveLog.length);
    });
  });

  describe("estimateCompressionRatio", () => {
    it("calculates compression ratio", () => {
      const result = estimateCompressionRatio(testGameState);

      expect(result.encodedSize).toBeGreaterThan(0);
      expect(result.fullSize).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThan(1); // Full should be larger
    });

    it("achieves significant compression", () => {
      const result = estimateCompressionRatio(testGameState);

      // Should achieve at least 2x compression
      expect(result.ratio).toBeGreaterThan(2);
    });
  });

  describe("edge cases", () => {
    it("handles moves with empty ramification", () => {
      const stateWithEmptyRam: GamePlayState = {
        ...testGameState,
        moveLog: [
          {
            moveNumber: 1,
            player: "P",
            move: { id: "m1", address: "0", ramification: [], player: "P", isInitial: true },
            source: "manual",
            timestamp: new Date(),
          },
        ],
      };

      const encoded = encodeGameState(stateWithEmptyRam);
      expect(encoded.m).toBe("0:");

      const decoded = decodeGameState(encoded, testArena);
      expect(decoded.moveLog[0].move.ramification).toEqual([]);
    });

    it("handles terminal positions", () => {
      const terminalState: GamePlayState = {
        ...testGameState,
        status: "p_wins",
        currentPosition: {
          ...testGameState.currentPosition,
          isTerminal: true,
        },
      };

      const encoded = encodeGameState(terminalState);
      expect(encoded.s).toBe(2); // p_wins

      const decoded = decodeGameState(encoded, testArena);
      expect(decoded.status).toBe("p_wins");
      expect(decoded.currentPosition.isTerminal).toBe(true);
    });

    it("handles missing optional fields", () => {
      const minimalState: GamePlayState = {
        gameId: "minimal-001",
        currentPosition: {
          id: "pos",
          arenaId: "arena-test-001",
          sequence: [],
          currentPlayer: "P",
          isTerminal: false,
        },
        mode: "manual",
        status: "setup",
        moveLog: [],
        startedAt: new Date(),
      };

      const encoded = encodeGameState(minimalState);
      expect(encoded.ps).toBeUndefined();
      expect(encoded.os).toBeUndefined();

      const decoded = decodeGameState(encoded, testArena);
      expect(decoded.pStrategyId).toBeUndefined();
      expect(decoded.oStrategyId).toBeUndefined();
    });
  });
});
