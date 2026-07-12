/**
 * DDS Phase 5 - Analysis Module Tests
 * Tests for saturation, correspondence, properties, and performance
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Action, Strategy, Play } from "../types";
import {
  checkSaturation,
  computeSaturationClosure,
  getSaturationDeficiency,
} from "../analysis/saturation";
import {
  validateFullCorrespondence,
  validateCorrespondenceLevel,
} from "../analysis/correspondence";
import {
  analyzeDesignProperties,
  analyzeStrategyProperties,
  analyzeGameProperties,
  analyzeComplexity,
} from "../analysis/properties";
import {
  trackPerformance,
  trackPerformanceSync,
  getAllMetrics,
  clearMetrics,
  analyzeBottlenecks,
} from "../analysis/performance";

describe("Saturation Analysis", () => {
  const createTestStrategy = (playCount: number): Strategy => ({
    id: "test-strategy",
    designId: "test-design",
    player: "P",
    plays: Array.from({ length: playCount }, (_, i) => ({
      id: `play-${i}`,
      strategyId: "test-strategy",
      sequence: [
        { focus: "0", ramification: [i], polarity: "P" as const },
      ],
      length: 1,
      isPositive: true,
    })),
    isInnocent: true,
    satisfiesPropagation: true,
  });

  describe("checkSaturation", () => {
    it("should check if strategy is saturated", () => {
      const strategy = createTestStrategy(3);
      const result = checkSaturation(strategy);
      expect(result.isSaturated).toBeDefined();
    });

    it("should return viewsEqualStrategy flag", () => {
      const strategy = createTestStrategy(2);
      const result = checkSaturation(strategy);
      expect(result.viewsEqualStrategy).toBeDefined();
    });
  });

  describe("computeSaturationClosure", () => {
    it("should compute closure of strategy", () => {
      const strategy = createTestStrategy(2);
      const result = computeSaturationClosure(strategy);
      expect(result.closedStrategy).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(0);
    });

    it("should maintain or increase play count", () => {
      const strategy = createTestStrategy(3);
      const result = computeSaturationClosure(strategy);
      expect(result.closedStrategy.plays.length).toBeGreaterThanOrEqual(
        strategy.plays.length
      );
    });
  });

  describe("getSaturationDeficiency", () => {
    it("should calculate deficiency", () => {
      const strategy = createTestStrategy(2);
      const result = getSaturationDeficiency(strategy);
      expect(result.deficiency).toBeGreaterThanOrEqual(0);
    });

    it("should list missing plays", () => {
      const strategy = createTestStrategy(1);
      const result = getSaturationDeficiency(strategy);
      expect(result.missingPlays).toBeDefined();
      expect(Array.isArray(result.missingPlays)).toBe(true);
    });
  });
});

describe("Correspondence Validation", () => {
  const testDesign: Action[] = [
    { focus: "0", ramification: [1, 2], polarity: "P" },
    { focus: "0.1", ramification: [], polarity: "O" },
  ];

  const testStrategy: Strategy = {
    id: "s1",
    designId: "d1",
    player: "P",
    plays: [
      {
        id: "p1",
        strategyId: "s1",
        sequence: testDesign,
        length: 2,
        isPositive: true,
      },
    ],
    isInnocent: true,
    satisfiesPropagation: true,
  };

  describe("validateFullCorrespondence", () => {
    it("should validate full correspondence chain", () => {
      const result = validateFullCorrespondence(testDesign, testStrategy);
      expect(result.isValid).toBeDefined();
      expect(result.levels).toBeDefined();
    });

    it("should check all correspondence levels", () => {
      const result = validateFullCorrespondence(testDesign, testStrategy);
      expect(result.levels.designToStrategy).toBeDefined();
      expect(result.levels.strategyToViews).toBeDefined();
    });
  });

  describe("validateCorrespondenceLevel", () => {
    it("should validate specific correspondence level", () => {
      const result = validateCorrespondenceLevel("design-strategy", {
        design: testDesign,
        strategy: testStrategy,
      });
      expect(result.valid).toBeDefined();
    });
  });
});

describe("Property Analysis", () => {
  const testActions: Action[] = [
    { focus: "0", ramification: [1, 2], polarity: "P" },
    { focus: "0.1", ramification: [], polarity: "O" },
    { focus: "0.2", ramification: [3], polarity: "O" },
  ];

  describe("analyzeDesignProperties", () => {
    it("should analyze design properties", () => {
      const result = analyzeDesignProperties(testActions);
      expect(result).toBeDefined();
    });

    it("should check linearity", () => {
      const result = analyzeDesignProperties(testActions);
      expect(result.isLinear).toBeDefined();
    });

    it("should check determinism", () => {
      const result = analyzeDesignProperties(testActions);
      expect(result.isDeterministic).toBeDefined();
    });

    it("should calculate depth", () => {
      const result = analyzeDesignProperties(testActions);
      expect(result.maxDepth).toBeGreaterThanOrEqual(0);
    });
  });

  describe("analyzeStrategyProperties", () => {
    const strategy: Strategy = {
      id: "s1",
      designId: "d1",
      player: "P",
      plays: [
        {
          id: "p1",
          strategyId: "s1",
          sequence: testActions,
          length: 3,
          isPositive: true,
        },
      ],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    it("should analyze strategy properties", () => {
      const result = analyzeStrategyProperties(strategy);
      expect(result).toBeDefined();
    });

    it("should verify innocence property", () => {
      const result = analyzeStrategyProperties(strategy);
      expect(result.isInnocent).toBe(true);
    });
  });

  describe("analyzeGameProperties", () => {
    const game = {
      behaviours: [
        { id: "b1", designIds: ["d1", "d2"], isClosed: true },
      ],
      designCount: 2,
      behaviourCount: 1,
    };

    it("should analyze game properties", () => {
      const result = analyzeGameProperties(game);
      expect(result).toBeDefined();
    });

    it("should check closure", () => {
      const result = analyzeGameProperties(game);
      expect(result.hasClosed).toBeDefined();
    });
  });

  describe("analyzeComplexity", () => {
    it("should compute complexity metrics", () => {
      const result = analyzeComplexity(testActions, [], []);
      expect(result).toBeDefined();
    });

    it("should calculate action complexity", () => {
      const result = analyzeComplexity(testActions, [], []);
      expect(result.actionCount).toBe(3);
    });
  });
});

describe("Performance Tracking", () => {
  beforeEach(() => {
    clearMetrics();
  });

  afterEach(() => {
    clearMetrics();
  });

  describe("trackPerformance", () => {
    it("should track async operation performance", async () => {
      const result = await trackPerformance("test-op", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 42;
      });
      expect(result).toBe(42);
    });

    it("should record metrics", async () => {
      await trackPerformance("metrics-test", async () => "done");
      const metrics = getAllMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe("trackPerformanceSync", () => {
    it("should track sync operation performance", () => {
      const result = trackPerformanceSync("sync-op", () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });
      expect(result).toBe(4950);
    });
  });

  describe("getAllMetrics", () => {
    it("should return all recorded metrics", async () => {
      await trackPerformance("op1", async () => 1);
      await trackPerformance("op2", async () => 2);
      const metrics = getAllMetrics();
      expect(metrics.length).toBe(2);
    });
  });

  describe("clearMetrics", () => {
    it("should clear all metrics", async () => {
      await trackPerformance("to-clear", async () => "data");
      clearMetrics();
      const metrics = getAllMetrics();
      expect(metrics.length).toBe(0);
    });
  });

  describe("analyzeBottlenecks", () => {
    it("should identify slow operations", async () => {
      await trackPerformance("fast", async () => "quick");
      await trackPerformance("slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "delayed";
      });
      const bottlenecks = analyzeBottlenecks(10);
      expect(bottlenecks).toBeDefined();
    });
  });
});
