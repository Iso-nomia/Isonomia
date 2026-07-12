/**
 * ============================================
 * INCARNATION EXTRACTION
 * ============================================
 * 
 * Compute the incarnation (essential core) of an interaction trace.
 * 
 * Based on Fouqueré & Quatrini "Study of Behaviours via Visitable Paths":
 * 
 * The incarnation is the relevant part of a design traversed in interaction.
 * It strips away non-essential parts, keeping only what matters for the outcome.
 * 
 * Key operations:
 * 1. View: Filter to keep positive + justified negative actions
 * 2. Incarnation: The essential core of the view
 * 
 * Theoretical foundation:
 * - Positive actions are always kept (asserting)
 * - Negative actions are kept only if justified by preceding positive
 * - Justification means the negative focus is in the positive ramification
 */

import type {
  DialogueAct,
  LudicAddress,
  Polarity,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  isDaimon,
} from "../types/ludics-theory";

// ============================================================================
// VIEW COMPUTATION
// ============================================================================

/**
 * Compute view of a trace
 * 
 * The view operation from the paper:
 * - Keep all positive actions (asserting player)
 * - For negative actions, keep only those justified by
 *   a preceding positive action
 * 
 * @param trace The action trace
 * @returns The view (filtered trace)
 */
export function computeView(trace: DialogueAct[]): DialogueAct[] {
  if (trace.length === 0) return [];

  const view: DialogueAct[] = [];

  for (let i = 0; i < trace.length; i++) {
    const act = trace[i];

    if (act.polarity === "+") {
      // Keep all positive actions
      view.push(act);
    } else {
      // Negative: check justification
      const previousInView = view.slice();
      const previousInTrace = trace.slice(0, i);

      // First try: immediately preceding positive in view
      const lastPositive = findLastPositive(previousInView);
      
      if (lastPositive && justifies(lastPositive, act)) {
        view.push(act);
      } else {
        // Second try: find any justifying positive in trace
        const justifier = findJustifyingPositive(act, previousInTrace);
        
        if (justifier) {
          // Truncate view to justifier, then add this action
          const justifierIndex = findActionIndex(view, justifier);
          
          if (justifierIndex >= 0) {
            // Keep only up to and including the justifier
            view.length = justifierIndex + 1;
            view.push(act);
          } else {
            // Justifier not in view - add justifier first, then this action
            // This handles cases where we need to "backtrack" in the view
            view.push(justifier);
            view.push(act);
          }
        }
        // If no justifier found, the negative action is not added to view
        // This is correct - unjustified negative actions are filtered out
      }
    }
  }

  return view;
}

/**
 * Find the last positive action in a sequence
 * 
 * @param actions Sequence of actions
 * @returns Last positive action, or null
 */
export function findLastPositive(actions: DialogueAct[]): DialogueAct | null {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].polarity === "+") {
      return actions[i];
    }
  }
  return null;
}

/**
 * Find a positive action that justifies a given negative action
 * 
 * Search backwards through the trace for a positive action whose
 * ramification includes the negative action's focus.
 * 
 * @param negativeAct The negative action to justify
 * @param previousActions Actions before the negative
 * @returns Justifying positive action, or null
 */
export function findJustifyingPositive(
  negativeAct: DialogueAct,
  previousActions: DialogueAct[]
): DialogueAct | null {
  // Search backwards for the most recent justifier
  for (let i = previousActions.length - 1; i >= 0; i--) {
    const prev = previousActions[i];
    if (prev.polarity === "+" && justifies(prev, negativeAct)) {
      return prev;
    }
  }
  return null;
}

/**
 * Check if a positive action justifies a negative action
 * 
 * An action A justifies action B if:
 * 1. B's focus is directly in A's ramification, OR
 * 2. B's focus extends (is child of) an address in A's ramification, OR
 * 3. B's focus is a prefix of A's focus (going back to parent)
 * 
 * @param positive The positive action (potential justifier)
 * @param negative The negative action (to be justified)
 * @returns true if positive justifies negative
 */
export function justifies(positive: DialogueAct, negative: DialogueAct): boolean {
  const focus = negative.focus;
  const ramification = positive.ramification;

  // Case 1: Direct match - focus is in ramification
  for (const ramAddr of ramification) {
    if (addressEquals(ramAddr, focus)) {
      return true;
    }
  }

  // Case 2: Focus extends ramification address (going deeper)
  for (const ramAddr of ramification) {
    if (isPrefix(ramAddr, focus)) {
      return true;
    }
  }

  // Case 3: Focus is in the "domain" of positive action
  // (same base address or extends positive focus)
  const positiveFocus = positive.focus;
  if (isPrefix(positiveFocus, focus)) {
    return true;
  }

  // Case 4: Response to the position (focus is prefix of positive focus)
  // This handles dialogue patterns where we respond to parent positions
  if (isPrefix(focus, positiveFocus) && focus.length > 0) {
    return true;
  }

  return false;
}

/**
 * Check if a negative action has a justifying positive in the trace
 * 
 * @param negativeAct The negative action
 * @param previousActions Previous actions in the trace
 * @returns true if justified
 */
export function hasJustifyingPositive(
  negativeAct: DialogueAct,
  previousActions: DialogueAct[]
): boolean {
  return findJustifyingPositive(negativeAct, previousActions) !== null;
}

// ============================================================================
// INCARNATION COMPUTATION
// ============================================================================

/**
 * Compute incarnation (essential core) of a trace
 * 
 * The incarnation strips away non-essential parts of the interaction,
 * keeping only the moves that actually matter for the outcome.
 * 
 * Algorithm:
 * 1. Build view (keep positive, filter negative by justification)
 * 2. Strip non-essential actions
 * 3. Return essential core
 * 
 * @param trace The full action trace
 * @returns The incarnation (essential actions only)
 */
export function computeIncarnation(trace: DialogueAct[]): DialogueAct[] {
  if (trace.length === 0) return [];

  // Step 1: Build view
  const view = computeView(trace);

  // Step 2: Strip non-essential actions
  const essential = stripNonEssential(view);

  return essential;
}

/**
 * Strip non-essential actions from a view
 * 
 * Non-essential actions are those that don't contribute to the
 * final outcome. We keep:
 * 1. All actions on the "main line" to the conclusion
 * 2. Actions that are referenced by later actions
 * 
 * @param view The view (pre-filtered trace)
 * @returns Essential actions only
 */
export function stripNonEssential(view: DialogueAct[]): DialogueAct[] {
  if (view.length === 0) return [];

  // For now, use a simple algorithm:
  // Keep all actions that are either:
  // 1. On the path to a terminal action (daimon or last action)
  // 2. Referenced by a kept action

  const essential: DialogueAct[] = [];
  const referenced = new Set<string>();

  // Pass 1: Find all addresses that are referenced
  for (const act of view) {
    // Each action references its focus
    referenced.add(addressToKey(act.focus));
    
    // And creates references via ramification
    for (const ramAddr of act.ramification) {
      referenced.add(addressToKey(ramAddr));
    }
  }

  // Pass 2: Keep actions whose focus is referenced by later actions
  // (or are terminal actions)
  for (let i = 0; i < view.length; i++) {
    const act = view[i];
    const focusKey = addressToKey(act.focus);

    // Keep terminal actions (daimon or last in trace)
    if (isDaimon(act) || i === view.length - 1) {
      essential.push(act);
      continue;
    }

    // Keep if this action's ramification is used later
    let usedLater = false;
    for (const ramAddr of act.ramification) {
      const ramKey = addressToKey(ramAddr);
      // Check if any later action focuses on this ramification
      for (let j = i + 1; j < view.length; j++) {
        if (addressEquals(view[j].focus, ramAddr) || isPrefix(ramAddr, view[j].focus)) {
          usedLater = true;
          break;
        }
      }
      if (usedLater) break;
    }

    if (usedLater) {
      essential.push(act);
    }
  }

  // If we filtered too aggressively, ensure we at least have the main line
  if (essential.length === 0 && view.length > 0) {
    return view; // Fall back to full view
  }

  return essential;
}

/**
 * Check if an action is essential to the interaction
 * 
 * An action is essential if:
 * 1. It's a daimon (terminates interaction)
 * 2. It's the last action (determines outcome)
 * 3. Its ramification is used by a later essential action
 * 
 * @param action The action to check
 * @param view The full view
 * @param index Index of the action in the view
 * @returns true if essential
 */
export function isEssentialAction(
  action: DialogueAct,
  view: DialogueAct[],
  index: number
): boolean {
  // Terminal actions are essential
  if (isDaimon(action)) return true;
  if (index === view.length - 1) return true;

  // Check if any later action uses this action's ramification
  for (let i = index + 1; i < view.length; i++) {
    const laterAction = view[i];
    for (const ramAddr of action.ramification) {
      if (addressEquals(laterAction.focus, ramAddr) || 
          isPrefix(ramAddr, laterAction.focus)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// INCARNATION ANALYSIS
// ============================================================================

/**
 * Get the justification chain for an incarnation
 * 
 * For each action in the incarnation, find what justifies it.
 * 
 * @param incarnation The incarnation to analyze
 * @returns Array of justification reasons
 */
export function getJustificationChain(incarnation: DialogueAct[]): string[] {
  const chain: string[] = [];

  for (let i = 0; i < incarnation.length; i++) {
    const act = incarnation[i];

    if (i === 0) {
      chain.push(`Initial ${act.polarity === "+" ? "assertion" : "challenge"} at root`);
      continue;
    }

    if (act.polarity === "+") {
      // Positive: justified by being an assertion
      chain.push(`${act.type} at ${addressToKey(act.focus)}`);
    } else {
      // Negative: find justifier
      const justifier = findJustifyingPositive(act, incarnation.slice(0, i));
      if (justifier) {
        chain.push(
          `Response to ${justifier.type} at ${addressToKey(justifier.focus)}`
        );
      } else {
        chain.push(`${act.type} at ${addressToKey(act.focus)}`);
      }
    }
  }

  return chain;
}

/**
 * Check if an incarnation is minimal (cannot be reduced further)
 * 
 * @param incarnation The incarnation to check
 * @returns true if minimal
 */
export function isMinimalIncarnation(incarnation: DialogueAct[]): boolean {
  // Every action in a minimal incarnation must be essential
  for (let i = 0; i < incarnation.length; i++) {
    if (!isEssentialAction(incarnation[i], incarnation, i)) {
      return false;
    }
  }
  return true;
}

/**
 * Compute the compression ratio of an incarnation
 * 
 * @param original Original trace length
 * @param incarnation The incarnation
 * @returns Compression ratio (0-1)
 */
export function getCompressionRatio(
  original: DialogueAct[],
  incarnation: DialogueAct[]
): number {
  if (original.length === 0) return 1;
  return incarnation.length / original.length;
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
 * Find the index of an action in a list (by reference or by content)
 */
function findActionIndex(actions: DialogueAct[], target: DialogueAct): number {
  // First try by reference
  const refIndex = actions.indexOf(target);
  if (refIndex >= 0) return refIndex;

  // Then try by content
  return actions.findIndex(
    (a) =>
      a.polarity === target.polarity &&
      addressEquals(a.focus, target.focus) &&
      a.type === target.type &&
      a.expression === target.expression
  );
}

// ============================================================================
// ADVANCED INCARNATION OPERATIONS
// ============================================================================

/**
 * Merge two incarnations (for comparing interaction paths)
 * 
 * @param inc1 First incarnation
 * @param inc2 Second incarnation
 * @returns Merged incarnation containing common elements
 */
export function mergeIncarnations(
  inc1: DialogueAct[],
  inc2: DialogueAct[]
): DialogueAct[] {
  // Find common prefix
  let commonLength = 0;
  while (
    commonLength < inc1.length &&
    commonLength < inc2.length &&
    actionsMatch(inc1[commonLength], inc2[commonLength])
  ) {
    commonLength++;
  }

  return inc1.slice(0, commonLength);
}

/**
 * Check if two actions match (for incarnation comparison)
 */
function actionsMatch(a1: DialogueAct, a2: DialogueAct): boolean {
  return (
    a1.polarity === a2.polarity &&
    addressEquals(a1.focus, a2.focus) &&
    a1.type === a2.type
    // Note: Don't compare expression for structural matching
  );
}

/**
 * Get the "depth" of an incarnation (maximum address depth)
 */
export function getIncarnationDepth(incarnation: DialogueAct[]): number {
  if (incarnation.length === 0) return 0;
  return Math.max(...incarnation.map((a) => a.focus.length));
}

/**
 * Get the "width" of an incarnation (number of distinct base addresses)
 */
export function getIncarnationWidth(incarnation: DialogueAct[]): number {
  const bases = new Set<string>();
  for (const act of incarnation) {
    const base = act.focus.slice(0, 1);
    bases.add(addressToKey(base));
  }
  return bases.size;
}
