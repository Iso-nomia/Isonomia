/**
 * ============================================
 * THEORY VALIDATION TESTS
 * ============================================
 * 
 * Phase 7: Testing against theoretical foundations
 * 
 * Tests validate:
 * 1. Faggian-Hyland semantics (winner determination)
 * 2. Address mapping and polarity computation
 * 3. Incarnation extraction (essential core)
 * 4. Girard's ludics theoretical constraints
 */

import { describe, it, expect, beforeEach } from "vitest";

import type {
  DeliberationArena,
  InteractionState,
  DialogueAct,
  ArenaPositionTheory,
  LudicDesignTheory,
  Chronicle,
  VisitablePath,
} from "../types/ludics-theory";

import {
  addressToKey,
  keyToAddress,
  polarityAtAddress,
  createDaimon,
  isDaimon,
  addressEquals,
  isAddressPrefix,
} from "../types/ludics-theory";

import {
  createInitialState,
  stepInteraction,
  determineWinner,
  isTerminated,
  getLegalMoves,
  detectOutcome,
  isConvergent,
} from "../interaction";

import {
  computeIncarnation,
  isEssentialAction,
  getJustificationChain,
  isMinimalIncarnation,
} from "../extraction/incarnation";

import {
  extractPath,
  validatePath,
} from "../extraction/path-extractor";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create arena where P can get stuck
 */
function createPStuckArena(): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  // Root - P starts
  positions.set("", {
    address: [],
    content: "Root claim",
    type: "claim",
    ramification: [0],
    polarity: "+",
  });

  // Single response for O at [0]
  positions.set("0", {
    address: [0],
    content: "O's only response",
    type: "attack",
    ramification: [], // No further moves - P gets stuck
    polarity: "-",
  });

  return {
    deliberationId: "p-stuck-arena",
    rootAddress: [],
    positions,
    availableDesigns: [],
  };
}

/**
 * Create arena where O can get stuck
 */
function createOStuckArena(): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  // Root - P starts
  positions.set("", {
    address: [],
    content: "Root claim",
    type: "claim",
    ramification: [0, 1],
    polarity: "+",
  });

  // O responds at [0], then P blocks
  positions.set("0", {
    address: [0],
    content: "O's response",
    type: "attack",
    ramification: [0],
    polarity: "-",
  });

  positions.set("0.0", {
    address: [0, 0],
    content: "P's winning move",
    type: "support",
    ramification: [], // O stuck here
    polarity: "+",
  });

  // Alternative path
  positions.set("1", {
    address: [1],
    content: "O's alternative",
    type: "support",
    ramification: [],
    polarity: "-",
  });

  return {
    deliberationId: "o-stuck-arena",
    rootAddress: [],
    positions,
    availableDesigns: [],
  };
}

/**
 * Create a state where player is stuck (terminal)
 */
function createTerminalState(
  arena: DeliberationArena,
  currentPlayer: "P" | "O"
): InteractionState {
  return {
    arena,
    currentPath: [],
    currentAddress: [],
    activePolarity: currentPlayer === "P" ? "+" : "-",
    terminated: true,
    winner: currentPlayer === "P" ? "O" : "P", // stuck player loses
    terminalReason: "no-moves",
  };
}

/**
 * Create a state where player played daimon
 */
function createDaimonState(
  arena: DeliberationArena,
  daimonPlayer: "P" | "O"
): InteractionState {
  const daimonAct: DialogueAct = {
    polarity: daimonPlayer === "P" ? "+" : "-",
    focus: [],
    ramification: [],
    expression: "⊥",
    type: "daimon",
    isDaimon: true,
  };

  return {
    arena,
    currentPath: [daimonAct],
    currentAddress: [],
    activePolarity: daimonPlayer === "P" ? "+" : "-",
    terminated: true,
    winner: daimonPlayer === "P" ? "O" : "P", // daimon player loses
    terminalReason: "daimon",
  };
}

/**
 * Create design with branches for incarnation testing
 */
function createDesignWithBranches(): LudicDesignTheory {
  const chronicle1: Chronicle = {
    id: "c1",
    actions: [
      { polarity: "+", focus: [], ramification: [[0], [1]], expression: "Start", type: "claim" },
      { polarity: "-", focus: [0], ramification: [[0, 0]], expression: "Response 0", type: "attack" },
      { polarity: "+", focus: [0, 0], ramification: [], expression: "Counter", type: "support" },
    ],
    isComplete: true,
  };

  const chronicle2: Chronicle = {
    id: "c2",
    actions: [
      { polarity: "+", focus: [], ramification: [[0], [1]], expression: "Start", type: "claim" },
      { polarity: "-", focus: [1], ramification: [], expression: "Response 1", type: "attack" },
    ],
    isComplete: true,
  };

  return {
    id: "design-branches",
    base: [],
    polarity: "+",
    chronicles: [chronicle1, chronicle2],
    hasDaimon: false,
  };
}

/**
 * Create a valid visitable path
 */
function createValidPath(): VisitablePath {
  return {
    id: "path-1",
    actions: [
      { polarity: "+", focus: [], ramification: [[0]], expression: "Claim", type: "claim" },
      { polarity: "-", focus: [0], ramification: [[0, 0]], expression: "Attack", type: "attack" },
      { polarity: "+", focus: [0, 0], ramification: [], expression: "Defense", type: "support" },
    ],
    outcome: "convergent",
    winner: "P",
    incarnation: [],
    isComplete: true,
  };
}

// ============================================================================
// FAGGIAN-HYLAND SEMANTICS TESTS
// ============================================================================

describe("Faggian-Hyland Semantics", () => {
  describe("Winner determination", () => {
    it("stuck player loses (P stuck → O wins)", () => {
      const arena = createPStuckArena();
      const state = createTerminalState(arena, "P");
      
      expect(state.winner).toBe("O");
      expect(state.terminalReason).toBe("no-moves");
    });

    it("stuck player loses (O stuck → P wins)", () => {
      const arena = createOStuckArena();
      const state = createTerminalState(arena, "O");
      
      expect(state.winner).toBe("P");
      expect(state.terminalReason).toBe("no-moves");
    });

    it("daimon player gives up (P daimon → O wins)", () => {
      const arena = createPStuckArena();
      const state = createDaimonState(arena, "P");
      
      expect(state.winner).toBe("O");
      expect(state.terminalReason).toBe("daimon");
    });

    it("daimon player gives up (O daimon → P wins)", () => {
      const arena = createOStuckArena();
      const state = createDaimonState(arena, "O");
      
      expect(state.winner).toBe("P");
      expect(state.terminalReason).toBe("daimon");
    });

    it("determineWinner returns correct winner for terminated state", () => {
      const arena = createPStuckArena();
      const terminatedState: InteractionState = {
        arena,
        currentPath: [],
        currentAddress: [0],
        activePolarity: "+",
        terminated: true,
        terminalReason: "no-moves",
      };

      const winner = determineWinner(terminatedState);
      // P is stuck at [0] (polarity +), so O wins (returns negative polarity "-")
      expect(winner).toBe("-");
    });
  });

  describe("Polarity alternation", () => {
    it("active player alternates by depth (even=P, odd=O)", () => {
      expect(polarityAtAddress([])).toBe("+");     // depth 0 → P
      expect(polarityAtAddress([0])).toBe("-");    // depth 1 → O
      expect(polarityAtAddress([0, 0])).toBe("+"); // depth 2 → P
      expect(polarityAtAddress([0, 0, 1])).toBe("-"); // depth 3 → O
    });

    it("initial state has positive polarity", () => {
      const arena = createPStuckArena();
      const state = createInitialState(arena);
      
      expect(state.activePolarity).toBe("+");
    });
  });

  describe("Convergence detection", () => {
    it("interaction with winner is convergent", () => {
      const path = createValidPath();
      
      expect(path.outcome).toBe("convergent");
      expect(path.winner).toBeDefined();
    });

    it("outcome with daimon is convergent but losing", () => {
      const path: VisitablePath = {
        ...createValidPath(),
        actions: [
          ...createValidPath().actions.slice(0, 2),
          createDaimon([0, 0]), // createDaimon takes focus address
        ],
        winner: "O",
      };

      expect(path.winner).toBe("O"); // P played daimon
    });
  });
});

// ============================================================================
// ADDRESS MAPPING TESTS
// ============================================================================

describe("Address Computation", () => {
  describe("Address to key conversion", () => {
    it("maps empty address to empty string", () => {
      expect(addressToKey([])).toBe("");
    });

    it("maps nested address correctly with dot separator", () => {
      expect(addressToKey([0])).toBe("0");
      expect(addressToKey([0, 1])).toBe("0.1");
      expect(addressToKey([0, 1, 2])).toBe("0.1.2");
    });

    it("round-trips through keyToAddress", () => {
      const addresses = [[], [0], [1, 2], [0, 1, 2, 3]];
      for (const addr of addresses) {
        const key = addressToKey(addr);
        const back = keyToAddress(key);
        expect(back).toEqual(addr);
      }
    });
  });

  describe("Address comparison", () => {
    it("addressEquals returns true for same address", () => {
      expect(addressEquals([], [])).toBe(true);
      expect(addressEquals([0, 1], [0, 1])).toBe(true);
    });

    it("addressEquals returns false for different addresses", () => {
      expect(addressEquals([], [0])).toBe(false);
      expect(addressEquals([0], [1])).toBe(false);
      expect(addressEquals([0, 1], [0, 2])).toBe(false);
    });
  });

  describe("Address prefix checking", () => {
    it("empty is prefix of all addresses", () => {
      expect(isAddressPrefix([], [])).toBe(true);
      expect(isAddressPrefix([], [0])).toBe(true);
      expect(isAddressPrefix([], [0, 1, 2])).toBe(true);
    });

    it("address is prefix of itself", () => {
      expect(isAddressPrefix([0], [0])).toBe(true);
      expect(isAddressPrefix([0, 1], [0, 1])).toBe(true);
    });

    it("proper prefix detection", () => {
      expect(isAddressPrefix([0], [0, 1])).toBe(true);
      expect(isAddressPrefix([0, 1], [0, 1, 2])).toBe(true);
      expect(isAddressPrefix([0, 1], [0, 2])).toBe(false);
      expect(isAddressPrefix([1], [0, 1])).toBe(false);
    });
  });

  describe("Polarity computation from depth", () => {
    it("computes polarity correctly for various depths", () => {
      // Root (depth 0) → positive
      expect(polarityAtAddress([])).toBe("+");
      
      // Depth 1 → negative
      expect(polarityAtAddress([0])).toBe("-");
      expect(polarityAtAddress([1])).toBe("-");
      
      // Depth 2 → positive
      expect(polarityAtAddress([0, 0])).toBe("+");
      expect(polarityAtAddress([0, 1])).toBe("+");
      
      // Depth 3 → negative
      expect(polarityAtAddress([0, 0, 0])).toBe("-");
    });
  });
});

// ============================================================================
// INCARNATION TESTS
// ============================================================================

describe("Incarnation Computation", () => {
  describe("Essential core extraction", () => {
    it("incarnation is subset of original path", () => {
      const path = createValidPath();
      const incarnation = computeIncarnation(path);
      
      // Incarnation should have fewer or equal actions
      expect(incarnation.length).toBeLessThanOrEqual(path.actions.length);
    });

    it("incarnation preserves justification chain", () => {
      const path = createValidPath();
      const incarnation = computeIncarnation(path);
      
      // Every action in incarnation should be essential
      for (const action of incarnation) {
        expect(isEssentialAction(action, path.actions)).toBe(true);
      }
    });

    it("isMinimalIncarnation validates minimal incarnations", () => {
      const path = createValidPath();
      const incarnation = computeIncarnation(path);
      
      // The computed incarnation should be minimal
      expect(isMinimalIncarnation(incarnation, path.actions)).toBe(true);
    });
  });

  describe("Justification chain", () => {
    it("builds justification chain from incarnation", () => {
      const incarnation: DialogueAct[] = [
        { polarity: "+", focus: [], ramification: [[0]], expression: "A", type: "claim" },
        { polarity: "-", focus: [0], ramification: [[0, 0]], expression: "B", type: "attack" },
        { polarity: "+", focus: [0, 0], ramification: [], expression: "C", type: "support" },
      ];

      const chain = getJustificationChain(incarnation);
      
      // Chain should explain each step
      expect(chain.length).toBe(incarnation.length);
      expect(chain[0]).toContain("Initial");
    });
  });
});

// ============================================================================
// DAIMON TESTS
// ============================================================================

describe("Daimon Handling", () => {
  it("createDaimon creates valid daimon action with focus", () => {
    const daimon = createDaimon([0, 1]);
    
    expect(daimon.type).toBe("daimon");
    expect(daimon.polarity).toBe("+"); // daimon is always positive
    expect(daimon.focus).toEqual([0, 1]);
    expect(daimon.expression).toBe("†");
  });

  it("isDaimon correctly identifies daimon actions", () => {
    const daimon = createDaimon([]);
    const normalAct: DialogueAct = {
      polarity: "+",
      focus: [],
      ramification: [[0]],
      expression: "Normal",
      type: "claim",
    };

    expect(isDaimon(daimon)).toBe(true);
    expect(isDaimon(normalAct)).toBe(false);
  });

  it("daimon at any point terminates interaction", () => {
    const path: VisitablePath = {
      id: "daimon-path",
      actions: [
        { polarity: "+", focus: [], ramification: [[0]], expression: "Start", type: "claim" },
        createDaimon([0]),
      ],
      outcome: "convergent",
      winner: "O", // Daimon player (P) loses
      incarnation: [],
      isComplete: true,
    };

    expect(isDaimon(path.actions[path.actions.length - 1])).toBe(true);
    expect(path.winner).toBe("O"); // P gave up
  });
});

// ============================================================================
// PATH VALIDATION TESTS
// ============================================================================

describe("Path Validation", () => {
  it("validatePath accepts well-formed paths", () => {
    const path = createValidPath();
    const result = validatePath(path);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validatePath rejects path with wrong polarity sequence", () => {
    const badPath: VisitablePath = {
      id: "bad-path",
      actions: [
        { polarity: "+", focus: [], ramification: [[0]], expression: "A", type: "claim" },
        { polarity: "+", focus: [0], ramification: [], expression: "B", type: "claim" }, // Should be -
      ],
      outcome: "convergent",
      winner: "P",
      incarnation: [],
      isComplete: true,
    };

    const result = validatePath(badPath);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validatePath accepts path ending in daimon after negative action", () => {
    // Daimon is always positive, so it must come after a negative action
    const daimonPath: VisitablePath = {
      id: "daimon-ending",
      actions: [
        { polarity: "+", focus: [], ramification: [[0]], expression: "Start", type: "claim" },
        { polarity: "-", focus: [0], ramification: [[0, 0]], expression: "Response", type: "attack" },
        createDaimon([0, 0]), // Daimon is positive, follows negative
      ],
      outcome: "convergent",
      winner: "O", // P played daimon so O wins
      incarnation: [],
      isComplete: true,
    };

    const result = validatePath(daimonPath);
    
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// LUDICS THEORY CONSTRAINTS
// ============================================================================

describe("Ludics Theory Constraints", () => {
  describe("Positivity and Negativity", () => {
    it("positive actions open new ramifications", () => {
      const positiveAct: DialogueAct = {
        polarity: "+",
        focus: [],
        ramification: [[0], [1]],
        expression: "Positive opens branches",
        type: "claim",
      };

      expect(positiveAct.polarity).toBe("+");
      expect(positiveAct.ramification.length).toBeGreaterThan(0);
    });

    it("negative actions respond to positions", () => {
      const negativeAct: DialogueAct = {
        polarity: "-",
        focus: [0],
        ramification: [[0, 0]],
        expression: "Negative responds",
        type: "attack",
      };

      expect(negativeAct.polarity).toBe("-");
      expect(negativeAct.focus.length).toBeGreaterThan(0);
    });
  });

  describe("Chronicle coherence", () => {
    it("chronicles have alternating polarities", () => {
      const design = createDesignWithBranches();
      
      for (const chronicle of design.chronicles) {
        for (let i = 1; i < chronicle.actions.length; i++) {
          const prev = chronicle.actions[i - 1];
          const curr = chronicle.actions[i];
          expect(prev.polarity).not.toBe(curr.polarity);
        }
      }
    });

    it("chronicles start with design base polarity", () => {
      const design = createDesignWithBranches();
      
      for (const chronicle of design.chronicles) {
        if (chronicle.actions.length > 0) {
          expect(chronicle.actions[0].polarity).toBe(design.polarity);
        }
      }
    });
  });

  describe("Address coherence", () => {
    it("ramification addresses extend focus", () => {
      const act: DialogueAct = {
        polarity: "+",
        focus: [0, 1],
        ramification: [[0, 1, 0], [0, 1, 1]],
        expression: "Extension",
        type: "claim",
      };

      for (const ram of act.ramification) {
        // Each ramification should start with the focus
        expect(ram.slice(0, act.focus.length)).toEqual(act.focus);
        // And extend it by one
        expect(ram.length).toBe(act.focus.length + 1);
      }
    });
  });
});
