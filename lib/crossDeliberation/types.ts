/**
 * Phase 3.3: Cross-Deliberation Claim Mapping
 * Type definitions for canonical claim registry, cross-room search, and argument transport
 */

// ─────────────────────────────────────────────────────────
// Enums (matching Prisma schema)
// ─────────────────────────────────────────────────────────

export type EquivalenceType =
  | "SEMANTIC"
  | "TERMINOLOGICAL"
  | "SUBSET"
  | "SUPERSET"
  | "CONTRAPOSITIVE"
  | "REFORMULATION";

export type ImportType =
  | "FULL"
  | "PREMISES_ONLY"
  | "SKELETON"
  | "REFERENCE";

// Re-export from provenance types for convenience
export type { ConsensusStatus, ClaimInstanceType } from "@/lib/provenance/types";

// ─────────────────────────────────────────────────────────
// Canonical Claim Types
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimSummary {
  id: string;
  slug: string;
  title: string;
  representativeText?: string;
  globalStatus: string;
  totalInstances: number;
  totalChallenges: number;
  primaryField?: string;
  instances: ClaimInstanceSummary[];
}

export interface ClaimInstanceSummary {
  id: string;
  claimId: string;
  claimText: string;
  deliberation: {
    id: string;
    title: string;
  };
  instanceType: string;
  localStatus?: string;
  variationNotes?: string;
}

// ─────────────────────────────────────────────────────────
// Claim Equivalence Types
// ─────────────────────────────────────────────────────────

export interface ClaimEquivalenceSummary {
  id: string;
  equivalenceType: EquivalenceType;
  confidence: number;
  isVerified: boolean;
  notes?: string;
  claim: {
    id: string;
    slug: string;
    representativeText?: string;
    globalStatus: string;
  };
}

// ─────────────────────────────────────────────────────────
// Cross-Room Search Types
// ─────────────────────────────────────────────────────────

export interface CrossRoomSearchResult {
  canonicalClaim: CanonicalClaimSummary;
  instances: Array<{
    deliberation: {
      id: string;
      title: string;
    };
    claim: {
      id: string;
      text: string;
      status: string;
    };
    challengeCount: number;
    supportCount: number;
  }>;
  matchScore: number;
  matchReason: string;
}

export interface CrossRoomSearchParams {
  query: string;
  excludeDeliberationId?: string;
  fields?: string[];
  globalStatus?: string;
  minInstances?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────
// Argument Import Types
// ─────────────────────────────────────────────────────────

export interface ArgumentImportInput {
  sourceArgumentId: string;
  targetDeliberationId: string;
  importType: ImportType;
  importReason?: string;
  preserveAttribution?: boolean;
  modifications?: {
    newConclusion?: string;
    excludePremises?: string[];
    addPremises?: string[];
  };
}

export interface ArgumentImportResult {
  importedArgumentId: string;
  sourceArgumentId: string;
  importRecord: {
    id: string;
    importType: ImportType;
    wasModified: boolean;
  };
  linkedClaims: string[];
}

// ─────────────────────────────────────────────────────────
// Canonical Claim Search Params
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimSearchParams {
  query?: string;
  field?: string;
  globalStatus?: string;
  minInstances?: number;
  excludeDeliberationId?: string;
}

// ─────────────────────────────────────────────────────────
// Related Deliberation Types
// ─────────────────────────────────────────────────────────

export interface RelatedDeliberation {
  deliberation: {
    id: string;
    title: string;
  };
  sharedClaimCount: number;
  sharedClaims?: Array<{ id: string; text: string }>;
  relationshipStrength?: number;
}

export interface ClaimCrossRoomStatus {
  claimId: string;
  isCanonical: boolean;
  canonicalId?: string;
  globalStatus?: string;
  totalInstances: number;
  statusBreakdown?: Record<string, number>;
  totalChallenges?: number;
  otherDeliberations: Array<{
    id: string;
    title: string;
  }>;
  instances?: Array<{
    deliberationId: string;
    deliberationTitle: string;
    claimId: string;
    localStatus: string;
    challengeCount: number;
  }>;
}
