/**
 * Types for reputation and contribution system
 * Phase 4.2: Argumentation-Based Reputation
 */

export type ContributionType =
  | "ARGUMENT_CREATED"
  | "ATTACK_INITIATED"
  | "DEFENSE_PROVIDED"
  | "SUPPORT_GIVEN"
  | "EVIDENCE_ADDED"
  | "REVIEW_COMPLETED"
  | "COMMITMENT_MADE"
  | "BLOCKING_CONCERN_RAISED"
  | "CONCESSION_MADE"
  | "REVISION_COMPLETED"
  | "CLARIFICATION_PROVIDED"
  | "CONSENSUS_ACHIEVED"
  | "CHALLENGE_RESOLVED"
  | "CITATION_RECEIVED";

export type ExpertiseLevel =
  | "NOVICE"
  | "CONTRIBUTOR"
  | "ESTABLISHED"
  | "EXPERT"
  | "AUTHORITY";

export interface ContributionDetails {
  // Context IDs
  deliberationId?: string;
  argumentId?: string;
  reviewId?: string;
  claimId?: string;

  // Type-specific data
  targetUserId?: string;      // For attack/defense - user being targeted
  outcomeSuccess?: boolean;   // For attacks/defenses - was it successful?
  consensusLevel?: number;    // For consensus achievements (0-1)
  citationCount?: number;     // For citation events
}

export interface ScholarStatsSummary {
  userId: string;
  userName: string;

  // Core metrics
  totalArguments: number;
  argumentsWithConsensus: number;
  consensusRate: number;

  // Combat metrics
  totalAttacks: number;
  successfulAttacks: number;
  attackPrecision: number;

  totalDefenses: number;
  successfulDefenses: number;
  defenseSuccessRate: number;

  // Review metrics
  reviewsCompleted: number;
  reviewQuality: number;

  // Impact
  citationCount: number;
  downstreamUsage: number;

  // Overall
  reputationScore: number;
}

export interface ExpertiseAreaSummary {
  topicArea: string;
  contributionCount: number;
  expertiseScore: number;
  expertiseLevel: ExpertiseLevel;
}

export interface ReviewerProfileSummary {
  userId: string;
  totalReviews: number;
  completedOnTime: number;
  onTimeRate: number;
  averageCommitments: number;
  blockingConcernRate: number;
  concernResolutionRate: number;
  averageResponseDays: number;
  topSpecialties: Array<{
    topicArea: string;
    reviewCount: number;
  }>;
}

export interface ContributionEvent {
  type: ContributionType;
  userId: string;
  details: ContributionDetails;
  timestamp?: Date;
}

// Weights for different contribution types
export const CONTRIBUTION_WEIGHTS: Record<ContributionType, number> = {
  ARGUMENT_CREATED: 2.0,
  ATTACK_INITIATED: 1.5,
  DEFENSE_PROVIDED: 1.5,
  SUPPORT_GIVEN: 1.0,
  EVIDENCE_ADDED: 1.5,
  REVIEW_COMPLETED: 3.0,
  COMMITMENT_MADE: 0.5,
  BLOCKING_CONCERN_RAISED: 1.0,
  CONCESSION_MADE: 0.5,
  REVISION_COMPLETED: 2.0,
  CLARIFICATION_PROVIDED: 0.5,
  CONSENSUS_ACHIEVED: 3.0,
  CHALLENGE_RESOLVED: 2.5,
  CITATION_RECEIVED: 2.0,
};

/**
 * Expertise level thresholds and display info
 */
export const EXPERTISE_LEVEL_INFO: Record<
  ExpertiseLevel,
  { minContributions: number; label: string; color: string }
> = {
  NOVICE: { minContributions: 0, label: "Novice", color: "gray" },
  CONTRIBUTOR: { minContributions: 5, label: "Contributor", color: "blue" },
  ESTABLISHED: { minContributions: 20, label: "Established", color: "green" },
  EXPERT: { minContributions: 50, label: "Expert", color: "purple" },
  AUTHORITY: { minContributions: 100, label: "Authority", color: "gold" },
};

/**
 * Threshold counts for determining expertise level
 */
export const EXPERTISE_THRESHOLDS = {
  CONTRIBUTOR: 5,
  ESTABLISHED: 20,
  EXPERT: 50,
  AUTHORITY: 100,
} as const;
