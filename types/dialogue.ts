// types/dialogue.ts
/**
 * Canonical type definitions for the dialogue system
 * Used across DialogueActionsModal, LegalMoveToolbar, LegalMoveChips, and API routes
 */

import { TargetType } from "@prisma/client";

// ============================================================================
// MOVE TYPES
// ============================================================================

/**
 * All supported dialogue move kinds
 */
export type MoveKind =
  | "ASSERT"
  | "WHY"
  | "GROUNDS"
  | "RETRACT"
  | "CONCEDE"
  | "CLOSE"
  | "THEREFORE"
  | "SUPPOSE"
  | "DISCHARGE"
  | "ACCEPT_ARGUMENT";

/**
 * Alias for backward compatibility with some components
 */
export type ProtocolKind = MoveKind;

/**
 * Strategic force/intent of a move
 */
export type MoveForce = "ATTACK" | "SURRENDER" | "NEUTRAL";

/**
 * Relevance hint for UI prioritization
 */
export type MoveRelevance = "likely" | "unlikely" | null;

/**
 * Target specification for moves that post to a different target
 * (e.g., R7 hint: accept the argument instead of the claim)
 */
export interface PostTarget {
  targetType: "argument" | "claim" | "card";
  targetId: string;
}

/**
 * Verdict code for debugging and explanation
 * Format: [R|H][number]_[NAME]
 * - R = Rule (why move is illegal)
 * - H = Hint (why move is legal/suggested)
 */
export interface Verdict {
  code: string;
  context?: Record<string, any>;
}

/**
 * Core move structure returned by legal-moves API
 */
export interface Move {
  kind: MoveKind;
  label: string;
  payload?: any;
  disabled?: boolean;
  reason?: string;
  force?: MoveForce;
  relevance?: MoveRelevance;
  postAs?: PostTarget;
  verdict?: Verdict;
}

// ============================================================================
// DIALOGUE CONTEXT
// ============================================================================

/**
 * Context for performing a dialogue move
 */
export interface DialogueContext {
  deliberationId: string;
  targetType: TargetType;
  targetId: string;
  locusPath?: string;
}

/**
 * Extended context with actor information
 */
export interface DialogueContextWithActor extends DialogueContext {
  actorId?: string | null;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request payload for posting a dialogue move
 */
export interface PostMoveRequest {
  deliberationId: string;
  targetType: "argument" | "claim" | "card";
  targetId: string;
  kind: MoveKind;
  payload?: any;
  locusPath?: string;
  autoCompile?: boolean;
  autoStep?: boolean;
  phase?: "neutral" | "proponent" | "opponent";
}

/**
 * Response from legal-moves API
 */
export interface LegalMovesResponse {
  ok: boolean;
  moves: Move[];
  error?: string;
}

/**
 * Response from move post API
 */
export interface PostMoveResponse {
  ok: boolean;
  moveId?: string;
  error?: string;
}

// ============================================================================
// CQ (CRITICAL QUESTIONS) TYPES
// ============================================================================

/**
 * Critical question status badge
 */
export interface CQStatusBadge {
  total: number;
  satisfied: number;
}

/**
 * CQ item structure
 */
export interface CQItem {
  cqKey: string;
  text: string;
  status: "open" | "answered";
  attackType?: string;
  targetScope?: string;
}

/**
 * CQ data response from API
 */
export interface CQDataResponse {
  schemes: Array<{
    cqs: Array<{
      key?: string;
      text?: string;
      satisfied: boolean;
    }>;
  }>;
}

// ============================================================================
// COMMAND CARD / ACTION TYPES
// ============================================================================

/**
 * Action structure for CommandCard component
 * Maps moves to UI actions
 */
export interface CommandCardAction {
  id: string;
  kind: MoveKind;
  label: string;
  force: MoveForce;
  disabled: boolean;
  reason?: string;
  move: {
    kind: MoveKind;
    payload?: any;
  };
  target: {
    deliberationId: string;
    targetType: "argument" | "claim" | "card";
    targetId: string;
    locusPath?: string;
  };
  tone: "primary" | "danger" | "default";
}

// ============================================================================
// TOAST NOTIFICATION TYPES
// ============================================================================

/**
 * Toast message kind
 */
export type ToastKind = "ok" | "err" | "info" | "warn";

/**
 * Toast message structure
 */
export interface ToastMessage {
  kind: ToastKind;
  text: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Custom events dispatched by dialogue components
 */
export interface DialogueEventDetail {
  deliberationId: string;
  targetType?: TargetType;
  targetId?: string;
}

declare global {
  interface WindowEventMap {
    "dialogue:changed": CustomEvent<DialogueEventDetail>;
    "dialogue:moves:refresh": CustomEvent<DialogueEventDetail>;
    "arguments:changed": CustomEvent<DialogueEventDetail>;
    "claims:changed": CustomEvent<DialogueEventDetail>;
  }
}

// ============================================================================
// MOVE CONFIGURATION
// ============================================================================

/**
 * UI configuration for a move kind
 */
export interface MoveConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "danger" | "default";
  category: "protocol" | "structural" | "cqs";
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Owner/role in a dialogue
 */
export type DialogueOwner = "Proponent" | "Opponent";

/**
 * Locus path (position in dialogue tree)
 */
export type LocusPath = string;

/**
 * Phase of deliberation
 */
export type DeliberationPhase = "neutral" | "proponent" | "opponent";
