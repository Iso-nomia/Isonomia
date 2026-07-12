/**
 * ============================================
 * INTERACTION STEPPER
 * ============================================
 * 
 * Core engine for stepping through interactions on deliberation arenas.
 * Implements the game semantics from Faggian & Hyland.
 * 
 * Key responsibilities:
 * - Create initial interaction state from arena
 * - Validate and apply moves
 * - Track interaction progress
 * - Determine available moves
 */

import type {
  DeliberationArena,
  InteractionState,
  DialogueAct,
  LudicAddress,
  Polarity,
  ArenaPositionTheory,
  MoveValidation,
  MoveValidationError,
} from "../types/ludics-theory";

import {
  addressToKey,
  polarityAtAddress,
  flipPolarity,
  isDaimon,
  createDaimon,
  addressEquals,
  isAddressPrefix,
  getChildAddress,
} from "../types/ludics-theory";

// ============================================================================
// INITIAL STATE CREATION
// ============================================================================

/**
 * Create initial interaction state from arena
 * 
 * @param arena The deliberation arena to play on
 * @param options Optional configuration
 * @returns Initial interaction state
 */
export function createInitialState(
  arena: DeliberationArena,
  options?: {
    id?: string;
    startingPolarity?: Polarity;
  }
): InteractionState {
  return {
    arena,
    currentPath: [],
    currentAddress: arena.rootAddress || [],
    activePolarity: options?.startingPolarity || "+",
    pDesign: null,
    oDesign: null,
    terminated: false,
    id: options?.id,
  };
}

// ============================================================================
// MOVE VALIDATION
// ============================================================================

/**
 * Validate a move is legal in the current state
 * 
 * Validation rules:
 * 1. Game must not be terminated
 * 2. Move polarity must match active polarity
 * 3. Focus must be a valid address in the arena
 * 4. Ramification must be valid for that position
 * 
 * @param state Current interaction state
 * @param action The move to validate
 * @returns Validation result
 */
export function validateMove(
  state: InteractionState,
  action: DialogueAct
): MoveValidation {
  const errors: MoveValidationError[] = [];

  // Rule 1: Game must not be terminated
  if (state.terminated) {
    errors.push({
      code: "GAME_OVER",
      message: "Interaction has already terminated",
    });
    return { valid: false, errors };
  }

  // Rule 2: Polarity must match active polarity
  if (action.polarity !== state.activePolarity) {
    errors.push({
      code: "WRONG_POLARITY",
      message: `Expected ${state.activePolarity} polarity but got ${action.polarity}`,
      details: {
        expected: state.activePolarity,
        received: action.polarity,
      },
    });
  }

  // Rule 3: Focus must be valid
  const focusKey = addressToKey(action.focus);
  const position = state.arena.positions.get(focusKey);

  // For first move, any root-level position is valid
  if (state.currentPath.length === 0) {
    // Allow moves at root or at any position reachable from root
    if (action.focus.length > 0 && !position) {
      errors.push({
        code: "INVALID_ADDRESS",
        message: `Address [${action.focus.join(",")}] does not exist in arena`,
        details: { address: action.focus },
      });
    }
  } else {
    // For subsequent moves, focus must be justified by previous
    const lastAction = state.currentPath[state.currentPath.length - 1];
    const isJustified = validateJustification(lastAction, action);

    if (!isJustified && !position) {
      errors.push({
        code: "INVALID_ADDRESS",
        message: `Address [${action.focus.join(",")}] is not justified by previous move`,
        details: {
          address: action.focus,
          previousFocus: lastAction.focus,
          previousRamification: lastAction.ramification,
        },
      });
    }
  }

  // Rule 4: Ramification must be valid
  // Daimon has empty ramification (always valid)
  if (!isDaimon(action) && position) {
    const validRamification = validateRamification(
      action.ramification,
      position,
      state.arena
    );
    if (!validRamification.valid) {
      errors.push({
        code: "INVALID_RAMIFICATION",
        message: validRamification.message || "Invalid ramification",
        details: {
          given: action.ramification,
          available: position.ramification,
        },
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if action2 is justified by action1
 * 
 * From Faggian & Hyland: A move is justified by the previous move
 * if its focus is one of the addresses in the previous move's ramification.
 */
function validateJustification(
  action1: DialogueAct,
  action2: DialogueAct
): boolean {
  // Daimon can be played at any justified position
  if (isDaimon(action2)) {
    return true;
  }

  // Check if action2's focus is in action1's ramification
  for (const ramAddr of action1.ramification) {
    if (addressEquals(ramAddr, action2.focus)) {
      return true;
    }
    // Also check if focus is a child of ramification address
    if (isAddressPrefix(ramAddr, action2.focus)) {
      return true;
    }
  }

  // Also valid if focus is a prefix of any ramification (going back up)
  for (const ramAddr of action1.ramification) {
    if (isAddressPrefix(action2.focus, ramAddr)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate ramification against position's available responses
 */
function validateRamification(
  ramification: LudicAddress[],
  position: ArenaPositionTheory,
  arena: DeliberationArena
): { valid: boolean; message?: string } {
  // Ramification addresses should be children of the position
  for (const ramAddr of ramification) {
    // Check it's a valid child address
    const lastIndex = ramAddr[ramAddr.length - 1];
    if (lastIndex === undefined) {
      return { valid: false, message: "Empty ramification address" };
    }

    // Check this index is available at the position
    if (!position.ramification.includes(lastIndex)) {
      return {
        valid: false,
        message: `Index ${lastIndex} not available at position [${position.address.join(",")}]`,
      };
    }

    // Check the child position exists in arena
    const childKey = addressToKey(ramAddr);
    if (!arena.positions.has(childKey)) {
      // It's okay if position doesn't exist yet (might be opened by this move)
      // This is part of the ludics semantics
    }
  }

  return { valid: true };
}

// ============================================================================
// INTERACTION STEPPING
// ============================================================================

/**
 * Step interaction forward with a move
 * 
 * @param state Current interaction state
 * @param action The move to make
 * @returns New interaction state (immutable)
 * @throws Error if move is invalid
 */
export function stepInteraction(
  state: InteractionState,
  action: DialogueAct
): InteractionState {
  // Validate move
  const validation = validateMove(state, action);
  if (!validation.valid) {
    throw new Error(
      `Invalid move: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Build new path
  const newPath = [...state.currentPath, action];

  // Determine new current address (focus of the move)
  const newAddress = action.focus;

  // Flip polarity for next turn
  const newPolarity = flipPolarity(state.activePolarity);

  // Check for termination
  const terminated = checkTermination(action, state);

  return {
    ...state,
    currentPath: newPath,
    currentAddress: newAddress,
    activePolarity: newPolarity,
    terminated,
  };
}

/**
 * Check if the interaction terminates with this action
 * 
 * Termination occurs when:
 * - A daimon is played (convergent end)
 * - The active player has no legal moves (divergent end)
 */
function checkTermination(
  action: DialogueAct,
  state: InteractionState
): boolean {
  // Daimon always terminates
  if (isDaimon(action)) {
    return true;
  }

  // Empty ramification might indicate stuck (depends on arena)
  if (action.ramification.length === 0) {
    // This is a terminal position
    return true;
  }

  return false;
}

// ============================================================================
// LEGAL MOVES
// ============================================================================

/**
 * Get all legal moves from the current state
 * 
 * @param state Current interaction state
 * @returns Array of legal dialogue acts
 */
export function getLegalMoves(state: InteractionState): DialogueAct[] {
  if (state.terminated) {
    return [];
  }

  const moves: DialogueAct[] = [];
  const polarity = state.activePolarity;

  if (state.currentPath.length === 0) {
    // Initial move: can play at root or any root-level position
    const rootPosition = state.arena.positions.get(addressToKey([]));
    if (rootPosition) {
      // Add moves at root
      moves.push(...generateMovesAtPosition(rootPosition, polarity, state.arena));
    }

    // Also check positions at depth 1
    for (const [key, pos] of state.arena.positions) {
      if (pos.address.length === 1) {
        moves.push(...generateMovesAtPosition(pos, polarity, state.arena));
      }
    }
  } else {
    // Subsequent move: must be justified by previous ramification
    const lastAction = state.currentPath[state.currentPath.length - 1];

    for (const ramAddr of lastAction.ramification) {
      const ramKey = addressToKey(ramAddr);
      const position = state.arena.positions.get(ramKey);

      if (position) {
        moves.push(...generateMovesAtPosition(position, polarity, state.arena));
      }
    }
  }

  // Always allow daimon (giving up)
  const currentAddr = state.currentAddress;
  moves.push(createDaimon(currentAddr));

  return moves;
}

/**
 * Generate all possible moves at a position
 */
function generateMovesAtPosition(
  position: ArenaPositionTheory,
  polarity: Polarity,
  arena: DeliberationArena
): DialogueAct[] {
  const moves: DialogueAct[] = [];

  // For each subset of ramification, create a move
  // In practice, we usually consider:
  // 1. All available responses (full ramification)
  // 2. Individual responses (single index)
  // 3. Empty (terminal/daimon)

  // Full ramification move
  if (position.ramification.length > 0) {
    const fullRamification = position.ramification.map((i) =>
      getChildAddress(position.address, i)
    );

    moves.push({
      polarity,
      focus: position.address,
      ramification: fullRamification,
      expression: position.content,
      type: mapPositionTypeToActType(position.type),
    });

    // Individual response moves
    for (const index of position.ramification) {
      moves.push({
        polarity,
        focus: position.address,
        ramification: [getChildAddress(position.address, index)],
        expression: position.content,
        type: mapPositionTypeToActType(position.type),
      });
    }
  } else {
    // Terminal position - can only play here with empty ramification
    moves.push({
      polarity,
      focus: position.address,
      ramification: [],
      expression: position.content,
      type: mapPositionTypeToActType(position.type),
    });
  }

  return moves;
}

/**
 * Map position type to dialogue act type
 */
function mapPositionTypeToActType(
  posType: ArenaPositionTheory["type"]
): DialogueAct["type"] {
  switch (posType) {
    case "claim":
      return "claim";
    case "support":
      return "argue";
    case "attack":
      return "negate";
    case "question":
      return "ask";
    case "response":
    case "premise":
      return "argue";
    default:
      return "claim";
  }
}

// ============================================================================
// STATE QUERIES
// ============================================================================

/**
 * Check if interaction has terminated
 */
export function isTerminated(state: InteractionState): boolean {
  return state.terminated;
}

/**
 * Check if there are any legal moves
 */
export function hasLegalMoves(state: InteractionState): boolean {
  return getLegalMoves(state).length > 0;
}

/**
 * Get the current position in the arena
 */
export function getCurrentPosition(
  state: InteractionState
): ArenaPositionTheory | undefined {
  return state.arena.positions.get(addressToKey(state.currentAddress));
}

/**
 * Get move count
 */
export function getMoveCount(state: InteractionState): number {
  return state.currentPath.length;
}

/**
 * Get the last action played
 */
export function getLastAction(state: InteractionState): DialogueAct | undefined {
  return state.currentPath[state.currentPath.length - 1];
}

/**
 * Check if it's the first move
 */
export function isFirstMove(state: InteractionState): boolean {
  return state.currentPath.length === 0;
}
