/**
 * Facilitation — Metric calculator types (C1.6)
 *
 * All calculators are PURE functions over a `WindowInputs` snapshot loaded
 * once by `metricService.computeWindow`. Each calculator pins its own
 * `version` integer; bumping a calculator must increment its version (older
 * `EquityMetricSnapshot` rows remain valid for their original version per
 * the storage policy in roadmap §3.5).
 */

import { EquityMetricKind } from "../types";

/** A single contribution from an author within the window. */
export interface ContributionRecord {
  authorId: string;
  createdAt: Date;
  /** Free-form so callers can include arguments, messages, claims, etc. */
  source: "argument" | "claim" | "dialogue_move" | "message";
}

/** A challenge / attack move from an author within the window. */
export interface ChallengeRecord {
  authorId: string;
  createdAt: Date;
  /** "conflict" = ConflictApplication; "why" = DialogueMove kind=WHY etc. */
  source: "conflict" | "why" | "rebut";
}

/**
 * A claim (or argument) and the timestamp of its first reply. Used by
 * RESPONSE_LATENCY_P50 and ATTENTION_DEFICIT.
 */
export interface ReplyableRecord {
  id: string;
  postedAt: Date;
  firstReplyAt: Date | null;
  /** Optional weight for ATTENTION_DEFICIT prioritization. */
  weight?: number;
}

/** Snapshot of facilitator-side state for FACILITATOR_LOAD. */
export interface FacilitatorState {
  openInterventionCount: number;
  /** Most recent INTERVENTION_APPLIED / INTERVENTION_DISMISSED, if any. */
  lastActionAt: Date | null;
}

/**
 * Single immutable input bundle passed to every calculator. Any calculator
 * is free to ignore fields it does not need; orchestrator may pass empty
 * arrays where data is unavailable.
 */
export interface WindowInputs {
  windowStart: Date;
  windowEnd: Date;
  /** Auth IDs of all enrolled participants (for Gini denominators). */
  enrolledAuthIds: string[];
  contributions: ContributionRecord[];
  challenges: ChallengeRecord[];
  replyables: ReplyableRecord[];
  facilitator: FacilitatorState;
}

/** Output shape every calculator returns. Decimal value cast to string for Prisma. */
export interface MetricResult {
  value: number;
  breakdown: Record<string, unknown>;
}

export interface MetricCalculator {
  kind: EquityMetricKind;
  /** Bump when the formula changes — written verbatim to `metricVersion`. */
  version: number;
  /** Pure: same inputs → same outputs. No I/O, no clock reads. */
  compute(inputs: WindowInputs): MetricResult;
}
