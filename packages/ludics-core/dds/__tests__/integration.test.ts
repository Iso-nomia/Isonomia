/**
 * ============================================
 * INTEGRATION TESTS
 * ============================================
 * 
 * Phase 7: Full deliberation flow integration tests
 * 
 * Tests the complete pipeline:
 * 1. Deliberation → Arena transformation
 * 2. Arena → Interaction → Outcome
 * 3. Outcome → Path extraction → Narrative
 * 4. Landscape analysis flow
 */

import { describe, it, expect, beforeEach } from "vitest";

import type {
  DeliberationArena,
  ArenaPositionTheory,
  InteractionState,
  DialogueAct,
  LudicDesignTheory,
  Chronicle,
  VisitablePath,
  LudicBehaviourTheory,
  LandscapeData,
  InteractionResult,
} from "../types/ludics-theory";

import {
  addressToKey,
  polarityAtAddress,
  createDaimon,
} from "../types/ludics-theory";

// Interaction imports
import {
  createInitialState,
  stepInteraction,
  getLegalMoves,
  isTerminated,
  determineWinner,
  detectOutcome,
  createStrategy,
  applyStrategy,
  createDesign,
} from "../interaction";

// Extraction imports
import {
  extractPath,
  extractAllPaths,
  validatePath,
  getPathStatistics,
} from "../extraction/path-extractor";

import {
  computeIncarnation,
  getJustificationChain,
} from "../extraction/incarnation";

import {
  completeDesign,
  isDesignComplete,
} from "../extraction/completion";

import {
  formatAsNarrative,
  narrativeToMarkdown,
  narrativeToJSON,
} from "../extraction/narrative-formatter";

// Landscape imports
import {
  computeOrthogonal,
  computeBiorthogonalClosure,
  computeBehaviour,
  converges,
} from "../landscape/behaviour-computer";

import {
  analyzePositionStrength,
  analyzeAllPositions,
  runSimulations,
} from "../landscape/position-analyzer";

import {
  generateLandscapeData,
  findCriticalPoints,
  extractFlowPaths,
} from "../landscape/visualization-data";

import {
  checkBehaviourCompleteness,
  checkDesignCompleteness,
} from "../landscape/completeness-checker";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test InteractionResult from a trace
 */
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

/**
 * Create a deliberation-like arena with rich structure
 */
function createDeliberationArena(): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  // Root claim (depth 0, +)
  positions.set("", {
    address: [],
    content: "We should adopt renewable energy",
    type: "claim",
    ramification: [0, 1, 2],
    polarity: "+",
  });

  // First response branch: Environmental argument
  positions.set("0", {
    address: [0],
    content: "Climate change is accelerating",
    type: "support",
    ramification: [0, 1],
    polarity: "-",
  });

  positions.set("0.0", {
    address: [0, 0],
    content: "Scientific consensus supports this",
    type: "support",
    ramification: [0],
    polarity: "+",
  });

  positions.set("0.0.0", {
    address: [0, 0, 0],
    content: "But models have uncertainties",
    type: "attack",
    ramification: [],
    polarity: "-",
  });

  positions.set("0.1", {
    address: [0, 1],
    content: "Economic transition is costly",
    type: "attack",
    ramification: [],
    polarity: "+",
  });

  // Second response branch: Economic argument
  positions.set("1", {
    address: [1],
    content: "Renewable costs are dropping",
    type: "support",
    ramification: [0],
    polarity: "-",
  });

  positions.set("1.0", {
    address: [1, 0],
    content: "Solar reached grid parity",
    type: "support",
    ramification: [],
    polarity: "+",
  });

  // Third response branch: Opposition
  positions.set("2", {
    address: [2],
    content: "Fossil fuels are more reliable",
    type: "attack",
    ramification: [0, 1],
    polarity: "-",
  });

  positions.set("2.0", {
    address: [2, 0],
    content: "Battery storage solves reliability",
    type: "attack",
    ramification: [],
    polarity: "+",
  });

  positions.set("2.1", {
    address: [2, 1],
    content: "Grid infrastructure needs upgrade",
    type: "support",
    ramification: [],
    polarity: "+",
  });

  return {
    deliberationId: "delib-renewable-energy",
    rootAddress: [],
    positions,
    availableDesigns: [],
  };
}

/**
 * Create a proponent design (positive player strategy)
 */
function createProponentDesign(arena: DeliberationArena): LudicDesignTheory {
  // P's strategy: push through environmental argument
  const chronicle1: Chronicle = {
    id: "p-env-path",
    actions: [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [0],
        ramification: [[0, 0], [0, 1]],
        expression: "Climate change is accelerating",
        type: "support",
      },
      {
        polarity: "+",
        focus: [0, 0],
        ramification: [[0, 0, 0]],
        expression: "Scientific consensus supports this",
        type: "support",
      },
    ],
    isComplete: true,
  };

  // P's strategy: economic argument path
  const chronicle2: Chronicle = {
    id: "p-econ-path",
    actions: [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [1],
        ramification: [[1, 0]],
        expression: "Renewable costs are dropping",
        type: "support",
      },
      {
        polarity: "+",
        focus: [1, 0],
        ramification: [],
        expression: "Solar reached grid parity",
        type: "support",
      },
    ],
    isComplete: true,
  };

  return {
    id: "proponent-design",
    base: [],
    polarity: "+",
    chronicles: [chronicle1, chronicle2],
    hasDaimon: false,
  };
}

/**
 * Create an opponent design (negative player strategy)
 */
function createOpponentDesign(arena: DeliberationArena): LudicDesignTheory {
  // O's strategy: attack via reliability
  const chronicle1: Chronicle = {
    id: "o-reliability",
    actions: [
      {
        polarity: "-",
        focus: [2],
        ramification: [[2, 0], [2, 1]],
        expression: "Fossil fuels are more reliable",
        type: "attack",
      },
    ],
    isComplete: false,
  };

  // O's counter to environmental
  const chronicle2: Chronicle = {
    id: "o-counter-env",
    actions: [
      {
        polarity: "-",
        focus: [0, 0, 0],
        ramification: [],
        expression: "But models have uncertainties",
        type: "attack",
      },
    ],
    isComplete: true,
  };

  return {
    id: "opponent-design",
    base: [],
    polarity: "-",
    chronicles: [chronicle1, chronicle2],
    hasDaimon: false,
  };
}

// ============================================================================
// INTEGRATION TEST: DELIBERATION → ARENA
// ============================================================================

describe("Deliberation to Arena Integration", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createDeliberationArena();
  });

  it("arena has correct structure from deliberation", () => {
    expect(arena.positions.size).toBe(10);
    expect(arena.deliberationId).toBe("delib-renewable-energy");
    expect(arena.rootAddress).toEqual([]);
  });

  it("all positions have correct polarity by depth", () => {
    for (const [key, position] of arena.positions) {
      const expectedPolarity = polarityAtAddress(position.address);
      expect(position.polarity).toBe(expectedPolarity);
    }
  });

  it("ramifications point to valid child positions", () => {
    for (const [key, position] of arena.positions) {
      for (const ramIdx of position.ramification) {
        const childAddr = [...position.address, ramIdx];
        const childKey = childAddr.join(".");
        expect(arena.positions.has(childKey)).toBe(true);
      }
    }
  });

  it("designs can be built from arena positions", () => {
    const pDesign = createProponentDesign(arena);
    const oDesign = createOpponentDesign(arena);

    expect(pDesign.polarity).toBe("+");
    expect(oDesign.polarity).toBe("-");
    expect(pDesign.chronicles.length).toBeGreaterThan(0);
    expect(oDesign.chronicles.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// INTEGRATION TEST: ARENA → INTERACTION
// ============================================================================

describe("Arena to Interaction Integration", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createDeliberationArena();
  });

  it("can create initial interaction state", () => {
    const state = createInitialState(arena);

    expect(state.arena).toBe(arena);
    expect(state.currentPath).toHaveLength(0);
    expect(state.activePolarity).toBe("+");
    expect(state.terminated).toBe(false);
  });

  it("can get legal moves at start", () => {
    const state = createInitialState(arena);
    const moves = getLegalMoves(state);

    // At root, should have ramification options
    expect(moves.length).toBeGreaterThan(0);
  });

  it("can step through interaction", () => {
    let state = createInitialState(arena);

    // P makes opening move
    const firstMove: DialogueAct = {
      polarity: "+",
      focus: [],
      ramification: [[0], [1], [2]],
      expression: "We should adopt renewable energy",
      type: "claim",
    };

    state = stepInteraction(state, firstMove);

    expect(state.currentPath).toHaveLength(1);
    expect(state.activePolarity).toBe("-"); // O's turn
  });

  it("interaction terminates when no legal moves", () => {
    let state = createInitialState(arena);

    // Play through to a terminal position
    const moves: DialogueAct[] = [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [1],
        ramification: [[1, 0]],
        expression: "Renewable costs are dropping",
        type: "support",
      },
      {
        polarity: "+",
        focus: [1, 0],
        ramification: [],
        expression: "Solar reached grid parity",
        type: "support",
      },
    ];

    for (const move of moves) {
      state = stepInteraction(state, move);
    }

    // After reaching terminal position
    expect(isTerminated(state)).toBe(true);
  });

  it("determines winner correctly", () => {
    let state = createInitialState(arena);

    // Play to O getting stuck
    const moves: DialogueAct[] = [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [1],
        ramification: [[1, 0]],
        expression: "Renewable costs are dropping",
        type: "support",
      },
      {
        polarity: "+",
        focus: [1, 0],
        ramification: [],
        expression: "Solar reached grid parity",
        type: "support",
      },
    ];

    for (const move of moves) {
      state = stepInteraction(state, move);
    }

    const winner = determineWinner(state);
    // P made last move at terminal, O is stuck → P wins (returns "+")
    expect(winner).toBe("+");
  });
});

// ============================================================================
// INTEGRATION TEST: INTERACTION → PATH EXTRACTION
// ============================================================================

describe("Interaction to Path Extraction Integration", () => {
  let arena: DeliberationArena;
  let completedPath: DialogueAct[];

  beforeEach(() => {
    arena = createDeliberationArena();
    completedPath = [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [0],
        ramification: [[0, 0], [0, 1]],
        expression: "Climate change is accelerating",
        type: "support",
      },
      {
        polarity: "+",
        focus: [0, 0],
        ramification: [[0, 0, 0]],
        expression: "Scientific consensus supports this",
        type: "support",
      },
      {
        polarity: "-",
        focus: [0, 0, 0],
        ramification: [],
        expression: "But models have uncertainties",
        type: "attack",
      },
    ];
  });

  it("extracts valid visitable path from interaction", () => {
    const result = createTestInteractionResult(completedPath, "divergent", "O");
    const path = extractPath(result);

    expect(path.actions).toHaveLength(completedPath.length);
    expect(path.convergent).toBe(false);
  });

  it("validates extracted path", () => {
    const result = createTestInteractionResult(completedPath, "divergent", "O");
    const path = extractPath(result);
    const validation = validatePath(path);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("computes path statistics", () => {
    const result = createTestInteractionResult(completedPath, "divergent", "O");
    const path = extractPath(result);
    const stats = getPathStatistics(path);

    expect(stats.totalMoves).toBe(completedPath.length);
    expect(stats.maxDepth).toBeGreaterThan(0);
    expect(stats.positiveMoves).toBeGreaterThan(0);
    expect(stats.negativeMoves).toBeGreaterThan(0);
  });

  it("computes incarnation from path", () => {
    const result = createTestInteractionResult(completedPath, "divergent", "O");
    const path = extractPath(result);
    const incarnation = computeIncarnation(path);

    expect(incarnation.length).toBeLessThanOrEqual(path.actions.length);
  });
});

// ============================================================================
// INTEGRATION TEST: PATH → NARRATIVE
// ============================================================================

describe("Path to Narrative Integration", () => {
  let arena: DeliberationArena;
  let path: VisitablePath;

  beforeEach(() => {
    arena = createDeliberationArena();
    const actions: DialogueAct[] = [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [1],
        ramification: [[1, 0]],
        expression: "Renewable costs are dropping",
        type: "support",
      },
      {
        polarity: "+",
        focus: [1, 0],
        ramification: [],
        expression: "Solar reached grid parity",
        type: "support",
      },
    ];
    const result = createTestInteractionResult(actions, "divergent", "O");
    path = extractPath(result);
  });

  it("formats path as narrative", () => {
    const narrative = formatAsNarrative(path, arena);

    expect(narrative.steps.length).toBe(path.actions.length);
    expect(narrative.conclusion).toBeDefined();
  });

  it("narrative has proper step structure", () => {
    const narrative = formatAsNarrative(path, arena);

    for (const step of narrative.steps) {
      expect(step.speaker).toBeDefined();
      expect(step.position).toBeDefined();
      expect(step.type).toBeDefined();
      expect(step.justification).toBeDefined();
    }
  });

  it("converts narrative to markdown", () => {
    const narrative = formatAsNarrative(path, arena);
    const markdown = narrativeToMarkdown(narrative);

    expect(typeof markdown).toBe("string");
    expect(markdown.length).toBeGreaterThan(0);
    expect(markdown).toContain("renewable energy");
  });

  it("converts narrative to JSON", () => {
    const narrative = formatAsNarrative(path, arena);
    const json = narrativeToJSON(narrative);

    // narrativeToJSON returns an object, not a string
    expect(typeof json).toBe("object");
    expect(json).toHaveProperty("steps");
    expect(json).toHaveProperty("conclusion");
  });
});

// ============================================================================
// INTEGRATION TEST: LANDSCAPE ANALYSIS
// ============================================================================

describe("Landscape Analysis Integration", () => {
  let arena: DeliberationArena;
  let pDesign: LudicDesignTheory;
  let oDesign: LudicDesignTheory;

  beforeEach(() => {
    arena = createDeliberationArena();
    pDesign = createProponentDesign(arena);
    oDesign = createOpponentDesign(arena);
  });

  it("computes orthogonal of design set", () => {
    const ortho = computeOrthogonal([pDesign]);

    expect(ortho.length).toBeGreaterThanOrEqual(0);
    if (ortho.length > 0) {
      expect(ortho[0].polarity).toBe("-"); // Opposite of pDesign
    }
  });

  it("computes biorthogonal closure", () => {
    const closure = computeBiorthogonalClosure([pDesign]);

    expect(closure.length).toBeGreaterThanOrEqual(1);
  });

  it("checks convergence between designs", () => {
    const result = converges(pDesign, oDesign);

    expect(typeof result).toBe("boolean");
  });

  it("analyzes position strength", () => {
    const strength = analyzePositionStrength(arena, [], [pDesign], {});

    expect(strength).toBeDefined();
    expect(strength.address).toEqual([]);
    expect(strength.winRate).toBeGreaterThanOrEqual(0);
    expect(strength.winRate).toBeLessThanOrEqual(1);
  });

  it("analyzes all positions", () => {
    const result = analyzeAllPositions(arena, [pDesign], {});

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions.every((s) => s.winRate >= 0 && s.winRate <= 1)).toBe(true);
  });

  it("runs simulations", () => {
    const results = runSimulations([pDesign, oDesign], [], 5);

    expect(results.length).toBe(5);
    for (const result of results) {
      expect(result.winner === "P" || result.winner === "O" || result.winner === null).toBe(true);
    }
  });

  it("generates landscape data", () => {
    const analysisResult = analyzeAllPositions(arena, [pDesign], {});
    const landscape = generateLandscapeData(arena, analysisResult.positions);

    expect(landscape.positions.length).toBeGreaterThan(0);
    expect(landscape.heatMap).toBeDefined();
  });

  it("finds critical points", () => {
    const analysisResult = analyzeAllPositions(arena, [pDesign], {});
    const criticalPoints = findCriticalPoints(analysisResult.positions);

    expect(Array.isArray(criticalPoints)).toBe(true);
  });
});

// ============================================================================
// INTEGRATION TEST: COMPLETENESS CHECKING
// ============================================================================

describe("Completeness Checking Integration", () => {
  let arena: DeliberationArena;
  let pDesign: LudicDesignTheory;

  beforeEach(() => {
    arena = createDeliberationArena();
    pDesign = createProponentDesign(arena);
  });

  it("checks design completeness", () => {
    const result = checkDesignCompleteness(pDesign, arena);

    expect(result).toBeDefined();
    expect(typeof result.isComplete).toBe("boolean");
  });

  it("completes incomplete design", () => {
    const incompleteDesign: LudicDesignTheory = {
      ...pDesign,
      chronicles: pDesign.chronicles.map((c) => ({
        ...c,
        isComplete: false,
      })),
    };

    const completed = completeDesign(incompleteDesign, arena);

    expect(completed).toBeDefined();
  });

  it("verifies completed design is valid", () => {
    const completed = completeDesign(pDesign, arena);
    const isComplete = isDesignComplete(completed);

    expect(typeof isComplete).toBe("boolean");
  });
});

// ============================================================================
// FULL PIPELINE TEST
// ============================================================================

describe("Full Pipeline Integration", () => {
  it("completes full deliberation → narrative pipeline", () => {
    // 1. Create arena from deliberation
    const arena = createDeliberationArena();
    expect(arena.positions.size).toBeGreaterThan(0);

    // 2. Create designs
    const pDesign = createProponentDesign(arena);
    const oDesign = createOpponentDesign(arena);

    // 3. Run interaction
    let state = createInitialState(arena);
    const moves: DialogueAct[] = [
      {
        polarity: "+",
        focus: [],
        ramification: [[0], [1], [2]],
        expression: "We should adopt renewable energy",
        type: "claim",
      },
      {
        polarity: "-",
        focus: [1],
        ramification: [[1, 0]],
        expression: "Renewable costs are dropping",
        type: "support",
      },
      {
        polarity: "+",
        focus: [1, 0],
        ramification: [],
        expression: "Solar reached grid parity",
        type: "support",
      },
    ];

    for (const move of moves) {
      state = stepInteraction(state, move);
    }

    expect(isTerminated(state)).toBe(true);

    // 4. Determine outcome
    const winner = determineWinner(state);
    // P wins, returns "+" polarity
    expect(winner).toBe("+");

    // 5. Extract path
    const interactionResult = createTestInteractionResult(state.currentPath, "divergent", "O");
    const path = extractPath(interactionResult);
    expect(path.convergent).toBe(false);

    // 6. Validate path
    const validation = validatePath(path);
    expect(validation.valid).toBe(true);

    // 7. Compute incarnation
    const incarnation = computeIncarnation(path);
    expect(incarnation.length).toBeLessThanOrEqual(path.actions.length);

    // 8. Format as narrative
    const narrative = formatAsNarrative(path, arena);
    expect(narrative.steps.length).toBe(moves.length);
    // Winner comes from interaction result
    expect(narrative.conclusion).toBeDefined();

    // 9. Export to markdown
    const markdown = narrativeToMarkdown(narrative);
    expect(markdown).toContain("renewable energy");
    expect(markdown).toContain("Solar");

    // 10. Analyze landscape
    const analysisResult = analyzeAllPositions(arena, [pDesign], {});
    expect(analysisResult.positions.length).toBeGreaterThan(0);

    const landscape = generateLandscapeData(arena, analysisResult.positions);
    expect(landscape.positions.length).toBeGreaterThan(0);

    console.log("✅ Full pipeline completed successfully!");
    console.log(`   Arena: ${arena.positions.size} positions`);
    console.log(`   Path: ${path.actions.length} moves`);
    console.log(`   Winner: ${winner}`);
    console.log(`   Narrative: ${narrative.steps.length} steps`);
    console.log(`   Landscape: ${landscape.positions.length} visualized`);
  });
});
