/**
 * Phase 3.1: Claim Provenance Tracking
 * Type definitions for claim lifecycle, versioning, and challenge tracking
 */

// ─────────────────────────────────────────────────────────
// Enums (matching Prisma schema)
// ─────────────────────────────────────────────────────────

export type VersionChangeType =
  | "CREATED"
  | "REFINED"
  | "STRENGTHENED"
  | "WEAKENED"
  | "CORRECTED"
  | "MERGED"
  | "SPLIT"
  | "IMPORTED";

export type ConsensusStatus =
  | "UNDETERMINED"
  | "EMERGING"
  | "ACCEPTED"
  | "CONTESTED"
  | "REJECTED"
  | "SUPERSEDED";

export type AttackType = "REBUTS" | "UNDERCUTS" | "UNDERMINES";

export type ClaimAttackStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "DEFENDED"
  | "PARTIALLY_DEFENDED"
  | "CONCEDED"
  | "WITHDRAWN"
  | "STALEMATE";

export type ClaimDefenseType =
  | "DIRECT_REBUTTAL"
  | "DISTINCTION"
  | "CONCESSION_LIMIT"
  | "EVIDENCE"
  | "AUTHORITY";

export type ClaimDefenseOutcome =
  | "SUCCESSFUL"
  | "PARTIAL"
  | "UNSUCCESSFUL"
  | "PENDING";

export type ClaimInstanceType =
  | "ORIGINAL"
  | "EQUIVALENT"
  | "IMPORTED"
  | "FORKED"
  | "DERIVED";

// ─────────────────────────────────────────────────────────
// Provenance Types
// ─────────────────────────────────────────────────────────

export interface ClaimOrigin {
  sourceId?: string;
  sourceTitle?: string;
  sourceAuthors?: string[];
  date?: Date;
  authorId?: string;
  authorName?: string;
}

export interface ClaimVersionSummary {
  id: string;
  versionNumber: number;
  text: string;
  changeType: VersionChangeType;
  changeReason?: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface ClaimProvenance {
  claimId: string;
  canonicalId?: string;
  deliberationId?: string;
  
  // Origin info
  origin: ClaimOrigin;
  
  // Version history
  versions: ClaimVersionSummary[];
  currentVersion: number;
  
  // Current consensus
  consensusStatus: ConsensusStatus;
  
  // Challenge summary
  challengeSummary: ChallengeSummary;
}

export interface ChallengeSummary {
  total: number;
  open: number;
  defended: number;
  conceded: number;
  stalemate: number;
  partiallyDefended: number;
  withdrawn: number;
}

// ─────────────────────────────────────────────────────────
// Version Creation Types
// ─────────────────────────────────────────────────────────

export interface CreateVersionOptions {
  claimId: string;
  text: string;
  claimType?: string;
  changeType: VersionChangeType;
  changeReason?: string;
}

export interface ClaimVersionWithAuthor {
  id: string;
  claimId: string;
  text: string;
  claimType: string | null;
  versionNumber: number;
  changeType: VersionChangeType;
  changeReason: string | null;
  changedFields: Record<string, boolean> | null;
  previousVersionId: string | null;
  releaseId: string | null;
  authorId: string;
  createdAt: Date;
  author?: {
    name: string | null;
  };
}

// ─────────────────────────────────────────────────────────
// Attack/Defense Types
// ─────────────────────────────────────────────────────────

export interface AttackSummary {
  id: string;
  attackType: AttackType;
  attackSubtype?: string;
  status: ClaimAttackStatus;
  argument: {
    id: string;
    text: string;
    authorId: string;
    authorName?: string;
  };
  defenseCount: number;
  createdAt: Date;
  createdById: string;
}

export interface DefenseSummary {
  id: string;
  attackId: string;
  defenseType: ClaimDefenseType;
  outcome?: ClaimDefenseOutcome;
  outcomeNote?: string;
  argument: {
    id: string;
    text: string;
    authorId: string;
    authorName?: string;
  };
  createdAt: Date;
  createdById: string;
}

export interface ChallengeReport {
  claim: {
    id: string;
    text: string;
    status: ConsensusStatus;
    deliberationId?: string;
  };
  
  challenges: {
    rebuttals: AttackSummary[];
    undercuts: AttackSummary[];
    undermines: AttackSummary[];
  };
  
  defenses: DefenseSummary[];
  
  resolutionStatus: "open" | "defended" | "conceded" | "stalemate" | "mixed";
  resolutionSummary: string;
}

export interface CreateAttackOptions {
  targetClaimId: string;
  attackingArgumentId: string;
  attackType: AttackType;
  attackSubtype?: string;
}

export interface CreateDefenseOptions {
  claimId: string;
  attackId: string;
  defendingArgumentId: string;
  defenseType: ClaimDefenseType;
}

export interface UpdateAttackStatusOptions {
  attackId: string;
  status: ClaimAttackStatus;
  resolutionNote?: string;
}

export interface UpdateDefenseOutcomeOptions {
  defenseId: string;
  outcome: ClaimDefenseOutcome;
  outcomeNote?: string;
}

// ─────────────────────────────────────────────────────────
// Timeline Types
// ─────────────────────────────────────────────────────────

export type TimelineEventType = 
  | "version"
  | "attack"
  | "defense"
  | "status_change"
  | "imported"
  | "forked";

export interface ClaimTimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  actor: {
    id: string;
    name: string;
  };
  description: string;
  details: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────
// Canonical Claim Types (Cross-Deliberation Identity)
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimSummary {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  representativeText?: string;
  totalInstances: number;
  totalChallenges: number;
  globalStatus: ConsensusStatus;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface ClaimInstanceSummary {
  id: string;
  claimId: string;
  claimText: string;
  deliberationId: string;
  deliberationTitle?: string;
  instanceType: ClaimInstanceType;
  localStatus: ConsensusStatus;
  linkedAt: Date;
  linkedById: string;
}

export interface CanonicalClaimWithInstances extends CanonicalClaimSummary {
  instances: ClaimInstanceSummary[];
}

export interface LinkClaimToCanonicalOptions {
  claimId: string;
  canonicalClaimId: string;
  deliberationId: string;
  instanceType: ClaimInstanceType;
}

export interface CreateCanonicalClaimOptions {
  slug: string;
  title: string;
  summary?: string;
  representativeText?: string;
  semanticHash?: string;
}

// ─────────────────────────────────────────────────────────
// Search/Filter Types
// ─────────────────────────────────────────────────────────

export interface ClaimProvenanceFilters {
  consensusStatus?: ConsensusStatus | ConsensusStatus[];
  hasOpenChallenges?: boolean;
  minVersions?: number;
  hasCanonicalId?: boolean;
  deliberationId?: string;
}

export interface AttackFilters {
  targetClaimId?: string;
  status?: ClaimAttackStatus | ClaimAttackStatus[];
  attackType?: AttackType | AttackType[];
  createdById?: string;
}

export interface DefenseFilters {
  claimId?: string;
  attackId?: string;
  outcome?: ClaimDefenseOutcome | ClaimDefenseOutcome[];
  createdById?: string;
}

// ─────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────

export interface ProvenanceResponse {
  provenance: ClaimProvenance;
}

export interface TimelineResponse {
  claimId: string;
  events: ClaimTimelineEvent[];
  totalEvents: number;
}

export interface ChallengeReportResponse {
  report: ChallengeReport;
}

export interface AttackResponse {
  attack: AttackSummary;
}

export interface DefenseResponse {
  defense: DefenseSummary;
}

export interface VersionResponse {
  version: ClaimVersionSummary;
  claimId: string;
}

// ─────────────────────────────────────────────────────────
// Consensus Calculation Types
// ─────────────────────────────────────────────────────────

export interface ConsensusCalculationInput {
  challengeCount: number;
  openChallenges: number;
  defendedCount: number;
  concededCount: number;
  stalemateCount?: number;
}

export interface ConsensusCalculationResult {
  status: ConsensusStatus;
  confidence: number; // 0-1 how confident in status
  reasoning: string;
}
