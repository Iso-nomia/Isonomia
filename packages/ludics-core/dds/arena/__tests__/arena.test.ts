/**
 * Arena Module Tests
 * 
 * Tests for Phase 5 Arena Foundation implementation
 */

import {
  createUniversalArena,
  createArenaMove,
  getPlayerFromAddress,
  delocateArena,
  checkEnabling,
  getEnabledMoves,
  validateArena,
  getArenaStats,
  encodeArena,
  decodeArena,
  createInitialPosition,
} from "../index";

import {
  validatePosition,
  computePView,
  computeOView,
  computeViewForSequence,
  getAvailableMoves,
  applyMove,
  enumerateLegalPositions,
  PositionCache,
} from "../positions";

describe("Arena Foundation", () => {
  describe("getPlayerFromAddress", () => {
    it("returns P for even-length addresses", () => {
      expect(getPlayerFromAddress("")).toBe("P"); // length 0
      expect(getPlayerFromAddress("01")).toBe("P"); // length 2
      expect(getPlayerFromAddress("0123")).toBe("P"); // length 4
    });

    it("returns O for odd-length addresses", () => {
      expect(getPlayerFromAddress("0")).toBe("O"); // length 1
      expect(getPlayerFromAddress("012")).toBe("O"); // length 3
      expect(getPlayerFromAddress("01234")).toBe("O"); // length 5
    });
  });

  describe("createArenaMove", () => {
    it("creates move with correct player based on address", () => {
      const move1 = createArenaMove("", [0, 1, 2]);
      expect(move1.player).toBe("P");
      expect(move1.isInitial).toBe(true);

      const move2 = createArenaMove("0", [0, 1]);
      expect(move2.player).toBe("O");

      const move3 = createArenaMove("01", [0]);
      expect(move3.player).toBe("P");
    });

    it("sets isInitial correctly", () => {
      const initial = createArenaMove("", [0, 1]);
      expect(initial.isInitial).toBe(true);

      const nonInitial = createArenaMove("0", [0, 1], { justifierId: "parent-id" });
      expect(nonInitial.isInitial).toBe(false);
    });
  });

  describe("createUniversalArena", () => {
    it("creates arena with base empty string", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      
      expect(arena.base).toBe("");
      expect(arena.isUniversal).toBe(true);
      expect(arena.moves.length).toBeGreaterThan(0);
    });

    it("respects maxDepth parameter", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      
      const maxAddressLength = Math.max(...arena.moves.map(m => m.address.length));
      expect(maxAddressLength).toBeLessThanOrEqual(2);
    });

    it("validates correctly", () => {
      const arena = createUniversalArena({ maxDepth: 3, maxRamification: 2 });
      const validation = validateArena(arena);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("delocateArena", () => {
    it("shifts all addresses by base", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      const delocated = delocateArena(arena, "0");
      
      expect(delocated.base).toBe("0");
      expect(delocated.isUniversal).toBe(false);
      expect(delocated.delocalizationAddress).toBe("0");
      
      // All addresses should start with "0"
      for (const move of delocated.moves) {
        expect(move.address.startsWith("0")).toBe(true);
      }
    });

    it("updates player assignments correctly", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      const delocated = delocateArena(arena, "0");
      
      for (const move of delocated.moves) {
        const expectedPlayer = getPlayerFromAddress(move.address);
        expect(move.player).toBe(expectedPlayer);
      }
    });
  });

  describe("checkEnabling", () => {
    it("returns true when justifier enables move", () => {
      const parent = createArenaMove("", [0, 1, 2]);
      const child = createArenaMove("0", [0, 1]);
      
      expect(checkEnabling(parent, child)).toBe(true);
    });

    it("returns false when index not in ramification", () => {
      const parent = createArenaMove("", [0, 1]); // Only 0, 1 - not 2
      const child = createArenaMove("2", [0]);
      
      expect(checkEnabling(parent, child)).toBe(false);
    });

    it("returns false for non-child addresses", () => {
      const move1 = createArenaMove("0", [0, 1]);
      const move2 = createArenaMove("1", [0]); // Sibling, not child
      
      expect(checkEnabling(move1, move2)).toBe(false);
    });
  });

  describe("encodeArena / decodeArena", () => {
    it("roundtrips arena correctly", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      const encoded = encodeArena(arena);
      const decoded = decodeArena(encoded);
      
      expect(decoded.base).toBe(arena.base);
      expect(decoded.moves.length).toBe(arena.moves.length);
    });
  });

  describe("getArenaStats", () => {
    it("computes correct statistics", () => {
      const arena = createUniversalArena({ maxDepth: 2, maxRamification: 2 });
      const stats = getArenaStats(arena);
      
      expect(stats.moveCount).toBe(arena.moves.length);
      expect(stats.pMoves + stats.oMoves).toBe(arena.moves.length);
      expect(stats.initialMoves).toBeGreaterThan(0);
    });
  });
});

describe("Position Operations", () => {
  let arena: ReturnType<typeof createUniversalArena>;

  beforeEach(() => {
    arena = createUniversalArena({ maxDepth: 3, maxRamification: 2 });
  });

  describe("validatePosition", () => {
    it("validates empty position as legal", () => {
      const validity = validatePosition([], arena);
      expect(validity.isValid).toBe(true);
    });

    it("detects parity violation", () => {
      const move1 = arena.moves.find(m => m.address === "")!;
      const move2 = arena.moves.find(m => m.address === "" && m.id !== move1.id) 
        || { ...move1, id: "move2" };
      
      // Two P moves in a row (both at root)
      const validity = validatePosition([move1, { ...move1, id: "dup" }], arena);
      expect(validity.parityOk).toBe(false);
    });

    it("detects linearity violation", () => {
      const move = arena.moves.find(m => m.address === "")!;
      
      // Same address twice
      const validity = validatePosition([move, move], arena);
      expect(validity.linearityOk).toBe(false);
    });
  });

  describe("computeView", () => {
    it("returns empty view for empty position", () => {
      const view = computeViewForSequence([], "P");
      expect(view).toHaveLength(0);
    });

    it("includes positive moves in view", () => {
      const pMove = arena.moves.find(m => m.player === "P" && m.isInitial)!;
      const view = computeViewForSequence([pMove], "P");
      
      expect(view.some(v => v.id === pMove.id)).toBe(true);
    });
  });

  describe("createInitialPosition", () => {
    it("creates position with empty sequence", () => {
      const pos = createInitialPosition(arena.id);
      
      expect(pos.sequence).toHaveLength(0);
      expect(pos.currentPlayer).toBe("P");
      expect(pos.isTerminal).toBe(false);
      expect(pos.validity.isValid).toBe(true);
    });
  });

  describe("getAvailableMoves", () => {
    it("returns initial moves for empty position", () => {
      const pos = createInitialPosition(arena.id);
      const available = getAvailableMoves(pos, arena);
      
      // Should have P moves (P starts)
      expect(available.every(m => m.player === "P")).toBe(true);
      expect(available.some(m => m.isInitial)).toBe(true);
    });
  });

  describe("applyMove", () => {
    it("creates new position after valid move", () => {
      const pos = createInitialPosition(arena.id);
      const available = getAvailableMoves(pos, arena);
      
      if (available.length > 0) {
        const newPos = applyMove(pos, available[0], arena);
        
        expect(newPos).not.toBeNull();
        expect(newPos!.sequence).toHaveLength(1);
        expect(newPos!.currentPlayer).toBe("O"); // O's turn after P moves
      }
    });

    it("returns null for wrong player move", () => {
      const pos = createInitialPosition(arena.id);
      const oMove = arena.moves.find(m => m.player === "O")!;
      
      const newPos = applyMove(pos, oMove, arena);
      expect(newPos).toBeNull();
    });
  });

  describe("enumerateLegalPositions", () => {
    it("enumerates positions up to maxDepth", () => {
      const positions = enumerateLegalPositions(arena, 2, 50);
      
      expect(positions.length).toBeGreaterThan(0);
      expect(positions.every(p => p.length <= 2)).toBe(true);
    });

    it("respects maxPositions limit", () => {
      const positions = enumerateLegalPositions(arena, 10, 5);
      
      expect(positions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("PositionCache", () => {
    it("caches computed positions", () => {
      const cache = new PositionCache(100);
      const moves = arena.moves.filter(m => m.isInitial).slice(0, 1);
      
      const pos1 = cache.getOrCompute(arena, moves);
      const pos2 = cache.getOrCompute(arena, moves);
      
      expect(pos1.id).toBe(pos2.id);
    });

    it("evicts old entries when full", () => {
      const cache = new PositionCache(2);
      const moves1 = arena.moves.filter(m => m.isInitial).slice(0, 1);
      const moves2 = arena.moves.filter(m => m.isInitial).slice(1, 2);
      
      cache.getOrCompute(arena, moves1);
      cache.getOrCompute(arena, moves2);
      
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });
});
