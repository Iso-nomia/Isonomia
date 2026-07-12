/**
 * DDS Phase 2: Strategy Types
 * Based on Faggian & Hyland (2002) - Definitions 4.8, 4.10, 4.11, 4.25
 * 
 * A strategy is a collection of plays that determines how a player responds
 * to opponent moves. Innocent strategies respond the same way to the same view.
 */

import type { Action, View, Position } from "../types";

/**
 * Strategy - Collection of plays determining player behavior
 * Definition 4.8: Strategy is view-determined (innocent) if same view → same response
 */
export type Strategy = {
  id: string;
  designId: string;
  player: "P" | "O";
  plays: Play[];
  isInnocent: boolean;
  satisfiesPropagation: boolean;
};

/**
 * Play - Sequence of actions in strategy
 * A play represents one complete interaction path through the design
 */
export type Play = {
  id: string;
  strategyId: string;
  sequence: Action[];
  length: number;
  isPositive: boolean; // Ends on player's own polarity
  view?: View;
};

/**
 * Determinism check result
 * Determinism: s̄b, s̄c ∈ S† ⟹ b = c
 * (Same view implies same next move)
 */
export type DeterminismCheck = {
  isDeterministic: boolean;
  violations: DeterminismViolation[];
};

export type DeterminismViolation = {
  view: Action[];
  viewKey: string;
  responses: Action[]; // Multiple different responses to same view
};

/**
 * Innocence check result (Definition 4.8)
 * Strategy is innocent if:
 * 1. Deterministic: same view → same response
 * 2. View-stable: Views(S) ⊆ S
 * 3. Saturated: contains all view-compatible plays
 */
export type InnocenceCheck = {
  isInnocent: boolean;
  isDeterministic: boolean;
  isViewStable: boolean;
  isSaturated: boolean;
  violations: InnocenceViolation[];
};

export type InnocenceViolation = {
  type: "determinism" | "view-stability" | "saturation";
  details: string;
  evidence?: {
    view?: Action[];
    responses?: Action[];
    missingPlay?: Action[];
  };
};

/**
 * Propagation check result (Definition 4.25)
 * Propagation: If views share a common prefix, continuations must agree on addresses
 * "In each slice, any address only appears once"
 */
export type PropagationCheck = {
  satisfiesPropagation: boolean;
  violations: PropagationViolation[];
};

export type PropagationViolation = {
  views: [Action[], Action[]];
  commonPrefixLength: number;
  issue: string;
  conflictingAddresses?: [string, string];
};

/**
 * Views(S) operation result (Definition 4.10)
 * Extract all player views from a strategy
 */
export type ViewsResult = {
  strategyId: string;
  views: View[];
  viewCount: number;
  isStable: boolean; // All views satisfy p̄ = p (view of view is itself)
};

/**
 * Plays(V) operation result (Definition 4.11)
 * Generate the smallest innocent strategy containing view set V
 */
export type PlaysResult = {
  plays: Play[];
  playCount: number;
  isSmallest: boolean; // By construction, this is the minimal innocent strategy
  iterations: number; // Number of closure iterations performed
};

/**
 * Strategy construction options
 */
export type StrategyConstructionOptions = {
  maxPlays?: number;
  maxIterations?: number;
  includeNegativePlays?: boolean;
  validateInnocence?: boolean;
};

/**
 * View extension check - can a view extend a play?
 */
export type ViewExtensionCheck = {
  canExtend: boolean;
  playView: Action[];
  extensionView: Action[];
  nextAction?: Action;
};

/**
 * Strategy comparison result
 */
export type StrategyComparison = {
  strategy1Id: string;
  strategy2Id: string;
  areEqual: boolean;
  commonPlays: number;
  uniqueToFirst: number;
  uniqueToSecond: number;
};

/**
 * Full strategy analysis result
 */
export type StrategyAnalysis = {
  strategy: Strategy;
  innocenceCheck: InnocenceCheck;
  propagationCheck: PropagationCheck;
  viewsResult: ViewsResult;
  correspondence: {
    satisfiesDesignCorrespondence: boolean;
    reason?: string;
  };
};
