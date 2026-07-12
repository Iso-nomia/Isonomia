/**
 * Facilitation — Question check shared types
 */

import type {
  FacilitationCheckKind,
  FacilitationCheckSeverity,
  FacilitationFramingType,
} from "../types";

export interface CheckContext {
  framingType: FacilitationFramingType;
  /** BCP-47. Only "en" runs heuristics in v1. */
  language: string;
  /** e.g. "legal", "medical" — selects an alternate clarity lexicon. */
  lexiconOverrideKey?: string;
  /** Per-deliberation BLOCK→WARN demotion map. */
  severityCeilings?: Partial<Record<FacilitationCheckKind, FacilitationCheckSeverity>>;
  /** Optional per-deliberation overrides for readability ceiling, etc. */
  readabilityBlockGrade?: number;
}

export interface CheckResult {
  kind: FacilitationCheckKind;
  severity: FacilitationCheckSeverity;
  messageText: string;
  evidence?: Record<string, unknown>;
}

export type CheckFn = (text: string, ctx: CheckContext) => CheckResult[];
