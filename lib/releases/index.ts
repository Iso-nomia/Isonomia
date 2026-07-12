/**
 * Releases Module - Barrel Exports
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * Public API for the release management system.
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type {
  // Claim Snapshots
  ClaimSnapshot,
  ClaimSnapshotItem,
  ClaimStatus,
  ClaimStats,
  
  // Argument Snapshots
  ArgumentSnapshot,
  ArgumentSnapshotItem,
  PremiseSnapshot,
  AttackGraphSnapshot,
  AttackGraphNode,
  AttackGraphEdge,
  ArgumentStats,
  
  // Stats
  StatsSnapshot,
  
  // Changelog
  Changelog,
  ChangelogClaim,
  ChangelogStatusChange,
  ChangelogModification,
  ChangelogArgument,
  ChangelogAcceptabilityChange,
  ChangelogSummary,
  
  // Versioning
  SemanticVersion,
} from "./types";

// ─────────────────────────────────────────────────────────
// Version Utilities
// ─────────────────────────────────────────────────────────

export {
  parseVersion,
  formatVersion,
  incrementVersion,
  compareVersions,
} from "./types";

// ─────────────────────────────────────────────────────────
// Snapshot Service
// ─────────────────────────────────────────────────────────

export {
  generateClaimSnapshot,
  generateArgumentSnapshot,
  generateStatsSnapshot,
  calculateClaimStatuses,
  calculateArgumentAcceptability,
  buildAttackGraph,
} from "./snapshotService";

// ─────────────────────────────────────────────────────────
// Changelog Service
// ─────────────────────────────────────────────────────────

export {
  generateChangelog,
  formatChangelogText,
  generateChangelogOneLiner,
  isStatusImprovement,
} from "./changelogService";

// ─────────────────────────────────────────────────────────
// Release Service (Main CRUD)
// ─────────────────────────────────────────────────────────

export type {
  CreateReleaseInput,
  ReleaseOutput,
  ReleaseListItem,
  CompareReleasesOutput,
} from "./releaseService";

export {
  createRelease,
  listReleases,
  getRelease,
  getLatestRelease,
  compareReleases,
} from "./releaseService";
