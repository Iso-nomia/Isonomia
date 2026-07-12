/**
 * orchestrator/finalize/phase-3-finalize.ts
 *
 * Validates platform state against `PHASE_3_PARTIAL.json`, then writes
 * `PHASE_3_COMPLETE.json` (the gate Stage 5 reads).
 *
 * Audit (read-only):
 *   - Both advocates' run records must have outcome === "ok".
 *   - Every rebuttal Argument id and every attack ArgumentEdge id from
 *     the mint result must still exist in the database. (We use prisma
 *     directly because there's no /api/arguments/:id GET that returns
 *     edge metadata and the volume is small enough for a single
 *     `findMany`.)
 *
 * Review-flag gating (mirrors Phase 2):
 *   - If `PHASE_3_PARTIAL.json` has reviewFlags but no review report exists,
 *     finalize refuses.
 *   - If a review report exists, every flag must carry an `**Applied:**`
 *     marker. Otherwise refuse.
 *
 * Output: `PHASE_3_COMPLETE.json` — the canonical Stage-4 manifest.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type {
  Phase3PartialFile,
  RebuttalRunRecord,
  MethodologistRunRecord,
} from "../phases/phase-3-attacks";
import type { Phase3Round2PartialFile } from "../phases/phase-3-round2";
import type { ReviewFlag } from "../review/phase-3-checks";
import { parseReport, reportPathFor } from "../review/report";
import { prisma } from "@/lib/prismaclient";

export interface Phase3CompleteRebuttal {
  inputIndex: number;
  /** Iter-3 multi-round indicator. "1" = round 1 (Iter-2 default), "2" = round 2 attack-on-attack. */
  round: "1" | "2";
  rebuttalArgumentId: string;
  targetArgumentId: string;
  /** Iter-3: which kind of object `targetArgumentId` resolves to. */
  targetKind: "phase2-arg" | "round1-rebuttal";
  edgeId: string;
  attackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  targetPremiseIndex: number | null;
  targetPremiseClaimId: string | null;
  schemeKey: string;
  schemeId: string;
  conclusionClaimId: string;
  premiseClaimIds: string[];
  premiseTexts: string[];
  premiseCitationTokens: Array<string | null>;
  warrant: string | null;
  cqKey: string | null;
  conclusionText: string;
  citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
}

export interface Phase3CompleteCqResponse {
  inputIndex: number;
  /** Iter-3 multi-round indicator. */
  round: "1" | "2";
  targetArgumentId: string;
  /** Iter-3: which kind of object `targetArgumentId` resolves to. */
  targetKind: "phase2-arg" | "round1-rebuttal";
  cqKey: string;
  action: "raise" | "waive";
  rationale: string;
  cqStatusId: string;
  elidedByRebuttalCqKey: boolean;
}

export interface Phase3CompleteAdvocate {
  outcome: "ok";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  rebuttals: Phase3CompleteRebuttal[];
  cqResponses: Phase3CompleteCqResponse[];
}

/**
 * Methodologist-specific complete record. Same shape as the advocate
 * record except every rebuttal and cqResponse carries an explicit
 * `targetAdvocateRole` ("A" | "B") so downstream phases can route the
 * Methodologist's attacks to the correct advocate.
 */
export interface Phase3CompleteMethodologistRebuttal
  extends Phase3CompleteRebuttal {
  targetAdvocateRole: "A" | "B";
}
export interface Phase3CompleteMethodologistCqResponse
  extends Phase3CompleteCqResponse {
  targetAdvocateRole: "A" | "B";
}
export interface Phase3CompleteMethodologist {
  outcome: "ok";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  rebuttals: Phase3CompleteMethodologistRebuttal[];
  cqResponses: Phase3CompleteMethodologistCqResponse[];
}

/** Iter-3: per-actor summary of the round-2 pass, recorded on
 *  `Phase3CompleteFile.round2` for audit. Mints are merged inline. */
export interface Round2ActorSummary {
  outcome: string;
  attempts: number;
  rebuttalsMerged: number;
  cqResponsesMerged: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

/** Iter-3 task #6: round-2 soft-check coverage summary. Aggregates
 *  per-rule flag counts produced by `runPhase3Round2SoftChecks`. */
export interface Round2ReviewSummary {
  totalFlags: number;
  flagsByRule: Record<string, number>;
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
}

export interface Phase3CompleteFile {
  phase: 3;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  cqCatalog: Phase3PartialFile["cqCatalog"];
  advocates: { a: Phase3CompleteAdvocate; b: Phase3CompleteAdvocate };
  /** Optional Phase-3 third-actor record (cross-side methodological
   *  critic). Older deliberations finalized before the Methodologist
   *  was introduced will not have this field. */
  methodologist?: Phase3CompleteMethodologist;
  totals: Phase3PartialFile["totals"];
  /** Iter-3: per-actor outcome summary for the round-2 attack-on-attack
   *  pass. Absent when `iter3MultiRound` is off or the round-2 driver
   *  never ran. Mints from "ok" actors are merged inline into
   *  `advocates.{a,b}.rebuttals`/`cqResponses` and
   *  `methodologist.rebuttals`/`cqResponses` tagged `round: "2"`;
   *  non-"ok" actors are recorded here for audit only. */
  round2?: {
    a?: Round2ActorSummary;
    b?: Round2ActorSummary;
    methodologist?: Round2ActorSummary;
    totals: Phase3Round2PartialFile["totals"];
    /** Iter-3 task #6: round-2 soft-check flag counts (merged into the
     *  unified `reviewSummary` for human review; surfaced separately
     *  here for audit of the round-2 deterministic+judge pass). */
    review?: Round2ReviewSummary;
  };
  reviewSummary: {
    totalFlags: number;
    accepted: number;
    revised: number;
    retracted: number;
    flagsByRule: Record<string, number>;
    reportPath: string | null;
  };
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
}

export async function finalizePhase3(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase3CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_3_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_3_PARTIAL.json not found. Run \`npm run orchestrator -- phase 3\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase3PartialFile;

  // ── Iter-3: load round-2 partial when present + flag enabled ──
  let round2: Phase3Round2PartialFile | null = null;
  if (opts.cfg.iter3MultiRound) {
    const round2Path = path.join(opts.cfg.runtimeDir, "PHASE_3_ROUND2_PARTIAL.json");
    if (existsSync(round2Path)) {
      round2 = JSON.parse(readFileSync(round2Path, "utf8")) as Phase3Round2PartialFile;
    }
  }

  // ── 1. Both advocates must have outcome === "ok" ──
  const a = partial.advocates.a;
  const b = partial.advocates.b;
  const okA = a?.outcome === "ok";
  const okB = b?.outcome === "ok";
  if (!okA || !okB) {
    const status = (rec?: RebuttalRunRecord) => (rec ? rec.outcome : "missing");
    throw new Error(
      `Phase 3 finalize refused: both advocates must have outcome="ok". ` +
        `Got A=${status(a)}, B=${status(b)}. ` +
        `Re-run \`npm run orchestrator -- phase 3 --resume\` to retry the failed/missing advocate(s).`,
    );
  }

  // ── 2. Argument + edge audit ──
  const expectedArgIds = new Set<string>();
  const expectedEdgeIds = new Set<string>();
  for (const rec of [a!, b!]) {
    if (!rec.mintResult) continue;
    for (const r of rec.mintResult.rebuttals) {
      expectedArgIds.add(r.rebuttalArgumentId);
      expectedEdgeIds.add(r.edgeId);
    }
  }
  // Methodologist (optional). If present and ok, audit its mints too.
  const meth = partial.methodologist;
  if (meth?.outcome === "ok" && meth.mintResult) {
    for (const r of meth.mintResult.rebuttals) {
      expectedArgIds.add(r.rebuttalArgumentId);
      expectedEdgeIds.add(r.edgeId);
    }
  } else if (meth && meth.outcome !== "ok") {
    throw new Error(
      `Phase 3 finalize refused: methodologist record present but outcome="${meth.outcome}". ` +
        `Re-run \`npm run orchestrator -- phase 3 --resume\` to retry the methodologist.`,
    );
  }

  // Iter-3: include round-2 "ok" actor mints in the audit set.
  if (round2) {
    const round2Actors = [
      round2.actors.a,
      round2.actors.b,
      round2.actors.methodologist,
    ] as const;
    for (const rec of round2Actors) {
      if (!rec || rec.outcome !== "ok" || !rec.mintResult) continue;
      for (const r of rec.mintResult.rebuttals) {
        expectedArgIds.add(r.rebuttalArgumentId);
        expectedEdgeIds.add(r.edgeId);
      }
    }
  }

  const divergences: string[] = [];
  if (expectedArgIds.size > 0) {
    const presentArgs = await prisma.argument.findMany({
      where: { id: { in: [...expectedArgIds] } },
      select: { id: true },
    });
    const observed = new Set(presentArgs.map((r) => r.id));
    for (const id of expectedArgIds) {
      if (!observed.has(id)) divergences.push(`Rebuttal Argument ${id} not present in DB.`);
    }
  }
  if (expectedEdgeIds.size > 0) {
    const presentEdges = await prisma.argumentEdge.findMany({
      where: { id: { in: [...expectedEdgeIds] } },
      select: { id: true },
    });
    const observed = new Set(presentEdges.map((r) => r.id));
    for (const id of expectedEdgeIds) {
      if (!observed.has(id)) divergences.push(`Attack ArgumentEdge ${id} not present in DB.`);
    }
  }

  if (divergences.length > 0) {
    const divPath = path.join(opts.cfg.runtimeDir, "reviews", "phase-3-divergence.md");
    mkdirSync(path.dirname(divPath), { recursive: true });
    writeFileSync(
      divPath,
      `# Phase 3 Finalization — Divergence Detected\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        divergences.map((d) => `- ${d}`).join("\n") + "\n\n" +
        `Likely causes:\n` +
        `  - A rebuttal Argument or attack edge was manually deleted between phase 3 and finalize.\n` +
        `  - Phase 3 was partially re-run and the orphan-guard cascade removed prior rows.\n` +
        `  - Global MOID dedup bound a premise text to a claim row already attached to a\n` +
        `    *different* deliberation; the rebuttal/edge was created successfully but the\n` +
        `    premise claim doesn't appear in this deliberation's claim listing.\n\n` +
        `Set FINALIZE_SOFT_DIVERGENCE=1 to log+continue (treat as soft warning) when the\n` +
        `divergence is benign (e.g. cross-deliberation MOID dedup).\n\n` +
        `Resolve by re-running \`npm run orchestrator -- phase 3\` against the current Phase 2 state.\n`,
    );
    if (process.env.FINALIZE_SOFT_DIVERGENCE === "1") {
      // eslint-disable-next-line no-console
      console.warn(
        `[finalize-phase3] FINALIZE_SOFT_DIVERGENCE=1 → continuing despite ${divergences.length} divergence(s); see ${divPath}.`,
      );
    } else {
      throw new Error(`Phase 3 finalize refused: ${divergences.length} divergence(s). See ${divPath}.`);
    }
  }

  // ── 3. Review-flag gating ──
  // Round-1 reviewFlags participate in the human-review report.
  // Iter-3 round-2 reviewFlags are surfaced separately on
  // `complete.round2.review` for analyst inspection and do NOT gate
  // finalization (they are diagnostic — the round-2 mints are
  // already validated by the same Zod + per-mint checks as round 1).
  const reviewSummary = await buildReviewSummary(opts.cfg, partial.reviewFlags);

  // ── 4. Build complete file ──
  const completeA = buildCompleteAdvocate(a!);
  const completeB = buildCompleteAdvocate(b!);
  const completeMeth =
    meth?.outcome === "ok" ? buildCompleteMethodologist(meth) : undefined;

  // Iter-3: merge round-2 mints into the round-1 records (per-item
  // `round` field discriminates). Non-"ok" actors contribute nothing
  // but are summarized in `round2.{a,b,methodologist}`.
  let round2Summary: Phase3CompleteFile["round2"] | undefined;
  if (round2) {
    const summarize = (
      rec:
        | RebuttalRunRecord
        | MethodologistRunRecord
        | undefined,
      mergedRebuttals: number,
      mergedCqs: number,
    ): Round2ActorSummary | undefined =>
      rec
        ? {
            outcome: rec.outcome,
            attempts: rec.attempts,
            rebuttalsMerged: mergedRebuttals,
            cqResponsesMerged: mergedCqs,
            tokenUsage: rec.tokenUsage,
          }
        : undefined;

    const r2a = round2.actors.a;
    if (r2a?.outcome === "ok" && r2a.mintResult && r2a.llmOutput) {
      const built = buildCompleteAdvocate(r2a);
      completeA.rebuttals.push(...built.rebuttals);
      completeA.cqResponses.push(...built.cqResponses);
      completeA.attempts += r2a.attempts;
      completeA.tokenUsage.inputTokens += r2a.tokenUsage.inputTokens;
      completeA.tokenUsage.outputTokens += r2a.tokenUsage.outputTokens;
    }
    const r2b = round2.actors.b;
    if (r2b?.outcome === "ok" && r2b.mintResult && r2b.llmOutput) {
      const built = buildCompleteAdvocate(r2b);
      completeB.rebuttals.push(...built.rebuttals);
      completeB.cqResponses.push(...built.cqResponses);
      completeB.attempts += r2b.attempts;
      completeB.tokenUsage.inputTokens += r2b.tokenUsage.inputTokens;
      completeB.tokenUsage.outputTokens += r2b.tokenUsage.outputTokens;
    }
    const r2m = round2.actors.methodologist;
    if (r2m?.outcome === "ok" && r2m.mintResult && r2m.llmOutput && completeMeth) {
      const built = buildCompleteMethodologist(r2m);
      completeMeth.rebuttals.push(...built.rebuttals);
      completeMeth.cqResponses.push(...built.cqResponses);
      completeMeth.attempts += r2m.attempts;
      completeMeth.tokenUsage.inputTokens += r2m.tokenUsage.inputTokens;
      completeMeth.tokenUsage.outputTokens += r2m.tokenUsage.outputTokens;
    }

    round2Summary = {
      a: summarize(
        r2a,
        r2a?.outcome === "ok" ? (r2a.mintResult?.rebuttals.length ?? 0) : 0,
        r2a?.outcome === "ok" ? (r2a.mintResult?.cqResponses.length ?? 0) : 0,
      ),
      b: summarize(
        r2b,
        r2b?.outcome === "ok" ? (r2b.mintResult?.rebuttals.length ?? 0) : 0,
        r2b?.outcome === "ok" ? (r2b.mintResult?.cqResponses.length ?? 0) : 0,
      ),
      methodologist: summarize(
        r2m,
        r2m?.outcome === "ok" ? (r2m.mintResult?.rebuttals.length ?? 0) : 0,
        r2m?.outcome === "ok" ? (r2m.mintResult?.cqResponses.length ?? 0) : 0,
      ),
      totals: round2.totals,
      review: round2.reviewFlags
        ? {
            totalFlags: round2.reviewFlags.length,
            flagsByRule: round2.reviewFlags.reduce<Record<string, number>>((acc, f) => {
              acc[f.ruleId] = (acc[f.ruleId] ?? 0) + 1;
              return acc;
            }, {}),
            judgeUsage: round2.judgeUsage,
          }
        : undefined,
    };
  }

  const complete: Phase3CompleteFile = {
    phase: 3,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    hingeIndices: partial.hingeIndices,
    cqCatalog: partial.cqCatalog,
    advocates: { a: completeA, b: completeB },
    methodologist: completeMeth,
    totals: partial.totals,
    round2: round2Summary,
    reviewSummary,
    judgeUsage: partial.judgeUsage,
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_3_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function buildReviewSummary(
  cfg: OrchestratorConfig,
  reviewFlags: ReviewFlag[],
): Promise<Phase3CompleteFile["reviewSummary"]> {
  const flagsByRule: Record<string, number> = {};
  for (const f of reviewFlags) flagsByRule[f.ruleId] = (flagsByRule[f.ruleId] ?? 0) + 1;

  const reportPath = reportPathFor(cfg.runtimeDir, 3);
  if (existsSync(reportPath)) {
    const text = readFileSync(reportPath, "utf8");
    let verdicts;
    try {
      verdicts = parseReport(text);
    } catch (parseErr) {
      throw new Error(
        `Phase 3 finalize: review report at ${reportPath} could not be parsed: ${(parseErr as Error).message}`,
      );
    }
    const unapplied = verdicts.filter((v) => !v.applied);
    if (unapplied.length > 0) {
      throw new Error(
        `Phase 3 finalize refused: ${unapplied.length} flag(s) in the review report have no \`**Applied:**\` marker.`,
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
      `Phase 3 finalize refused: PHASE_3_PARTIAL.json has ${gating.length} non-info review flag(s) but no review report exists at ${reportPath}. ` +
        `Generate it with \`npm run orchestrator -- review --phase 3\`, fill in verdicts + Applied markers.`,
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

function buildCompleteAdvocate(rec: RebuttalRunRecord): Phase3CompleteAdvocate {
  if (rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) {
    throw new Error(`buildCompleteAdvocate: advocate ${rec.role} not in "ok" state.`);
  }
  const inputRebuttals = rec.llmOutput.rebuttals;
  const inputCqResponses = rec.llmOutput.cqResponses;

  const rebuttals: Phase3CompleteRebuttal[] = rec.mintResult.rebuttals.map((m) => {
    const orig = inputRebuttals[m.inputIndex];
    return {
      inputIndex: m.inputIndex,
      round: rec.llmOutput!.round ?? "1",
      rebuttalArgumentId: m.rebuttalArgumentId,
      targetArgumentId: m.targetArgumentId,
      targetKind: orig.targetKind ?? "phase2-arg",
      edgeId: m.edgeId,
      attackType: m.attackType,
      targetPremiseIndex: m.targetPremiseIndex,
      targetPremiseClaimId: m.targetPremiseClaimId,
      schemeKey: m.schemeKey,
      schemeId: m.schemeId,
      conclusionClaimId: m.conclusionClaimId,
      premiseClaimIds: m.premiseClaimIds,
      premiseTexts: orig.premises.map((p) => p.text),
      premiseCitationTokens: orig.premises.map((p) => p.citationToken ?? null),
      warrant: orig.warrant ?? null,
      cqKey: m.cqKey,
      conclusionText: orig.conclusionText,
      citations: m.citations,
    };
  });

  const cqResponses: Phase3CompleteCqResponse[] = rec.mintResult.cqResponses.map((m) => {
    const orig = inputCqResponses[m.inputIndex];
    return {
      inputIndex: m.inputIndex,
      round: rec.llmOutput!.round ?? "1",
      targetArgumentId: m.targetArgumentId,
      targetKind: orig.targetKind ?? "phase2-arg",
      cqKey: m.cqKey,
      action: m.action,
      rationale: orig.rationale,
      cqStatusId: m.cqStatusId,
      elidedByRebuttalCqKey: m.elidedByRebuttalCqKey,
    };
  });

  return {
    outcome: "ok",
    attempts: rec.attempts,
    tokenUsage: rec.tokenUsage,
    rebuttals,
    cqResponses,
  };
}

/**
 * Build the complete-file Methodologist record. Mirrors
 * `buildCompleteAdvocate` but propagates the per-item `targetAdvocateRole`
 * field from the LLM output (the translator stripped it; we re-attach
 * it here from `rec.llmOutput`).
 */
function buildCompleteMethodologist(
  rec: MethodologistRunRecord,
): Phase3CompleteMethodologist {
  if (rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) {
    throw new Error(`buildCompleteMethodologist: methodologist not in "ok" state.`);
  }
  const inputRebuttals = rec.llmOutput.rebuttals;
  const inputCqResponses = rec.llmOutput.cqResponses;

  const rebuttals: Phase3CompleteMethodologistRebuttal[] = rec.mintResult.rebuttals.map(
    (m) => {
      const orig = inputRebuttals[m.inputIndex];
      return {
        inputIndex: m.inputIndex,
        round: rec.llmOutput!.round ?? "1",
        rebuttalArgumentId: m.rebuttalArgumentId,
        targetArgumentId: m.targetArgumentId,
        targetKind: orig.targetKind ?? "phase2-arg",
        targetAdvocateRole: orig.targetAdvocateRole,
        edgeId: m.edgeId,
        attackType: m.attackType,
        targetPremiseIndex: m.targetPremiseIndex,
        targetPremiseClaimId: m.targetPremiseClaimId,
        schemeKey: m.schemeKey,
        schemeId: m.schemeId,
        conclusionClaimId: m.conclusionClaimId,
        premiseClaimIds: m.premiseClaimIds,
        premiseTexts: orig.premises.map((p) => p.text),
        premiseCitationTokens: orig.premises.map((p) => p.citationToken ?? null),
        warrant: orig.warrant ?? null,
        cqKey: m.cqKey,
        conclusionText: orig.conclusionText,
        citations: m.citations,
      };
    },
  );

  const cqResponses: Phase3CompleteMethodologistCqResponse[] =
    rec.mintResult.cqResponses.map((m) => {
      const orig = inputCqResponses[m.inputIndex];
      return {
        inputIndex: m.inputIndex,
        round: rec.llmOutput!.round ?? "1",
        targetArgumentId: m.targetArgumentId,
        targetKind: orig.targetKind ?? "phase2-arg",
        targetAdvocateRole: orig.targetAdvocateRole,
        cqKey: m.cqKey,
        action: m.action,
        rationale: orig.rationale,
        cqStatusId: m.cqStatusId,
        elidedByRebuttalCqKey: m.elidedByRebuttalCqKey,
      };
    });

  return {
    outcome: "ok",
    attempts: rec.attempts,
    tokenUsage: rec.tokenUsage,
    rebuttals,
    cqResponses,
  };
}
