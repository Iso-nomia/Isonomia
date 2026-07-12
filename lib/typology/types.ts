/**
 * Typology / Meta-consensus — Domain types
 *
 * Pure TypeScript mirrors of the Prisma enums and models added in B1.
 * Service code should import these (rather than `@prisma/client`) where
 * possible to keep the surface unit-testable without a DB.
 *
 * Status: B1 scaffold.
 */

export type Cuid = string;
export type AuthId = string;

export enum DisagreementAxisKey {
  VALUE = "VALUE",
  EMPIRICAL = "EMPIRICAL",
  FRAMING = "FRAMING",
  INTEREST = "INTEREST",
}

export enum DisagreementTagTargetType {
  CLAIM = "CLAIM",
  ARGUMENT = "ARGUMENT",
  EDGE = "EDGE",
}

export enum DisagreementTagAuthorRole {
  PARTICIPANT = "PARTICIPANT",
  FACILITATOR = "FACILITATOR",
  HOST = "HOST",
}

export enum DisagreementTagSeedSource {
  MANUAL = "MANUAL",
  INTERVENTION_SEED = "INTERVENTION_SEED",
  METRIC_SEED = "METRIC_SEED",
  REPEATED_ATTACK_SEED = "REPEATED_ATTACK_SEED",
  VALUE_LEXICON_SEED = "VALUE_LEXICON_SEED",
  IMPORTED = "IMPORTED",
}

export enum MetaConsensusSummaryStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  RETRACTED = "RETRACTED",
}

export enum MetaConsensusEventType {
  TAG_PROPOSED = "TAG_PROPOSED",
  TAG_CONFIRMED = "TAG_CONFIRMED",
  TAG_RETRACTED = "TAG_RETRACTED",
  CANDIDATE_ENQUEUED = "CANDIDATE_ENQUEUED",
  CANDIDATE_DISMISSED = "CANDIDATE_DISMISSED",
  SUMMARY_DRAFTED = "SUMMARY_DRAFTED",
  SUMMARY_PUBLISHED = "SUMMARY_PUBLISHED",
  SUMMARY_RETRACTED = "SUMMARY_RETRACTED",
  AXIS_VERSION_BUMPED = "AXIS_VERSION_BUMPED",
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash-chain payload (input to lib/pathways/hashChain.ts → computeEventHash).
// ─────────────────────────────────────────────────────────────────────────────

/** Stable subset of a MetaConsensusEvent used as input to the hash. */
export interface MetaConsensusHashableEventPayload {
  deliberationId: Cuid;
  sessionId: Cuid | null;
  eventType: MetaConsensusEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  tagId: Cuid | null;
  summaryId: Cuid | null;
  candidateId: Cuid | null;
}

export interface MetaConsensusEventInput {
  deliberationId: Cuid;
  sessionId?: Cuid | null;
  eventType: MetaConsensusEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  tagId?: Cuid | null;
  summaryId?: Cuid | null;
  candidateId?: Cuid | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain row mirrors (subset; expand as services grow).
// ─────────────────────────────────────────────────────────────────────────────

export interface DisagreementAxis {
  id: Cuid;
  key: DisagreementAxisKey;
  displayName: string;
  description: string;
  colorToken: string;
  interventionHint: string;
  version: number;
  isActive: boolean;
  seededAt: Date;
}

export interface DisagreementTag {
  id: Cuid;
  deliberationId: Cuid;
  sessionId: Cuid | null;
  targetType: DisagreementTagTargetType;
  targetId: string;
  axisId: Cuid;
  axisVersion: number;
  /** Decimal serialized as string to preserve precision. */
  confidence: string;
  evidenceText: string;
  evidenceJson: Record<string, unknown> | null;
  authoredById: AuthId;
  authoredRole: DisagreementTagAuthorRole;
  seedSource: DisagreementTagSeedSource;
  seedReferenceJson: Record<string, unknown> | null;
  promotedFromCandidateId: Cuid | null;
  confirmedAt: Date | null;
  confirmedById: AuthId | null;
  retractedAt: Date | null;
  retractedById: AuthId | null;
  retractedReasonText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypologyCandidate {
  id: Cuid;
  deliberationId: Cuid;
  sessionId: Cuid;
  targetType: DisagreementTagTargetType | null;
  targetId: string | null;
  suggestedAxisId: Cuid;
  suggestedAxisVersion: number;
  seedSource: DisagreementTagSeedSource;
  seedReferenceJson: Record<string, unknown>;
  rationaleText: string;
  priority: number;
  ruleName: string;
  ruleVersion: number;
  promotedToTagId: Cuid | null;
  promotedAt: Date | null;
  promotedById: AuthId | null;
  dismissedAt: Date | null;
  dismissedById: AuthId | null;
  dismissedReasonText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetaConsensusSummaryBody {
  agreedOn: string[];
  disagreedOn: {
    axisKey: DisagreementAxisKey;
    summary: string;
    supportingTagIds: Cuid[];
  }[];
  blockers: string[];
  nextSteps: string[];
}

export interface MetaConsensusSummary {
  id: Cuid;
  deliberationId: Cuid;
  sessionId: Cuid | null;
  version: number;
  status: MetaConsensusSummaryStatus;
  authoredById: AuthId;
  publishedAt: Date | null;
  publishedById: AuthId | null;
  retractedAt: Date | null;
  retractedById: AuthId | null;
  retractedReasonText: string | null;
  parentSummaryId: Cuid | null;
  bodyJson: MetaConsensusSummaryBody;
  narrativeText: string | null;
  snapshotJson: Record<string, unknown> | null;
  snapshotHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetaConsensusEvent {
  id: Cuid;
  deliberationId: Cuid;
  sessionId: Cuid | null;
  eventType: MetaConsensusEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  hashChainPrev: string | null;
  hashChainSelf: string;
  tagId: Cuid | null;
  summaryId: Cuid | null;
  candidateId: Cuid | null;
  createdAt: Date;
}
