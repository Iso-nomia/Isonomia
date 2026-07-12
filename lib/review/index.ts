/**
 * Phase 4.1: Peer Review Module
 *
 * This module provides functionality for conducting transparent,
 * structured peer review deliberations on Mesh.
 *
 * @module lib/review
 */

// Export all types
export * from "./types";

// Export template service functions
export {
  // Built-in templates
  STANDARD_PEER_REVIEW_TEMPLATE,
  OPEN_REVIEW_TEMPLATE,
  DOUBLE_BLIND_REVIEW_TEMPLATE,
  PREPRINT_REVIEW_TEMPLATE,
  BUILT_IN_TEMPLATES,
  // Template CRUD
  createReviewTemplate,
  getTemplateById,
  getAvailableTemplates,
  getUserTemplates,
  updateTemplate,
  deleteTemplate,
  incrementTemplateUsage,
  // Template utilities
  parseTemplatePhases,
  parseTemplateSettings,
  validateTemplateConfig,
  getBuiltInTemplate,
  cloneTemplateConfig,
} from "./templateService";

// Export review service functions
export {
  // Review CRUD
  createReviewDeliberation,
  getReviewDeliberation,
  getReviewByDeliberationId,
  listUserReviews,
  // Status management
  updateReviewStatus,
  makeReviewDecision,
  advanceToNextPhase,
  skipPhase,
  // Progress tracking
  getReviewProgress,
  // Author management
  setReviewAuthors,
  // Withdrawal
  withdrawReview,
} from "./reviewService";

// Export assignment service functions
export {
  inviteReviewer,
  respondToInvitation,
  startReview,
  completeReview,
  withdrawFromReview,
  getReviewerAssignments,
  getUserAssignments,
  getPendingInvitations,
  getActiveReviews,
} from "./assignmentService";

// Export commitment service functions
export {
  createCommitment,
  updateCommitment,
  resolveCommitment,
  reopenCommitment,
  getReviewCommitments,
  getAssignmentCommitments,
  getCommitmentHistory,
  getBlockingConcernsSummary,
  getCommitmentStats,
} from "./commitmentService";

// Export author response service functions
export {
  createAuthorResponse,
  getAuthorResponses,
  getAuthorResponse,
  getResponseSummary,
  getUnaddressedCommitments,
  analyzeResponsePatterns,
  updateAuthorResponse,
  addResponseMove,
  deleteResponseMove,
  getMovesForCommitment,
  MOVE_TYPE_LABELS,
  MOVE_TYPE_DESCRIPTIONS,
} from "./authorResponseService";

// Export progress service functions
export {
  getReviewProgress as getFullReviewProgress,
  canAdvancePhase,
  getReviewTimeline,
  getReviewStats,
  getPhaseDurations,
  checkReviewHealth,
} from "./progressService";
