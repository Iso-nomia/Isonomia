/**
 * Types for Commitment-Ludics Bridge System
 * 
 * Provides type definitions for the mapping between dialogue commitments
 * and ludics commitment elements, enabling promotion of public debate claims
 * into the formal proof system.
 */

import type { CommitmentLudicMapping, LudicCommitmentElement } from "@prisma/client";

/**
 * Request body for promoting a dialogue commitment to ludics
 */
export interface PromoteCommitmentRequest {
  deliberationId: string;
  participantId: string;
  proposition: string;
  targetOwnerId: string;        // e.g., "Proponent", "Opponent"
  targetLocusPath?: string;     // Optional, defaults to root locus
  basePolarity: "pos" | "neg";  // Fact or rule
}

/**
 * Response from promoting a dialogue commitment
 */
export interface PromoteCommitmentResponse {
  ok: boolean;
  mapping?: CommitmentLudicMappingWithElement;
  error?: string;
}

/**
 * Mapping with full ludic commitment element details
 */
export interface CommitmentLudicMappingWithElement extends CommitmentLudicMapping {
  ludicCommitmentElement: LudicCommitmentElement;
}

/**
 * Extended commitment record with promotion status
 */
export interface CommitmentWithPromotionStatus {
  claimId: string;
  claimText: string;
  moveId: string;
  moveKind: string;
  timestamp: Date;
  isActive: boolean;
  isPromoted: boolean;
  promotedAt?: Date;
  ludicOwnerId?: string;
  ludicPolarity?: string;
}

/**
 * Promotion context metadata stored in JSON
 */
export interface PromotionContext {
  sourcePanel: string;          // e.g., "CommitmentStorePanel", "ClaimDetailPanel"
  userIntent?: string;          // Optional: why user promoted (free text)
  deliberationPhase?: string;   // Optional: which phase of deliberation
  [key: string]: any;           // Extensible for future metadata
}
