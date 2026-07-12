/**
 * DDS (Designs, Disputes and Strategies) Type Definitions
 * Based on Faggian & Hyland (2002) Research Paper
 * Phase 1: Core Abstractions (Views, Chronicles, Legal Positions)
 */

import type { Polarity } from "../types";

// ============================================================================
// PHASE 1: Core Abstractions
// ============================================================================

/**
 * Action representation - fundamental unit of interaction
 * An action is played at an address (locus path) with ramification to sub-addresses
 */
export type Action = {
  focus: string;             // Address (locus path) e.g., "0", "0.1", "0.1.2"
  ramification: number[];    // Indices of sub-addresses opened
  polarity: "P" | "O";       // Proponent or Opponent
  actId?: string;            // Optional link to LudicAct record
  expression?: string;       // Optional natural language expression
  ts?: number;               // Timestamp
};

/**
 * View - projection of play for a player
 * Definition 3.5 from paper: view extracts the relevant actions visible to a player
 */
export type View = {
  id: string;
  player: "P" | "O";
  sequence: Action[];        // Actions visible to this player
  designId: string;
  parentDisputeId?: string;
};

/**
 * Chronicle - branch in design tree
 * A chronicle is a maximal branch from root to a positive or negative action
 */
export type Chronicle = {
  id: string;
  designId: string;
  actions: Action[];         // Ordered sequence of actions in this branch
  polarity: "P" | "O";       // Starting polarity
  isPositive: boolean;       // Ends with positive action (player's own action)?
};

/**
 * Position - sequence of actions in interaction
 * Represents a point in the dispute between designs
 */
export type Position = {
  id: string;
  sequence: Action[];
  player: "P" | "O";         // Whose turn is next
  isLinear: boolean;         // No address appears twice
  isLegal: boolean;          // Satisfies visibility condition
  disputeId?: string;
};

/**
 * Dispute - interaction trace between designs
 * First-class representation of design interaction
 */
export type Dispute = {
  id: string;
  dialogueId: string;
  posDesignId: string;
  negDesignId: string;
  pairs: Array<{
    posActId: string;
    negActId: string;
    locusPath: string;
    ts?: number;
  }>;
  status: "ONGOING" | "CONVERGENT" | "DIVERGENT" | "STUCK";
  length: number;
  isLegal?: boolean;
};

/**
 * Legal position validation result
 * Validates that a position satisfies the ludics game rules
 */
export type LegalityCheck = {
  isLinear: boolean;         // Each address appears at most once
  isParity: boolean;         // Polarity alternates correctly
  isJustified: boolean;      // Each move is justified by a prior opening
  isVisible: boolean;        // Justifier occurs in player's view
  errors: string[];          // Detailed error messages
};

// ============================================================================
// PHASE 2: Strategy Layer (Preview)
// ============================================================================

/**
 * Strategy - collection of plays
 * Definition 4.8: innocent strategy has same response to same view
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
 * Play - sequence of actions in strategy
 */
export type Play = {
  id: string;
  strategyId: string;
  sequence: Action[];
  length: number;
  isPositive: boolean;       // Ends on positive action
  view?: View;
};

/**
 * Innocence check result
 */
export type InnocenceCheck = {
  isInnocent: boolean;
  isDeterministic: boolean;
  isViewStable: boolean;
  violations: Array<{
    type: "determinism" | "view-stability" | "saturation";
    details: string;
  }>;
};

/**
 * Propagation check result
 */
export type PropagationCheck = {
  satisfiesPropagation: boolean;
  violations: Array<{
    views: [Action[], Action[]];
    issue: string;
  }>;
};

/**
 * Views(S) operation result
 */
export type ViewsResult = {
  strategyId: string;
  views: View[];
  isStable: boolean;
};

/**
 * Plays(V) operation result
 */
export type PlaysResult = {
  plays: Play[];
  isSmallest: boolean;
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for async operations
 */
export type DDSResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

/**
 * View extraction options
 */
export type ViewExtractionOptions = {
  includeTimestamps?: boolean;
  includeExpressions?: boolean;
  maxDepth?: number;
};

/**
 * Chronicle extraction options
 */
export type ChronicleExtractionOptions = {
  player?: "P" | "O";
  onlyPositive?: boolean;
  maxChronicles?: number;
};

/**
 * Legality validation options
 */
export type LegalityOptions = {
  strictParity?: boolean;
  allowDaimon?: boolean;
  validateJustification?: boolean;
  validateVisibility?: boolean;
};
