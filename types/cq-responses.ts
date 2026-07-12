// types/cq-responses.ts
// TypeScript types for the CQ Multi-Layer Response System

/**
 * Status enum for CQ progression
 */
export enum CQStatusEnum {
  OPEN = "OPEN",                           // No responses yet
  PENDING_REVIEW = "PENDING_REVIEW",       // Has responses awaiting approval
  PARTIALLY_SATISFIED = "PARTIALLY_SATISFIED", // Some responses approved, but incomplete
  SATISFIED = "SATISFIED",                 // Author accepted canonical response
  DISPUTED = "DISPUTED",                   // Conflicting responses or new challenges
}

/**
 * Status enum for individual CQ responses
 */
export enum ResponseStatus {
  PENDING = "PENDING",         // Awaiting review
  APPROVED = "APPROVED",       // Accepted by author/moderator
  CANONICAL = "CANONICAL",     // Selected as THE official answer
  REJECTED = "REJECTED",       // Not accepted
  SUPERSEDED = "SUPERSEDED",   // Was canonical, but replaced
  WITHDRAWN = "WITHDRAWN",     // Contributor removed it
}

/**
 * Action types for CQ activity logging
 */
export enum CQAction {
  RESPONSE_SUBMITTED = "RESPONSE_SUBMITTED",
  RESPONSE_APPROVED = "RESPONSE_APPROVED",
  RESPONSE_REJECTED = "RESPONSE_REJECTED",
  RESPONSE_WITHDRAWN = "RESPONSE_WITHDRAWN",
  STATUS_CHANGED = "STATUS_CHANGED",
  CANONICAL_SELECTED = "CANONICAL_SELECTED",
  ENDORSEMENT_ADDED = "ENDORSEMENT_ADDED",
  CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED",
}

/**
 * Frontend-friendly CQ response with nested data
 */
export interface CQResponseWithDetails {
  id: string;
  cqStatusId: string;
  groundsText: string;
  evidenceClaimIds: string[];
  sourceUrls: string[];
  responseStatus: ResponseStatus;
  contributorId: string;
  contributor?: {
    id: string;
    name: string;
    image?: string | null;
    reputation?: number;
  };
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  upvotes: number;
  downvotes: number;
  endorsements?: CQEndorsementWithUser[];
  canonicalMoveId?: string | null;
  executedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Endorsement with user details
 */
export interface CQEndorsementWithUser {
  id: string;
  responseId: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    image?: string | null;
  };
  weight: number;
  comment?: string | null;
  createdAt: Date;
}

/**
 * CQ Status with full response data
 */
export interface CQStatusWithResponses {
  id: string;
  targetType: "claim" | "argument";
  targetId: string;
  schemeKey: string;
  cqKey: string;
  statusEnum: CQStatusEnum;
  satisfied: boolean; // Legacy field
  canonicalResponseId?: string | null;
  canonicalResponse?: CQResponseWithDetails | null;
  responses: CQResponseWithDetails[];
  lastReviewedAt?: Date | null;
  lastReviewedBy?: string | null;
  createdById: string;
  roomId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed fields
  pendingCount?: number;
  approvedCount?: number;
}

/**
 * Activity log entry
 */
export interface CQActivityLogEntry {
  id: string;
  cqStatusId: string;
  action: CQAction;
  actorId: string;
  actor?: {
    id: string;
    name: string;
    image?: string | null;
  };
  responseId?: string | null;
  response?: CQResponseWithDetails | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Request body for submitting a CQ response
 */
export interface SubmitCQResponseRequest {
  cqStatusId: string;
  groundsText: string;
  evidenceClaimIds?: string[];
  sourceUrls?: string[];
  deliberationId?: string;
}

/**
 * Request body for approving a CQ response
 */
export interface ApproveCQResponseRequest {
  setAsCanonical?: boolean;
  reviewNotes?: string;
}

/**
 * Request body for rejecting a CQ response
 */
export interface RejectCQResponseRequest {
  reason: string;
}

/**
 * Request body for voting on a response
 */
export interface VoteCQResponseRequest {
  value: 1 | -1; // upvote or downvote
}

/**
 * Request body for endorsing a response
 */
export interface EndorseCQResponseRequest {
  comment?: string;
  weight?: number;
}

/**
 * Request body for setting canonical response
 */
export interface SetCanonicalResponseRequest {
  cqStatusId: string;
  responseId: string;
}

/**
 * API response for CQ list with responses
 */
export interface CQsWithResponsesResponse {
  schemes: Array<{
    key: string;
    title: string;
    cqs: CQStatusWithResponses[];
  }>;
}

/**
 * Permission check result
 */
export interface CQPermissions {
  canViewCQ: boolean;
  canViewPendingResponses: boolean;
  canSubmitResponse: boolean;
  canEditResponse: boolean;
  canWithdrawResponse: boolean;
  canVoteOnResponse: boolean;
  canEndorseResponse: boolean;
  canApproveResponse: boolean;
  canRejectResponse: boolean;
  canSetCanonical: boolean;
  canRequestClarification: boolean;
}

/**
 * Helper to check if user is claim author
 */
export function isClaimAuthor(userId: string, claimAuthorId: string): boolean {
  return userId === claimAuthorId;
}

/**
 * Helper to check if user is response contributor
 */
export function isResponseContributor(userId: string, contributorId: string): boolean {
  return userId === contributorId;
}

/**
 * Helper to get display status for CQ
 */
export function getCQStatusDisplay(status: CQStatusEnum): {
  label: string;
  emoji: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case CQStatusEnum.OPEN:
      return { label: "Open", emoji: "🔓", variant: "outline" };
    case CQStatusEnum.PENDING_REVIEW:
      return { label: "Under Review", emoji: "⏳", variant: "secondary" };
    case CQStatusEnum.PARTIALLY_SATISFIED:
      return { label: "Partially Satisfied", emoji: "⚡", variant: "default" };
    case CQStatusEnum.SATISFIED:
      return { label: "Satisfied", emoji: "✅", variant: "default" };
    case CQStatusEnum.DISPUTED:
      return { label: "Disputed", emoji: "⚠️", variant: "destructive" };
  }
}

/**
 * Helper to get display status for response
 */
export function getResponseStatusDisplay(status: ResponseStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case ResponseStatus.PENDING:
      return { label: "Pending", variant: "secondary" };
    case ResponseStatus.APPROVED:
      return { label: "Approved", variant: "default" };
    case ResponseStatus.CANONICAL:
      return { label: "Canonical", variant: "default" };
    case ResponseStatus.REJECTED:
      return { label: "Rejected", variant: "destructive" };
    case ResponseStatus.SUPERSEDED:
      return { label: "Superseded", variant: "outline" };
    case ResponseStatus.WITHDRAWN:
      return { label: "Withdrawn", variant: "outline" };
  }
}
