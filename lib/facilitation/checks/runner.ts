/**
 * Facilitation — Question check runner.
 *
 * Pure: takes text + context, returns CheckResult[] + summary. Persistence
 * happens in `questionService.runChecks`.
 */

import { FacilitationCheckKind, FacilitationCheckSeverity } from "../types";
import type { CheckContext, CheckFn, CheckResult } from "./types";
import { clarityCheck } from "./clarity";
import { leadingCheck } from "./leading";
import { balanceCheck } from "./balance";
import { scopeCheck } from "./scope";
import { readabilityCheck } from "./readability";
import { biasCheck } from "./bias";

const REGISTRY: Array<{ kind: FacilitationCheckKind; fn: CheckFn }> = [
  { kind: FacilitationCheckKind.CLARITY, fn: clarityCheck },
  { kind: FacilitationCheckKind.LEADING, fn: leadingCheck },
  { kind: FacilitationCheckKind.BALANCE, fn: balanceCheck },
  { kind: FacilitationCheckKind.SCOPE, fn: scopeCheck },
  { kind: FacilitationCheckKind.READABILITY, fn: readabilityCheck },
  { kind: FacilitationCheckKind.BIAS, fn: biasCheck },
];

export interface CheckRunSummary {
  info: number;
  warn: number;
  block: number;
  byKind: Partial<Record<FacilitationCheckKind, number>>;
}

export interface CheckRunResult {
  checks: CheckResult[];
  summary: CheckRunSummary;
}

const SEVERITY_RANK: Record<FacilitationCheckSeverity, number> = {
  [FacilitationCheckSeverity.INFO]: 0,
  [FacilitationCheckSeverity.WARN]: 1,
  [FacilitationCheckSeverity.BLOCK]: 2,
};

function applyCeiling(
  result: CheckResult,
  ceilings: CheckContext["severityCeilings"],
): CheckResult {
  const ceiling = ceilings?.[result.kind];
  if (!ceiling) return result;
  if (SEVERITY_RANK[result.severity] > SEVERITY_RANK[ceiling]) {
    return { ...result, severity: ceiling };
  }
  return result;
}

export function runAllChecks(text: string, ctx: CheckContext): CheckRunResult {
  // Non-English: return single advisory INFO row, no other heuristics fire.
  if (ctx.language !== "en") {
    const single: CheckResult = {
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.INFO,
      messageText: `Question quality checks not yet calibrated for language: ${ctx.language}`,
      evidence: { language: ctx.language },
    };
    return { checks: [single], summary: summarize([single]) };
  }

  const all: CheckResult[] = [];
  for (const { fn } of REGISTRY) {
    const rows = fn(text, ctx);
    for (const r of rows) all.push(applyCeiling(r, ctx.severityCeilings));
  }
  return { checks: all, summary: summarize(all) };
}

function summarize(rows: CheckResult[]): CheckRunSummary {
  const summary: CheckRunSummary = { info: 0, warn: 0, block: 0, byKind: {} };
  for (const r of rows) {
    if (r.severity === FacilitationCheckSeverity.INFO) summary.info++;
    else if (r.severity === FacilitationCheckSeverity.WARN) summary.warn++;
    else if (r.severity === FacilitationCheckSeverity.BLOCK) summary.block++;
    summary.byKind[r.kind] = (summary.byKind[r.kind] ?? 0) + 1;
  }
  return summary;
}
