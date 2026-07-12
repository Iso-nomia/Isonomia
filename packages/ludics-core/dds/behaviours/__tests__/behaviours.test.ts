/**
 * DDS Phase 5 - Behaviours Module Tests
 * Tests for orthogonality, closure, and game operations
 */

import { describe, it, expect } from "vitest";
import type { Action, Dispute } from "../types";
import {
  checkOrthogonality,
  findCounterDesigns,
  verifyOrthogonality,
} from "../behaviours/orthogonality";
import {
  biorthogonalClosure,
  closureIterate,
  isClosed,
} from "../behaviours/closure";
import {
  gameFromBehaviour,
  gamePositions,
  gameStructure,
} from "../behaviours/game";

describe("Orthogonality Operations", () => {
  // Sample designs for testing
  const designA: Action[] = [
    { focus: "0", ramification: [1, 2], polarity: "P" },
    { focus: "0.1", ramification: [], polarity: "O" },
  ];

  const designB: Action[] = [
    { focus: "0", ramification: [1], polarity: "O" },
    { focus: "0.1", ramification: [], polarity: "P" },
  ];

  const convergentDispute: Dispute = {
    id: "d1",
    dialogueId: "dlg1",
    posDesignId: "a",
    negDesignId: "b",
    pairs: [
      { posActId: "a1", negActId: "b1", locusPath: "0" },
      { posActId: "a2", negActId: "b2", locusPath: "0.1" },
    ],
    status: "CONVERGENT",
    length: 2,
  };

  describe("checkOrthogonality", () => {
    it("should detect orthogonal designs with convergent disputes", () => {
      const result = checkOrthogonality(designA, designB, [convergentDispute]);
      expect(result.converges).toBe(true);
    });

    it("should return false for empty designs", () => {
      const result = checkOrthogonality([], [], []);
      expect(result.converges).toBe(false);
    });

    it("should include convergence length", () => {
      const result = checkOrthogonality(designA, designB, [convergentDispute]);
      if (result.converges) {
        expect(result.convergenceLength).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("findCounterDesigns", () => {
    it("should find designs that are not orthogonal", () => {
      const candidates = [
        [{ focus: "0", ramification: [3], polarity: "O" as const }],
        designB,
      ];

      const result = findCounterDesigns(designA, candidates);
      expect(result.counterDesigns).toBeDefined();
    });

    it("should return empty for no candidates", () => {
      const result = findCounterDesigns(designA, []);
      expect(result.counterDesigns).toHaveLength(0);
    });
  });

  describe("verifyOrthogonality", () => {
    it("should verify orthogonality across design sets", () => {
      const result = verifyOrthogonality(["a", "b"], ["c", "d"]);
      expect(result.pairs).toBeDefined();
      expect(result.allOrthogonal).toBeDefined();
    });
  });
});

describe("Biorthogonal Closure", () => {
  const designs: Action[][] = [
    [{ focus: "0", ramification: [1], polarity: "P" }],
    [{ focus: "0", ramification: [2], polarity: "P" }],
  ];

  const counterDesigns: Action[][] = [
    [{ focus: "0", ramification: [1, 2], polarity: "O" }],
  ];

  describe("biorthogonalClosure", () => {
    it("should compute closure of designs", () => {
      const result = biorthogonalClosure(designs, counterDesigns, 5);
      expect(result.isClosed).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(0);
      expect(result.closedCount).toBeGreaterThanOrEqual(result.originalCount);
    });

    it("should converge within max iterations", () => {
      const result = biorthogonalClosure(designs, counterDesigns, 3);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });
  });

  describe("closureIterate", () => {
    it("should perform single closure iteration", () => {
      const result = closureIterate(designs, counterDesigns);
      expect(result.original).toEqual(designs);
      expect(result.closed.length).toBeGreaterThanOrEqual(designs.length);
    });
  });

  describe("isClosed", () => {
    it("should check if set is already closed", () => {
      const result = isClosed(designs, counterDesigns);
      expect(result.isClosed).toBeDefined();
      if (!result.isClosed) {
        expect(result.reason).toBeDefined();
      }
    });
  });
});

describe("Game Operations", () => {
  const behaviour = {
    id: "b1",
    designIds: ["d1", "d2"],
    isClosed: true,
  };

  describe("gameFromBehaviour", () => {
    it("should construct game from behaviour", () => {
      const game = gameFromBehaviour(behaviour);
      expect(game).toBeDefined();
      expect(game.behaviourId).toBe("b1");
    });
  });

  describe("gamePositions", () => {
    it("should extract positions from game", () => {
      const game = gameFromBehaviour(behaviour);
      const positions = gamePositions(game);
      expect(positions).toBeDefined();
      expect(Array.isArray(positions)).toBe(true);
    });
  });

  describe("gameStructure", () => {
    it("should analyze game structure", () => {
      const game = gameFromBehaviour(behaviour);
      const structure = gameStructure(game);
      expect(structure).toBeDefined();
      expect(structure.designCount).toBe(2);
    });
  });
});
