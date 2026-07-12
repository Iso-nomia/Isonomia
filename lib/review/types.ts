/**
 * Phase 4.1: Types for Peer Review Deliberations
 *
 * This module defines all TypeScript types for the peer review system,
 * including review templates, phases, assignments, and commitments.
 */

// ============================================================
// ENUMS (matching Prisma enums)
// ============================================================

export type ReviewTargetType =
  | "PAPER"
  | "PREPRINT"
  | "THESIS"
  | "GRANT_PROPOSAL"
  | "OTHER";

export type ReviewStatus =
  | "INITIATED"
  | "IN_REVIEW"
  | "AUTHOR_RESPONSE"
  | "REVISION"
  | "FINAL_REVIEW"
  | "DECISION"
  | "COMPLETED"
  | "WITHDRAWN";

export type ReviewDecision =
  | "ACCEPT"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECT"
  | "DESK_REJECT";

export type ReviewPhaseType =
  | "INITIAL_REVIEW"
  | "AUTHOR_RESPONSE"
  | "REVISION"
  | "SECOND_REVIEW"
  | "FINAL_DECISION"
  | "CUSTOM";

export type PhaseStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "SKIPPED";

export type ReviewerRole =
  | "REVIEWER"
  | "SENIOR_REVIEWER"
  | "STATISTICAL_REVIEWER"
  | "ETHICS_REVIEWER"
  | "GUEST_EDITOR";

export type ReviewerStatus =
  | "INVITED"
  | "ACCEPTED"
  | "DECLINED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WITHDRAWN";

export type CommitmentPosition =
  | "STRONGLY_SUPPORT"
  | "SUPPORT"
  | "NEUTRAL"
  | "CONCERN"
  | "STRONGLY_OPPOSE";

export type CommitmentStrength =
  | "WEAK"
  | "MODERATE"
  | "STRONG"
  | "BLOCKING";

// ============================================================
// TEMPLATE CONFIGURATION TYPES
// ============================================================

/**
 * Configuration for a single review phase within a template
 */
export interface ReviewPhaseConfig {
  name: string;
  type: ReviewPhaseType;
  description?: string;
  defaultDurationDays?: number;
  requiredForCompletion?: boolean;
  allowedParticipants?: ("reviewers" | "authors" | "editors")[];
}

/**
 * Full configuration for a review template
 */
export interface ReviewTemplateConfig {
  phases: ReviewPhaseConfig[];
  defaultSettings?: {
    isBlinded?: boolean;
    isPublicReview?: boolean;
    minReviewers?: number;
    maxReviewers?: number;
  };
}

// ============================================================
// INPUT TYPES
// ============================================================

/**
 * Input for creating a new review deliberation
 */
export interface CreateReviewInput {
  targetType: ReviewTargetType;
  targetSourceId?: string;   // Optional link to existing Source
  targetUrl?: string;        // URL to the work being reviewed
  targetTitle: string;       // Title of the work
  templateId?: string;       // Template to use (defaults to standard peer review)
  isBlinded?: boolean;       // Enable blind review
  isPublicReview?: boolean;  // Make review publicly visible
  initialReviewers?: string[]; // Auth IDs of initial reviewers to invite
}

/**
 * Input for inviting a reviewer
 */
export interface InviteReviewerInput {
  reviewId: string;
  userId: string;           // Auth ID of user to invite
  role?: ReviewerRole;
  deadline?: Date;
}

/**
 * Input for responding to a reviewer invitation
 */
export interface RespondToInvitationInput {
  assignmentId: string;
  accept: boolean;
  declineReason?: string;
}

/**
 * Input for creating a reviewer commitment
 */
export interface CreateCommitmentInput {
  topic: string;
  description: string;
  position: CommitmentPosition;
  strength?: CommitmentStrength;
  argumentId?: string;       // Supporting argument
  targetClaimId?: string;    // Claim being evaluated
}

/**
 * Input for updating a commitment (creates new version)
 */
export interface UpdateCommitmentInput {
  commitmentId: string;
  position?: CommitmentPosition;
  strength?: CommitmentStrength;
  description?: string;
  resolutionNote?: string;
  isResolved?: boolean;
}

/**
 * Input for recording a phase outcome
 */
export interface RecordPhaseOutcomeInput {
  phaseId: string;
  summary: string;
  keyArgumentIds?: string[];
}

/**
 * Input for making a review decision
 */
export interface MakeDecisionInput {
  reviewId: string;
  decision: ReviewDecision;
  note: string;
}

// ============================================================
// SUMMARY/OUTPUT TYPES
// ============================================================

/**
 * Summary of a review deliberation for list views
 */
export interface ReviewDeliberationSummary {
  id: string;
  deliberationId: string;
  targetType: ReviewTargetType;
  targetTitle: string;
  targetSource?: {
    id: string;
    title: string;
    authors: string[];
  };
  status: ReviewStatus;
  decision?: ReviewDecision;
  currentPhase?: {
    id: string;
    name: string;
    type: ReviewPhaseType;
    status: PhaseStatus;
  };
  reviewerCount: number;
  editor?: { id: string; name: string };
  createdAt: Date;
}

/**
 * Full details of a review deliberation
 */
export interface ReviewDeliberationDetails extends ReviewDeliberationSummary {
  targetSourceId?: string;
  targetUrl?: string;
  templateId?: string;
  isBlinded: boolean;
  isPublicReview: boolean;
  authorUserIds: string[];
  phases: ReviewPhaseSummary[];
  reviewers: ReviewerAssignmentSummary[];
  decisionDate?: Date;
  decisionNote?: string;
  updatedAt: Date;
}

/**
 * Summary of a review phase
 */
export interface ReviewPhaseSummary {
  id: string;
  name: string;
  type: ReviewPhaseType;
  order: number;
  status: PhaseStatus;
  startDate?: Date;
  endDate?: Date;
  deadline?: Date;
  outcomeCount: number;
}

/**
 * Summary of a reviewer assignment
 */
export interface ReviewerAssignmentSummary {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  role: ReviewerRole;
  status: ReviewerStatus;
  assignedAt: Date;
  deadline?: Date;
  completedAt?: Date;
  commitmentCount: number;
  blockingConcerns: number;
}

/**
 * Summary of a reviewer commitment
 */
export interface ReviewerCommitmentSummary {
  id: string;
  topic: string;
  description: string;
  position: CommitmentPosition;
  strength: CommitmentStrength;
  isResolved: boolean;
  resolutionNote?: string;
  targetClaim?: {
    id: string;
    text: string;
  };
  argument?: {
    id: string;
    summary: string;
  };
  reviewer: {
    id: string;
    name: string;
  };
  previousCommitmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregated progress summary for a review
 */
export interface ReviewProgressSummary {
  status: ReviewStatus;
  phases: Array<{
    id: string;
    name: string;
    type: ReviewPhaseType;
    status: PhaseStatus;
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    isOverdue: boolean;
  }>;
  reviewerProgress: Array<{
    reviewerId: string;
    reviewerName: string;
    status: ReviewerStatus;
    commitmentsMade: number;
    blockingConcerns: number;
  }>;
  totals: {
    openConcerns: number;
    resolvedConcerns: number;
    blockingConcerns: number;
    totalCommitments: number;
  };
}

/**
 * Summary of a phase outcome
 */
export interface PhaseOutcomeSummary {
  id: string;
  phaseId: string;
  summary: string;
  keyArgumentIds: string[];
  recordedBy: {
    id: string;
    name: string;
  };
  recordedAt: Date;
}

// ============================================================
// UTILITY TYPES
// ============================================================

/**
 * Filter options for listing reviews
 */
export interface ReviewListFilters {
  status?: ReviewStatus | ReviewStatus[];
  targetType?: ReviewTargetType;
  editorId?: string;
  reviewerId?: string;
  authorUserId?: string;
  isPublicReview?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Sort options for listing reviews
 */
export interface ReviewListSort {
  field: "createdAt" | "updatedAt" | "status" | "targetTitle";
  direction: "asc" | "desc";
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================================
// DECISION LABELS (for UI display)
// ============================================================

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  ACCEPT: "Accept",
  MINOR_REVISION: "Minor Revisions Required",
  MAJOR_REVISION: "Major Revisions Required",
  REJECT: "Reject",
  DESK_REJECT: "Desk Reject",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  INITIATED: "Initiated",
  IN_REVIEW: "In Review",
  AUTHOR_RESPONSE: "Author Response",
  REVISION: "Revision",
  FINAL_REVIEW: "Final Review",
  DECISION: "Decision Pending",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
};

export const COMMITMENT_POSITION_LABELS: Record<CommitmentPosition, string> = {
  STRONGLY_SUPPORT: "Strongly Support",
  SUPPORT: "Support",
  NEUTRAL: "Neutral",
  CONCERN: "Concern",
  STRONGLY_OPPOSE: "Strongly Oppose",
};

export const COMMITMENT_STRENGTH_LABELS: Record<CommitmentStrength, string> = {
  WEAK: "Minor",
  MODERATE: "Moderate",
  STRONG: "Critical",
  BLOCKING: "Blocking",
};

export const REVIEWER_ROLE_LABELS: Record<ReviewerRole, string> = {
  REVIEWER: "Reviewer",
  SENIOR_REVIEWER: "Senior Reviewer",
  STATISTICAL_REVIEWER: "Statistical Reviewer",
  ETHICS_REVIEWER: "Ethics Reviewer",
  GUEST_EDITOR: "Guest Editor",
};

export const REVIEWER_STATUS_LABELS: Record<ReviewerStatus, string> = {
  INVITED: "Invited",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
};
