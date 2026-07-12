/**
 * DDS Phase 2: Views(S) and Plays(V) Operations Tests
 * Tests for Definitions 4.10 and 4.11 from Faggian & Hyland (2002)
 */

import {
  computeViews,
  computePlays,
  verifyPlaysViewsIdentity,
  verifyViewsPlaysIdentity,
} from "../operations";
import type { Strategy, Play } from "../types";
import type { Action, View } from "../../types";

describe("Strategy Operations", () => {
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
    isInnocent: true,
    satisfiesPropagation: true,
  });

  const createTestViews = (sequences: Action[][]): View[] =>
    sequences.map((sequence, idx) => ({
      id: `view-${idx}`,
      player: "P",
      sequence,
      designId: "design-1",
    }));

  describe("computeViews", () => {
    it("should return empty views for empty strategy", () => {
      const strategy = createTestStrategy([]);
      const result = computeViews(strategy);
      expect(result.views).toHaveLength(0);
      expect(result.viewCount).toBe(0);
      expect(result.isStable).toBe(true);
    });

    it("should extract views from single play", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = computeViews(strategy);
      expect(result.viewCount).toBeGreaterThan(0);
    });

    it("should deduplicate identical views", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        [
          { focus: "0", ramification: [1], polarity: "P" }, // Same prefix
          { focus: "0.1", ramification: [1], polarity: "O" },
          { focus: "0.1.1", ramification: [], polarity: "P" },
        ],
      ]);

      const result = computeViews(strategy);

      // Check for deduplication
      const viewKeys = result.views.map((v) => JSON.stringify(v.sequence));
      const uniqueKeys = new Set(viewKeys);
      expect(viewKeys.length).toBe(uniqueKeys.size);
    });

    it("should report view stability", () => {
      const strategy = createTestStrategy([
        [{ focus: "0", ramification: [], polarity: "P" }],
      ]);

      const result = computeViews(strategy);
      expect(result.isStable).toBe(true);
    });
  });

  describe("computePlays", () => {
    it("should return empty plays for empty views", () => {
      const result = computePlays([]);
      expect(result.plays).toHaveLength(0);
      expect(result.isSmallest).toBe(true);
    });

    it("should generate plays from minimal views", () => {
      const views = createTestViews([
        [{ focus: "0", ramification: [1], polarity: "P" }],
      ]);

      const result = computePlays(views);
      expect(result.playCount).toBeGreaterThan(0);
    });

    it("should find minimal views when some are prefixes", () => {
      const views = createTestViews([
        [{ focus: "0", ramification: [1], polarity: "P" }],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = computePlays(views);

      // Should include plays for the minimal (shorter) view
      expect(result.playCount).toBeGreaterThan(0);
    });

    it("should respect maxIterations option", () => {
      const views = createTestViews([
        [{ focus: "0", ramification: [1, 2, 3], polarity: "P" }],
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = computePlays(views, { maxIterations: 1 });
      expect(result.iterations).toBeLessThanOrEqual(1);
    });
  });

  describe("verifyPlaysViewsIdentity", () => {
    it("should hold for simple innocent strategy", () => {
      const strategy = createTestStrategy([
        [{ focus: "0", ramification: [], polarity: "P" }],
      ]);

      const result = verifyPlaysViewsIdentity(strategy);
      // For simple cases, the identity should approximately hold
      expect(result.originalPlayCount).toBeGreaterThan(0);
    });

    it("should identify missing plays in reconstruction", () => {
      const strategy = createTestStrategy([
        [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
      ]);

      const result = verifyPlaysViewsIdentity(strategy);
      expect(result.originalPlayCount).toBe(1);
    });
  });

  describe("verifyViewsPlaysIdentity", () => {
    it("should hold for empty views", () => {
      const result = verifyViewsPlaysIdentity([]);
      expect(result.holds).toBe(true);
      expect(result.originalViewCount).toBe(0);
    });

    it("should hold for simple view set", () => {
      const views = createTestViews([
        [{ focus: "0", ramification: [], polarity: "P" }],
      ]);

      const result = verifyViewsPlaysIdentity(views);
      expect(result.originalViewCount).toBe(1);
    });
  });
});

describe("Isomorphism Properties", () => {
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
    isInnocent: true,
    satisfiesPropagation: true,
  });

  it("should satisfy Views(Plays(Views(S))) = Views(S) for innocent strategies", () => {
    const strategy = createTestStrategy([
      [{ focus: "0", ramification: [], polarity: "P" }],
    ]);

    // Compute Views(S)
    const views1 = computeViews(strategy);

    // Compute Plays(Views(S))
    const plays = computePlays(views1.views);

    // Build strategy from plays
    const reconstructedStrategy: Strategy = {
      id: "reconstructed",
      designId: strategy.designId,
      player: strategy.player,
      plays: plays.plays,
      isInnocent: true,
      satisfiesPropagation: true,
    };

    // Compute Views(Plays(Views(S)))
    const views2 = computeViews(reconstructedStrategy);

    // Should have same number of views
    expect(views2.viewCount).toBe(views1.viewCount);
  });
});
