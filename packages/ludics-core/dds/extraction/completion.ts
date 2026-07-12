/**
 * ============================================
 * DESIGN COMPLETION
 * ============================================
 * 
 * Complete a design by adding daimon endings to all incomplete branches.
 * 
 * Based on Girard's ludics and Faggian-Hyland semantics:
 * 
 * A complete design has explicit termination (daimon †) on all branches
 * where the player cannot continue. This ensures:
 * 1. Interaction can always terminate
 * 2. The design is well-defined at all positions
 * 3. Orthogonality can be properly computed
 * 
 * Key concepts:
 * - Incomplete chronicle: Ends at a positive action that could continue
 * - Complete chronicle: Ends in daimon or at a terminal position
 * - Completion: Add daimon to all incomplete endings
 */

import type {
  LudicDesignTheory,
  Chronicle,
  DialogueAct,
  LudicAddress,
} from "../types/ludics-theory";

import {
  createDaimon,
  isDaimon,
  addressToKey,
  flipPolarity,
} from "../types/ludics-theory";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Completion statistics
 */
export interface CompletionStats {
  /** Total chronicles before completion */
  originalChronicleCount: number;

  /** Total chronicles after completion */
  completedChronicleCount: number;

  /** Number of daimons added */
  daimonsAdded: number;

  /** Addresses where daimons were added */
  completionPoints: LudicAddress[];

  /** Was the design already complete? */
  wasAlreadyComplete: boolean;
}

/**
 * Incomplete position info
 */
export interface IncompletePosition {
  /** Address of the incomplete position */
  address: LudicAddress;

  /** Chronicle index containing this position */
  chronicleIndex: number;

  /** Action index within the chronicle */
  actionIndex: number;

  /** The action at this position */
  action: DialogueAct;

  /** Why it's incomplete */
  reason: "no_response" | "empty_ramification" | "ends_positive";
}

// ============================================================================
// CHRONICLE COMPLETION CHECKS
// ============================================================================

/**
 * Check if a chronicle is complete
 * 
 * A chronicle is complete if:
 * 1. It ends in a daimon (†), OR
 * 2. It ends at a terminal position (no ramification), OR
 * 3. It ends in a negative action (opponent's turn to respond)
 * 
 * @param chronicle The chronicle to check
 * @returns true if complete
 */
export function isChronicleComplete(chronicle: Chronicle): boolean {
  // Empty chronicles are considered complete (degenerate case)
  if (chronicle.actions.length === 0) {
    return true;
  }

  // If marked complete, trust the flag
  if (chronicle.isComplete) {
    return true;
  }

  const lastAction = chronicle.actions[chronicle.actions.length - 1];

  // Ends in daimon = complete
  if (isDaimon(lastAction)) {
    return true;
  }

  // Ends in negative action = waiting for opponent, so complete for our design
  if (lastAction.polarity === "-") {
    return true;
  }

  // Ends in positive with empty ramification = terminal, complete
  if (lastAction.ramification.length === 0) {
    return true;
  }

  // Ends in positive with ramification = we should respond, incomplete
  return false;
}

/**
 * Find all incomplete chronicles in a design
 * 
 * @param design The design to check
 * @returns Array of incomplete chronicles with indices
 */
export function findIncompleteChronicles(
  design: LudicDesignTheory
): { chronicle: Chronicle; index: number }[] {
  const incomplete: { chronicle: Chronicle; index: number }[] = [];

  for (let i = 0; i < design.chronicles.length; i++) {
    if (!isChronicleComplete(design.chronicles[i])) {
      incomplete.push({
        chronicle: design.chronicles[i],
        index: i,
      });
    }
  }

  return incomplete;
}

/**
 * Find all incomplete positions in a design
 * 
 * @param design The design to analyze
 * @returns Array of incomplete positions
 */
export function getIncompletePositions(
  design: LudicDesignTheory
): IncompletePosition[] {
  const positions: IncompletePosition[] = [];

  for (let cIdx = 0; cIdx < design.chronicles.length; cIdx++) {
    const chronicle = design.chronicles[cIdx];
    
    if (chronicle.actions.length === 0) continue;

    const lastAction = chronicle.actions[chronicle.actions.length - 1];
    const lastIndex = chronicle.actions.length - 1;

    // Check if this ending is incomplete
    if (!isChronicleComplete(chronicle)) {
      let reason: IncompletePosition["reason"] = "ends_positive";

      if (lastAction.polarity === "+" && lastAction.ramification.length === 0) {
        reason = "empty_ramification";
      } else if (lastAction.polarity === "+") {
        reason = "no_response";
      }

      positions.push({
        address: lastAction.focus,
        chronicleIndex: cIdx,
        actionIndex: lastIndex,
        action: lastAction,
        reason,
      });
    }
  }

  return positions;
}

// ============================================================================
// DESIGN COMPLETION
// ============================================================================

/**
 * Complete a design by adding daimon endings to incomplete branches
 * 
 * This is the main completion function. For each incomplete chronicle,
 * it adds a daimon action to make it complete.
 * 
 * @param design The design to complete
 * @returns Completed design (new object, original unchanged)
 */
export function completeDesign(design: LudicDesignTheory): LudicDesignTheory {
  const completedChronicles: Chronicle[] = [];
  const completionPoints: LudicAddress[] = [];
  let daimonsAdded = 0;

  for (const chronicle of design.chronicles) {
    if (isChronicleComplete(chronicle)) {
      // Already complete, keep as-is
      completedChronicles.push({ ...chronicle });
    } else {
      // Need to complete this chronicle
      const completed = addDaimonEnding(chronicle);
      completedChronicles.push(completed);

      // Track completion
      const lastAction = chronicle.actions[chronicle.actions.length - 1];
      completionPoints.push(lastAction.focus);
      daimonsAdded++;
    }
  }

  return {
    ...design,
    chronicles: completedChronicles,
    hasDaimon: true, // Completion always adds daimons if needed
  };
}

/**
 * Add a daimon ending to an incomplete chronicle
 * 
 * @param chronicle The chronicle to complete
 * @returns Completed chronicle with daimon
 */
export function addDaimonEnding(chronicle: Chronicle): Chronicle {
  if (isChronicleComplete(chronicle)) {
    // Already complete, return as-is
    return { ...chronicle };
  }

  const lastAction = chronicle.actions[chronicle.actions.length - 1];
  
  // Create daimon at the appropriate position
  // The daimon should be at the position where we need to respond
  let daimonFocus: LudicAddress;

  if (lastAction.ramification.length > 0) {
    // Use first ramification as daimon focus
    daimonFocus = lastAction.ramification[0];
  } else {
    // Use the last action's focus
    daimonFocus = lastAction.focus;
  }

  const daimon = createDaimon(daimonFocus);

  return {
    ...chronicle,
    actions: [...chronicle.actions, daimon],
    isComplete: true,
  };
}

/**
 * Complete a design and return statistics
 * 
 * @param design The design to complete
 * @returns Object with completed design and statistics
 */
export function completeDesignWithStats(
  design: LudicDesignTheory
): { design: LudicDesignTheory; stats: CompletionStats } {
  const originalCount = design.chronicles.length;
  const incompleteChronicles = findIncompleteChronicles(design);
  const wasAlreadyComplete = incompleteChronicles.length === 0;

  const completedDesign = completeDesign(design);

  // Collect completion points
  const completionPoints = incompleteChronicles.map(({ chronicle }) => {
    const lastAction = chronicle.actions[chronicle.actions.length - 1];
    return lastAction.focus;
  });

  return {
    design: completedDesign,
    stats: {
      originalChronicleCount: originalCount,
      completedChronicleCount: completedDesign.chronicles.length,
      daimonsAdded: incompleteChronicles.length,
      completionPoints,
      wasAlreadyComplete,
    },
  };
}

// ============================================================================
// DESIGN ANALYSIS
// ============================================================================

/**
 * Check if a design is already complete (all chronicles complete)
 * 
 * @param design The design to check
 * @returns true if all chronicles are complete
 */
export function isDesignComplete(design: LudicDesignTheory): boolean {
  return design.chronicles.every(isChronicleComplete);
}

/**
 * Get completion degree of a design (ratio of complete chronicles)
 * 
 * @param design The design to analyze
 * @returns Completion ratio (0-1)
 */
export function getCompletionDegree(design: LudicDesignTheory): number {
  if (design.chronicles.length === 0) return 1;

  const completeCount = design.chronicles.filter(isChronicleComplete).length;
  return completeCount / design.chronicles.length;
}

/**
 * Check if a design is winning (has no daimons)
 * 
 * A design is winning if all its chronicles complete without daimon,
 * meaning it always forces the opponent to give up.
 * 
 * @param design The design to check
 * @returns true if winning
 */
export function isWinningDesign(design: LudicDesignTheory): boolean {
  // Check explicit flag
  if (design.isWinning !== undefined) {
    return design.isWinning;
  }

  // Check if any chronicle contains daimon
  for (const chronicle of design.chronicles) {
    for (const action of chronicle.actions) {
      if (isDaimon(action)) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Complete multiple designs
 * 
 * @param designs Array of designs to complete
 * @returns Array of completed designs
 */
export function completeDesigns(
  designs: LudicDesignTheory[]
): LudicDesignTheory[] {
  return designs.map(completeDesign);
}

/**
 * Complete designs and return combined statistics
 */
export function completeDesignsWithStats(
  designs: LudicDesignTheory[]
): { designs: LudicDesignTheory[]; totalDaimonsAdded: number } {
  let totalDaimonsAdded = 0;
  const completedDesigns: LudicDesignTheory[] = [];

  for (const design of designs) {
    const { design: completed, stats } = completeDesignWithStats(design);
    completedDesigns.push(completed);
    totalDaimonsAdded += stats.daimonsAdded;
  }

  return { designs: completedDesigns, totalDaimonsAdded };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a completed design is well-formed
 * 
 * @param design The design to validate
 * @returns Validation result
 */
export function validateCompletedDesign(design: LudicDesignTheory): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // All chronicles should be complete
  const incomplete = findIncompleteChronicles(design);
  if (incomplete.length > 0) {
    errors.push(`Design has ${incomplete.length} incomplete chronicles`);
  }

  // If hasDaimon is true, should actually have daimons
  if (design.hasDaimon) {
    let foundDaimon = false;
    for (const chronicle of design.chronicles) {
      if (chronicle.actions.some(isDaimon)) {
        foundDaimon = true;
        break;
      }
    }
    if (!foundDaimon) {
      warnings.push("hasDaimon is true but no daimons found in chronicles");
    }
  }

  // If isWinning is true, should have no daimons
  if (design.isWinning) {
    for (const chronicle of design.chronicles) {
      if (chronicle.actions.some(isDaimon)) {
        errors.push("isWinning is true but design contains daimons");
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Remove daimons from a design (inverse of completion)
 * 
 * Useful for re-completing with different strategy.
 * 
 * @param design The design to strip
 * @returns Design with daimons removed
 */
export function stripDaimons(design: LudicDesignTheory): LudicDesignTheory {
  const strippedChronicles: Chronicle[] = [];

  for (const chronicle of design.chronicles) {
    const strippedActions = chronicle.actions.filter((a) => !isDaimon(a));
    
    strippedChronicles.push({
      ...chronicle,
      actions: strippedActions,
      isComplete: false, // May no longer be complete
    });
  }

  return {
    ...design,
    chronicles: strippedChronicles,
    hasDaimon: false,
    isWinning: true, // No daimons means potentially winning
  };
}

/**
 * Count daimons in a design
 */
export function countDaimons(design: LudicDesignTheory): number {
  let count = 0;
  for (const chronicle of design.chronicles) {
    count += chronicle.actions.filter(isDaimon).length;
  }
  return count;
}
