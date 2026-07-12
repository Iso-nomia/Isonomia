/**
 * Claim Prediction System - TypeScript Types
 * 
 * These types extend the Prisma-generated types with additional
 * utility types for API responses and service layer.
 */

import type {
  ClaimPrediction as PrismaClaimPrediction,
  PredictionOutcome as PrismaPredictionOutcome,
  ClaimPredictionStatus,
  PredictionResolution,
  EvidenceType,
} from "@prisma/client";

// Re-export enums for convenience
export {
  ClaimPredictionStatus,
  PredictionResolution,
  EvidenceType,
};

// ─────────────────────────────────────────────────────────
// Core Types (extend Prisma types)
// ─────────────────────────────────────────────────────────

/**
 * ClaimPrediction with optional relations loaded
 */
export interface ClaimPrediction extends PrismaClaimPrediction {
  outcomes?: PredictionOutcome[];
  creatorName?: string;
  claim?: {
    id: string;
    text: string;
  };
}

/**
 * PredictionOutcome with optional relations loaded
 */
export interface PredictionOutcome extends PrismaPredictionOutcome {
  recorderName?: string;
}

// ─────────────────────────────────────────────────────────
// Input Types (for creating/updating)
// ─────────────────────────────────────────────────────────

export interface CreatePredictionInput {
  claimId: string;
  deliberationId: string;
  predictionText: string;
  targetDate?: Date | string;
  confidence?: number;
  createdById: string;
}

export interface UpdatePredictionInput {
  predictionId: string;
  predictionText?: string;
  targetDate?: Date | string | null;
  confidence?: number;
}

export interface ResolvePredictionInput {
  predictionId: string;
  resolution: PredictionResolution;
  resolutionNote?: string;
  resolvedById: string;
}

export interface RecordOutcomeInput {
  predictionId: string;
  description: string;
  evidenceType?: EvidenceType;
  evidenceUrl?: string;
  observedAt?: Date | string;
  recordedById: string;
}

// ─────────────────────────────────────────────────────────
// Query Types
// ─────────────────────────────────────────────────────────

export interface GetPredictionsQuery {
  claimId?: string;
  deliberationId?: string;
  createdById?: string;
  status?: ClaimPredictionStatus;
  limit?: number;
  offset?: number;
}

export interface GetPredictionsForDeliberationQuery {
  deliberationId: string;
  status?: ClaimPredictionStatus;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────

export interface PredictionsListResponse {
  predictions: ClaimPrediction[];
  total: number;
  hasMore: boolean;
}

export interface UserPredictionStats {
  userId: string;
  totalPredictions: number;
  pendingCount: number;
  resolvedCount: number;
  confirmedCount: number;
  disconfirmedCount: number;
  partiallyTrueCount: number;
  indeterminateCount: number;
  withdrawnCount: number;
  expiredCount: number;
  accuracyRate: number; // confirmed / (confirmed + disconfirmed)
  averageConfidence: number;
}

export interface ClaimPredictionSummary {
  claimId: string;
  totalPredictions: number;
  pendingCount: number;
  confirmedCount: number;
  disconfirmedCount: number;
}

// ─────────────────────────────────────────────────────────
// API Request/Response Types
// ─────────────────────────────────────────────────────────

export interface CreatePredictionRequest {
  predictionText: string;
  targetDate?: string; // ISO date string
  confidence?: number;
}

export interface CreatePredictionResponse {
  ok: boolean;
  prediction?: ClaimPrediction;
  error?: string;
}

export interface ResolvePredictionRequest {
  resolution: PredictionResolution;
  resolutionNote?: string;
}

export interface ResolvePredictionResponse {
  ok: boolean;
  prediction?: ClaimPrediction;
  error?: string;
}

export interface RecordOutcomeRequest {
  description: string;
  evidenceType?: EvidenceType;
  evidenceUrl?: string;
  observedAt?: string; // ISO date string
}

export interface RecordOutcomeResponse {
  ok: boolean;
  outcome?: PredictionOutcome;
  error?: string;
}

export interface GetPredictionsResponse {
  ok: boolean;
  predictions?: ClaimPrediction[];
  total?: number;
  error?: string;
}

export interface GetUserStatsResponse {
  ok: boolean;
  stats?: UserPredictionStats;
  error?: string;
}
