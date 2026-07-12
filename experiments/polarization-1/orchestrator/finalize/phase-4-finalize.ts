/**
 * orchestrator/finalize/phase-4-finalize.ts
 *
 * Validates platform state against `PHASE_4_PARTIAL.json`, then writes
 * `PHASE_4_COMPLETE.json` (the gate Stage 6 / final analysis reads) and
 * recomputes grounded standings.
 *
 * Audit (read-only):
 *   - Both advocates must have outcome === "ok".
 *   - The Concession Tracker must have outcome === "ok".
 *   - Every defense Argument id and every defense → rebuttal ArgumentEdge
 *     id from the mint result must still exist.
 *   - Every narrow-variant Argument id (if any) must still exist.
 *   - Every retracted Commitment claim must show isRetracted=true.
 *   - Every CQStatus id from cqAnswers must still exist.
 *
 * Review-flag gating: same shape as Phase 2/3.
 *
 * Side-effects:
 *   - Calls `recomputeGroundedForDelib(deliberationId)` so the grounded
 *     standings reflect the new defense edges + commitment retracts.
 *
 * Output: `PHASE_4_COMPLETE.json` — the canonical Stage-5 manifest.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type {
  Phase4PartialFile,
  DefenseRunRecord,
  TrackerRunRecord,
} from "../phases/phase-4-defenses";
import type { Phase4SubRoundBPartialFile } from "../phases/phase-4-subround-b";
import type { ReviewFlag } from "../review/phase-4-checks";
import { parseReport, reportPathFor } from "../review/report";
import { prisma } from "@/lib/prismaclient";
import { recomputeGroundedForDelib } from "@/lib/ceg/grounded";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface Phase4CompleteResponse {
  inputIndex: number;
  /** Iter-3: which sub-round the response was filed in. "a" =
   *  sub-round-a (Iter-2 default), "b" = sub-round-b (defends round-2
   *  attacks). Items merged from `PHASE_4_SUBROUNDB_PARTIAL.json`
   *  carry `"b"`. */
  subRound: "a" | "b";
  targetAttackId: string;
  kind: "defend" | "concede" | "narrow";
  rationale: string;
  defenseArgumentId: string | null;
  defenseEdgeId: string | null;
  narrowedConclusionClaimId: string | null;
  narrowVariantArgumentId: string | null;
  retractedCommitmentClaimId: string | null;
  cqStatusIdRejected: string | null;
  /** When kind="defend": the defense's attackType + targeting (mirrors LLM output). */
  defense: {
    attackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
    targetPremiseIndex: number | null;
    conclusionText: string;
    schemeKey: string;
    warrant: string | null;
    premiseTexts: string[];
    premiseCitationTokens: Array<string | null>;
  } | null;
  narrowedConclusionText: string | null;
  citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
}

export interface Phase4CompleteCqAnswer {
  inputIndex: number;
  /** Iter-3: which sub-round the cqAnswer was filed in. */
  subRound: "a" | "b";
  targetCqRaiseId: string;
  kind: "answer" | "concede";
  rationale: string;
  cqStatusId: string;
}

export interface Phase4CompleteAdvocate {
  outcome: "ok";
  attempts: number;
  /** Iter-3 multi-sub-round indicator. "a" = sub-round-a (Iter-2 default), "b" = sub-round-b. */
  subRound: "a" | "b";
  tokenUsage: { inputTokens: number; outputTokens: number };
  responses: Phase4CompleteResponse[];
  cqAnswers: Phase4CompleteCqAnswer[];
}

/** Iter-3: per-advocate summary of the sub-round-b pass. */
export interface SubRoundBAdvocateSummary {
  outcome: string;
  attempts: number;
  responsesMerged: number;
  cqAnswersMerged: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export interface Phase4CompleteFile {
  phase: 4;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  advocates: { a: Phase4CompleteAdvocate; b: Phase4CompleteAdvocate };
  tracker: TrackerRunRecord;
  totals: Phase4PartialFile["totals"];
  /** Iter-3: per-advocate summary for the sub-round-b pass. Absent when
   *  `iter3MultiRound` is off or the sub-round-b driver never ran.
   *  Mints from "ok" advocates are merged inline into
   *  `advocates.{a,b}.responses` / `cqAnswers` (each tagged
   *  `subRound: "b"`); non-"ok" advocates are recorded here for audit
   *  only. */
  subRoundB?: {
    a?: SubRoundBAdvocateSummary;
    b?: SubRoundBAdvocateSummary;
    totals: Phase4SubRoundBPartialFile["totals"];
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
  /** Result of the post-finalize standings recompute. */
  standingsRecompute: {
    ranAt: string;
    deliberationId: string;
    /** Number of arguments updated (best-effort; depends on grounded.ts return shape). */
    affectedCount?: number;
  };
}

export async function finalizePhase4(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase4CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_4_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_4_PARTIAL.json not found. Run \`npm run orchestrator -- phase 4\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase4PartialFile;

  // ── Iter-3: load sub-round-b partial when present + flag enabled ──
  let subRoundB: Phase4SubRoundBPartialFile | null = null;
  if (opts.cfg.iter3MultiRound) {
    const subbPath = path.join(opts.cfg.runtimeDir, "PHASE_4_SUBROUNDB_PARTIAL.json");
    if (existsSync(subbPath)) {
      subRoundB = JSON.parse(readFileSync(subbPath, "utf8")) as Phase4SubRoundBPartialFile;
    }
  }

  // ── 1. Both advocates must have outcome === "ok" + tracker must have run ──
  const a = partial.advocates.a;
  const b = partial.advocates.b;
  const okA = a?.outcome === "ok";
  const okB = b?.outcome === "ok";
  if (!okA || !okB) {
    const status = (rec?: DefenseRunRecord) => (rec ? rec.outcome : "missing");
    throw new Error(
      `Phase 4 finalize refused: both advocates must have outcome="ok". ` +
        `Got A=${status(a)}, B=${status(b)}. ` +
        `Re-run \`npm run orchestrator -- phase 4 --resume\` to retry the failed/missing advocate(s).`,
    );
  }
  if (partial.tracker.outcome !== "ok") {
    throw new Error(
      `Phase 4 finalize refused: Concession Tracker has outcome="${partial.tracker.outcome}". ` +
        `Re-run \`npm run orchestrator -- phase 4 --resume\` (the tracker re-runs automatically when both advocates are ok).`,
    );
  }

  // ── 2. Argument + edge + commitment + CQStatus audit ──
  const expectedDefenseArgIds = new Set<string>();
  const expectedDefenseEdgeIds = new Set<string>();
  const expectedNarrowArgIds = new Set<string>();
  const expectedRetractedClaimIds = new Set<string>();
  const expectedCqStatusIds = new Set<string>();

  for (const rec of [a!, b!]) {
    if (!rec.mintResult) continue;
    for (const r of rec.mintResult.responses) {
      if (r.defenseArgumentId) expectedDefenseArgIds.add(r.defenseArgumentId);
      if (r.defenseEdgeId) expectedDefenseEdgeIds.add(r.defenseEdgeId);
      if (r.narrowVariantArgumentId) expectedNarrowArgIds.add(r.narrowVariantArgumentId);
      if (r.retractedCommitmentClaimId) expectedRetractedClaimIds.add(r.retractedCommitmentClaimId);
      if (r.cqStatusIdRejected) expectedCqStatusIds.add(r.cqStatusIdRejected);
    }
    for (const c of rec.mintResult.cqAnswers) {
      if (c.cqStatusId) expectedCqStatusIds.add(c.cqStatusId);
    }
  }

  // Iter-3: include sub-round-b "ok" advocate mints in the audit set.
  if (subRoundB) {
    const subActors = [subRoundB.advocates.a, subRoundB.advocates.b] as const;
    for (const rec of subActors) {
      if (!rec || rec.outcome !== "ok" || !rec.mintResult) continue;
      for (const r of rec.mintResult.responses) {
        if (r.defenseArgumentId) expectedDefenseArgIds.add(r.defenseArgumentId);
        if (r.defenseEdgeId) expectedDefenseEdgeIds.add(r.defenseEdgeId);
        if (r.narrowVariantArgumentId) expectedNarrowArgIds.add(r.narrowVariantArgumentId);
        if (r.retractedCommitmentClaimId) expectedRetractedClaimIds.add(r.retractedCommitmentClaimId);
        if (r.cqStatusIdRejected) expectedCqStatusIds.add(r.cqStatusIdRejected);
      }
      for (const c of rec.mintResult.cqAnswers) {
        if (c.cqStatusId) expectedCqStatusIds.add(c.cqStatusId);
      }
    }
  }

  const divergences: string[] = [];

  if (expectedDefenseArgIds.size > 0 || expectedNarrowArgIds.size > 0) {
    const allArgIds = [...expectedDefenseArgIds, ...expectedNarrowArgIds];
    const present = await prisma.argument.findMany({
      where: { id: { in: allArgIds } },
      select: { id: true },
    });
    const observed = new Set(present.map((r) => r.id));
    for (const id of expectedDefenseArgIds) {
      if (!observed.has(id)) divergences.push(`Defense Argument ${id} not present in DB.`);
    }
    for (const id of expectedNarrowArgIds) {
      if (!observed.has(id)) divergences.push(`Narrow-variant Argument ${id} not present in DB.`);
    }
  }
  if (expectedDefenseEdgeIds.size > 0) {
    const present = await prisma.argumentEdge.findMany({
      where: { id: { in: [...expectedDefenseEdgeIds] } },
      select: { id: true },
    });
    const observed = new Set(present.map((r) => r.id));
    for (const id of expectedDefenseEdgeIds) {
      if (!observed.has(id)) divergences.push(`Defense ArgumentEdge ${id} not present in DB.`);
    }
  }
  if (expectedRetractedClaimIds.size > 0) {
    // Commitment is keyed by (deliberationId, participantId, proposition);
    // the partial only carries the Claim id of the retracted proposition.
    // Audit: confirm that every claimId we said we retracted has at least
    // one Commitment row with isRetracted=true on this deliberation.
    const claims = await prisma.claim.findMany({
      where: { id: { in: [...expectedRetractedClaimIds] } },
      select: { id: true, text: true },
    });
    const claimById = new Map(claims.map((c) => [c.id, c.text] as const));
    for (const claimId of expectedRetractedClaimIds) {
      const text = claimById.get(claimId);
      if (!text) {
        divergences.push(`Retracted Commitment target Claim ${claimId} not present in DB.`);
        continue;
      }
      const matches = await prisma.commitment.count({
        where: {
          deliberationId: partial.deliberationId,
          proposition: text,
          isRetracted: true,
        },
      });
      if (matches === 0) {
        divergences.push(
          `No retracted Commitment found for Claim ${claimId} ("${text.slice(0, 80)}...") in deliberation ${partial.deliberationId}.`,
        );
      }
    }
  }
  if (expectedCqStatusIds.size > 0) {
    const present = await prisma.cQStatus.findMany({
      where: { id: { in: [...expectedCqStatusIds] } },
      select: { id: true },
    });
    const observed = new Set(present.map((r) => r.id));
    for (const id of expectedCqStatusIds) {
      if (!observed.has(id)) divergences.push(`CQStatus ${id} not present in DB.`);
    }
  }

  if (divergences.length > 0) {
    const divPath = path.join(opts.cfg.runtimeDir, "reviews", "phase-4-divergence.md");
    mkdirSync(path.dirname(divPath), { recursive: true });
    writeFileSync(
      divPath,
      `# Phase 4 Finalization — Divergence Detected\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        divergences.map((d) => `- ${d}`).join("\n") + "\n\n" +
        `Likely causes:\n` +
        `  - A defense Argument / edge / commitment was manually deleted between phase 4 and finalize.\n` +
        `  - Phase 4 was partially re-run and the orphan-guard cascade removed prior rows.\n` +
        `  - Global MOID dedup bound a premise text to a claim row already attached to a\n` +
        `    *different* deliberation; the defense/edge was created successfully but the\n` +
        `    premise claim doesn't appear in this deliberation's claim listing.\n\n` +
        `Set FINALIZE_SOFT_DIVERGENCE=1 to log+continue (treat as soft warning) when the\n` +
        `divergence is benign (e.g. cross-deliberation MOID dedup).\n\n` +
        `Resolve by re-running \`npm run orchestrator -- phase 4\` against the current Phase 3 state.\n`,
    );
    if (process.env.FINALIZE_SOFT_DIVERGENCE === "1") {
      // eslint-disable-next-line no-console
      console.warn(
        `[finalize-phase4] FINALIZE_SOFT_DIVERGENCE=1 → continuing despite ${divergences.length} divergence(s); see ${divPath}.`,
      );
    } else {
      throw new Error(`Phase 4 finalize refused: ${divergences.length} divergence(s). See ${divPath}.`);
    }
  }

  // ── 3. Review-flag gating ──
  const reviewSummary = await buildReviewSummary(opts.cfg, partial.reviewFlags);

  // ── 4. Recompute standings ──
  let affectedCount: number | undefined;
  try {
    const result = await recomputeGroundedForDelib(partial.deliberationId);
    if (result && typeof (result as any).affectedCount === "number") {
      affectedCount = (result as any).affectedCount;
    }
  } catch (err) {
    throw new Error(
      `Phase 4 finalize: standings recompute failed for deliberation ${partial.deliberationId}: ${(err as Error).message}`,
    );
  }

  // ── 5. Build complete file ──
  const completeA = buildCompleteAdvocate(a!);
  const completeB = buildCompleteAdvocate(b!);

  // Iter-3: merge sub-round-b mints into the sub-round-a records
  // (per-item `subRound` field discriminates).
  let subRoundBSummary: Phase4CompleteFile["subRoundB"] | undefined;
  if (subRoundB) {
    const summarize = (
      rec: DefenseRunRecord | undefined,
      mergedResponses: number,
      mergedCqs: number,
    ): SubRoundBAdvocateSummary | undefined =>
      rec
        ? {
            outcome: rec.outcome,
            attempts: rec.attempts,
            responsesMerged: mergedResponses,
            cqAnswersMerged: mergedCqs,
            tokenUsage: rec.tokenUsage,
          }
        : undefined;

    const sbA = subRoundB.advocates.a;
    if (sbA?.outcome === "ok" && sbA.mintResult && sbA.llmOutput) {
      const built = buildCompleteAdvocate(sbA);
      completeA.responses.push(...built.responses);
      completeA.cqAnswers.push(...built.cqAnswers);
      completeA.attempts += sbA.attempts;
      completeA.tokenUsage.inputTokens += sbA.tokenUsage.inputTokens;
      completeA.tokenUsage.outputTokens += sbA.tokenUsage.outputTokens;
    }
    const sbB = subRoundB.advocates.b;
    if (sbB?.outcome === "ok" && sbB.mintResult && sbB.llmOutput) {
      const built = buildCompleteAdvocate(sbB);
      completeB.responses.push(...built.responses);
      completeB.cqAnswers.push(...built.cqAnswers);
      completeB.attempts += sbB.attempts;
      completeB.tokenUsage.inputTokens += sbB.tokenUsage.inputTokens;
      completeB.tokenUsage.outputTokens += sbB.tokenUsage.outputTokens;
    }

    subRoundBSummary = {
      a: summarize(
        sbA,
        sbA?.outcome === "ok" ? (sbA.mintResult?.responses.length ?? 0) : 0,
        sbA?.outcome === "ok" ? (sbA.mintResult?.cqAnswers.length ?? 0) : 0,
      ),
      b: summarize(
        sbB,
        sbB?.outcome === "ok" ? (sbB.mintResult?.responses.length ?? 0) : 0,
        sbB?.outcome === "ok" ? (sbB.mintResult?.cqAnswers.length ?? 0) : 0,
      ),
      totals: subRoundB.totals,
    };
  }

  const complete: Phase4CompleteFile = {
    phase: 4,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    hingeIndices: partial.hingeIndices,
    advocates: { a: completeA, b: completeB },
    tracker: partial.tracker,
    totals: partial.totals,
    subRoundB: subRoundBSummary,
    reviewSummary,
    judgeUsage: partial.judgeUsage,
    standingsRecompute: {
      ranAt: new Date().toISOString(),
      deliberationId: partial.deliberationId,
      affectedCount,
    },
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_4_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function buildReviewSummary(
  cfg: OrchestratorConfig,
  reviewFlags: ReviewFlag[],
): Promise<Phase4CompleteFile["reviewSummary"]> {
  const flagsByRule: Record<string, number> = {};
  for (const f of reviewFlags) flagsByRule[f.ruleId] = (flagsByRule[f.ruleId] ?? 0) + 1;

  const reportPath = reportPathFor(cfg.runtimeDir, 4);
  if (existsSync(reportPath)) {
    const text = readFileSync(reportPath, "utf8");
    let verdicts;
    try {
      verdicts = parseReport(text);
    } catch (parseErr) {
      throw new Error(
        `Phase 4 finalize: review report at ${reportPath} could not be parsed: ${(parseErr as Error).message}`,
      );
    }
    const unapplied = verdicts.filter((v) => !v.applied);
    if (unapplied.length > 0) {
      throw new Error(
        `Phase 4 finalize refused: ${unapplied.length} flag(s) in the review report have no \`**Applied:**\` marker.`,
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
      `Phase 4 finalize refused: PHASE_4_PARTIAL.json has ${gating.length} non-info review flag(s) but no review report exists at ${reportPath}. ` +
        `Generate it with \`npm run orchestrator -- review --phase 4\`, fill in verdicts + Applied markers.`,
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

function buildCompleteAdvocate(rec: DefenseRunRecord): Phase4CompleteAdvocate {
  if (rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) {
    throw new Error(`buildCompleteAdvocate: advocate ${rec.role} not in "ok" state.`);
  }
  const inputResponses = rec.llmOutput.responses;
  const inputCqAnswers = rec.llmOutput.cqAnswers;
  const subRound: "a" | "b" = rec.llmOutput.subRound ?? "a";

  const responses: Phase4CompleteResponse[] = rec.mintResult.responses.map((m) => {
    const orig = inputResponses[m.inputIndex];
    return {
      inputIndex: m.inputIndex,
      subRound,
      targetAttackId: m.targetAttackId,
      kind: m.kind,
      rationale: orig.rationale,
      defenseArgumentId: m.defenseArgumentId,
      defenseEdgeId: m.defenseEdgeId,
      narrowedConclusionClaimId: m.narrowedConclusionClaimId,
      narrowVariantArgumentId: m.narrowVariantArgumentId,
      retractedCommitmentClaimId: m.retractedCommitmentClaimId,
      cqStatusIdRejected: m.cqStatusIdRejected,
      defense: orig.defense
        ? {
            attackType: orig.defense.attackType,
            targetPremiseIndex: orig.defense.targetPremiseIndex,
            conclusionText: orig.defense.conclusionText,
            schemeKey: orig.defense.schemeKey,
            warrant: orig.defense.warrant ?? null,
            premiseTexts: orig.defense.premises.map((p) => p.text),
            premiseCitationTokens: orig.defense.premises.map((p) => p.citationToken ?? null),
          }
        : null,
      narrowedConclusionText: orig.narrowedConclusionText ?? null,
      citations: m.citations,
    };
  });

  const cqAnswers: Phase4CompleteCqAnswer[] = rec.mintResult.cqAnswers.map((m) => {
    const orig = inputCqAnswers[m.inputIndex];
    return {
      inputIndex: m.inputIndex,
      subRound,
      targetCqRaiseId: m.targetCqRaiseId,
      kind: m.kind,
      rationale: orig.rationale,
      cqStatusId: m.cqStatusId,
    };
  });

  return {
    outcome: "ok",
    attempts: rec.attempts,
    subRound,
    tokenUsage: rec.tokenUsage,
    responses,
    cqAnswers,
  };
}
