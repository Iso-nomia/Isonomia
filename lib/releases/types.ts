/**
 * Type Definitions for Debate Releases
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * Defines types for snapshots, changelogs, and version management.
 */

import { AcademicClaimType } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Claim Snapshot Types
// ─────────────────────────────────────────────────────────

export interface ClaimSnapshot {
  claims: ClaimSnapshotItem[];
  stats: ClaimStats;
  generatedAt: string; // ISO date
}

export interface ClaimSnapshotItem {
  id: string;
  text: string;
  claimType: string | null;
  academicClaimType: AcademicClaimType | null;
  status: ClaimStatus;
  sourceId: string | null;
  sourceTitle: string | null;
  createdById: string;
  createdByName: string;
  attackCount: number;
  supportCount: number;
  createdAt: string;
}

export type ClaimStatus =
  | "DEFENDED"     // Has support, attacks defeated
  | "CONTESTED"    // Under active attack
  | "UNRESOLVED"   // No clear status
  | "WITHDRAWN"    // Author withdrew
  | "ACCEPTED";    // Consensus accepted

export interface ClaimStats {
  total: number;
  defended: number;
  contested: number;
  unresolved: number;
  withdrawn: number;
  accepted: number;
}

// ─────────────────────────────────────────────────────────
// Argument Snapshot Types
// ─────────────────────────────────────────────────────────

export interface ArgumentSnapshot {
  arguments: ArgumentSnapshotItem[];
  attackGraph: AttackGraphSnapshot;
  stats: ArgumentStats;
  generatedAt: string;
}

export interface ArgumentSnapshotItem {
  id: string;
  text: string;
  type: string; // ArgumentType or scheme
  premises: PremiseSnapshot[];
  conclusionId: string | null;
  conclusionText: string | null;
  schemeId: string | null;
  schemeName: string | null;
  acceptable: boolean; // ASPIC+ acceptability
  attackedByIds: string[]; // Argument IDs that attack this
  attacksIds: string[]; // Argument IDs this attacks
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface PremiseSnapshot {
  claimId: string;
  claimText: string;
  order: number;
}

export interface AttackGraphSnapshot {
  nodes: AttackGraphNode[];
  edges: AttackGraphEdge[];
}

export interface AttackGraphNode {
  id: string;
  type: "claim" | "argument";
  label?: string;
}

export interface AttackGraphEdge {
  from: string;
  to: string;
  type: "attack" | "support" | "undercut";
}

export interface ArgumentStats {
  total: number;
  acceptable: number;
  defeated: number;
  attackEdges: number;
  supportEdges: number;
}

// ─────────────────────────────────────────────────────────
// Stats Snapshot
// ─────────────────────────────────────────────────────────

export interface StatsSnapshot {
  claims: ClaimStats;
  arguments: ArgumentStats;
  participants: number;
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────
// Changelog Types
// ─────────────────────────────────────────────────────────

export interface Changelog {
  fromVersion: string;
  toVersion: string;
  generatedAt: string;

  claims: {
    added: ChangelogClaim[];
    removed: ChangelogClaim[];
    statusChanged: ChangelogStatusChange[];
    modified: ChangelogModification[];
  };

  arguments: {
    added: ChangelogArgument[];
    removed: ChangelogArgument[];
    acceptabilityChanged: ChangelogAcceptabilityChange[];
  };

  summary: ChangelogSummary;
}

export interface ChangelogClaim {
  id: string;
  text: string;
  type: string | null;
  status: ClaimStatus;
}

export interface ChangelogStatusChange {
  claimId: string;
  claimText: string;
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
}

export interface ChangelogModification {
  claimId: string;
  claimText: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ChangelogArgument {
  id: string;
  type: string;
  conclusionText: string;
}

export interface ChangelogAcceptabilityChange {
  argumentId: string;
  conclusionText: string;
  fromAcceptable: boolean;
  toAcceptable: boolean;
}

export interface ChangelogSummary {
  claimsAdded: number;
  claimsRemoved: number;
  statusChanges: number;
  argumentsAdded: number;
  argumentsRemoved: number;
  netDefended: number; // Change in defended count
}

// ─────────────────────────────────────────────────────────
// Semantic Version Types & Utilities
// ─────────────────────────────────────────────────────────

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Parse a version string into components
 * Supports "1.0.0" and "v1.0.0" formats
 */
export function parseVersion(version: string): SemanticVersion {
  const normalized = version.startsWith("v") ? version.slice(1) : version;
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)$/);
  
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected "X.Y.Z" or "vX.Y.Z"`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    raw: version,
  };
}

/**
 * Format a version object as a string
 */
export function formatVersion(v: SemanticVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Increment a version by type
 */
export function incrementVersion(
  current: SemanticVersion,
  type: "major" | "minor" | "patch"
): SemanticVersion {
  const newVersion = { ...current };
  
  switch (type) {
    case "major":
      newVersion.major += 1;
      newVersion.minor = 0;
      newVersion.patch = 0;
      break;
    case "minor":
      newVersion.minor += 1;
      newVersion.patch = 0;
      break;
    case "patch":
      newVersion.patch += 1;
      break;
  }
  
  newVersion.raw = formatVersion(newVersion);
  return newVersion;
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Check if this is a major version bump
 */
export function isMajorChange(from: SemanticVersion, to: SemanticVersion): boolean {
  return to.major > from.major;
}

/**
 * Get version increment type between two versions
 */
export function getVersionBumpType(
  from: SemanticVersion,
  to: SemanticVersion
): "major" | "minor" | "patch" | null {
  if (to.major > from.major) return "major";
  if (to.minor > from.minor) return "minor";
  if (to.patch > from.patch) return "patch";
  return null;
}

// ─────────────────────────────────────────────────────────
// Release Input/Output Types
// ─────────────────────────────────────────────────────────

export interface CreateReleaseInput {
  deliberationId: string;
  title: string;
  summary?: string;
  releaseNotes?: string;
  versionType?: "major" | "minor" | "patch";
  customVersion?: string;
  releasedById: string;
}

export interface ReleaseWithRelations {
  id: string;
  deliberationId: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  title: string;
  summary: string | null;
  releaseNotes: string | null;
  claimSnapshot: ClaimSnapshot;
  argumentSnapshot: ArgumentSnapshot;
  statsSnapshot: StatsSnapshot;
  changelogFromPrevious: Changelog | null;
  changelogText: string | null;
  previousReleaseId: string | null;
  citationUri: string | null;
  doi: string | null;
  bibtex: string | null;
  releasedById: string;
  releasedAt: Date;
  isLatest: boolean;
}
