/**
 * Type Definitions for Deliberation Forking
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * Enables scholars to fork deliberations to explore alternative
 * assumptions, then merge insights back with full provenance.
 */

// ─────────────────────────────────────────────────────────
// Fork Types
// ─────────────────────────────────────────────────────────

export type ForkType =
  | "ASSUMPTION_VARIANT"   // Testing different assumptions
  | "METHODOLOGICAL"       // Different analytical approach
  | "SCOPE_EXTENSION"      // Extending to new domain
  | "ADVERSARIAL"          // Devil's advocate exploration
  | "EDUCATIONAL"          // Teaching/learning fork
  | "ARCHIVAL";            // Preserving a branch

export const FORK_TYPE_LABELS: Record<ForkType, string> = {
  ASSUMPTION_VARIANT: "Assumption Variant",
  METHODOLOGICAL: "Methodological",
  SCOPE_EXTENSION: "Scope Extension",
  ADVERSARIAL: "Adversarial",
  EDUCATIONAL: "Educational",
  ARCHIVAL: "Archival",
};

export const FORK_TYPE_DESCRIPTIONS: Record<ForkType, string> = {
  ASSUMPTION_VARIANT: "Explore what happens under different assumptions",
  METHODOLOGICAL: "Apply a different analytical approach or methodology",
  SCOPE_EXTENSION: "Extend the deliberation to a new domain or context",
  ADVERSARIAL: "Create a devil's advocate exploration of the topic",
  EDUCATIONAL: "Fork for teaching or learning purposes",
  ARCHIVAL: "Preserve a branch of the deliberation for reference",
};

// ─────────────────────────────────────────────────────────
// Sync Status
// ─────────────────────────────────────────────────────────

export type SyncStatus =
  | "SYNCED"              // Matches original
  | "DIVERGED"            // Local modifications made
  | "ORIGINAL_UPDATED"    // Original changed, needs review
  | "DETACHED";           // No longer tracking original

// ─────────────────────────────────────────────────────────
// Fork Options
// ─────────────────────────────────────────────────────────

export interface ForkOptions {
  parentDeliberationId: string;
  forkReason: string;
  forkType: ForkType;
  title: string;
  description?: string;
  
  // What to import
  importAllClaims?: boolean;
  claimIdsToImport?: string[];
  importAllArguments?: boolean;
  argumentIdsToImport?: string[];
  
  // Fork from specific release (optional)
  fromReleaseId?: string;
  
  // Visibility (inherits from parent if not specified)
  visibility?: "public" | "private" | "organization";
  organizationId?: string;
}

export interface ForkResult {
  id: string;
  title: string;
  forkReason: string;
  forkType: ForkType;
  parentId: string;
  parentTitle: string;
  forkedFromVersion?: string;
  importedClaimsCount: number;
  importedArgumentsCount: number;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// Fork Summary
// ─────────────────────────────────────────────────────────

export interface ForkSummary {
  id: string;
  title: string;
  forkReason: string;
  forkType: ForkType;
  forkedAt: Date;
  forkedBy: {
    id: string;
    name: string;
    image?: string;
  };
  parentTitle: string;
  parentId: string;
  forkedFromVersion?: string;
  claimCount: number;
  argumentCount: number;
  importedClaimCount: number;
  divergedClaimCount: number;
  hasMergeRequest: boolean;
  latestVersion?: string;
}

export interface ForkTreeNode {
  id: string;
  title: string;
  forkReason?: string;
  forkType?: ForkType;
  depth: number;
  children: ForkTreeNode[];
  claimCount: number;
  argumentCount: number;
  forkedAt?: Date;
  latestVersion?: string;
}

// ─────────────────────────────────────────────────────────
// Imported Content
// ─────────────────────────────────────────────────────────

export interface ImportedClaimInfo {
  id: string;
  originalClaimId: string;
  localClaimId: string;
  originalText: string;
  localText: string;
  syncStatus: SyncStatus;
  importedAt: Date;
  importedBy: {
    id: string;
    name: string;
  };
  hasLocalChanges: boolean;
  originalUpdated: boolean;
}

export interface ImportedArgumentInfo {
  id: string;
  originalArgumentId: string;
  localArgumentId: string;
  syncStatus: SyncStatus;
  importedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Merge Types
// ─────────────────────────────────────────────────────────

export type MergeStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "APPROVED"
  | "MERGED"
  | "CLOSED"
  | "CONFLICT";

export type MergeStrategy =
  | "ADD_NEW"        // Add as new claim
  | "REPLACE"        // Replace existing claim
  | "LINK_SUPPORT"   // Add as supporting claim
  | "LINK_CHALLENGE" // Add as challenging claim
  | "SKIP";          // Don't merge

export interface MergeOptions {
  sourceDeliberationId: string;
  targetDeliberationId: string;
  title: string;
  description?: string;
  
  // What to merge
  claimsToMerge: MergeClaimSelection[];
  argumentsToMerge: MergeArgumentSelection[];
}

export interface MergeClaimSelection {
  claimId: string;
  strategy: MergeStrategy;
  targetClaimId?: string;  // For REPLACE or LINK strategies
}

export interface MergeArgumentSelection {
  argumentId: string;
  includeWithClaims: boolean;  // Auto-include if premise claims are merged
}

// ─────────────────────────────────────────────────────────
// Merge Conflict & Analysis
// ─────────────────────────────────────────────────────────

export type MergeConflictType =
  | "CLAIM_EXISTS"        // Claim already exists in target
  | "ARGUMENT_ORPHAN"     // Argument without valid premises
  | "CIRCULAR_REFERENCE"  // Would create circular reference
  | "DELETED_IN_TARGET";  // Original was deleted in target

export interface MergeConflict {
  type: MergeConflictType;
  sourceId: string;
  targetId?: string;
  description: string;
  suggestedResolution: MergeStrategy;
}

export interface MergeAnalysis {
  canMerge: boolean;
  conflicts: MergeConflict[];
  newClaims: number;
  newArguments: number;
  updatedClaims: number;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────
// Merge Request
// ─────────────────────────────────────────────────────────

export interface MergeRequestSummary {
  id: string;
  title: string;
  description?: string;
  status: MergeStatus;
  
  sourceDeliberation: {
    id: string;
    title: string;
  };
  targetDeliberation: {
    id: string;
    title: string;
  };
  
  author: {
    id: string;
    name: string;
    image?: string;
  };
  
  claimsToMergeCount: number;
  argumentsToMergeCount: number;
  
  commentCount: number;
  
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
}

export interface MergeRequestDetail extends MergeRequestSummary {
  claimsToMerge: MergeClaimSelection[];
  argumentsToMerge: MergeArgumentSelection[];
  comments: MergeCommentInfo[];
  analysis: MergeAnalysis;
}

export interface MergeCommentInfo {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    image?: string;
  };
  targetClaimId?: string;
  targetArgumentId?: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// Provenance
// ─────────────────────────────────────────────────────────

export interface ClaimProvenance {
  claimId: string;
  originDeliberationId: string;
  originDeliberationTitle: string;
  originVersion?: string;
  importChain: ProvenanceStep[];
}

export interface ProvenanceStep {
  deliberationId: string;
  deliberationTitle: string;
  action: "CREATED" | "IMPORTED" | "MODIFIED" | "MERGED";
  at: Date;
  by: {
    id: string;
    name: string;
  };
}
