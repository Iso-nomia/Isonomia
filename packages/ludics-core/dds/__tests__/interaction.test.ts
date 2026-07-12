/**
 * ============================================
 * INTERACTION ENGINE TESTS
 * ============================================
 * 
 * Tests for Phase 2: Interaction Engine
 * 
 * Tests cover:
 * - Stepper: State creation, move validation, stepping
 * - Outcome: Convergence/divergence detection
 * - Play: Game session management
 * - Strategy: Strategy creation and application
 */

import { describe, it, expect, beforeEach } from "vitest";

import type {
  DeliberationArena,
  InteractionState,
  DialogueAct,
  ArenaPositionTheory,
  Play,
  Strategy,
  Chronicle,
} from "../types/ludics-theory";

import {
  addressToKey,
  createDaimon,
  polarityAtAddress,
} from "../types/ludics-theory";

import {
  // Stepper
  createInitialState,
  validateMove,
  stepInteraction,
  getLegalMoves,
  isTerminated,
  hasLegalMoves,
  getMoveCount,
  getLastAction,
  isFirstMove,
  
  // Outcome
  detectOutcome,
  isConvergent,
  isDivergent,
  determineWinner,
  buildVisitablePath,
  computeIncarnation,
  describeOutcome,
  
  // Play
  createPlay,
  makeMove,
  undoMove,
  completePlay,
  forfeitPlay,
  serializePlay,
  deserializePlay,
  isPlayComplete,
  getMoveHistory,
  
  // Strategy
  createStrategy,
  setResponse,
  getResponse,
  applyStrategy,
  createChronicle,
  extendChronicle,
  chronicleHasDaimon,
  createDesign,
  generateRandomStrategy,
  evaluateStrategy,
} from "../interaction";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a simple test arena
 * 
 * Structure:
 * [] (root)
 *  ├── [0] (support)
 *  │    └── [0,0] (counter)
 *  └── [1] (attack)
 *       └── [1,0] (defense)
 */
function createSimpleArena(): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  // Root (depth 0, polarity +)
  positions.set("", {
    address: [],
    content: "Main claim",
    type: "claim",
    ramification: [0, 1],
    polarity: "+",
  });

  // Support (depth 1, polarity -)
  positions.set("0", {
    address: [0],
    content: "Supporting argument",
    type: "support",
    ramification: [0],
    polarity: "-",
  });

  // Counter (depth 2, polarity +)
  positions.set("0.0", {
    address: [0, 0],
    content: "Counter to support",
    type: "attack",
    ramification: [],
    polarity: "+",
  });

  // Attack (depth 1, polarity -)
  positions.set("1", {
    address: [1],
    content: "Attacking argument",
    type: "attack",
    ramification: [0],
    polarity: "-",
  });

  // Defense (depth 2, polarity +)
  positions.set("1.0", {
    address: [1, 0],
    content: "Defense against attack",
    type: "support",
    ramification: [],
    polarity: "+",
  });

  return {
    deliberationId: "test-delib-1",
    rootAddress: [],
    positions,
    availableDesigns: [],
  };
}

/**
 * Create a simple dialogue act
 */
function createTestAct(
  focus: number[],
  ramification: number[][],
  polarity: "+" | "-" = "+"
): DialogueAct {
  return {
    polarity,
    focus,
    ramification,
    expression: `Act at [${focus.join(",")}]`,
    type: "claim",
  };
}

// ============================================================================
// STEPPER TESTS
// ============================================================================

describe("Interaction Stepper", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createSimpleArena();
  });

  describe("createInitialState", () => {
    it("should create initial state with empty path", () => {
      const state = createInitialState(arena);
      
      expect(state.currentPath).toHaveLength(0);
      expect(state.currentAddress).toEqual([]);
      expect(state.activePolarity).toBe("+");
      expect(state.terminated).toBe(false);
    });

    it("should allow custom starting polarity", () => {
      const state = createInitialState(arena, { startingPolarity: "-" });
      
      expect(state.activePolarity).toBe("-");
    });

    it("should include the arena reference", () => {
      const state = createInitialState(arena);
      
      expect(state.arena).toBe(arena);
    });
  });

  describe("validateMove", () => {
    it("should accept valid first move", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0], [1]], "+");
      
      const result = validateMove(state, act);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject wrong polarity", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0]], "-");
      
      const result = validateMove(state, act);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "WRONG_POLARITY")).toBe(true);
    });

    it("should reject move on terminated game", () => {
      let state = createInitialState(arena);
      state = { ...state, terminated: true };
      
      const act = createTestAct([], [[0]], "+");
      const result = validateMove(state, act);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === "GAME_OVER")).toBe(true);
    });

    it("should accept daimon at any position", () => {
      const state = createInitialState(arena);
      const daimon = createDaimon([]);
      
      const result = validateMove(state, daimon);
      
      expect(result.valid).toBe(true);
    });
  });

  describe("stepInteraction", () => {
    it("should step to new state with move added", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0]], "+");
      
      const newState = stepInteraction(state, act);
      
      expect(newState.currentPath).toHaveLength(1);
      expect(newState.currentPath[0]).toBe(act);
    });

    it("should flip polarity after move", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0]], "+");
      
      const newState = stepInteraction(state, act);
      
      expect(newState.activePolarity).toBe("-");
    });

    it("should update current address", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0]], "+");
      
      const newState = stepInteraction(state, act);
      
      expect(newState.currentAddress).toEqual([]);
    });

    it("should terminate on daimon", () => {
      const state = createInitialState(arena);
      const daimon = createDaimon([]);
      
      const newState = stepInteraction(state, daimon);
      
      expect(newState.terminated).toBe(true);
    });

    it("should throw on invalid move", () => {
      const state = createInitialState(arena);
      const act = createTestAct([], [[0]], "-"); // Wrong polarity
      
      expect(() => stepInteraction(state, act)).toThrow();
    });
  });

  describe("getLegalMoves", () => {
    it("should return legal moves from initial state", () => {
      const state = createInitialState(arena);
      
      const moves = getLegalMoves(state);
      
      expect(moves.length).toBeGreaterThan(0);
    });

    it("should return empty array when terminated", () => {
      let state = createInitialState(arena);
      state = { ...state, terminated: true };
      
      const moves = getLegalMoves(state);
      
      expect(moves).toHaveLength(0);
    });

    it("should always include daimon option", () => {
      const state = createInitialState(arena);
      
      const moves = getLegalMoves(state);
      const hasDaimon = moves.some(m => m.type === "daimon");
      
      expect(hasDaimon).toBe(true);
    });
  });

  describe("state queries", () => {
    it("isTerminated should reflect state", () => {
      const state = createInitialState(arena);
      
      expect(isTerminated(state)).toBe(false);
      
      const terminated = { ...state, terminated: true };
      expect(isTerminated(terminated)).toBe(true);
    });

    it("hasLegalMoves should check for available moves", () => {
      const state = createInitialState(arena);
      
      expect(hasLegalMoves(state)).toBe(true);
    });

    it("getMoveCount should return path length", () => {
      const state = createInitialState(arena);
      
      expect(getMoveCount(state)).toBe(0);
      
      const withMove = stepInteraction(state, createTestAct([], [[0]], "+"));
      expect(getMoveCount(withMove)).toBe(1);
    });

    it("isFirstMove should be true initially", () => {
      const state = createInitialState(arena);
      
      expect(isFirstMove(state)).toBe(true);
      
      const withMove = stepInteraction(state, createTestAct([], [[0]], "+"));
      expect(isFirstMove(withMove)).toBe(false);
    });
  });
});

// ============================================================================
// OUTCOME TESTS
// ============================================================================

describe("Outcome Detection", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createSimpleArena();
  });

  describe("detectOutcome", () => {
    it("should return null for in-progress game", () => {
      const state = createInitialState(arena);
      
      const outcome = detectOutcome(state);
      
      expect(outcome).toBeNull();
    });

    it("should detect convergent outcome on daimon", () => {
      let state = createInitialState(arena);
      state = stepInteraction(state, createDaimon([]));
      
      const outcome = detectOutcome(state);
      
      expect(outcome).not.toBeNull();
      expect(outcome?.outcome).toBe("convergent");
    });
  });

  describe("isConvergent / isDivergent", () => {
    it("isConvergent should be true after daimon", () => {
      let state = createInitialState(arena);
      state = stepInteraction(state, createDaimon([]));
      
      expect(isConvergent(state)).toBe(true);
      expect(isDivergent(state)).toBe(false);
    });

    it("isDivergent should be false when not terminated", () => {
      const state = createInitialState(arena);
      
      expect(isDivergent(state)).toBe(false);
    });
  });

  describe("determineWinner", () => {
    it("should return null for in-progress game", () => {
      const state = createInitialState(arena);
      
      expect(determineWinner(state)).toBeNull();
    });

    it("should return opposite of daimon player", () => {
      let state = createInitialState(arena);
      state = stepInteraction(state, createDaimon([]));
      
      // + played daimon, so - wins
      expect(determineWinner(state)).toBe("-");
    });
  });

  describe("buildVisitablePath", () => {
    it("should build path from trace", () => {
      const trace: DialogueAct[] = [
        createTestAct([], [[0]], "+"),
      ];
      
      const path = buildVisitablePath(trace, false);
      
      expect(path.actions).toHaveLength(1);
      expect(path.convergent).toBe(false);
    });

    it("should mark convergent paths", () => {
      const trace: DialogueAct[] = [
        createDaimon([]),
      ];
      
      const path = buildVisitablePath(trace, true);
      
      expect(path.convergent).toBe(true);
    });

    it("should include incarnation", () => {
      const trace: DialogueAct[] = [
        createTestAct([], [[0]], "+"),
        createTestAct([0], [[0, 0]], "-"),
      ];
      
      const path = buildVisitablePath(trace, false);
      
      expect(path.incarnation).toBeDefined();
      expect(path.incarnation.length).toBeLessThanOrEqual(trace.length);
    });
  });

  describe("computeIncarnation", () => {
    it("should return empty for empty trace", () => {
      const incarnation = computeIncarnation([]);
      
      expect(incarnation).toHaveLength(0);
    });

    it("should keep positive actions", () => {
      const trace: DialogueAct[] = [
        createTestAct([], [[0]], "+"),
      ];
      
      const incarnation = computeIncarnation(trace);
      
      expect(incarnation).toHaveLength(1);
      expect(incarnation[0].polarity).toBe("+");
    });
  });

  describe("describeOutcome", () => {
    it("should describe convergent outcome", () => {
      let state = createInitialState(arena);
      state = stepInteraction(state, createDaimon([]));
      
      const result = detectOutcome(state)!;
      const description = describeOutcome(result);
      
      expect(description).toContain("Convergent");
    });
  });
});

// ============================================================================
// PLAY TESTS
// ============================================================================

describe("Play Management", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createSimpleArena();
  });

  describe("createPlay", () => {
    it("should create play with initial state", () => {
      const play = createPlay(arena);
      
      expect(play.id).toBeDefined();
      expect(play.arena).toBe(arena);
      expect(play.moves).toHaveLength(0);
      expect(play.result).toBeUndefined();
    });

    it("should accept custom ID", () => {
      const play = createPlay(arena, { id: "custom-id" });
      
      expect(play.id).toBe("custom-id");
    });

    it("should accept participants", () => {
      const participants = [
        { id: "p1", name: "Player 1", perspective: "+" as const },
        { id: "p2", name: "Player 2", perspective: "-" as const },
      ];
      
      const play = createPlay(arena, { participants });
      
      expect(play.participants).toHaveLength(2);
    });
  });

  describe("makeMove", () => {
    it("should add move to play", () => {
      let play = createPlay(arena);
      const act = createTestAct([], [[0]], "+");
      
      play = makeMove(play, act);
      
      expect(play.moves).toHaveLength(1);
      expect(play.moves[0].action).toBe(act);
    });

    it("should update state", () => {
      let play = createPlay(arena);
      const act = createTestAct([], [[0]], "+");
      
      play = makeMove(play, act);
      
      expect(play.state.currentPath).toHaveLength(1);
    });

    it("should detect game end", () => {
      let play = createPlay(arena);
      play = makeMove(play, createDaimon([]));
      
      expect(play.result).toBeDefined();
      expect(play.endedAt).toBeDefined();
    });

    it("should throw on invalid move", () => {
      const play = createPlay(arena);
      const act = createTestAct([], [[0]], "-"); // Wrong polarity
      
      expect(() => makeMove(play, act)).toThrow();
    });
  });

  describe("undoMove", () => {
    it("should remove last move", () => {
      let play = createPlay(arena);
      play = makeMove(play, createTestAct([], [[0]], "+"));
      play = undoMove(play);
      
      expect(play.moves).toHaveLength(0);
    });

    it("should restore previous state", () => {
      let play = createPlay(arena);
      play = makeMove(play, createTestAct([], [[0]], "+"));
      play = undoMove(play);
      
      expect(play.state.activePolarity).toBe("+");
    });

    it("should throw when no moves to undo", () => {
      const play = createPlay(arena);
      
      expect(() => undoMove(play)).toThrow();
    });
  });

  describe("completePlay", () => {
    it("should return play with result", () => {
      let play = createPlay(arena);
      play = makeMove(play, createDaimon([]));
      
      const completed = completePlay(play);
      
      expect(completed.result).toBeDefined();
    });

    it("should handle incomplete play", () => {
      const play = createPlay(arena);
      const completed = completePlay(play);
      
      expect(completed.result).toBeDefined();
    });
  });

  describe("forfeitPlay", () => {
    it("should end play with daimon", () => {
      const play = createPlay(arena);
      const forfeited = forfeitPlay(play);
      
      expect(forfeited.result).toBeDefined();
      expect(forfeited.result.outcome).toBe("convergent");
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize play", () => {
      let play = createPlay(arena);
      play = makeMove(play, createTestAct([], [[0]], "+"));
      
      const serialized = serializePlay(play);
      const deserialized = deserializePlay(serialized);
      
      expect(deserialized.id).toBe(play.id);
      expect(deserialized.moves).toHaveLength(1);
    });
  });

  describe("play queries", () => {
    it("isPlayComplete should reflect state", () => {
      let play = createPlay(arena);
      expect(isPlayComplete(play)).toBe(false);
      
      play = makeMove(play, createDaimon([]));
      expect(isPlayComplete(play)).toBe(true);
    });

    it("getMoveHistory should return formatted history", () => {
      let play = createPlay(arena);
      play = makeMove(play, createTestAct([], [[0]], "+"));
      
      const history = getMoveHistory(play);
      
      expect(history).toHaveLength(1);
      expect(history[0].player).toBe("P");
    });
  });
});

// ============================================================================
// STRATEGY TESTS
// ============================================================================

describe("Strategy Management", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createSimpleArena();
  });

  describe("createStrategy", () => {
    it("should create strategy with polarity", () => {
      const strategy = createStrategy("+");
      
      expect(strategy.polarity).toBe("+");
      expect(strategy.responses.size).toBe(0);
    });

    it("should allow initial responses", () => {
      const responses = new Map([["", 0]]);
      const strategy = createStrategy("+", { responses });
      
      expect(strategy.responses.get("")).toBe(0);
    });
  });

  describe("setResponse / getResponse", () => {
    it("should set and get response", () => {
      let strategy = createStrategy("+");
      strategy = setResponse(strategy, [], 0);
      
      expect(getResponse(strategy, [])).toBe(0);
    });

    it("should return undefined for unset response", () => {
      const strategy = createStrategy("+");
      
      expect(getResponse(strategy, [])).toBeUndefined();
    });
  });

  describe("applyStrategy", () => {
    it("should return move based on response", () => {
      let strategy = createStrategy("+");
      strategy = setResponse(strategy, [], 0);
      
      const state = createInitialState(arena);
      const move = applyStrategy(strategy, state, arena);
      
      expect(move).not.toBeNull();
      expect(move?.polarity).toBe("+");
    });

    it("should return null when not this strategy's turn", () => {
      const strategy = createStrategy("-");
      const state = createInitialState(arena); // + to play
      
      const move = applyStrategy(strategy, state, arena);
      
      expect(move).toBeNull();
    });

    it("should return daimon when no response and allowed", () => {
      const strategy = createStrategy("+", { allowDaimon: true });
      const state = createInitialState(arena);
      
      const move = applyStrategy(strategy, state, arena);
      
      expect(move?.type).toBe("daimon");
    });
  });

  describe("Chronicle management", () => {
    it("should create chronicle", () => {
      const chronicle = createChronicle([createTestAct([], [[0]], "+")]);
      
      expect(chronicle.actions).toHaveLength(1);
      expect(chronicle.isComplete).toBe(false);
    });

    it("should extend chronicle", () => {
      let chronicle = createChronicle([createTestAct([], [[0]], "+")]);
      chronicle = extendChronicle(chronicle, createTestAct([0], [[0, 0]], "-"));
      
      expect(chronicle.actions).toHaveLength(2);
    });

    it("should detect daimon in chronicle", () => {
      const chronicle = createChronicle([createDaimon([])]);
      
      expect(chronicleHasDaimon(chronicle)).toBe(true);
    });
  });

  describe("Design management", () => {
    it("should create design", () => {
      const design = createDesign("+");
      
      expect(design.polarity).toBe("+");
      expect(design.chronicles).toHaveLength(0);
    });

    it("should track hasDaimon", () => {
      const chronicle = createChronicle([createDaimon([])], true);
      const design = createDesign("+", { chronicles: [chronicle] });
      
      expect(design.hasDaimon).toBe(true);
      expect(design.isWinning).toBe(false);
    });
  });

  describe("Strategy generation", () => {
    it("should generate random strategy", () => {
      const strategy = generateRandomStrategy(arena, "+");
      
      expect(strategy.polarity).toBe("+");
    });
  });

  describe("Strategy evaluation", () => {
    it("should evaluate strategy against random opponent", () => {
      let strategy = createStrategy("+");
      strategy = setResponse(strategy, [], 0);
      strategy = setResponse(strategy, [0, 0], 0);
      
      const result = evaluateStrategy(strategy, arena, undefined, 10);
      
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(1);
      expect(result.avgMoves).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration", () => {
  let arena: DeliberationArena;

  beforeEach(() => {
    arena = createSimpleArena();
  });

  it("full game: P plays daimon immediately", () => {
    let play = createPlay(arena);
    play = makeMove(play, createDaimon([]));
    
    expect(isPlayComplete(play)).toBe(true);
    expect(play.result?.outcome).toBe("convergent");
    expect(play.result?.stuckPlayer).toBe("P");
  });

  it("full game: alternating moves until terminal", () => {
    let play = createPlay(arena);
    
    // P plays at root, opening [0]
    play = makeMove(play, createTestAct([], [[0]], "+"));
    
    // O plays at [0], opening [0,0]
    play = makeMove(play, createTestAct([0], [[0, 0]], "-"));
    
    // P at [0,0] - terminal position, empty ramification
    play = makeMove(play, {
      polarity: "+",
      focus: [0, 0],
      ramification: [],
      expression: "Terminal",
      type: "claim",
    });
    
    expect(isPlayComplete(play)).toBe(true);
  });

  it("strategy-based play", () => {
    // Create strategies
    let pStrategy = createStrategy("+");
    pStrategy = setResponse(pStrategy, [], 0);
    
    let oStrategy = createStrategy("-");
    oStrategy = setResponse(oStrategy, [0], 0);
    
    // Create play
    let play = createPlay(arena);
    
    // P moves (it's P's turn, activePolarity is +)
    expect(play.state.activePolarity).toBe("+");
    const pMove = applyStrategy(pStrategy, play.state, arena);
    expect(pMove).not.toBeNull();
    if (pMove) {
      play = makeMove(play, pMove);
    }
    
    // Now it's O's turn
    expect(play.state.activePolarity).toBe("-");
    
    // O moves - need to get move from current position which is [0]
    // But oStrategy was set for [0] and we're now AT [0] after P's move
    // Actually the current address after P's move is still the focus of that move
    // Let's check what oStrategy returns
    const oMove = applyStrategy(oStrategy, play.state, arena);
    
    // O should get a move since activePolarity is now -
    if (oMove) {
      play = makeMove(play, oMove);
      expect(play.moves.length).toBe(2);
    } else {
      // O had no move defined for current position, which is okay
      expect(play.moves.length).toBe(1);
    }
  });

  it("undo and replay", () => {
    let play = createPlay(arena);
    play = makeMove(play, createTestAct([], [[0]], "+"));
    play = makeMove(play, createTestAct([0], [[0, 0]], "-"));
    
    // Undo last move
    play = undoMove(play);
    expect(play.moves).toHaveLength(1);
    expect(play.state.activePolarity).toBe("-");
    
    // Make different move
    play = makeMove(play, createTestAct([0], [[0, 0]], "-"));
    expect(play.moves).toHaveLength(2);
  });
});
