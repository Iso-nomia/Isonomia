/**
 * DDS Phase 2: Propagation Checking
 * Based on Faggian & Hyland (2002) - Definition 4.25
 * 
 * Propagation condition: If views share a common prefix, continuations must agree
 * on which addresses appear.
 * 
 * Reformulation: "In each slice, any address only appears once"
 * 
 * This ensures that the strategy's behavior is consistent across different
 * interaction paths that share common sub-histories.
 */

import type { Action, Position } from "../types";
import type { Strategy, PropagationCheck, PropagationViolation } from "./types";
import { extractView, viewToKey } from "../views";

/**
 * Check propagation condition (Definition 4.25)
 * 
 * If tκ, t′κ ∈ Views(S) and t = c * (ξ, I) * d, t′ = c * (ξ′, I′) * d′
 * then ξ = ξ′
 * 
 * Translation: Views with same ending locus that share a common prefix
 * must have matching addresses at that point.
 * 
 * @param strategy - Strategy to check
 * @returns PropagationCheck result
 */
export function checkPropagation(strategy: Strategy): PropagationCheck {
  const violations: PropagationViolation[] = [];

  // Extract all views from strategy
  const views: Action[][] = [];
  for (const play of strategy.plays) {
    for (let i = 1; i <= play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i);
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      views.push(view);
    }
  }

  // Deduplicate views
  const uniqueViews = deduplicateViews(views);

  // Check each pair of views for propagation violations
  for (let i = 0; i < uniqueViews.length; i++) {
    for (let j = i + 1; j < uniqueViews.length; j++) {
      const v1 = uniqueViews[i];
      const v2 = uniqueViews[j];

      const violation = checkViewPairPropagation(v1, v2);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  return {
    satisfiesPropagation: violations.length === 0,
    violations,
  };
}

/**
 * Check propagation between two specific views
 */
function checkViewPairPropagation(
  v1: Action[],
  v2: Action[]
): PropagationViolation | null {
  // Skip if views are empty
  if (v1.length === 0 || v2.length === 0) return null;

  // Get terminal locus for each view
  const terminal1 = v1[v1.length - 1].focus;
  const terminal2 = v2[v2.length - 1].focus;

  // Only check views that end at the same locus
  if (terminal1 !== terminal2) return null;

  // Find longest common prefix
  const commonPrefixLength = findCommonPrefixLength(v1, v2);

  // If no common prefix, no propagation issue
  if (commonPrefixLength === 0) return null;

  // Check: after common prefix, addresses must match
  const cont1 = v1.slice(commonPrefixLength);
  const cont2 = v2.slice(commonPrefixLength);

  if (cont1.length > 0 && cont2.length > 0) {
    const firstCont1 = cont1[0];
    const firstCont2 = cont2[0];

    // If continuations have different addresses, that's a violation
    if (firstCont1.focus !== firstCont2.focus) {
      return {
        views: [v1, v2],
        commonPrefixLength,
        issue: `After common prefix of ${commonPrefixLength}, views diverge to different addresses`,
        conflictingAddresses: [firstCont1.focus, firstCont2.focus],
      };
    }
  }

  return null;
}

/**
 * Find length of longest common prefix between two action sequences
 */
function findCommonPrefixLength(seq1: Action[], seq2: Action[]): number {
  const maxLen = Math.min(seq1.length, seq2.length);
  let commonLen = 0;

  for (let i = 0; i < maxLen; i++) {
    if (actionsEqual(seq1[i], seq2[i])) {
      commonLen = i + 1;
    } else {
      break;
    }
  }

  return commonLen;
}

/**
 * Check if two actions are equal
 */
function actionsEqual(a1: Action, a2: Action): boolean {
  return (
    a1.focus === a2.focus &&
    a1.polarity === a2.polarity &&
    JSON.stringify(a1.ramification.sort()) ===
      JSON.stringify(a2.ramification.sort())
  );
}

/**
 * Deduplicate view array
 */
function deduplicateViews(views: Action[][]): Action[][] {
  const seen = new Set<string>();
  const unique: Action[][] = [];

  for (const view of views) {
    const key = JSON.stringify(view);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(view);
    }
  }

  return unique;
}

/**
 * Alternative propagation check: "In each slice, address appears only once"
 * This is the slice-based reformulation of propagation
 */
export function checkLinearityInSlices(strategy: Strategy): boolean {
  for (const play of strategy.plays) {
    const seenAddresses = new Set<string>();

    for (const action of play.sequence) {
      if (seenAddresses.has(action.focus)) {
        return false; // Address appears twice in this slice/play
      }
      seenAddresses.add(action.focus);
    }
  }

  return true;
}

/**
 * Group views by terminal locus for propagation analysis
 */
export function groupViewsByTerminal(
  strategy: Strategy
): Map<string, Action[][]> {
  const groups = new Map<string, Action[][]>();

  for (const play of strategy.plays) {
    for (let i = 1; i <= play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i);
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      if (view.length === 0) continue;

      const terminal = view[view.length - 1].focus;

      if (!groups.has(terminal)) {
        groups.set(terminal, []);
      }
      groups.get(terminal)!.push(view);
    }
  }

  // Deduplicate within each group
  for (const [locus, views] of groups.entries()) {
    groups.set(locus, deduplicateViews(views));
  }

  return groups;
}

/**
 * Check if strategy satisfies both slice-linearity and pair-propagation
 * This is the full propagation condition
 */
export function checkFullPropagation(strategy: Strategy): {
  satisfiesSliceLinearity: boolean;
  satisfiesPairPropagation: boolean;
  satisfiesPropagation: boolean;
  violations: PropagationViolation[];
} {
  const sliceLinear = checkLinearityInSlices(strategy);
  const pairCheck = checkPropagation(strategy);

  return {
    satisfiesSliceLinearity: sliceLinear,
    satisfiesPairPropagation: pairCheck.satisfiesPropagation,
    satisfiesPropagation: sliceLinear && pairCheck.satisfiesPropagation,
    violations: pairCheck.violations,
  };
}

/**
 * Analyze propagation structure of a strategy
 * Returns detailed information about view structure
 */
export function analyzePropagationStructure(strategy: Strategy): {
  totalViews: number;
  uniqueViews: number;
  viewGroups: Map<string, number>; // locus → count
  maxGroupSize: number;
  potentialViolations: number;
} {
  const groups = groupViewsByTerminal(strategy);

  let totalViews = 0;
  let maxGroupSize = 0;

  for (const views of groups.values()) {
    totalViews += views.length;
    maxGroupSize = Math.max(maxGroupSize, views.length);
  }

  // Estimate potential violations (pairs to check)
  let potentialViolations = 0;
  for (const views of groups.values()) {
    // For each group, we check (n choose 2) pairs
    const n = views.length;
    potentialViolations += (n * (n - 1)) / 2;
  }

  const viewCounts = new Map<string, number>();
  for (const [locus, views] of groups.entries()) {
    viewCounts.set(locus, views.length);
  }

  return {
    totalViews,
    uniqueViews: groups.size,
    viewGroups: viewCounts,
    maxGroupSize,
    potentialViolations,
  };
}
