/**
 * ============================================
 * OUTCOME DETECTION
 * ============================================
 * 
 * Detects the outcome of interactions and builds visitable paths.
 * Implements convergence/divergence semantics from Girard's ludics.
 * 
 * Key concepts:
 * - Convergent: Interaction ends with daimon (success, agreement)
 * - Divergent: One player has no legal moves (stuck, disagreement)
 * - Winner: The player who could still move when the other got stuck
 */

import type {
  InteractionState,
  InteractionResult,
  VisitablePath,
  DialogueAct,
  Polarity,
  LudicAddress,
} from "../types/ludics-theory";

import {
  isDaimon,
  flipPolarity,
  addressToKey,
} from "../types/ludics-theory";

import {
  isTerminated,
  getLegalMoves,
  getLastAction,
} from "./stepper";

// ============================================================================
// OUTCOME DETECTION
// ============================================================================

/**
 * Detect outcome of current state
 * 
 * Returns null if the game is still in progress.
 * 
 * @param state Current interaction state
 * @returns InteractionResult if game ended, null otherwise
 */
export function detectOutcome(state: InteractionState): InteractionResult | null {
  // Game must be terminated to have an outcome
  if (!state.terminated) {
    // Check if current player is stuck
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) {
      // Stuck! Game ends divergently
      return buildDivergentResult(state);
    }
    // Game still in progress
    return null;
  }

  // Check last action for daimon
  const lastAction = getLastAction(state);
  if (lastAction && isDaimon(lastAction)) {
    // Convergent end
    return buildConvergentResult(state, lastAction);
  }

  // Terminal position reached
  return buildTerminalResult(state);
}

/**
 * Build result for convergent end (daimon played)
 */
function buildConvergentResult(
  state: InteractionState,
  daimonAction: DialogueAct
): InteractionResult {
  const path = buildVisitablePath(state.currentPath, true);
  
  // The player who played daimon "gave up" - the other wins
  const daimonPlayer = daimonAction.polarity === "+" ? "P" : "O";
  const winner = daimonPlayer === "P" ? "O" : "P";

  return {
    path,
    outcome: "convergent",
    stuckPlayer: daimonPlayer as "P" | "O",
    trace: [...state.currentPath],
    moveCount: state.currentPath.length,
  };
}

/**
 * Build result for divergent end (player stuck)
 */
function buildDivergentResult(state: InteractionState): InteractionResult {
  const path = buildVisitablePath(state.currentPath, false);
  
  // The active player (who would move next) is stuck
  const stuckPlayer = state.activePolarity === "+" ? "P" : "O";

  return {
    path,
    outcome: "divergent",
    stuckPlayer,
    trace: [...state.currentPath],
    moveCount: state.currentPath.length,
  };
}

/**
 * Build result for terminal position reached
 */
function buildTerminalResult(state: InteractionState): InteractionResult {
  const lastAction = getLastAction(state);
  const path = buildVisitablePath(state.currentPath, false);
  
  // Terminal position with empty ramification - depends on whose turn
  // The player who would move next (but can't) is stuck
  const stuckPlayer = state.activePolarity === "+" ? "P" : "O";

  return {
    path,
    outcome: "divergent",
    stuckPlayer,
    trace: [...state.currentPath],
    moveCount: state.currentPath.length,
  };
}

// ============================================================================
// CONVERGENCE/DIVERGENCE CHECKS
// ============================================================================

/**
 * Check if interaction ended convergently (with daimon)
 * 
 * @param state The interaction state
 * @returns true if ended with daimon
 */
export function isConvergent(state: InteractionState): boolean {
  if (!state.terminated) return false;
  
  const lastAction = getLastAction(state);
  return lastAction ? isDaimon(lastAction) : false;
}

/**
 * Check if interaction ended divergently (player stuck)
 * 
 * @param state The interaction state
 * @returns true if ended with stuck player
 */
export function isDivergent(state: InteractionState): boolean {
  if (!state.terminated) {
    // Check if stuck (no legal moves)
    return getLegalMoves(state).length === 0;
  }
  
  const lastAction = getLastAction(state);
  return lastAction ? !isDaimon(lastAction) : true;
}

/**
 * Determine winner from the current state
 * 
 * In ludics semantics:
 * - If one player is stuck, the other wins
 * - If one player plays daimon, the other wins
 * - Returns null if game is still in progress
 * 
 * @param state The interaction state
 * @returns The winning polarity, or null
 */
export function determineWinner(state: InteractionState): Polarity | null {
  if (!state.terminated && getLegalMoves(state).length > 0) {
    // Game still in progress
    return null;
  }

  const lastAction = getLastAction(state);
  
  if (lastAction && isDaimon(lastAction)) {
    // Daimon player loses
    return lastAction.polarity === "+" ? "-" : "+";
  }

  // Stuck player loses
  return flipPolarity(state.activePolarity);
}

// ============================================================================
// VISITABLE PATH CONSTRUCTION
// ============================================================================

/**
 * Build visitable path from completed interaction
 * 
 * The visitable path is the proof trace - the actual sequence
 * of actions that occurred during interaction.
 * 
 * @param trace The action trace
 * @param convergent Whether the interaction ended convergently
 * @returns VisitablePath
 */
export function buildVisitablePath(
  trace: DialogueAct[],
  convergent: boolean
): VisitablePath {
  // Compute incarnation (essential core)
  const incarnation = computeIncarnation(trace);

  // Determine winner
  let winner: "P" | "O" | null = null;
  if (trace.length > 0) {
    const lastAction = trace[trace.length - 1];
    if (isDaimon(lastAction)) {
      // Daimon player loses
      winner = lastAction.polarity === "+" ? "O" : "P";
    } else {
      // For divergent end, need to look at whose turn it was
      // The player who would move next is stuck
      const nextPolarity = flipPolarity(lastAction.polarity);
      winner = nextPolarity === "+" ? "O" : "P";
    }
  }

  return {
    actions: [...trace],
    convergent,
    winner,
    incarnation,
  };
}

/**
 * Compute incarnation (essential core) of a trace
 * 
 * From "Visitable Paths" paper:
 * The incarnation strips away non-essential parts of the interaction,
 * keeping only the moves that actually matter for the outcome.
 * 
 * Algorithm:
 * 1. Build view (keep positive, filter negative by justification)
 * 2. Remove non-essential negative actions
 * 
 * @param trace The full action trace
 * @returns The incarnation (essential actions only)
 */
export function computeIncarnation(trace: DialogueAct[]): DialogueAct[] {
  if (trace.length === 0) return [];

  // Step 1: Build view
  const view = computeView(trace);

  // Step 2: Filter to essential actions
  // For now, the view IS the incarnation
  // More sophisticated filtering can be added later
  return view;
}

/**
 * Compute view of a trace
 * 
 * View operation from the paper:
 * - Keep all positive actions
 * - For negative actions, only keep those justified by 
 *   immediately preceding positive action
 * 
 * @param trace The action trace
 * @returns The view
 */
export function computeView(trace: DialogueAct[]): DialogueAct[] {
  const view: DialogueAct[] = [];

  for (let i = 0; i < trace.length; i++) {
    const act = trace[i];

    if (act.polarity === "+") {
      // Keep all positive actions
      view.push(act);
    } else {
      // Negative: check if justified by last positive in view
      const lastPositive = findLastPositive(view);
      
      if (lastPositive && justifies(lastPositive, act)) {
        view.push(act);
      } else {
        // Look back to find justifying positive
        const justifier = findJustifier(act, trace.slice(0, i));
        
        if (justifier) {
          // Truncate view to justifier, then add this action
          const justifierIndex = view.findIndex((a) =>
            addressEquals(a.focus, justifier.focus)
          );
          
          if (justifierIndex >= 0) {
            view.length = justifierIndex + 1;
            view.push(act);
          }
        }
      }
    }
  }

  return view;
}

/**
 * Find the last positive action in a sequence
 */
function findLastPositive(actions: DialogueAct[]): DialogueAct | null {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].polarity === "+") {
      return actions[i];
    }
  }
  return null;
}

/**
 * Check if action1 justifies action2
 * 
 * An action justifies another if the second action's focus
 * is in the first action's ramification.
 */
function justifies(action1: DialogueAct, action2: DialogueAct): boolean {
  for (const ramAddr of action1.ramification) {
    if (addressEquals(ramAddr, action2.focus)) {
      return true;
    }
    // Check if focus is a prefix (going to parent)
    if (isPrefix(ramAddr, action2.focus) || isPrefix(action2.focus, ramAddr)) {
      return true;
    }
  }
  return false;
}

/**
 * Find the justifying positive action for a negative action
 */
function findJustifier(
  action: DialogueAct,
  previousActions: DialogueAct[]
): DialogueAct | null {
  // Search backwards for a positive action that justifies this
  for (let i = previousActions.length - 1; i >= 0; i--) {
    const prev = previousActions[i];
    if (prev.polarity === "+" && justifies(prev, action)) {
      return prev;
    }
  }
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if address a is a prefix of address b
 */
function isPrefix(a: LudicAddress, b: LudicAddress): boolean {
  if (a.length > b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Check if two addresses are equal
 */
function addressEquals(a: LudicAddress, b: LudicAddress): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ============================================================================
// RESULT QUERIES
// ============================================================================

/**
 * Get a human-readable description of the outcome
 */
export function describeOutcome(result: InteractionResult): string {
  if (result.outcome === "convergent") {
    const loser = result.stuckPlayer === "P" ? "Proponent" : "Opponent";
    const winner = result.stuckPlayer === "P" ? "Opponent" : "Proponent";
    return `Convergent: ${loser} conceded (played daimon). ${winner} wins.`;
  } else {
    const stuck = result.stuckPlayer === "P" ? "Proponent" : "Opponent";
    const winner = result.stuckPlayer === "P" ? "Opponent" : "Proponent";
    return `Divergent: ${stuck} has no legal moves. ${winner} wins.`;
  }
}

/**
 * Get statistics about a result
 */
export function getResultStatistics(result: InteractionResult): {
  totalMoves: number;
  pMoves: number;
  oMoves: number;
  avgMoveDepth: number;
  finalDepth: number;
} {
  const trace = result.trace;
  const pMoves = trace.filter((a) => a.polarity === "+").length;
  const oMoves = trace.filter((a) => a.polarity === "-").length;
  
  const depths = trace.map((a) => a.focus.length);
  const avgMoveDepth = depths.length > 0 
    ? depths.reduce((a, b) => a + b, 0) / depths.length 
    : 0;
  const finalDepth = depths.length > 0 ? depths[depths.length - 1] : 0;

  return {
    totalMoves: trace.length,
    pMoves,
    oMoves,
    avgMoveDepth,
    finalDepth,
  };
}
