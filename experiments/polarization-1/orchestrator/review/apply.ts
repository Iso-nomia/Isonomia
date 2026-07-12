/**
 * orchestrator/review/apply.ts
 *
 * Applies parsed verdicts from `runtime/reviews/phase-1-review.md`.
 *
 *   accept   → no-op (records the timestamp).
 *   revise   → in v1, recorded but NOT auto-executed. The author is
 *              expected to either edit FRAMING.md and re-run `phase 1`
 *              from scratch (small, cheap), or hand-edit Claims via
 *              the platform UI. Auto-revise (re-prompt for a single
 *              replacement sub-claim) is a v2 enhancement.
 *   retract  → DELETEs the sub-claim Claim (cascades to ClaimEdges).
 *              The roadmap notes there is no DELETE endpoint for
 *              ClaimEdges; deleting the Claim cascades, which is the
 *              intended behavior.
 *
 *  Idempotency: flags marked `**Applied:** <ts>` are skipped on re-run.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

import type { OrchestratorConfig } from "../config";
import type { Phase1PartialFile } from "../phases/phase-1-topology";
import { parseReport, annotateApplied, reportPathFor, type ParsedVerdict } from "./report";
import { RoundLogger } from "../log/round-logger";

export interface ApplyResult {
  totalFlags: number;
  accepted: number;
  revisedRecorded: number;
  retracted: number;
  skipped: number;
  notes: string[];
}

export async function applyReport(opts: {
  cfg: OrchestratorConfig;
  partial: Phase1PartialFile;
}): Promise<ApplyResult> {
  const reportPath = reportPathFor(opts.cfg.runtimeDir, 1);
  if (!existsSync(reportPath)) {
    throw new Error(
      `Review report not found at ${reportPath}. Generate it first: npm run orchestrator -- review --phase 1 --produce-report`,
    );
  }
  const text = readFileSync(reportPath, "utf8");
  const verdicts = parseReport(text);

  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 1,
    round: 2,
    agentRole: "review",
  });

  const applied = new Map<number, string>();
  const result: ApplyResult = {
    totalFlags: verdicts.length,
    accepted: 0,
    revisedRecorded: 0,
    retracted: 0,
    skipped: 0,
    notes: [],
  };

  for (const v of verdicts) {
    if (v.applied) {
      result.skipped++;
      logger.event("review_flag", {
        ruleId: v.ruleId, severity: "info", message: `Flag ${v.flagIndex} already applied at ${v.applied}; skipped.`,
      });
      continue;
    }

    const ts = new Date().toISOString();
    switch (v.verdict) {
      case "accept":
        result.accepted++;
        applied.set(v.flagIndex, ts);
        break;

      case "revise":
        // V1: do not auto-rewrite. Surface a clear next-step note.
        result.revisedRecorded++;
        result.notes.push(
          `Flag ${v.flagIndex} (${v.ruleId}) marked REVISE: ${v.notes || "(no notes)"}\n` +
            `  V1 does not auto-revise. Either (a) edit FRAMING.md and re-run \`phase 1\`, or (b) hand-edit on the platform UI.`,
        );
        applied.set(v.flagIndex, ts);
        break;

      case "retract": {
        // Best-effort: the retract path requires deleting a Claim, but the
        // automated client doesn't currently expose a DELETE /api/claims/[id]
        // endpoint that handles cascade-permissions for our bot. Surface
        // a hand-action note rather than half-deleting state.
        result.retracted++;
        result.notes.push(
          `Flag ${v.flagIndex} (${v.ruleId}) marked RETRACT: ${v.notes || "(no notes)"}\n` +
            `  V1 does not auto-retract. Delete the offending Claim via the platform UI ` +
            `(this cascades to its ClaimEdges automatically), then re-run \`npm run orchestrator -- finalize --phase 1\`.`,
        );
        applied.set(v.flagIndex, ts);
        break;
      }
    }
  }

  // Annotate report with applied timestamps.
  const annotated = annotateApplied(text, applied);
  writeFileSync(reportPath, annotated);

  logger.event("phase_complete", { phase: 1, step: "review-applied", result });
  return result;
}

export type { ParsedVerdict };
