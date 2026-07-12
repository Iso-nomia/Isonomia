/**
 * ============================================
 * STRATEGY & DESIGN MANAGEMENT
 * ============================================
 * 
 * Manages strategies and designs for ludic interactions.
 * Implements the Faggian-Hyland game semantics.
 * 
 * Key concepts:
 * - Strategy: Response pattern (which move at each position)
 * - Design: Complete strategy with all possible chronicles
 * - Chronicle: Single path through a design
 */

import type {
  Strategy,
  LudicDesignTheory,
  Chronicle,
  DialogueAct,
  LudicAddress,
  Polarity,
  InteractionState,
  DeliberationArena,
  ArenaPositionTheory,
} from "../types/ludics-theory";

import {
  addressToKey,
  keyToAddress,
  polarityAtAddress,
  flipPolarity,
  getChildAddress,
  isDaimon,
  createDaimon,
} from "../types/ludics-theory";

import { getLegalMoves } from "./stepper";

// ============================================================================
// STRATEGY CREATION
// ============================================================================

/**
 * Create a new strategy
 * 
 * @param polarity The strategist's polarity
 * @param options Strategy options
 * @returns New Strategy
 */
export function createStrategy(
  polarity: Polarity,
  options?: {
    id?: string;
    designId?: string;
    name?: string;
    allowDaimon?: boolean;
    responses?: Map<string, number>;
  }
): Strategy {
  return {
    id: options?.id || `strategy-${Date.now()}`,
    designId: options?.designId,
    polarity,
    responses: options?.responses || new Map(),
    allowDaimon: options?.allowDaimon ?? true,
    name: options?.name,
  };
}

/**
 * Set a response in a strategy
 * 
 * @param strategy The strategy to modify
 * @param address The position address
 * @param responseIndex The chosen response index
 * @returns Updated strategy (immutable)
 */
export function setResponse(
  strategy: Strategy,
  address: LudicAddress,
  responseIndex: number
): Strategy {
  const newResponses = new Map(strategy.responses);
  newResponses.set(addressToKey(address), responseIndex);
  return { ...strategy, responses: newResponses };
}

/**
 * Get the response for a position
 * 
 * @param strategy The strategy
 * @param address The position address
 * @returns The response index, or undefined if not set
 */
export function getResponse(
  strategy: Strategy,
  address: LudicAddress
): number | undefined {
  return strategy.responses.get(addressToKey(address));
}

/**
 * Check if strategy has a response for a position
 */
export function hasResponse(
  strategy: Strategy,
  address: LudicAddress
): boolean {
  return strategy.responses.has(addressToKey(address));
}

// ============================================================================
// STRATEGY APPLICATION
// ============================================================================

/**
 * Apply strategy to get the move at current state
 * 
 * @param strategy The strategy to apply
 * @param state Current interaction state
 * @param arena The arena (for position lookup)
 * @returns The dialogue act to play, or null if no response defined
 */
export function applyStrategy(
  strategy: Strategy,
  state: InteractionState,
  arena: DeliberationArena
): DialogueAct | null {
  // Check if it's this strategy's turn
  if (state.activePolarity !== strategy.polarity) {
    return null;
  }

  // Determine where we can respond
  // If there's a previous move, we must respond at one of its ramification addresses
  let respondAt: LudicAddress;
  
  if (state.currentPath.length === 0) {
    // First move - respond at root
    respondAt = state.currentAddress;
  } else {
    // Subsequent move - need to respond at ramification of last move
    const lastAction = state.currentPath[state.currentPath.length - 1];
    if (lastAction.ramification.length === 0) {
      // No ramification - can only play daimon
      if (strategy.allowDaimon) {
        return createDaimon(lastAction.focus);
      }
      return null;
    }
    // Use first ramification address by default, or look up response
    const responseIndex = getResponse(strategy, lastAction.focus);
    if (responseIndex !== undefined) {
      respondAt = getChildAddress(lastAction.focus, responseIndex);
    } else {
      // No specific response - use first available
      respondAt = lastAction.ramification[0];
    }
  }

  const position = arena.positions.get(addressToKey(respondAt));
  if (!position) {
    if (strategy.allowDaimon) {
      return createDaimon(respondAt);
    }
    return null;
  }

  // Get response for this position
  const responseIndex = getResponse(strategy, respondAt);

  if (responseIndex === undefined) {
    // No response defined
    if (strategy.allowDaimon) {
      // Return daimon as fallback
      return createDaimon(respondAt);
    }
    return null;
  }

  // Check if response index is valid
  if (!position.ramification.includes(responseIndex)) {
    return null;
  }

  // Build the dialogue act
  const childAddress = getChildAddress(respondAt, responseIndex);
  const childPosition = arena.positions.get(addressToKey(childAddress));

  return {
    polarity: strategy.polarity,
    focus: respondAt,
    ramification: [childAddress],
    expression: childPosition?.content || position.content,
    type: "argue",
  };
}

/**
 * Apply strategy to get all possible moves
 * (useful for minimax evaluation)
 */
export function getStrategyMoves(
  strategy: Strategy,
  state: InteractionState,
  arena: DeliberationArena
): DialogueAct[] {
  if (state.activePolarity !== strategy.polarity) {
    return [];
  }

  const legalMoves = getLegalMoves(state);
  
  // Filter to only moves consistent with strategy
  const responseIndex = getResponse(strategy, state.currentAddress);
  
  if (responseIndex === undefined) {
    // No preference - return all legal moves
    return legalMoves;
  }

  // Filter to matching moves
  return legalMoves.filter((move) => {
    if (move.ramification.length === 0) {
      // Daimon
      return strategy.allowDaimon;
    }
    // Check if ramification contains the chosen response
    const chosenAddr = getChildAddress(state.currentAddress, responseIndex);
    return move.ramification.some(
      (r) => addressToKey(r) === addressToKey(chosenAddr)
    );
  });
}

// ============================================================================
// CHRONICLE MANAGEMENT
// ============================================================================

/**
 * Create a new chronicle
 * 
 * @param actions The actions in the chronicle
 * @param isComplete Whether the chronicle is complete
 * @returns New Chronicle
 */
export function createChronicle(
  actions: DialogueAct[],
  isComplete: boolean = false
): Chronicle {
  return {
    id: `chronicle-${Date.now()}`,
    actions: [...actions],
    isComplete,
  };
}

/**
 * Extend a chronicle with a new action
 */
export function extendChronicle(
  chronicle: Chronicle,
  action: DialogueAct
): Chronicle {
  return {
    ...chronicle,
    actions: [...chronicle.actions, action],
    isComplete: isDaimon(action) || chronicle.isComplete,
  };
}

/**
 * Check if a chronicle is positive-ended
 */
export function isPositiveChronicle(chronicle: Chronicle): boolean {
  if (chronicle.actions.length === 0) return false;
  const last = chronicle.actions[chronicle.actions.length - 1];
  return last.polarity === "+";
}

/**
 * Check if a chronicle contains daimon
 */
export function chronicleHasDaimon(chronicle: Chronicle): boolean {
  return chronicle.actions.some(isDaimon);
}

/**
 * Get chronicle depth
 */
export function getChronicleDepth(chronicle: Chronicle): number {
  return chronicle.actions.length;
}

/**
 * Check if one chronicle is a prefix of another
 */
export function isChroniclePrefix(
  prefix: Chronicle,
  chronicle: Chronicle
): boolean {
  if (prefix.actions.length > chronicle.actions.length) {
    return false;
  }
  return prefix.actions.every(
    (act, i) => actionsEqual(act, chronicle.actions[i])
  );
}

/**
 * Check if two actions are equal
 */
function actionsEqual(a: DialogueAct, b: DialogueAct): boolean {
  return (
    a.polarity === b.polarity &&
    addressToKey(a.focus) === addressToKey(b.focus) &&
    a.ramification.length === b.ramification.length &&
    a.ramification.every(
      (r, i) => addressToKey(r) === addressToKey(b.ramification[i])
    )
  );
}

// ============================================================================
// DESIGN MANAGEMENT
// ============================================================================

/**
 * Create a new design
 * 
 * @param polarity Design polarity
 * @param options Design options
 * @returns New LudicDesignTheory
 */
export function createDesign(
  polarity: Polarity,
  options?: {
    id?: string;
    name?: string;
    base?: LudicAddress[];
    chronicles?: Chronicle[];
  }
): LudicDesignTheory {
  const chronicles = options?.chronicles || [];
  const hasDaimon = chronicles.some(chronicleHasDaimon);

  return {
    id: options?.id || `design-${Date.now()}`,
    base: options?.base || [[]],
    polarity,
    chronicles,
    hasDaimon,
    isWinning: !hasDaimon && chronicles.length > 0,
    name: options?.name,
  };
}

/**
 * Add a chronicle to a design
 */
export function addChronicle(
  design: LudicDesignTheory,
  chronicle: Chronicle
): LudicDesignTheory {
  const newChronicles = [...design.chronicles, chronicle];
  const hasDaimon = newChronicles.some(chronicleHasDaimon);

  return {
    ...design,
    chronicles: newChronicles,
    hasDaimon,
    isWinning: !hasDaimon && newChronicles.length > 0,
  };
}

/**
 * Convert strategy to design
 * 
 * Generates all possible chronicles from a strategy.
 */
export function strategyToDesign(
  strategy: Strategy,
  arena: DeliberationArena,
  maxDepth: number = 10
): LudicDesignTheory {
  const chronicles: Chronicle[] = [];
  
  // Generate chronicles by traversing arena with strategy
  generateChroniclesFromStrategy(
    strategy,
    arena,
    [],
    [],
    maxDepth,
    chronicles
  );

  return createDesign(strategy.polarity, {
    id: strategy.designId,
    name: strategy.name,
    chronicles,
  });
}

/**
 * Recursively generate chronicles from strategy
 */
function generateChroniclesFromStrategy(
  strategy: Strategy,
  arena: DeliberationArena,
  currentPath: DialogueAct[],
  currentAddress: LudicAddress,
  maxDepth: number,
  chronicles: Chronicle[]
): void {
  if (currentPath.length >= maxDepth) {
    chronicles.push(createChronicle(currentPath, false));
    return;
  }

  const position = arena.positions.get(addressToKey(currentAddress));
  if (!position) {
    chronicles.push(createChronicle(currentPath, true));
    return;
  }

  // Determine whose turn
  const polarity = polarityAtAddress(currentAddress);

  if (polarity === strategy.polarity) {
    // Strategy's turn - use response
    const responseIndex = getResponse(strategy, currentAddress);
    
    if (responseIndex === undefined) {
      if (strategy.allowDaimon) {
        // Play daimon
        const daimon = createDaimon(currentAddress);
        chronicles.push(createChronicle([...currentPath, daimon], true));
      } else {
        chronicles.push(createChronicle(currentPath, false));
      }
      return;
    }

    // Make the move
    const childAddress = getChildAddress(currentAddress, responseIndex);
    const action: DialogueAct = {
      polarity,
      focus: currentAddress,
      ramification: [childAddress],
      expression: position.content,
      type: "argue",
    };

    // Continue from child
    generateChroniclesFromStrategy(
      strategy,
      arena,
      [...currentPath, action],
      childAddress,
      maxDepth,
      chronicles
    );
  } else {
    // Opponent's turn - branch on all possible responses
    if (position.ramification.length === 0) {
      // Terminal position
      chronicles.push(createChronicle(currentPath, true));
      return;
    }

    for (const index of position.ramification) {
      const childAddress = getChildAddress(currentAddress, index);
      const action: DialogueAct = {
        polarity,
        focus: currentAddress,
        ramification: [childAddress],
        expression: position.content,
        type: "argue",
      };

      generateChroniclesFromStrategy(
        strategy,
        arena,
        [...currentPath, action],
        childAddress,
        maxDepth,
        chronicles
      );
    }
  }
}

// ============================================================================
// STRATEGY GENERATION
// ============================================================================

/**
 * Generate all possible strategies for an arena
 * 
 * This is exponential in arena size - use with caution!
 * 
 * @param arena The arena
 * @param polarity The strategist's polarity
 * @param maxStrategies Maximum strategies to generate
 * @returns Array of strategies
 */
export function generateAllStrategies(
  arena: DeliberationArena,
  polarity: Polarity,
  maxStrategies: number = 100
): Strategy[] {
  const strategies: Strategy[] = [];
  
  // Get all positions where this polarity acts
  const myPositions: ArenaPositionTheory[] = [];
  for (const [key, pos] of arena.positions) {
    if (pos.polarity === polarity && pos.ramification.length > 0) {
      myPositions.push(pos);
    }
  }

  if (myPositions.length === 0) {
    // No positions - return single empty strategy
    return [createStrategy(polarity)];
  }

  // Generate combinations
  const combinations = generateResponseCombinations(
    myPositions,
    maxStrategies
  );

  for (const combo of combinations) {
    const responses = new Map<string, number>();
    for (let i = 0; i < myPositions.length; i++) {
      responses.set(addressToKey(myPositions[i].address), combo[i]);
    }
    strategies.push(
      createStrategy(polarity, { responses })
    );
  }

  return strategies;
}

/**
 * Generate response combinations for positions
 */
function generateResponseCombinations(
  positions: ArenaPositionTheory[],
  maxCombinations: number
): number[][] {
  if (positions.length === 0) return [[]];

  const result: number[][] = [];
  
  function generate(index: number, current: number[]): void {
    if (result.length >= maxCombinations) return;
    
    if (index >= positions.length) {
      result.push([...current]);
      return;
    }

    const pos = positions[index];
    for (const responseIndex of pos.ramification) {
      current.push(responseIndex);
      generate(index + 1, current);
      current.pop();
    }
  }

  generate(0, []);
  return result;
}

/**
 * Generate a random strategy
 */
export function generateRandomStrategy(
  arena: DeliberationArena,
  polarity: Polarity
): Strategy {
  const responses = new Map<string, number>();

  for (const [key, pos] of arena.positions) {
    if (pos.polarity === polarity && pos.ramification.length > 0) {
      // Pick random response
      const randomIndex = Math.floor(Math.random() * pos.ramification.length);
      responses.set(key, pos.ramification[randomIndex]);
    }
  }

  return createStrategy(polarity, { responses });
}

// ============================================================================
// STRATEGY EVALUATION
// ============================================================================

/**
 * Evaluate a strategy by simulation
 * 
 * @param strategy The strategy to evaluate
 * @param arena The arena
 * @param opponent Optional opponent strategy
 * @param simulations Number of simulations
 * @returns Win rate (0-1)
 */
export function evaluateStrategy(
  strategy: Strategy,
  arena: DeliberationArena,
  opponent?: Strategy,
  simulations: number = 100
): { winRate: number; avgMoves: number; results: string[] } {
  let wins = 0;
  let totalMoves = 0;
  const results: string[] = [];

  for (let i = 0; i < simulations; i++) {
    const opp = opponent || generateRandomStrategy(arena, flipPolarity(strategy.polarity));
    const result = simulateInteraction(strategy, opp, arena);
    
    if (result.winner === strategy.polarity) {
      wins++;
    }
    totalMoves += result.moves;
    results.push(result.outcome);
  }

  return {
    winRate: wins / simulations,
    avgMoves: totalMoves / simulations,
    results,
  };
}

/**
 * Simulate interaction between two strategies
 */
function simulateInteraction(
  pStrategy: Strategy,
  oStrategy: Strategy,
  arena: DeliberationArena
): { winner: Polarity | null; moves: number; outcome: string } {
  let address: LudicAddress = [];
  let polarity: Polarity = "+";
  let moves = 0;
  const maxMoves = 100;

  while (moves < maxMoves) {
    const position = arena.positions.get(addressToKey(address));
    if (!position) {
      // No position - divergent
      return { winner: flipPolarity(polarity), moves, outcome: "divergent" };
    }

    if (position.ramification.length === 0) {
      // Terminal - divergent
      return { winner: flipPolarity(polarity), moves, outcome: "divergent" };
    }

    const strategy = polarity === "+" ? pStrategy : oStrategy;
    const response = getResponse(strategy, address);

    if (response === undefined) {
      if (strategy.allowDaimon) {
        // Daimon - convergent, other wins
        return { winner: flipPolarity(polarity), moves, outcome: "convergent" };
      }
      // Stuck
      return { winner: flipPolarity(polarity), moves, outcome: "divergent" };
    }

    // Make move
    address = getChildAddress(address, response);
    polarity = flipPolarity(polarity);
    moves++;
  }

  // Max moves reached
  return { winner: null, moves, outcome: "timeout" };
}
