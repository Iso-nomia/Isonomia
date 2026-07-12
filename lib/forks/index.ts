/**
 * Fork Module - Barrel Exports
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type {
  // Fork types
  ForkType,
  SyncStatus,
  ForkOptions,
  ForkResult,
  ForkSummary,
  ForkTreeNode,
  
  // Imported content
  ImportedClaimInfo,
  ImportedArgumentInfo,
  
  // Merge types
  MergeStatus,
  MergeStrategy,
  MergeOptions,
  MergeClaimSelection,
  MergeArgumentSelection,
  MergeConflictType,
  MergeConflict,
  MergeAnalysis,
  MergeRequestSummary,
  MergeRequestDetail,
  MergeCommentInfo,
  
  // Provenance
  ClaimProvenance,
  ProvenanceStep,
} from "./types";

export {
  FORK_TYPE_LABELS,
  FORK_TYPE_DESCRIPTIONS,
} from "./types";

// ─────────────────────────────────────────────────────────
// Fork Service
// ─────────────────────────────────────────────────────────

export {
  createFork,
  listForks,
  getForkTree,
  getImportedClaims,
  markClaimDiverged,
  detachImportedClaim,
  resyncImportedClaim,
} from "./forkService";

// ─────────────────────────────────────────────────────────
// Merge Service
// ─────────────────────────────────────────────────────────

export {
  createMergeRequest,
  listMergeRequests,
  getMergeRequest,
  updateMergeRequestStatus,
  analyzeMerge,
  executeMerge,
  addMergeComment,
} from "./mergeService";
