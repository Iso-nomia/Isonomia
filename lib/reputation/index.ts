/**
 * Phase 4.2: Argumentation-Based Reputation System
 * 
 * This module provides services for tracking scholar contributions,
 * calculating reputation scores, and managing expertise areas.
 */

// Types
export type {
  ContributionType,
  ExpertiseLevel,
  ContributionDetails,
  ScholarStatsSummary,
  ExpertiseAreaSummary,
  ReviewerProfileSummary,
  ContributionEvent,
} from "./types";

export {
  CONTRIBUTION_WEIGHTS,
  EXPERTISE_LEVEL_INFO,
  EXPERTISE_THRESHOLDS,
} from "./types";

// Contribution Service
export {
  recordContribution,
  recordContributions,
  getUserContributions,
  getContributionSummary,
  getRecentContributions,
  updateContributionOutcome,
} from "./contributionService";

// Stats Service
export {
  recalculateScholarStats,
  getScholarStats,
  getOrCalculateScholarStats,
  getReputationLeaderboard,
  getDeliberationContributors,
  bulkRecalculateStats,
} from "./statsService";

// Expertise Service
export {
  trackExpertise,
  getUserExpertise,
  getTopicExperts,
  getAllTopicAreas,
  getTopicExpertiseSummary,
  getExpertiseLevelInfo,
} from "./expertiseService";

// Reviewer Profile Service
export {
  updateReviewerProfile,
  updateConcernResolution,
  trackInvitationResponse,
  getReviewerProfile,
  getTopReviewers,
  getReviewerStatsSummary,
} from "./reviewerProfileService";

// React Query Hooks (client-side only)
// Import directly from "./hooks" in client components
