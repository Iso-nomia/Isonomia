/**
 * Facilitation — Domain types
 *
 * Pure TypeScript mirrors of the Prisma enums and models added in C1.1.
 * Service code should import these (rather than `@prisma/client`) where
 * possible to keep the surface unit-testable without a DB.
 *
 * Status: C1.2 scaffold.
 */

export type Cuid = string;
export type AuthId = string;

export enum FacilitationSessionStatus {
  OPEN = "OPEN",
  HANDED_OFF = "HANDED_OFF",
  CLOSED = "CLOSED",
}

export enum FacilitationFramingType {
  open = "open",
  choice = "choice",
  evaluative = "evaluative",
  generative = "generative",
}

export enum FacilitationCheckKind {
  CLARITY = "CLARITY",
  LEADING = "LEADING",
  BALANCE = "BALANCE",
  SCOPE = "SCOPE",
  BIAS = "BIAS",
  READABILITY = "READABILITY",
}

export enum FacilitationCheckSeverity {
  INFO = "INFO",
  WARN = "WARN",
  BLOCK = "BLOCK",
}

export enum FacilitationEventType {
  SESSION_OPENED = "SESSION_OPENED",
  METRIC_THRESHOLD_CROSSED = "METRIC_THRESHOLD_CROSSED",
  INTERVENTION_RECOMMENDED = "INTERVENTION_RECOMMENDED",
  INTERVENTION_APPLIED = "INTERVENTION_APPLIED",
  INTERVENTION_DISMISSED = "INTERVENTION_DISMISSED",
  MANUAL_NUDGE = "MANUAL_NUDGE",
  QUESTION_REOPENED = "QUESTION_REOPENED",
  TIMEBOX_ADJUSTED = "TIMEBOX_ADJUSTED",
  HANDOFF_INITIATED = "HANDOFF_INITIATED",
  HANDOFF_ACCEPTED = "HANDOFF_ACCEPTED",
  HANDOFF_DECLINED = "HANDOFF_DECLINED",
  HANDOFF_CANCELED = "HANDOFF_CANCELED",
  SESSION_CLOSED = "SESSION_CLOSED",
}

export enum FacilitationInterventionKind {
  ELICIT_UNHEARD = "ELICIT_UNHEARD",
  REBALANCE_CHALLENGE = "REBALANCE_CHALLENGE",
  PROMPT_EVIDENCE = "PROMPT_EVIDENCE",
  REFRAME_QUESTION = "REFRAME_QUESTION",
  INVITE_RESPONSE = "INVITE_RESPONSE",
  COOLDOWN = "COOLDOWN",
  OTHER = "OTHER",
}

export enum FacilitationInterventionTargetType {
  CLAIM = "CLAIM",
  ARGUMENT = "ARGUMENT",
  USER = "USER",
  ROOM = "ROOM",
}

export enum FacilitationDismissalTag {
  not_relevant = "not_relevant",
  already_addressed = "already_addressed",
  wrong_target = "wrong_target",
  other = "other",
}

export enum EquityMetricKind {
  PARTICIPATION_GINI = "PARTICIPATION_GINI",
  CHALLENGE_CONCENTRATION = "CHALLENGE_CONCENTRATION",
  RESPONSE_LATENCY_P50 = "RESPONSE_LATENCY_P50",
  ATTENTION_DEFICIT = "ATTENTION_DEFICIT",
  FACILITATOR_LOAD = "FACILITATOR_LOAD",
}

export enum FacilitationHandoffStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  CANCELED = "CANCELED",
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash-chain payload (input to lib/pathways/hashChain.ts → computeEventHash).
// ─────────────────────────────────────────────────────────────────────────────

/** Stable subset of a FacilitationEvent used as input to the hash. */
export interface FacilitationHashableEventPayload {
  sessionId: Cuid;
  eventType: FacilitationEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  interventionId: Cuid | null;
  metricSnapshotId: Cuid | null;
}

export interface FacilitationEventInput {
  sessionId: Cuid;
  eventType: FacilitationEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  interventionId?: Cuid | null;
  metricSnapshotId?: Cuid | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain row mirrors (subset; expand as services grow).
// ─────────────────────────────────────────────────────────────────────────────

export interface FacilitationSession {
  id: Cuid;
  deliberationId: Cuid;
  openedById: AuthId;
  openedAt: Date;
  closedAt: Date | null;
  closedById: AuthId | null;
  status: FacilitationSessionStatus;
  isPublic: boolean;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilitationEvent {
  id: Cuid;
  sessionId: Cuid;
  eventType: FacilitationEventType;
  actorId: AuthId;
  actorRole: string;
  payloadJson: Record<string, unknown>;
  hashChainPrev: string | null;
  hashChainSelf: string;
  interventionId: Cuid | null;
  metricSnapshotId: Cuid | null;
  createdAt: Date;
}

export interface FacilitationIntervention {
  id: Cuid;
  sessionId: Cuid;
  kind: FacilitationInterventionKind;
  targetType: FacilitationInterventionTargetType;
  targetId: string;
  recommendedAt: Date;
  appliedAt: Date | null;
  appliedById: AuthId | null;
  dismissedAt: Date | null;
  dismissedById: AuthId | null;
  dismissedReasonText: string | null;
  dismissedReasonTag: FacilitationDismissalTag | null;
  rationaleJson: Record<string, unknown>;
  priority: number;
  ruleName: string;
  ruleVersion: number;
  triggeredByMetric: EquityMetricKind | null;
  triggeredByMetricSnapshotId: Cuid | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquityMetricSnapshot {
  id: Cuid;
  deliberationId: Cuid;
  sessionId: Cuid | null;
  windowStart: Date;
  windowEnd: Date;
  metricKind: EquityMetricKind;
  metricVersion: number;
  /** Decimal serialized as string to preserve precision. */
  value: string;
  breakdownJson: Record<string, unknown>;
  isFinal: boolean;
  createdAt: Date;
}
