/**
 * Facilitation — Rule engine shared types
 *
 * Rules are pure: `(ctx) => RuleOutput | null`. The driver in
 * `interventionService.recommendNext` builds `RuleContext` and persists
 * `RuleOutput`s as `FacilitationIntervention` rows.
 *
 * Open question from C0 (resolved here, v1): rules that don't read any
 * snapshot (`evidenceGapRule`, `cooldownRule`) may return
 * `triggeredByMetric: null` and `triggeredByMetricSnapshotId: null`. The
 * Prisma column is nullable; the API documents this exception.
 */

import type {
  EquityMetricKind,
  FacilitationIntervention,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";

export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * One row from `EquityMetricSnapshot`. Mirrors the Prisma model in a way
 * that keeps the rule engine independent of Prisma's runtime types.
 */
export interface MetricSnapshot {
  id: string;
  metricKind: EquityMetricKind;
  metricVersion: number;
  value: number;
  windowStart: Date;
  windowEnd: Date;
  breakdown: Record<string, unknown>;
  isFinal: boolean;
}

/** Lightweight summary surfaces for rules that target claims. */
export interface ClaimSummary {
  id: string;
  text: string;
  weight: number;
  supportCount: number;
  citationCount: number;
  authorAuthId: string;
  authorIsInstitutional?: boolean;
  lastActivityAt: Date | null;
}

/**
 * One pairwise-turn record used by `cooldownRule`. The collector groups
 * exchanges by `{userA, userB}` (order-insensitive) and `claimId`.
 */
export interface PairwiseTurn {
  userA: string;
  userB: string;
  claimId: string;
  turnCount: number;
  windowSeconds: number;
}

export interface RuleContext {
  sessionId: string;
  deliberationId: string;
  now: Date;
  enrolledAuthIds: string[];
  /** keyed by EquityMetricKind */
  snapshots: Partial<Record<EquityMetricKind, MetricSnapshot>>;
  /** Optional — populated by the driver when the claim provider is wired. */
  highWeightClaims?: ClaimSummary[];
  /** Optional — populated by the driver when the turns provider is wired. */
  pairwiseTurns?: PairwiseTurn[];
  /** Open interventions on this session, used for dedupe. */
  openInterventions: Pick<
    FacilitationIntervention,
    "id" | "ruleName" | "targetType" | "targetId" | "recommendedAt"
  >[];
  /** Per-rule per-deliberation overrides. */
  thresholds?: Record<string, Record<string, number>>;
}

export interface RuleRationale {
  headline: string;
  details: Record<string, unknown>;
}

export interface RuleOutput {
  kind: FacilitationInterventionKind;
  targetType: FacilitationInterventionTargetType;
  targetId: string;
  priority: Priority;
  rationale: RuleRationale;
  suggestedPhrasing: string;
  triggeredByMetric: EquityMetricKind | null;
  triggeredByMetricSnapshotId: string | null;
  /** Override default dedupe window for this rule. */
  dedupeWindowSeconds?: number;
}

export interface RuleDescriptor {
  name: string;
  version: number;
  defaultEnabled: boolean;
  flag: string;
  /** Default dedupe window for outputs from this rule. */
  dedupeWindowSeconds: number;
  run: (ctx: RuleContext) => RuleOutput | RuleOutput[] | null;
}
