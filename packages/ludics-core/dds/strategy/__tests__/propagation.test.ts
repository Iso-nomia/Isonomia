/**
 * DDS Phase 2: Propagation Checking Tests
 * Tests for Definition 4.25 from Faggian & Hyland (2002)
 */

import {
  checkPropagation,
  checkLinearityInSlices,
  checkFullPropagation,
  groupViewsByTerminal,
  analyzePropagationStructure,
} from "../propagation";
import type { Strategy } from "../types";
import type { Action } from "../../types";

describe("Propagation Checking", () => {
  const createTestStrategy = (plays: Action[][]): Strategy => ({
    id: "test-strategy",
    designId: "design-1",
    player: "P",
    plays: plays.map((sequence, idx) => ({
      id: `play-${idx}`,
      strategyId: "design-1",
      sequence,
      length: sequence.length,
      isPositive:
        sequence.length > 0 && sequence[sequence.length - 1].polarity === "P",
    })),
    isInnocent: false,
    satisfiesPropagation: false,
  });

  describe("checkLinearityInSlices", () => {
    it("should return true for empty strategy", () => {
      const strategy = createTestStrategy([]);
      expect(checkLinearityInSlices(strategy)).toBe(true);
    });

    it("should return true when no address repeats in any play", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
      ]);

      expect(checkLinearityInSlices(strategy)).toBe(true);
    });

    it("should return false when address repeats in a play", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
          { focus: "0", ramification: [], polarity: "P" }, // Repeated address!
        ],
      ]);

      expect(checkLinearityInSlices(strategy)).toBe(false);
    });
  });

  describe("checkPropagation", () => {
    it("should return true for empty strategy", () => {
      const strategy = createTestStrategy([]);
      const result = checkPropagation(strategy);
      expect(result.satisfiesPropagation).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should return true for single-play strategy", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = checkPropagation(strategy);
      expect(result.satisfiesPropagation).toBe(true);
    });

    it("should return true when views with same terminal have consistent continuations", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [1], polarity: "O" },
          { focus: "0.1.1", ramification: [], polarity: "P" },
        ],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [1], polarity: "O" },
          { focus: "0.1.1", ramification: [], polarity: "P" }, // Same continuation
        ],
      ]);

      const result = checkPropagation(strategy);
      expect(result.satisfiesPropagation).toBe(true);
    });
  });

  describe("checkFullPropagation", () => {
    it("should check both slice linearity and pair propagation", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = checkFullPropagation(strategy);
      expect(result.satisfiesSliceLinearity).toBe(true);
      expect(result.satisfiesPairPropagation).toBe(true);
      expect(result.satisfiesPropagation).toBe(true);
    });
  });

  describe("groupViewsByTerminal", () => {
    it("should return empty map for empty strategy", () => {
      const strategy = createTestStrategy([]);
      const groups = groupViewsByTerminal(strategy);
      expect(groups.size).toBe(0);
    });

    it("should group views by their terminal locus", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
      ]);

      const groups = groupViewsByTerminal(strategy);

      // Should have groups for different terminal loci
      expect(groups.size).toBeGreaterThan(0);
    });
  });

  describe("analyzePropagationStructure", () => {
    it("should return zero counts for empty strategy", () => {
      const strategy = createTestStrategy([]);
      const analysis = analyzePropagationStructure(strategy);
      expect(analysis.totalViews).toBe(0);
      expect(analysis.uniqueViews).toBe(0);
    });

    it("should count views and groups", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const analysis = analyzePropagationStructure(strategy);
      expect(analysis.totalViews).toBeGreaterThan(0);
      expect(analysis.viewGroups.size).toBeGreaterThan(0);
    });
  });
});
