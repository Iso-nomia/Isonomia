/**
 * DDS Phase 2: Innocence Checking Tests
 * Tests for Definition 4.8 from Faggian & Hyland (2002)
 */

import {
  checkInnocence,
  checkDeterminism,
  isLikelyInnocent,
  makeInnocent,
} from "../innocence";
import type { Strategy, Play } from "../types";
import type { Action } from "../../types";

describe("Innocence Checking", () => {
  const createTestStrategy = (plays: Action[][]): Strategy => ({
    id: "test-strategy",
    designId: "design-1",
    player: "P",
    plays: plays.map((sequence, idx) => ({
      id: `play-${idx}`,
      strategyId: "design-1",
      sequence,
      length: sequence.length,
      isPositive: sequence.length > 0 && sequence[sequence.length - 1].polarity === "P",
    })),
    isInnocent: false,
    satisfiesPropagation: false,
  });

  describe("checkDeterminism", () => {
    it("should return true for empty strategy", () => {
      const strategy = createTestStrategy([]);
      const result = checkDeterminism(strategy);
      expect(result.isDeterministic).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should return true for single-play strategy", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);
      const result = checkDeterminism(strategy);
      expect(result.isDeterministic).toBe(true);
    });

    it("should detect non-determinism with different responses to same view", () => {
      // Two plays that start the same but diverge
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" }, // Different response!
        ],
      ]);

      const result = checkDeterminism(strategy);
      expect(result.isDeterministic).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should allow different plays with different views", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [1], polarity: "O" },
          { focus: "0.1.1", ramification: [], polarity: "P" },
        ],
        [
          { focus: "0", ramification: [2], polarity: "P" }, // Different ramification = different view
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
      ]);

      const result = checkDeterminism(strategy);
      expect(result.isDeterministic).toBe(true);
    });
  });

  describe("checkInnocence", () => {
    it("should mark empty strategy as innocent", () => {
      const strategy = createTestStrategy([]);
      const result = checkInnocence(strategy);
      expect(result.isInnocent).toBe(true);
      expect(result.isDeterministic).toBe(true);
      expect(result.isViewStable).toBe(true);
    });

    it("should mark deterministic single-play strategy as innocent", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = checkInnocence(strategy);
      expect(result.isInnocent).toBe(true);
    });

    it("should detect non-innocent strategy", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" }, // Different response to same initial move
        ],
      ]);

      const result = checkInnocence(strategy);
      expect(result.isInnocent).toBe(false);
      expect(result.isDeterministic).toBe(false);
    });
  });

  describe("isLikelyInnocent", () => {
    it("should return true for empty strategy", () => {
      const strategy = createTestStrategy([]);
      expect(isLikelyInnocent(strategy)).toBe(true);
    });

    it("should return true for single-play strategy", () => {
      const strategy = createTestStrategy([
        [{ focus: "0", ramification: [], polarity: "P" }],
      ]);
      expect(isLikelyInnocent(strategy)).toBe(true);
    });

    it("should return false for obviously non-innocent strategy", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
      ]);

      expect(isLikelyInnocent(strategy)).toBe(false);
    });
  });

  describe("makeInnocent", () => {
    it("should return unchanged innocent strategy", () => {
      const strategy = createTestStrategy([
        [{ focus: "0", ramification: [], polarity: "P" }],
      ]);

      const innocent = makeInnocent(strategy);
      expect(innocent.plays.length).toBe(strategy.plays.length);
    });

    it("should remove conflicting plays", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" }, // Conflicting
        ],
      ]);

      const innocent = makeInnocent(strategy);
      expect(innocent.plays.length).toBeLessThan(strategy.plays.length);
      expect(innocent.isInnocent).toBe(true);
    });
  });
});
