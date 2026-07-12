/**
 * DDS Legal Position Validation
 * Based on Faggian & Hyland (2002) - Definition 3.7
 * 
 * A legal position must satisfy:
 * 1. Linearity - each address appears at most once
 * 2. Parity - polarity alternates correctly  
 * 3. Justification - each non-initial move is justified
 * 4. Visibility - justifier occurs in player's view
 */

import type { Position, Action, LegalityCheck, LegalityOptions } from "./types";
import { extractView, isInitial } from "./views";

/**
 * Validate if position is legal (Definition 3.7)
 * 
 * @param position - The position to validate
 * @param options - Validation options
 * @returns LegalityCheck with detailed results
 */
export function validateLegality(
  position: Position,
  options: LegalityOptions = {}
): LegalityCheck {
  const errors: string[] = [];

  // Check linearity: each address appears at most once
  const isLinear = checkLinearity(position, errors);

  // Check parity: polarity alternates
  const isParity = checkParity(position, errors, options);

  // Check justification: each move is justified (optional)
  const isJustified = options.validateJustification !== false
    ? checkJustification(position, errors, options)
    : true;

  // Check visibility: justifier occurs in view (optional)
  const isVisible = options.validateVisibility !== false
    ? checkVisibility(position, errors)
    : true;

  return {
    isLinear,
    isParity,
    isJustified,
    isVisible,
    errors,
  };
}

/**
 * Check linearity: no address appears twice in the position
 * This ensures the interaction tree structure is maintained
 */
function checkLinearity(position: Position, errors: string[]): boolean {
  const seen = new Set<string>();

  for (let i = 0; i < position.sequence.length; i++) {
    const action = position.sequence[i];
    if (seen.has(action.focus)) {
      errors.push(
        `Linearity violation: Address "${action.focus}" appears multiple times (at index ${i})`
      );
      return false;
    }
    seen.add(action.focus);
  }

  return true;
}

/**
 * Check parity alternation: moves alternate between P and O
 * In ludics, polarity must strictly alternate
 */
function checkParity(
  position: Position, 
  errors: string[],
  options: LegalityOptions
): boolean {
  if (!options.strictParity && position.sequence.length < 2) {
    return true;
  }

  for (let i = 1; i < position.sequence.length; i++) {
    const prev = position.sequence[i - 1];
    const curr = position.sequence[i];

    if (prev.polarity === curr.polarity) {
      errors.push(
        `Parity violation: Same polarity "${curr.polarity}" at indices ${i - 1} and ${i}`
      );
      return false;
    }
  }

  return true;
}

/**
 * Check justification: each non-initial move is justified by a prior opening
 * Action (ξi, J) is justified by (ξ, I) if i ∈ I
 */
function checkJustification(
  position: Position, 
  errors: string[],
  options: LegalityOptions
): boolean {
  for (let i = 0; i < position.sequence.length; i++) {
    const action = position.sequence[i];

    // Initial moves don't need justification
    if (isInitial(action)) {
      continue;
    }

    // Daimon (†) moves may not need strict justification
    if (options.allowDaimon && isDaimon(action)) {
      continue;
    }

    // Find justifier in prior sequence
    const focusParts = action.focus.split(".");
    if (focusParts.length <= 1) {
      // This is a root-level action, should be initial
      continue;
    }

    const parentFocus = focusParts.slice(0, -1).join(".");
    const childIndex = parseInt(focusParts[focusParts.length - 1], 10);

    let justified = false;
    for (let j = 0; j < i; j++) {
      const candidate = position.sequence[j];
      if (
        candidate.focus === parentFocus &&
        candidate.ramification.includes(childIndex)
      ) {
        justified = true;
        break;
      }
    }

    if (!justified) {
      errors.push(
        `Justification violation: Action at "${action.focus}" (index ${i}) has no justifier`
      );
      return false;
    }
  }

  return true;
}

/**
 * Check visibility: justifier occurs in player's view
 * This ensures the player can "see" the move that justifies their action
 */
function checkVisibility(position: Position, errors: string[]): boolean {
  for (let i = 0; i < position.sequence.length; i++) {
    const action = position.sequence[i];

    // Initial moves don't need visibility check
    if (isInitial(action)) {
      continue;
    }

    // Get view up to this action (exclusive)
    const prefix: Position = {
      ...position,
      sequence: position.sequence.slice(0, i),
    };

    const view = extractView(prefix, action.polarity);

    // Check if justifier is in view
    const focusParts = action.focus.split(".");
    if (focusParts.length <= 1) {
      continue;
    }

    const parentFocus = focusParts.slice(0, -1).join(".");
    const childIndex = parseInt(focusParts[focusParts.length - 1], 10);

    let inView = false;
    for (const viewAction of view) {
      if (
        viewAction.focus === parentFocus &&
        viewAction.ramification.includes(childIndex)
      ) {
        inView = true;
        break;
      }
    }

    if (!inView) {
      errors.push(
        `Visibility violation: Justifier for "${action.focus}" (index ${i}) not in ${action.polarity}'s view`
      );
      return false;
    }
  }

  return true;
}

/**
 * Check if action is a daimon (†) - game termination marker
 */
function isDaimon(action: Action): boolean {
  return action.expression === "†" || action.ramification.length === 0;
}

/**
 * Quick check if position is legal (all conditions must pass)
 */
export function isLegal(position: Position, options: LegalityOptions = {}): boolean {
  const check = validateLegality(position, options);
  return check.isLinear && check.isParity && check.isJustified && check.isVisible;
}

/**
 * Create a valid position from actions (with validation)
 */
export function createPosition(
  id: string,
  sequence: Action[],
  player: "P" | "O",
  disputeId?: string,
  options: LegalityOptions = {}
): Position & { validationResult: LegalityCheck } {
  const position: Position = {
    id,
    sequence,
    player,
    isLinear: true,
    isLegal: true,
    disputeId,
  };

  const validationResult = validateLegality(position, options);
  
  position.isLinear = validationResult.isLinear;
  position.isLegal = 
    validationResult.isLinear && 
    validationResult.isParity && 
    validationResult.isJustified && 
    validationResult.isVisible;

  return { ...position, validationResult };
}

/**
 * Extend a position with a new action (and validate)
 */
export function extendPosition(
  position: Position,
  action: Action,
  options: LegalityOptions = {}
): { position: Position; isValid: boolean; check: LegalityCheck } {
  const newPosition: Position = {
    ...position,
    id: `${position.id}-ext`,
    sequence: [...position.sequence, action],
    player: action.polarity === "P" ? "O" : "P", // Next player
  };

  const check = validateLegality(newPosition, options);
  const isValid = check.isLinear && check.isParity && check.isJustified && check.isVisible;

  newPosition.isLinear = check.isLinear;
  newPosition.isLegal = isValid;

  return { position: newPosition, isValid, check };
}

/**
 * Get the next valid actions from current position
 * Returns addresses that could be played next based on current openings
 */
export function getValidNextAddresses(position: Position): string[] {
  const validAddresses: string[] = [];
  const usedAddresses = new Set(position.sequence.map((a) => a.focus));

  // Collect all openings from current position
  for (const action of position.sequence) {
    for (const ramIndex of action.ramification) {
      const childAddress = `${action.focus}.${ramIndex}`;
      if (!usedAddresses.has(childAddress)) {
        validAddresses.push(childAddress);
      }
    }
  }

  // If position is empty, root is valid
  if (position.sequence.length === 0) {
    validAddresses.push("0");
  }

  return validAddresses;
}
