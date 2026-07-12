/**
 * ============================================
 * EXTRACTION MODULE TESTS
 * ============================================
 * 
 * Tests for Phase 3: Visitable Path Extraction & Incarnation
 * 
 * Test categories:
 * 1. Path extraction
 * 2. Incarnation computation
 * 3. Design completion
 * 4. Narrative formatting
 */

import { describe, it, expect } from "vitest";

import type {
  InteractionResult,
  VisitablePath,
  DialogueAct,
  LudicDesignTheory,
  LudicBehaviourTheory,
  Chronicle,
  JustifiedNarrative,
  DeliberationArena,
  ArenaPositionTheory,
} from "../types/ludics-theory";

import {
  createDaimon,
  addressToKey,
} from "../types/ludics-theory";

// Path extractor imports
import {
  extractPath,
  extractPaths,
  extractAllPaths,
  extractPathsFromDesign,
  chronicleToPath,
  validatePath,
  comparePaths,
  mergePaths,
  getPathStatistics,
  getPathsStatistics,
} from "../extraction/path-extractor";

// Incarnation imports
import {
  computeIncarnation,
  computeView,
  hasJustifyingPositive,
  findJustifyingPositive,
  justifies,
  findLastPositive,
  isEssentialAction,
  stripNonEssential,
  getJustificationChain,
  isMinimalIncarnation,
  getCompressionRatio,
  mergeIncarnations,
  getIncarnationDepth,
  getIncarnationWidth,
} from "../extraction/incarnation";

// Completion imports
import {
  isChronicleComplete,
  findIncompleteChronicles,
  getIncompletePositions,
  completeDesign,
  addDaimonEnding,
  completeDesignWithStats,
  isDesignComplete,
  getCompletionDegree,
  isWinningDesign,
  completeDesigns,
  validateCompletedDesign,
  stripDaimons,
  countDaimons,
} from "../extraction/completion";

// Narrative formatter imports
import {
  formatAsNarrative,
  deriveJustification,
  deriveConclusion,
  narrativeToMarkdown,
  narrativeToJSON,
  narrativeToPlainText,
  narrativeToHTML,
  analyzeNarrative,
  compareNarratives,
} from "../extraction/narrative-formatter";

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createDialogueAct(
  polarity: "+" | "-",
  focus: number[],
  ramification: number[][],
  expression: string,
  type: DialogueAct["type"] = "claim"
): DialogueAct {
  return {
    polarity,
    focus,
    ramification,
    expression,
    type,
  };
}

function createTestInteractionResult(
  trace: DialogueAct[],
  outcome: "convergent" | "divergent" = "divergent",
  stuckPlayer: "P" | "O" | null = null
): InteractionResult {
  return {
    trace,
    outcome,
    stuckPlayer,
    moveCount: trace.length,
    path: {
      actions: trace,
      convergent: outcome === "convergent",
      winner: stuckPlayer ? (stuckPlayer === "P" ? "O" : "P") : null,
      incarnation: [],
    },
  };
}

function createTestChronicle(
  actions: DialogueAct[],
  isComplete: boolean = false
): Chronicle {
  return {
    actions,
    isComplete,
    id: `chronicle-${Math.random().toString(36).substr(2, 9)}`,
  };
}

function createTestDesign(
  chronicles: Chronicle[],
  polarity: "+" | "-" = "+",
  hasDaimon: boolean = false
): LudicDesignTheory {
  return {
    id: `design-${Math.random().toString(36).substr(2, 9)}`,
    base: [[]],
    polarity,
    chronicles,
    hasDaimon,
    isWinning: !hasDaimon,
  };
}

function createTestBehaviour(designs: LudicDesignTheory[]): LudicBehaviourTheory {
  return {
    id: `behaviour-${Math.random().toString(36).substr(2, 9)}`,
    base: [[]],
    designs,
    polarity: "+",
    isComplete: true,
  };
}

// ============================================================================
// PATH EXTRACTION TESTS
// ============================================================================

describe("Path Extraction", () => {
  describe("extractPath", () => {
    it("should extract path from convergent interaction", () => {
      const daimon = createDaimon([0]);
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "Initial claim"),
        createDialogueAct("-", [0], [[0, 0]], "Challenge"),
        daimon,
      ];
      
      const result = createTestInteractionResult(trace, "convergent", "P");
      const path = extractPath(result);

      expect(path.actions).toHaveLength(3);
      expect(path.convergent).toBe(true);
      expect(path.winner).toBe("O");
    });

    it("should extract path from divergent interaction", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "Claim"),
        createDialogueAct("-", [0], [], "Counter"),
      ];
      
      const result = createTestInteractionResult(trace, "divergent", "P");
      const path = extractPath(result);

      expect(path.actions).toHaveLength(2);
      expect(path.convergent).toBe(false);
      expect(path.winner).toBe("O");
    });

    it("should compute incarnation for extracted path", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0], [1]], "Initial"),
        createDialogueAct("-", [0], [[0, 0]], "Response to 0"),
        createDialogueAct("+", [0, 0], [], "Final"),
      ];
      
      const result = createTestInteractionResult(trace, "divergent", "O");
      const path = extractPath(result);

      expect(path.incarnation).toBeDefined();
      expect(path.incarnation.length).toBeGreaterThan(0);
    });
  });

  describe("extractPaths", () => {
    it("should extract multiple paths from batch", () => {
      const traces = [
        [createDialogueAct("+", [], [[0]], "A")],
        [createDialogueAct("+", [], [[0]], "B")],
      ];
      
      const results = traces.map((t) => createTestInteractionResult(t));
      const paths = extractPaths(results);

      expect(paths).toHaveLength(2);
    });
  });

  describe("validatePath", () => {
    it("should validate correct polarity alternation", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [[0, 0]], "B"),
          createDialogueAct("+", [0, 0], [], "C"),
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const validation = validatePath(path);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject invalid polarity sequence", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("+", [0], [[0, 0]], "B"), // Should be negative
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const validation = validatePath(path);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "POLARITY_SEQUENCE")).toBe(true);
    });

    it("should reject empty path", () => {
      const path: VisitablePath = {
        actions: [],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const validation = validatePath(path);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "EMPTY")).toBe(true);
    });
  });

  describe("comparePaths", () => {
    it("should identify equal paths", () => {
      const actions = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ];
      
      const path1: VisitablePath = {
        actions,
        convergent: false,
        winner: null,
        incarnation: [],
      };
      const path2: VisitablePath = {
        actions: [...actions],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const comparison = comparePaths(path1, path2);
      expect(comparison.equal).toBe(true);
      expect(comparison.similarity).toBe(1);
    });

    it("should find common prefix", () => {
      const path1: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [[0, 0]], "B"),
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };
      const path2: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [[0, 1]], "C"), // Different
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const comparison = comparePaths(path1, path2);
      expect(comparison.equal).toBe(false);
      expect(comparison.hasCommonPrefix).toBe(true);
      expect(comparison.commonPrefixLength).toBe(1);
    });
  });

  describe("mergePaths", () => {
    it("should merge paths with common prefix", () => {
      const path1: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [], "B"),
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };
      const path2: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [], "C"),
        ],
        convergent: false,
        winner: null,
        incarnation: [],
      };

      const merged = mergePaths([path1, path2]);
      expect(merged.commonPrefix).toHaveLength(1);
      expect(merged.branches).toHaveLength(2);
    });

    it("should handle empty input", () => {
      const merged = mergePaths([]);
      expect(merged.commonPrefix).toHaveLength(0);
      expect(merged.branches).toHaveLength(0);
    });
  });

  describe("getPathStatistics", () => {
    it("should compute correct statistics", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0], [1]], "A"),
          createDialogueAct("-", [0], [[0, 0]], "B"),
          createDialogueAct("+", [0, 0], [], "C"),
        ],
        convergent: false,
        winner: null,
        incarnation: [
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [], "B"),
        ],
      };

      const stats = getPathStatistics(path);
      expect(stats.totalMoves).toBe(3);
      expect(stats.positiveMoves).toBe(2);
      expect(stats.negativeMoves).toBe(1);
      expect(stats.maxDepth).toBe(2);
      expect(stats.incarnationLength).toBe(2);
    });
  });
});

// ============================================================================
// INCARNATION TESTS
// ============================================================================

describe("Incarnation", () => {
  describe("computeView", () => {
    it("should keep all positive actions", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("+", [0], [[0, 0]], "B"),
      ];

      const view = computeView(trace);
      expect(view).toHaveLength(2);
    });

    it("should keep justified negative actions", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
      ];

      const view = computeView(trace);
      expect(view).toHaveLength(2);
    });

    it("should handle empty trace", () => {
      const view = computeView([]);
      expect(view).toHaveLength(0);
    });
  });

  describe("computeIncarnation", () => {
    it("should compute essential core", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0], [1]], "Initial"),
        createDialogueAct("-", [0], [[0, 0]], "Response"),
        createDialogueAct("+", [0, 0], [], "Final"),
      ];

      const incarnation = computeIncarnation(trace);
      expect(incarnation.length).toBeLessThanOrEqual(trace.length);
      expect(incarnation.length).toBeGreaterThan(0);
    });

    it("should handle single action", () => {
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "Only"),
      ];

      const incarnation = computeIncarnation(trace);
      expect(incarnation).toHaveLength(1);
    });

    it("should handle daimon ending", () => {
      const daimon = createDaimon([0]);
      const trace: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        daimon,
      ];

      const incarnation = computeIncarnation(trace);
      expect(incarnation.length).toBeGreaterThan(0);
    });
  });

  describe("justifies", () => {
    it("should return true when focus is in ramification", () => {
      const positive = createDialogueAct("+", [], [[0], [1]], "A");
      const negative = createDialogueAct("-", [0], [], "B");

      expect(justifies(positive, negative)).toBe(true);
    });

    it("should return true when focus extends ramification", () => {
      const positive = createDialogueAct("+", [], [[0]], "A");
      const negative = createDialogueAct("-", [0, 0], [], "B");

      expect(justifies(positive, negative)).toBe(true);
    });

    it("should return false when no justification", () => {
      const positive = createDialogueAct("+", [1], [[1, 0]], "A");
      const negative = createDialogueAct("-", [0], [], "B");

      expect(justifies(positive, negative)).toBe(false);
    });
  });

  describe("hasJustifyingPositive", () => {
    it("should find justifier in previous actions", () => {
      const negative = createDialogueAct("-", [0], [], "B");
      const previous: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
      ];

      expect(hasJustifyingPositive(negative, previous)).toBe(true);
    });

    it("should return false when no justifier", () => {
      const negative = createDialogueAct("-", [5, 3], [], "B");
      const previous: DialogueAct[] = [
        createDialogueAct("+", [1], [[1, 0]], "A"),
      ];

      expect(hasJustifyingPositive(negative, previous)).toBe(false);
    });
  });

  describe("findLastPositive", () => {
    it("should find last positive action", () => {
      const actions: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [], "C"),
      ];

      const last = findLastPositive(actions);
      expect(last?.expression).toBe("C");
    });

    it("should return null for empty array", () => {
      expect(findLastPositive([])).toBeNull();
    });

    it("should return null for all negative", () => {
      const actions: DialogueAct[] = [
        createDialogueAct("-", [0], [], "A"),
        createDialogueAct("-", [1], [], "B"),
      ];

      expect(findLastPositive(actions)).toBeNull();
    });
  });

  describe("getJustificationChain", () => {
    it("should build chain of justifications", () => {
      const incarnation: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "Initial claim"),
        createDialogueAct("-", [0], [[0, 0]], "Counter"),
        createDialogueAct("+", [0, 0], [], "Response"),
      ];

      const chain = getJustificationChain(incarnation);
      expect(chain).toHaveLength(3);
      expect(chain[0]).toContain("Initial");
    });
  });

  describe("getCompressionRatio", () => {
    it("should compute ratio correctly", () => {
      const original: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [], "C"),
        createDialogueAct("-", [0, 0, 0], [], "D"),
      ];
      const incarnation: DialogueAct[] = [
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ];

      const ratio = getCompressionRatio(original, incarnation);
      expect(ratio).toBe(0.5);
    });

    it("should return 1 for empty original", () => {
      const ratio = getCompressionRatio([], []);
      expect(ratio).toBe(1);
    });
  });
});

// ============================================================================
// COMPLETION TESTS
// ============================================================================

describe("Completion", () => {
  describe("isChronicleComplete", () => {
    it("should return true for chronicle ending in daimon", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);

      expect(isChronicleComplete(chronicle)).toBe(true);
    });

    it("should return true for chronicle ending in negative action", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ]);

      expect(isChronicleComplete(chronicle)).toBe(true);
    });

    it("should return false for chronicle ending in positive with ramification", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [[0, 0, 0]], "C"), // Has ramification
      ]);

      expect(isChronicleComplete(chronicle)).toBe(false);
    });

    it("should return true for chronicle with isComplete flag", () => {
      const chronicle = createTestChronicle(
        [createDialogueAct("+", [], [[0]], "A")],
        true
      );

      expect(isChronicleComplete(chronicle)).toBe(true);
    });
  });

  describe("findIncompleteChronicles", () => {
    it("should find incomplete chronicles", () => {
      const completeChronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);
      const incompleteChronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "B"),
        createDialogueAct("-", [0], [[0, 0]], "C"),
        createDialogueAct("+", [0, 0], [[0, 0, 0]], "D"),
      ]);

      const design = createTestDesign([completeChronicle, incompleteChronicle]);
      const incomplete = findIncompleteChronicles(design);

      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].index).toBe(1);
    });
  });

  describe("completeDesign", () => {
    it("should add daimon to incomplete chronicles", () => {
      const incompleteChronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [[0, 0, 0]], "C"),
      ]);

      const design = createTestDesign([incompleteChronicle]);
      const completed = completeDesign(design);

      expect(completed.hasDaimon).toBe(true);
      expect(isDesignComplete(completed)).toBe(true);
    });

    it("should not modify already complete design", () => {
      const completeChronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);

      const design = createTestDesign([completeChronicle], "+", true);
      const completed = completeDesign(design);

      expect(completed.chronicles).toHaveLength(1);
    });
  });

  describe("completeDesignWithStats", () => {
    it("should return completion statistics", () => {
      const incompleteChronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [[0, 0, 0]], "C"),
      ]);

      const design = createTestDesign([incompleteChronicle]);
      const { design: completed, stats } = completeDesignWithStats(design);

      expect(stats.originalChronicleCount).toBe(1);
      expect(stats.daimonsAdded).toBe(1);
      expect(stats.wasAlreadyComplete).toBe(false);
    });
  });

  describe("isWinningDesign", () => {
    it("should return true for design without daimons", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ]);

      const design = createTestDesign([chronicle], "+", false);
      design.isWinning = true;

      expect(isWinningDesign(design)).toBe(true);
    });

    it("should return false for design with daimons", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);

      const design = createTestDesign([chronicle], "+", true);
      expect(isWinningDesign(design)).toBe(false);
    });
  });

  describe("stripDaimons", () => {
    it("should remove all daimons", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);

      const design = createTestDesign([chronicle], "+", true);
      const stripped = stripDaimons(design);

      expect(countDaimons(stripped)).toBe(0);
      expect(stripped.hasDaimon).toBe(false);
    });
  });

  describe("countDaimons", () => {
    it("should count daimons correctly", () => {
      const chronicle1 = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);
      const chronicle2 = createTestChronicle([
        createDialogueAct("+", [], [[1]], "B"),
        createDaimon([1]),
      ]);

      const design = createTestDesign([chronicle1, chronicle2], "+", true);
      expect(countDaimons(design)).toBe(2);
    });
  });

  describe("validateCompletedDesign", () => {
    it("should validate correct completed design", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ]);

      const design = createTestDesign([chronicle], "+", true);
      const validation = validateCompletedDesign(design);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect incomplete chronicles", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [[0, 0]], "B"),
        createDialogueAct("+", [0, 0], [[0, 0, 0]], "C"),
      ]);

      const design = createTestDesign([chronicle]);
      const validation = validateCompletedDesign(design);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// NARRATIVE FORMATTER TESTS
// ============================================================================

describe("Narrative Formatter", () => {
  describe("formatAsNarrative", () => {
    it("should format basic path as narrative", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "This is the main claim"),
          createDialogueAct("-", [0], [[0, 0]], "I disagree", "attack"),
          createDialogueAct("+", [0, 0], [], "Here is my response"),
        ],
        convergent: false,
        winner: "P",
        incarnation: [
          createDialogueAct("+", [], [[0]], "This is the main claim"),
          createDialogueAct("-", [0], [], "I disagree", "attack"),
        ],
      };

      const narrative = formatAsNarrative(path);

      expect(narrative.steps).toHaveLength(2);
      expect(narrative.steps[0].speaker).toBe("Proponent");
      expect(narrative.steps[1].speaker).toBe("Opponent");
      expect(narrative.conclusion).toBeDefined();
    });

    it("should use arena content when available", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "placeholder"),
        ],
        convergent: false,
        winner: null,
        incarnation: [
          createDialogueAct("+", [], [[0]], "placeholder"),
        ],
      };

      const arena: DeliberationArena = {
        deliberationId: "test",
        rootAddress: [],
        positions: new Map([
          [addressToKey([]), {
            address: [],
            content: "Real content from arena",
            type: "claim",
            ramification: [0],
            polarity: "+",
          } as ArenaPositionTheory],
        ]),
        availableDesigns: [],
      };

      const narrative = formatAsNarrative(path, arena);
      expect(narrative.steps[0].position).toBe("Real content from arena");
    });

    it("should support different styles", () => {
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "Test claim"),
        ],
        convergent: false,
        winner: null,
        incarnation: [
          createDialogueAct("+", [], [[0]], "Test claim"),
        ],
      };

      const formal = formatAsNarrative(path, undefined, { style: "formal" });
      const conversational = formatAsNarrative(path, undefined, { style: "conversational" });

      expect(formal.steps[0].justification).not.toBe(conversational.steps[0].justification);
    });

    it("should handle convergent path", () => {
      const daimon = createDaimon([0]);
      const path: VisitablePath = {
        actions: [
          createDialogueAct("+", [], [[0]], "Claim"),
          createDialogueAct("-", [0], [[0, 0]], "Counter"),
          daimon,
        ],
        convergent: true,
        winner: "O",
        incarnation: [
          createDialogueAct("+", [], [[0]], "Claim"),
          daimon,
        ],
      };

      const narrative = formatAsNarrative(path);
      expect(narrative.conclusion).toContain("concedes");
    });
  });

  describe("narrativeToMarkdown", () => {
    it("should produce valid markdown", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "Claim A", justification: "Initial", speaker: "Proponent", type: "claim" },
          { position: "Counter B", justification: "Response", speaker: "Opponent", type: "attack" },
        ],
        conclusion: "Proponent wins",
        justificationChain: ["Initial", "Response"],
      };

      const markdown = narrativeToMarkdown(narrative);

      expect(markdown).toContain("# Argument Narrative");
      expect(markdown).toContain("**Proponent**");
      expect(markdown).toContain("## Conclusion");
    });

    it("should support numbered vs unnumbered", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J", speaker: "Proponent", type: "claim" },
        ],
        conclusion: "C",
        justificationChain: ["J"],
      };

      const numbered = narrativeToMarkdown(narrative, { numbered: true });
      const unnumbered = narrativeToMarkdown(narrative, { numbered: false });

      expect(numbered).toContain("1.");
      expect(unnumbered).not.toContain("1.");
    });
  });

  describe("narrativeToJSON", () => {
    it("should produce valid JSON structure", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J1", speaker: "Proponent", type: "claim" },
          { position: "B", justification: "J2", speaker: "Opponent", type: "attack" },
        ],
        conclusion: "C",
        justificationChain: ["J1", "J2"],
      };

      const json = narrativeToJSON(narrative);

      expect(json).toHaveProperty("steps");
      expect(json).toHaveProperty("conclusion");
      expect(json).toHaveProperty("metadata");
      expect((json as any).metadata.stepCount).toBe(2);
    });
  });

  describe("narrativeToPlainText", () => {
    it("should produce readable text", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "Test position", justification: "Test justification", speaker: "Proponent", type: "claim" },
        ],
        conclusion: "Test conclusion",
        justificationChain: ["Test justification"],
      };

      const text = narrativeToPlainText(narrative);

      expect(text).toContain("ARGUMENT NARRATIVE");
      expect(text).toContain("Test position");
      expect(text).toContain("CONCLUSION");
    });
  });

  describe("narrativeToHTML", () => {
    it("should produce valid HTML", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "Position with <tags>", justification: "J", speaker: "Proponent", type: "claim" },
        ],
        conclusion: "Conclusion",
        justificationChain: ["J"],
      };

      const html = narrativeToHTML(narrative);

      expect(html).toContain("<div class=\"argument-narrative\">");
      expect(html).toContain("&lt;tags&gt;"); // Escaped
      expect(html).toContain("</div>");
    });
  });

  describe("analyzeNarrative", () => {
    it("should compute correct analysis", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J", speaker: "Proponent", type: "claim" },
          { position: "B", justification: "J", speaker: "Opponent", type: "attack" },
          { position: "C", justification: "J", speaker: "Proponent", type: "support" },
          { position: "D", justification: "J", speaker: "Opponent", type: "concession" },
        ],
        conclusion: "C",
        justificationChain: [],
      };

      const analysis = analyzeNarrative(narrative);

      expect(analysis.stepCount).toBe(4);
      expect(analysis.proponentSteps).toBe(2);
      expect(analysis.opponentSteps).toBe(2);
      expect(analysis.claimCount).toBe(1);
      expect(analysis.attackCount).toBe(1);
      expect(analysis.supportCount).toBe(1);
      expect(analysis.concessionCount).toBe(1);
      expect(analysis.turnCount).toBe(3);
    });
  });

  describe("compareNarratives", () => {
    it("should compare identical narratives", () => {
      const narrative: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J", speaker: "Proponent", type: "claim" },
        ],
        conclusion: "C",
        justificationChain: ["J"],
      };

      const comparison = compareNarratives(narrative, narrative);

      expect(comparison.sameLength).toBe(true);
      expect(comparison.commonSteps).toBe(1);
      expect(comparison.similarConclusion).toBe(true);
    });

    it("should find divergence point", () => {
      const n1: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J", speaker: "Proponent", type: "claim" },
          { position: "B", justification: "J", speaker: "Opponent", type: "attack" },
        ],
        conclusion: "C1",
        justificationChain: [],
      };
      const n2: JustifiedNarrative = {
        steps: [
          { position: "A", justification: "J", speaker: "Proponent", type: "claim" },
          { position: "X", justification: "J", speaker: "Opponent", type: "support" },
        ],
        conclusion: "C2",
        justificationChain: [],
      };

      const comparison = compareNarratives(n1, n2);

      expect(comparison.sameLength).toBe(true);
      expect(comparison.commonSteps).toBe(1);
      expect(comparison.divergencePoint).toBe(1);
      expect(comparison.similarConclusion).toBe(false);
    });
  });
});

// ============================================================================
// DESIGN & CHRONICLE PATH EXTRACTION
// ============================================================================

describe("Design/Chronicle Path Extraction", () => {
  describe("extractPathsFromDesign", () => {
    it("should extract paths from all chronicles", () => {
      const chronicle1 = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ]);
      const chronicle2 = createTestChronicle([
        createDialogueAct("+", [], [[1]], "C"),
        createDaimon([1]),
      ]);

      const design = createTestDesign([chronicle1, chronicle2], "+", true);
      const paths = extractPathsFromDesign(design);

      expect(paths).toHaveLength(2);
    });
  });

  describe("chronicleToPath", () => {
    it("should convert chronicle to path", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDialogueAct("-", [0], [], "B"),
      ], true);

      const path = chronicleToPath(chronicle);

      expect(path.actions).toHaveLength(2);
      expect(path.convergent).toBe(false);
    });

    it("should detect convergent from daimon", () => {
      const chronicle = createTestChronicle([
        createDialogueAct("+", [], [[0]], "A"),
        createDaimon([0]),
      ], true);

      const path = chronicleToPath(chronicle);

      expect(path.convergent).toBe(true);
    });
  });

  describe("extractAllPaths", () => {
    it("should extract unique paths from behaviour", () => {
      const design1 = createTestDesign([
        createTestChronicle([
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [], "B"),
        ]),
      ]);
      const design2 = createTestDesign([
        createTestChronicle([
          createDialogueAct("+", [], [[0]], "A"),
          createDialogueAct("-", [0], [], "B"), // Same path
        ]),
        createTestChronicle([
          createDialogueAct("+", [], [[1]], "C"),
          createDialogueAct("-", [1], [], "D"),
        ]),
      ]);

      const behaviour = createTestBehaviour([design1, design2]);
      const paths = extractAllPaths(behaviour);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.length).toBeLessThanOrEqual(3); // Should deduplicate
    });
  });
});
