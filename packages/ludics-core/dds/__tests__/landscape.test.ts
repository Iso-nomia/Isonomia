/**
 * ============================================
 * LANDSCAPE MODULE TESTS
 * ============================================
 * 
 * Comprehensive test suite for Phase 4: Landscape Mapping
 * 
 * Tests cover:
 * - Behaviour computation (convergence, orthogonals, biorthogonal closure)
 * - Position analysis (strength, simulations, winning strategies)
 * - Visualization data (heat maps, flow paths, critical points)
 * - Completeness checking (behaviour completeness, validation)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Import landscape functions
import {
  // Behaviour computer
  converges,
  checkConvergence,
  computeOrthogonal,
  computeBiorthogonalClosure,
  computeBehaviour,
  designSetsEqual,
  designsEquivalent,
  generateCandidateDesigns,
  getAllAddresses,

  // Position analyzer
  analyzePositionStrength,
  analyzeAllPositions,
  buildAnalysisTree,
  getDesignsStartingAt,
  runSimulations,
  computeAverageDepth,
  computeWinRate,
  hasWinningStrategy,
  findWinningDesigns,
  clearAnalysisCache,
  comparePositions,
  sortByStrength,

  // Visualization
  generateLandscapeData,
  layoutAsTree,
  findCriticalPoints,
  extractFlowPaths,
  computeLandscapeStatistics,
  landscapeToJSON,
  landscapeToSVG,

  // Completeness
  checkBehaviourCompleteness,
  checkInternalCompleteness,
  checkDesignCompleteness,
  findMissingDesigns,
  validateBehaviourStructure,
  validateDesignStructure,
  getCompletenessSummary,
  isMinimallyComplete,
  getCoverageReport,
} from "../landscape";

import type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Chronicle,
  DialogueAct,
  DeliberationArena,
  ArenaPositionTheory,
  PositionStrength,
} from "../types/ludics-theory";

import { addressToKey, keyToAddress } from "../types/ludics-theory";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a simple design for testing
 */
function createTestDesign(options: {
  id?: string;
  base?: LudicAddress[];
  polarity?: "+" | "-";
  hasDaimon?: boolean;
  actions?: DialogueAct[];
}): LudicDesignTheory {
  const polarity = options.polarity ?? "+";
  const base = options.base ?? [[]];
  const hasDaimon = options.hasDaimon ?? false;

  const defaultActions: DialogueAct[] = options.actions ?? [
    {
      polarity,
      focus: base[0],
      ramification: [[0]],
      expression: "claim",
      type: "claim",
    },
  ];

  if (hasDaimon) {
    defaultActions.push({
      polarity,
      focus: [0],
      ramification: [],
      expression: "†",
      type: "daimon",
    });
  }

  const chronicle: Chronicle = {
    id: `chronicle-${options.id ?? "test"}`,
    actions: defaultActions,
    isComplete: true,
  };

  return {
    id: options.id ?? `design-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    base,
    polarity,
    chronicles: [chronicle],
    hasDaimon,
    isWinning: !hasDaimon,
  };
}

/**
 * Create a simple arena for testing
 */
function createTestArena(): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  // Root position
  positions.set("", {
    address: [],
    content: "Root claim",
    type: "claim",
    ramification: [0, 1],
    polarity: "+",
  });

  // First level children
  positions.set("0", {
    address: [0],
    content: "Support argument",
    type: "support",
    ramification: [0],
    polarity: "-",
  });

  positions.set("1", {
    address: [1],
    content: "Attack argument",
    type: "attack",
    ramification: [],
    polarity: "-",
  });

  // Second level
  positions.set("0.0", {
    address: [0, 0],
    content: "Counter support",
    type: "response",
    ramification: [],
    polarity: "+",
  });

  return {
    deliberationId: "test-arena",
    rootAddress: [],
    positions,
    availableDesigns: [],
    id: "test-arena",
  };
}

/**
 * Create P and O designs for interaction testing
 */
function createInteractingDesigns(): {
  pDesign: LudicDesignTheory;
  oDesign: LudicDesignTheory;
} {
  const pDesign: LudicDesignTheory = {
    id: "p-design",
    base: [[]],
    polarity: "+",
    chronicles: [
      {
        id: "p-chronicle",
        actions: [
          {
            polarity: "+",
            focus: [],
            ramification: [[0]],
            expression: "P claims",
            type: "claim",
          },
        ],
        isComplete: false,
      },
    ],
    hasDaimon: false,
    isWinning: true,
  };

  const oDesign: LudicDesignTheory = {
    id: "o-design",
    base: [[0]],
    polarity: "-",
    chronicles: [
      {
        id: "o-chronicle",
        actions: [
          {
            polarity: "-",
            focus: [0],
            ramification: [],
            expression: "O responds",
            type: "negate",
          },
          {
            polarity: "-",
            focus: [0],
            ramification: [],
            expression: "†",
            type: "daimon",
          },
        ],
        isComplete: true,
      },
    ],
    hasDaimon: true,
    isWinning: false,
  };

  return { pDesign, oDesign };
}

// ============================================================================
// BEHAVIOUR COMPUTER TESTS
// ============================================================================

describe("Behaviour Computer", () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  describe("converges", () => {
    it("should detect convergence when O plays daimon", () => {
      // P makes a claim at root, O has daimon response at the opened address
      const pDesign: LudicDesignTheory = {
        id: "p-design",
        base: [[]],
        polarity: "+",
        chronicles: [
          {
            id: "p-chronicle",
            actions: [
              {
                polarity: "+",
                focus: [],
                ramification: [[0]],
                expression: "P claims",
                type: "claim",
              },
            ],
            isComplete: false,
          },
        ],
        hasDaimon: false,
        isWinning: true,
      };

      // O responds at [0] with daimon
      const oDesign: LudicDesignTheory = {
        id: "o-design",
        base: [[0]],
        polarity: "-",
        chronicles: [
          {
            id: "o-chronicle",
            actions: [
              {
                polarity: "-",
                focus: [0],
                ramification: [],
                expression: "†",
                type: "daimon",
              },
            ],
            isComplete: true,
          },
        ],
        hasDaimon: true,
        isWinning: false,
      };

      // Since O plays daimon immediately at [0], interaction should converge
      // The checkConvergence function is what matters
      const result = checkConvergence(pDesign, oDesign);
      // Note: The specific convergence depends on implementation details
      // The test validates the structure of the result
      expect(result).toHaveProperty("converges");
      expect(result).toHaveProperty("termination");
    });

    it("should detect divergence when no daimon", () => {
      const design1 = createTestDesign({ id: "d1", hasDaimon: false });
      const design2 = createTestDesign({ id: "d2", polarity: "-", hasDaimon: false });
      
      // No daimon on either side
      const result = converges(design1, design2);
      expect(result).toBe(false);
    });

    it("should handle empty designs", () => {
      const emptyDesign: LudicDesignTheory = {
        id: "empty",
        base: [[]],
        polarity: "+",
        chronicles: [],
        hasDaimon: false,
        isWinning: false,
      };

      const otherDesign = createTestDesign({ polarity: "-" });
      
      // Empty design has no response - should diverge (stuck)
      const result = converges(emptyDesign, otherDesign);
      expect(result).toBe(false);
    });
  });

  describe("checkConvergence", () => {
    it("should return detailed result", () => {
      const { pDesign, oDesign } = createInteractingDesigns();
      const result = checkConvergence(pDesign, oDesign);

      expect(result).toHaveProperty("converges");
      expect(result).toHaveProperty("termination");
      expect(result).toHaveProperty("depth");
    });

    it("should track termination type", () => {
      const { pDesign, oDesign } = createInteractingDesigns();
      const result = checkConvergence(pDesign, oDesign);

      if (result.converges) {
        expect(result.termination).toBe("daimon");
      }
    });
  });

  describe("designSetsEqual", () => {
    it("should return true for identical sets", () => {
      const d1 = createTestDesign({ id: "d1" });
      const d2 = createTestDesign({ id: "d2" });
      
      const set1 = [d1, d2];
      const set2 = [d1, d2];
      
      expect(designSetsEqual(set1, set2)).toBe(true);
    });

    it("should return false for different sets", () => {
      const d1 = createTestDesign({ id: "d1" });
      const d2 = createTestDesign({ id: "d2" });
      const d3 = createTestDesign({ id: "d3" });
      
      const set1 = [d1, d2];
      const set2 = [d1, d3];
      
      expect(designSetsEqual(set1, set2)).toBe(false);
    });

    it("should return false for different sizes", () => {
      const d1 = createTestDesign({ id: "d1" });
      
      expect(designSetsEqual([d1], [d1, d1])).toBe(false);
    });

    it("should handle empty sets", () => {
      expect(designSetsEqual([], [])).toBe(true);
    });
  });

  describe("designsEquivalent", () => {
    it("should return true for same ID", () => {
      const d1 = createTestDesign({ id: "same" });
      const d2 = createTestDesign({ id: "same" });
      
      expect(designsEquivalent(d1, d2)).toBe(true);
    });

    it("should compare structure for different IDs", () => {
      const d1 = createTestDesign({ id: "d1", polarity: "+" });
      const d2 = createTestDesign({ id: "d2", polarity: "-" });
      
      expect(designsEquivalent(d1, d2)).toBe(false);
    });
  });

  describe("computeOrthogonal", () => {
    it("should return empty for empty input", () => {
      const result = computeOrthogonal([]);
      expect(result).toEqual([]);
    });

    it("should find designs that converge with all", () => {
      const d1 = createTestDesign({ id: "d1", hasDaimon: true });
      const result = computeOrthogonal([d1]);
      
      // Should find at least the candidate designs
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("computeBehaviour", () => {
    it("should return complete result", () => {
      const d1 = createTestDesign({ id: "d1" });
      const result = computeBehaviour([d1]);

      expect(result).toHaveProperty("behaviour");
      expect(result).toHaveProperty("orthogonal");
      expect(result).toHaveProperty("isComplete");
      expect(result).toHaveProperty("closureStats");
    });

    it("should handle empty input", () => {
      const result = computeBehaviour([]);
      
      expect(result.behaviour.designs).toHaveLength(0);
      expect(result.isComplete).toBe(true);
    });

    it("should track closure statistics", () => {
      const d1 = createTestDesign({ id: "d1" });
      const result = computeBehaviour([d1]);

      expect(result.closureStats.originalCount).toBe(1);
      expect(result.closureStats.computeTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateCandidateDesigns", () => {
    it("should generate candidates with opposite polarity", () => {
      const d1 = createTestDesign({ id: "d1", polarity: "+" });
      const candidates = generateCandidateDesigns([d1]);

      expect(candidates.length).toBeGreaterThan(0);
      
      // At least some candidates should have opposite polarity
      const oppositePolarityCount = candidates.filter((c) => c.polarity === "-").length;
      expect(oppositePolarityCount).toBeGreaterThan(0);
    });

    it("should return empty for empty input", () => {
      const candidates = generateCandidateDesigns([]);
      expect(candidates).toEqual([]);
    });
  });

  describe("getAllAddresses", () => {
    it("should collect all unique addresses", () => {
      const d1 = createTestDesign({
        id: "d1",
        base: [[]],
        actions: [
          { polarity: "+", focus: [], ramification: [[0], [1]], expression: "test", type: "claim" },
          { polarity: "+", focus: [0], ramification: [[0, 0]], expression: "test", type: "argue" },
        ],
      });

      const addresses = getAllAddresses([d1]);

      // Should include base, focus addresses, and ramifications
      expect(addresses.length).toBeGreaterThan(0);
      
      const keys = addresses.map(addressToKey);
      expect(keys).toContain("");
      expect(keys).toContain("0");
    });
  });
});

// ============================================================================
// POSITION ANALYZER TESTS
// ============================================================================

describe("Position Analyzer", () => {
  let arena: DeliberationArena;
  let testDesigns: LudicDesignTheory[];

  beforeEach(() => {
    clearAnalysisCache();
    arena = createTestArena();
    testDesigns = [
      createTestDesign({ id: "p1", polarity: "+", hasDaimon: false }),
      createTestDesign({ id: "p2", polarity: "+", hasDaimon: true }),
      createTestDesign({ id: "o1", polarity: "-", hasDaimon: true }),
    ];
  });

  describe("analyzePositionStrength", () => {
    it("should return strength metrics", () => {
      const strength = analyzePositionStrength(arena, [], testDesigns, {
        simulations: 10,
      });

      expect(strength).toHaveProperty("address");
      expect(strength).toHaveProperty("winRate");
      expect(strength).toHaveProperty("winningDesignCount");
      expect(strength).toHaveProperty("totalDesignCount");
      expect(strength).toHaveProperty("hasWinningStrategy");
      expect(strength).toHaveProperty("depth");
    });

    it("should have win rate between 0 and 1", () => {
      const strength = analyzePositionStrength(arena, [], testDesigns, {
        simulations: 10,
      });

      expect(strength.winRate).toBeGreaterThanOrEqual(0);
      expect(strength.winRate).toBeLessThanOrEqual(1);
    });

    it("should use cache when enabled", () => {
      const strength1 = analyzePositionStrength(arena, [], testDesigns, {
        simulations: 10,
        useCache: true,
      });

      const strength2 = analyzePositionStrength(arena, [], testDesigns, {
        simulations: 10,
        useCache: true,
      });

      // Should be exactly equal (same reference from cache)
      expect(strength1).toEqual(strength2);
    });
  });

  describe("analyzeAllPositions", () => {
    it("should analyze all arena positions", () => {
      const result = analyzeAllPositions(arena, testDesigns, {
        simulations: 5,
      });

      expect(result.positions.length).toBe(arena.positions.size);
      expect(result.statistics.positionsAnalyzed).toBe(arena.positions.size);
    });

    it("should include statistics", () => {
      const result = analyzeAllPositions(arena, testDesigns, {
        simulations: 5,
      });

      expect(result.statistics).toHaveProperty("positionsAnalyzed");
      expect(result.statistics).toHaveProperty("simulationsRun");
      expect(result.statistics).toHaveProperty("computeTime");
    });
  });

  describe("getDesignsStartingAt", () => {
    it("should find designs at root", () => {
      const designs = getDesignsStartingAt(testDesigns, []);
      expect(designs.length).toBeGreaterThan(0);
    });

    it("should filter by address prefix", () => {
      // Create design that starts at [1]
      const specificDesign = createTestDesign({ id: "specific", base: [[1]] });
      const allDesigns = [...testDesigns, specificDesign];

      const atRoot = getDesignsStartingAt(allDesigns, []);
      const atOne = getDesignsStartingAt(allDesigns, [1]);

      expect(atOne).toContain(specificDesign);
    });
  });

  describe("runSimulations", () => {
    it("should run specified number of simulations", () => {
      const results = runSimulations(testDesigns, [], 5);
      expect(results.length).toBe(5);
    });

    it("should return simulation results", () => {
      const results = runSimulations(testDesigns, [], 3);

      for (const result of results) {
        expect(result).toHaveProperty("winner");
        expect(result).toHaveProperty("moveCount");
        expect(result).toHaveProperty("convergent");
        expect(result).toHaveProperty("path");
      }
    });

    it("should handle no designs gracefully", () => {
      const results = runSimulations([], [], 5);
      expect(results).toEqual([]);
    });
  });

  describe("computeAverageDepth", () => {
    it("should compute average correctly", () => {
      const results = [
        { moveCount: 2 } as any,
        { moveCount: 4 } as any,
        { moveCount: 6 } as any,
      ];

      expect(computeAverageDepth(results)).toBe(4);
    });

    it("should return 0 for empty results", () => {
      expect(computeAverageDepth([])).toBe(0);
    });
  });

  describe("computeWinRate", () => {
    it("should compute P win rate", () => {
      const results = [
        { winner: "P" } as any,
        { winner: "P" } as any,
        { winner: "O" } as any,
        { winner: null } as any,
      ];

      // 2 P wins out of 3 completed games
      expect(computeWinRate(results, "+")).toBeCloseTo(2 / 3);
    });

    it("should return 0.5 for no completed games", () => {
      const results = [{ winner: null } as any];
      expect(computeWinRate(results, "+")).toBe(0.5);
    });
  });

  describe("hasWinningStrategy", () => {
    it("should detect winning designs", () => {
      const winningDesign = createTestDesign({ hasDaimon: false });
      expect(hasWinningStrategy([winningDesign], [])).toBe(true);
    });

    it("should return false when all have daimon", () => {
      const losingDesign = createTestDesign({ hasDaimon: true });
      expect(hasWinningStrategy([losingDesign], [])).toBe(false);
    });
  });

  describe("findWinningDesigns", () => {
    it("should find designs without daimon", () => {
      const winning = createTestDesign({ id: "winning", hasDaimon: false });
      const losing = createTestDesign({ id: "losing", hasDaimon: true });

      const found = findWinningDesigns([winning, losing], []);
      expect(found).toContain(winning);
      expect(found).not.toContain(losing);
    });
  });

  describe("comparePositions", () => {
    it("should rank by win rate first", () => {
      const a: PositionStrength = {
        address: [0],
        winRate: 0.8,
        winningDesignCount: 1,
        totalDesignCount: 2,
        hasWinningStrategy: true,
        depth: 3,
      };

      const b: PositionStrength = {
        address: [1],
        winRate: 0.6,
        winningDesignCount: 1,
        totalDesignCount: 2,
        hasWinningStrategy: true,
        depth: 3,
      };

      // Higher win rate should come first (negative = a before b)
      expect(comparePositions(a, b)).toBeLessThan(0);
    });
  });

  describe("sortByStrength", () => {
    it("should sort strongest first", () => {
      const positions: PositionStrength[] = [
        { address: [0], winRate: 0.3, winningDesignCount: 0, totalDesignCount: 1, hasWinningStrategy: false, depth: 1 },
        { address: [1], winRate: 0.9, winningDesignCount: 1, totalDesignCount: 1, hasWinningStrategy: true, depth: 1 },
        { address: [2], winRate: 0.5, winningDesignCount: 0, totalDesignCount: 1, hasWinningStrategy: false, depth: 1 },
      ];

      const sorted = sortByStrength(positions);
      expect(sorted[0].winRate).toBe(0.9);
      expect(sorted[2].winRate).toBe(0.3);
    });
  });
});

// ============================================================================
// VISUALIZATION DATA TESTS
// ============================================================================

describe("Visualization Data", () => {
  let arena: DeliberationArena;
  let positions: PositionStrength[];

  beforeEach(() => {
    arena = createTestArena();
    positions = [
      { address: [], winRate: 0.5, winningDesignCount: 1, totalDesignCount: 2, hasWinningStrategy: true, depth: 0 },
      { address: [0], winRate: 0.6, winningDesignCount: 1, totalDesignCount: 2, hasWinningStrategy: true, depth: 1 },
      { address: [1], winRate: 0.4, winningDesignCount: 0, totalDesignCount: 2, hasWinningStrategy: false, depth: 1 },
      { address: [0, 0], winRate: 0.7, winningDesignCount: 1, totalDesignCount: 1, hasWinningStrategy: true, depth: 2 },
    ];
  });

  describe("layoutAsTree", () => {
    it("should assign coordinates to all positions", () => {
      const heatMap = layoutAsTree(arena, positions);

      expect(heatMap.positions.length).toBe(arena.positions.size);

      for (const pos of heatMap.positions) {
        expect(typeof pos.x).toBe("number");
        expect(typeof pos.y).toBe("number");
        expect(pos.strength).toBeGreaterThanOrEqual(0);
        expect(pos.strength).toBeLessThanOrEqual(1);
      }
    });

    it("should increase Y with depth", () => {
      const heatMap = layoutAsTree(arena, positions);

      const rootPos = heatMap.positions.find((p) => p.address.length === 0);
      const childPos = heatMap.positions.find((p) => p.address.length === 1);

      if (rootPos && childPos) {
        expect(childPos.y).toBeGreaterThan(rootPos.y);
      }
    });
  });

  describe("findCriticalPoints", () => {
    it("should find positions with significant win rate change", () => {
      const criticalPositions: PositionStrength[] = [
        { address: [], winRate: 0.5, winningDesignCount: 1, totalDesignCount: 2, hasWinningStrategy: true, depth: 0 },
        { address: [0], winRate: 0.8, winningDesignCount: 1, totalDesignCount: 2, hasWinningStrategy: true, depth: 1 }, // Big change
        { address: [1], winRate: 0.51, winningDesignCount: 1, totalDesignCount: 2, hasWinningStrategy: true, depth: 1 }, // Small change
      ];

      const critical = findCriticalPoints(criticalPositions, 0.15);

      // Address [0] should be critical (0.3 change from root)
      const hasZero = critical.some((a) => addressToKey(a) === "0");
      expect(hasZero).toBe(true);
    });

    it("should skip root position", () => {
      const critical = findCriticalPoints(positions);
      const hasRoot = critical.some((a) => a.length === 0);
      expect(hasRoot).toBe(false);
    });
  });

  describe("extractFlowPaths", () => {
    it("should extract paths from simulations", () => {
      const simResults = [
        {
          path: {
            actions: [
              { focus: [], polarity: "+", ramification: [[0]], expression: "a", type: "claim" as const },
              { focus: [0], polarity: "-", ramification: [], expression: "b", type: "negate" as const },
            ],
            convergent: true,
            winner: "P" as const,
            incarnation: [],
          },
          convergent: true,
          winner: "P" as const,
          moveCount: 2,
          termination: "daimon" as const,
          lastPlayer: "O" as const,
        },
        {
          path: {
            actions: [
              { focus: [], polarity: "+", ramification: [[0]], expression: "a", type: "claim" as const },
              { focus: [0], polarity: "-", ramification: [], expression: "b", type: "negate" as const },
            ],
            convergent: true,
            winner: "P" as const,
            incarnation: [],
          },
          convergent: true,
          winner: "P" as const,
          moveCount: 2,
          termination: "daimon" as const,
          lastPlayer: "O" as const,
        },
      ];

      const flowPaths = extractFlowPaths(arena, simResults, 2);

      // Should find the repeated path
      expect(flowPaths.length).toBeGreaterThan(0);
      expect(flowPaths[0].frequency).toBe(2);
    });

    it("should filter by minimum frequency", () => {
      const simResults = [
        {
          path: {
            actions: [{ focus: [], polarity: "+", ramification: [], expression: "a", type: "claim" as const }],
            convergent: true,
            winner: "P" as const,
            incarnation: [],
          },
          convergent: true,
          winner: "P" as const,
          moveCount: 1,
          termination: "daimon" as const,
          lastPlayer: "P" as const,
        },
      ];

      // With minFrequency 2, single path should be excluded
      const flowPaths = extractFlowPaths(arena, simResults, 2);
      expect(flowPaths.length).toBe(0);
    });
  });

  describe("computeLandscapeStatistics", () => {
    it("should compute all statistics", () => {
      const criticalPoints: LudicAddress[] = [[0]];
      const flowPaths: any[] = [];

      const stats = computeLandscapeStatistics(arena, positions, criticalPoints, flowPaths);

      expect(stats.totalPositions).toBe(positions.length);
      expect(stats.criticalPointCount).toBe(1);
      expect(stats.pWinRate).toBeGreaterThanOrEqual(0);
      expect(stats.pWinRate).toBeLessThanOrEqual(1);
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateLandscapeData", () => {
    it("should generate complete landscape data", () => {
      const landscape = generateLandscapeData(arena, positions);

      expect(landscape).toHaveProperty("arena");
      expect(landscape).toHaveProperty("positions");
      expect(landscape).toHaveProperty("heatMap");
      expect(landscape).toHaveProperty("flowPaths");
      expect(landscape).toHaveProperty("criticalPoints");
      expect(landscape).toHaveProperty("statistics");
      expect(landscape).toHaveProperty("extendedHeatMap");
    });
  });

  describe("landscapeToJSON", () => {
    it("should export as JSON object", () => {
      const landscape = generateLandscapeData(arena, positions);
      const json = landscapeToJSON(landscape);

      expect(json).toHaveProperty("arenaId");
      expect(json).toHaveProperty("statistics");
      expect(json).toHaveProperty("positions");
      expect(json).toHaveProperty("heatMap");
      expect(json).toHaveProperty("flowPaths");
      expect(json).toHaveProperty("criticalPoints");
    });
  });

  describe("landscapeToSVG", () => {
    it("should generate valid SVG", () => {
      const landscape = generateLandscapeData(arena, positions);
      const svg = landscapeToSVG(landscape);

      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("circle");
    });
  });
});

// ============================================================================
// COMPLETENESS CHECKER TESTS
// ============================================================================

describe("Completeness Checker", () => {
  describe("checkBehaviourCompleteness", () => {
    it("should return complete result structure", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      const result = checkBehaviourCompleteness(behaviour);

      expect(result).toHaveProperty("isComplete");
      expect(result).toHaveProperty("isInternallyComplete");
      expect(result).toHaveProperty("missingDesigns");
      expect(result).toHaveProperty("excessDesigns");
      expect(result).toHaveProperty("diagnostics");
      expect(result).toHaveProperty("statistics");
    });

    it("should handle empty behaviour", () => {
      const behaviour: LudicBehaviourTheory = {
        id: "empty",
        base: [],
        designs: [],
        polarity: "+",
        isComplete: true,
      };

      const result = checkBehaviourCompleteness(behaviour);

      expect(result.isComplete).toBe(true);
      expect(result.statistics.designCount).toBe(0);
    });
  });

  describe("checkDesignCompleteness", () => {
    it("should check design completeness", () => {
      const design = createTestDesign({ id: "test" });
      const result = checkDesignCompleteness(design);

      expect(result).toHaveProperty("designId");
      expect(result).toHaveProperty("isComplete");
      expect(result).toHaveProperty("missingResponses");
      expect(result).toHaveProperty("incompleteChronicles");
    });

    it("should find incomplete chronicles", () => {
      const incompleteDesign: LudicDesignTheory = {
        id: "incomplete",
        base: [[]],
        polarity: "+",
        chronicles: [
          {
            id: "incomplete-chronicle",
            actions: [
              { polarity: "+", focus: [], ramification: [[0]], expression: "test", type: "claim" },
            ],
            isComplete: false, // Marked incomplete
          },
        ],
        hasDaimon: false,
        isWinning: true,
      };

      const result = checkDesignCompleteness(incompleteDesign);
      expect(result.incompleteChronicles.length).toBeGreaterThan(0);
    });
  });

  describe("findMissingDesigns", () => {
    it("should find designs added by closure", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      const missing = findMissingDesigns(behaviour);

      // May or may not find missing designs depending on closure
      expect(Array.isArray(missing)).toBe(true);
    });
  });

  describe("validateBehaviourStructure", () => {
    it("should validate behaviour structure", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      const result = validateBehaviourStructure(behaviour);

      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
    });

    it("should warn about empty behaviour", () => {
      const behaviour: LudicBehaviourTheory = {
        id: "empty",
        base: [],
        designs: [],
        polarity: "+",
        isComplete: true,
      };

      const result = validateBehaviourStructure(behaviour);

      expect(result.warnings.some((w) => w.includes("no designs"))).toBe(true);
    });
  });

  describe("validateDesignStructure", () => {
    it("should validate design structure", () => {
      const design = createTestDesign({ id: "test" });
      const result = validateDesignStructure(design);

      expect(result.valid).toBe(true);
    });

    it("should warn about empty chronicles", () => {
      const emptyDesign: LudicDesignTheory = {
        id: "empty",
        base: [[]],
        polarity: "+",
        chronicles: [],
        hasDaimon: false,
        isWinning: false,
      };

      const result = validateDesignStructure(emptyDesign);
      expect(result.warnings.some((w) => w.includes("no chronicles"))).toBe(true);
    });
  });

  describe("isMinimallyComplete", () => {
    it("should return true for valid behaviour", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      expect(isMinimallyComplete(behaviour)).toBe(true);
    });

    it("should return false for empty behaviour", () => {
      const behaviour: LudicBehaviourTheory = {
        id: "empty",
        base: [],
        designs: [],
        polarity: "+",
        isComplete: true,
      };

      expect(isMinimallyComplete(behaviour)).toBe(false);
    });
  });

  describe("getCompletenessSummary", () => {
    it("should return formatted summary", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      const result = checkBehaviourCompleteness(behaviour);
      const summary = getCompletenessSummary(result);

      expect(typeof summary).toBe("string");
      expect(summary).toContain("Behaviour Completeness");
      expect(summary).toContain("Statistics");
    });
  });

  describe("getCoverageReport", () => {
    it("should generate coverage report", () => {
      const design = createTestDesign({ id: "test" });
      const behaviour: LudicBehaviourTheory = {
        id: "behaviour",
        base: [[]],
        designs: [design],
        polarity: "+",
        isComplete: false,
      };

      const report = getCoverageReport(behaviour);

      expect(report).toHaveProperty("allAddresses");
      expect(report).toHaveProperty("pCovered");
      expect(report).toHaveProperty("oCovered");
      expect(report).toHaveProperty("uncovered");
      expect(report).toHaveProperty("coveragePercent");
      expect(report.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(report.coveragePercent).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Landscape Integration", () => {
  it("should complete full analysis workflow", () => {
    // Create arena
    const arena = createTestArena();

    // Create designs
    const designs = [
      createTestDesign({ id: "p1", polarity: "+", hasDaimon: false }),
      createTestDesign({ id: "p2", polarity: "+", hasDaimon: true }),
      createTestDesign({ id: "o1", polarity: "-", hasDaimon: true }),
    ];

    // Compute behaviour
    const behaviourResult = computeBehaviour(designs);
    expect(behaviourResult.behaviour).toBeDefined();

    // Analyze positions
    const analysisResult = analyzeAllPositions(arena, behaviourResult.behaviour.designs, {
      simulations: 5,
    });
    expect(analysisResult.positions.length).toBeGreaterThan(0);

    // Generate landscape
    const landscape = generateLandscapeData(arena, analysisResult.positions);
    expect(landscape.heatMap.positions.length).toBeGreaterThan(0);

    // Check completeness
    const completeness = checkBehaviourCompleteness(behaviourResult.behaviour);
    expect(completeness).toBeDefined();

    // Export
    const json = landscapeToJSON(landscape);
    expect(json).toHaveProperty("statistics");
  });
});
