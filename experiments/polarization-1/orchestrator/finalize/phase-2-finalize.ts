/**
 * orchestrator/finalize/phase-2-finalize.ts
 *
 * Validates platform state against `PHASE_2_PARTIAL.json`, then writes
 * `PHASE_2_COMPLETE.json` (the gate Stage 4 reads).
 *
 * Audit (read-only):
 *   - Every claim referenced by Phase 2 (root, sub-claims, minted premises,
 *     conclusion-claim ids — derived from PHASE_1_COMPLETE for sub-claims,
 *     mint result for premises) must still exist in the deliberation.
 *   - Both advocates' run records must have outcome === "ok". If only one
 *     succeeded, finalize refuses (operator must run `phase 2 --resume`).
 *
 * Review-flag gating (mirrors Phase 1):
 *   - If `PHASE_2_PARTIAL.json` has reviewFlags but no review report exists,
 *     finalize refuses.
 *   - If a review report exists, every flag must carry an `**Applied:**`
 *     marker (operator ran `review --phase 2 --apply`). Otherwise refuse.
 *
 * Output: `PHASE_2_COMPLETE.json` — the canonical Stage-3 manifest.
 *   {
 *     phase: 2,
 *     status: "complete",
 *     completedAt, deliberationId, modelTier, evidenceStackId,
 *     topologyBinding,
 *     advocates: {
 *       a: {
 *         outcome: "ok",
 *         attempts, tokenUsage,
 *         arguments: [
 *           { argumentId, conclusionClaimIndex, conclusionClaimId,
 *             schemeKey, schemeId, premiseClaimIds, premiseTexts,
 *             warrant, citations: [{sourceId, citationId, citationToken}] }
 *         ]
 *       },
 *       b: { … same shape … }
 *     },
 *     totals: { argumentsCreated, premiseClaimsMinted, premiseClaimsDeduped,
 *               citationsAttached, inputTokens, outputTokens },
 *     reviewSummary: { totalFlags, accepted, revised, retracted, judgeUsage,
 *                      reportPath },
 *     judgeUsage?: { calls, inputTokens, outputTokens }
 *   }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { Phase2PartialFile, AdvocateRunRecord } from "../phases/phase-2-arguments";
import type { ReviewFlag } from "../review/phase-2-checks";
import { parseReport, reportPathFor } from "../review/report";

export interface Phase2CompleteArgument {
  /** Index in the original AdvocateOutput.arguments array. */
  inputIndex: number;
  argumentId: string;
  conclusionClaimIndex: number;
  conclusionClaimId: string;
  schemeKey: string;
  schemeId: string;
  premiseClaimIds: string[];
  /** Surface text of each premise, in input order; matches premiseClaimIds order. */
  premiseTexts: string[];
  /** Per-premise citationToken (null where uncited); matches premiseClaimIds order. */
  premiseCitationTokens: Array<string | null>;
  warrant: string | null;
  citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
}

export interface Phase2CompleteAdvocate {
  outcome: "ok";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  arguments: Phase2CompleteArgument[];
}

export interface Phase2CompleteFile {
  phase: 2;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  topologyBinding: Phase2PartialFile["topologyBinding"];
  advocates: { a: Phase2CompleteAdvocate; b: Phase2CompleteAdvocate };
  totals: Phase2PartialFile["totals"];
  reviewSummary: {
    totalFlags: number;
    accepted: number;
    revised: number;
    retracted: number;
    /** Distribution by ruleId across all flags (visibility into where issues clustered). */
    flagsByRule: Record<string, number>;
    reportPath: string | null;
  };
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
}

export async function finalizePhase2(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase2CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_2_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_2_PARTIAL.json not found. Run \`npm run orchestrator -- phase 2\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase2PartialFile;

  // ── 1. Both advocates must have outcome === "ok" ──
  const a = partial.advocates.a;
  const b = partial.advocates.b;
  const okA = a?.outcome === "ok";
  const okB = b?.outcome === "ok";
  if (!okA || !okB) {
    const status = (rec?: AdvocateRunRecord) => (rec ? rec.outcome : "missing");
    throw new Error(
      `Phase 2 finalize refused: both advocates must have outcome="ok". ` +
        `Got A=${status(a)}, B=${status(b)}. ` +
        `Re-run \`npm run orchestrator -- phase 2 --resume\` to retry the failed/missing advocate(s).`,
    );
  }

  // ── 2. Claim audit (read-only) ──
  const expectedClaimIds = collectExpectedClaimIds(partial);
  const divergences: string[] = [];
  try {
    const claims = await opts.iso.listClaims(partial.deliberationId, { role: "advocate-a" });
    const observedIds = new Set<string>(claims.map((c) => c.id));
    for (const { kind, id, label } of expectedClaimIds) {
      if (!observedIds.has(id)) {
        divergences.push(`${kind} ${label} (claimId=${id}) not present in deliberation claims.`);
      }
    }
  } catch (err) {
    // Match Phase-1 behavior: degrade to a soft warning, do not block finalize.
    divergences.push(
      `Could not fetch claims for audit: ${(err as Error).message}. Proceeding without claim-existence audit.`,
    );
  }

  const hardDivergences = divergences.filter(
    (d) => d.includes("(claimId=") && !d.includes("Could not fetch"),
  );
  if (hardDivergences.length > 0) {
    const divPath = path.join(opts.cfg.runtimeDir, "reviews", "phase-2-divergence.md");
    mkdirSync(path.dirname(divPath), { recursive: true });
    writeFileSync(
      divPath,
      `# Phase 2 Finalization — Divergence Detected\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        hardDivergences.map((d) => `- ${d}`).join("\n") + "\n\n" +
        `Likely causes:\n` +
        `  - Phase 1 was re-run and produced new claim IDs after Phase 2 minted against the old ones.\n` +
        `  - A claim was manually retracted or deleted between phase 2 and finalize.\n` +
        `  - Global MOID dedup bound a premise text to a claim row already attached to a\n` +
        `    *different* deliberation; the Argument/edge was still created successfully but\n` +
        `    the premise claim doesn't appear in this deliberation's claim listing.\n\n` +
        `Set FINALIZE_SOFT_DIVERGENCE=1 to log+continue (treat as soft warning) when the\n` +
        `divergence is benign (e.g. cross-deliberation MOID dedup).\n\n` +
        `Resolve by re-running \`npm run orchestrator -- phase 2\` against the current Phase 1 topology.\n`,
    );
    if (process.env.FINALIZE_SOFT_DIVERGENCE === "1") {
      // eslint-disable-next-line no-console
      console.warn(
        `[finalize-phase2] FINALIZE_SOFT_DIVERGENCE=1 → continuing despite ${hardDivergences.length} claim divergence(s); see ${divPath}.`,
      );
    } else {
      throw new Error(`Phase 2 finalize refused: ${hardDivergences.length} claim divergence(s). See ${divPath}.`);
    }
  }

  // ── 3. Review-flag gating ──
  const reviewSummary = await buildReviewSummary(opts.cfg, partial.reviewFlags);

  // ── 4. Build complete file ──
  const complete: Phase2CompleteFile = {
    phase: 2,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    topologyBinding: partial.topologyBinding,
    advocates: {
      a: buildCompleteAdvocate(a!),
      b: buildCompleteAdvocate(b!),
    },
    totals: partial.totals,
    reviewSummary,
    judgeUsage: partial.judgeUsage,
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_2_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function collectExpectedClaimIds(partial: Phase2PartialFile): Array<{ kind: string; id: string; label: string }> {
  const out: Array<{ kind: string; id: string; label: string }> = [];
  // Conclusion + premise IDs are present in each advocate's mint result.
  for (const role of ["a", "b"] as const) {
    const rec = partial.advocates[role];
    if (!rec || rec.outcome !== "ok" || !rec.mintResult) continue;
    for (const arg of rec.mintResult.arguments) {
      out.push({
        kind: "Conclusion claim",
        id: arg.conclusionClaimId,
        label: `(advocate ${role.toUpperCase()}, arg #${arg.inputIndex}, sub-claim #${arg.conclusionClaimIndex})`,
      });
      for (let i = 0; i < arg.premiseClaimIds.length; i++) {
        out.push({
          kind: "Premise claim",
          id: arg.premiseClaimIds[i],
          label: `(advocate ${role.toUpperCase()}, arg #${arg.inputIndex}, premise #${i})`,
        });
      }
    }
  }
  // Dedup by id; same conclusion claim is referenced by many arguments.
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

async function buildReviewSummary(
  cfg: OrchestratorConfig,
  reviewFlags: ReviewFlag[],
): Promise<Phase2CompleteFile["reviewSummary"]> {
  const flagsByRule: Record<string, number> = {};
  for (const f of reviewFlags) flagsByRule[f.ruleId] = (flagsByRule[f.ruleId] ?? 0) + 1;

  const reportPath = reportPathFor(cfg.runtimeDir, 2);
  if (existsSync(reportPath)) {
    const text = readFileSync(reportPath, "utf8");
    let verdicts;
    try {
      verdicts = parseReport(text);
    } catch (parseErr) {
      throw new Error(
        `Phase 2 finalize: review report at ${reportPath} could not be parsed: ${(parseErr as Error).message}`,
      );
    }
    const unapplied = verdicts.filter((v) => !v.applied);
    if (unapplied.length > 0) {
      throw new Error(
        `Phase 2 finalize refused: ${unapplied.length} flag(s) in the review report have no \`**Applied:**\` marker. ` +
          `Run \`npm run orchestrator -- review --phase 2 --apply\` first.`,
      );
    }
    return {
      totalFlags: verdicts.length,
      accepted: verdicts.filter((v) => v.verdict === "accept").length,
      revised: verdicts.filter((v) => v.verdict === "revise").length,
      retracted: verdicts.filter((v) => v.verdict === "retract").length,
      flagsByRule,
      reportPath,
    };
  }

  // Info-severity flags are advisory and don't gate finalize.
  const gating = reviewFlags.filter((f) => f.severity !== "info");
  if (gating.length > 0) {
    throw new Error(
      `Phase 2 finalize refused: PHASE_2_PARTIAL.json has ${gating.length} non-info review flag(s) but no review report exists at ${reportPath}. ` +
        `Generate it with \`npm run orchestrator -- review --phase 2\`, fill in verdicts, then \`--apply\`.`,
    );
  }

  return {
    totalFlags: 0,
    accepted: 0,
    revised: 0,
    retracted: 0,
    flagsByRule,
    reportPath: null,
  };
}

function buildCompleteAdvocate(rec: AdvocateRunRecord): Phase2CompleteAdvocate {
  if (rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) {
    // Defensive — the caller already gates on outcome === "ok".
    throw new Error(`buildCompleteAdvocate: advocate ${rec.role} not in "ok" state.`);
  }
  const inputArgs = rec.llmOutput.arguments;
  const arguments_: Phase2CompleteArgument[] = rec.mintResult.arguments.map((m) => {
    const orig = inputArgs[m.inputIndex];
    return {
      inputIndex: m.inputIndex,
      argumentId: m.argumentId,
      conclusionClaimIndex: m.conclusionClaimIndex,
      conclusionClaimId: m.conclusionClaimId,
      schemeKey: m.schemeKey,
      schemeId: m.schemeId,
      premiseClaimIds: m.premiseClaimIds,
      premiseTexts: orig.premises.map((p) => p.text),
      premiseCitationTokens: orig.premises.map((p) => p.citationToken ?? null),
      warrant: orig.warrant ?? null,
      citations: m.citations,
    };
  });
  return {
    outcome: "ok",
    attempts: rec.attempts,
    tokenUsage: rec.tokenUsage,
    arguments: arguments_,
  };
}
