/**
 * orchestrator/finalize/phase-5-finalize.ts
 *
 * Validates `PHASE_5_PARTIAL.json`, then writes `PHASE_5_COMPLETE.json`
 * and a human-readable `SYNTHESIS.md` rendered from the verdict.
 *
 * Phase 5 is read-only on the platform — there's no claim/edge audit to
 * perform. Validation just gates on `synthesist.outcome === "ok"`. If the
 * Synthesist refused or hit a validation error, finalize refuses and the
 * operator can inspect `runtime/refusals/phase-5-synthesist-refusal.json`
 * (refused) or rerun phase 5 (validation-error).
 *
 * There is no review-flag pattern for Phase 5 — the Synthesist's output
 * is fully validated by the Zod schema; nothing requires human flagging
 * the way advocate / rebuttal / defense outputs do.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type {
  Phase5PartialFile,
  SynthesistRunRecord,
} from "../phases/phase-5-synthesis";
import type { SynthesistVerdict } from "../agents/synthesist-schema";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface Phase5CompleteFile {
  phase: 5;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  synthesist: SynthesistRunRecord;
  /** Path to the rendered human-readable synthesis report. */
  synthesisReportPath: string;
}

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function finalizePhase5(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase5CompleteFile> {
  // iso is unused (Phase 5 is read-only) but kept for signature parity
  // with finalizePhase{1..4}.
  void opts.iso;

  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_5_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_5_PARTIAL.json not found. Run \`npm run orchestrator -- phase 5\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase5PartialFile;

  if (partial.synthesist.outcome !== "ok" || !partial.synthesist.verdict) {
    const detail =
      partial.synthesist.outcome === "refused"
        ? `Synthesist refused (${partial.synthesist.refusal?.error}). See ${partial.synthesist.refusalPath}.`
        : partial.synthesist.outcome === "validation-error"
          ? `Synthesist exhausted retries (${partial.synthesist.attempts} attempts). Inspect logs at ${partial.synthesist.artifacts.roundLogPath} and re-run phase 5.`
          : `Synthesist outcome="${partial.synthesist.outcome}".`;
    throw new Error(`Phase 5 finalize blocked: ${detail}`);
  }

  // Render the human-readable report.
  const synthesisReportPath = path.join(opts.cfg.runtimeDir, "SYNTHESIS.md");
  const md = renderSynthesisMarkdown(partial.synthesist.verdict, {
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    completedAt: new Date().toISOString(),
  });
  mkdirSync(path.dirname(synthesisReportPath), { recursive: true });
  writeFileSync(synthesisReportPath, md);

  const complete: Phase5CompleteFile = {
    phase: 5,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    hingeIndices: partial.hingeIndices,
    synthesist: partial.synthesist,
    synthesisReportPath,
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_5_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────────

function renderSynthesisMarkdown(
  v: SynthesistVerdict,
  meta: { deliberationId: string; modelTier: string; completedAt: string },
): string {
  const lines: string[] = [];
  lines.push(`# Deliberation Synthesis`);
  lines.push(``);
  lines.push(`- **Deliberation:** \`${meta.deliberationId}\``);
  lines.push(`- **Model tier:** ${meta.modelTier}`);
  lines.push(`- **Generated:** ${meta.completedAt}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── Net rating up top.
  lines.push(`## Net epistemic value: \`${v.epistemicShift.netEpistemicValue}\``);
  lines.push(``);
  lines.push(`> ${v.epistemicShift.netEpistemicValueRationale}`);
  lines.push(``);
  lines.push(`### How the central claim moved`);
  lines.push(``);
  lines.push(v.epistemicShift.centralClaimMovementSummary);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── Cruxes.
  lines.push(`## Cruxes (${v.cruxes.length})`);
  lines.push(``);
  for (let i = 0; i < v.cruxes.length; i++) {
    const c = v.cruxes[i];
    lines.push(`### ${i}. ${c.label}  \`[${c.status}]\``);
    if (c.subClaimIndex !== null) {
      lines.push(`*Sub-claim #${c.subClaimIndex}*`);
    } else {
      lines.push(`*Cuts across multiple sub-claims.*`);
    }
    lines.push(``);
    lines.push(`- **A maintains:** ${c.advocateAClaim}`);
    lines.push(`- **B maintains:** ${c.advocateBClaim}`);
    lines.push(``);
    lines.push(`**Why they disagree:** ${c.whyTheyDisagree}`);
    lines.push(``);
    if (c.keyArgumentIds.length) {
      lines.push(`*Key ids:* \`${c.keyArgumentIds.join("`, `")}\``);
    }
    if (c.resolvedByOpenQuestions.length) {
      lines.push(
        `*Open questions that would resolve:* ${c.resolvedByOpenQuestions
          .map((idx) => `[#${idx}](#open-question-${idx})`)
          .join(", ")}`,
      );
    }
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);

  // ── Agreements.
  lines.push(`## Agreements (${v.agreements.length})`);
  lines.push(``);
  if (v.agreements.length === 0) {
    lines.push(`*No agreements identified.*`);
    lines.push(``);
  }
  for (let i = 0; i < v.agreements.length; i++) {
    const a = v.agreements[i];
    lines.push(`### ${i}. ${a.label}  \`[${a.origin}]\``);
    lines.push(``);
    lines.push(a.proposition);
    lines.push(``);
    if (a.basisInRecord.length) {
      lines.push(`*Basis:* \`${a.basisInRecord.join("`, `")}\``);
    }
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);

  // ── Original contributions.
  lines.push(`## Original contributions (${v.originalContributions.length})`);
  lines.push(``);
  if (v.originalContributions.length === 0) {
    lines.push(`*No original contributions identified.*`);
    lines.push(``);
  }
  for (let i = 0; i < v.originalContributions.length; i++) {
    const o = v.originalContributions[i];
    lines.push(`### ${i}. ${o.label}  \`[${o.type}]\`  *— ${o.attribution}*`);
    lines.push(``);
    lines.push(o.description);
    lines.push(``);
    lines.push(`**Novelty:** ${o.noveltyJustification}`);
    lines.push(``);
    if (o.contributingIds.length) {
      lines.push(`*Contributing ids:* \`${o.contributingIds.join("`, `")}\``);
    }
    if (o.evidenceTokens.length) {
      lines.push(`*Evidence:* \`${o.evidenceTokens.join("`, `")}\``);
    }
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);

  // ── Open questions.
  lines.push(`## Open questions (${v.openQuestions.length})`);
  lines.push(``);
  if (v.openQuestions.length === 0) {
    lines.push(`*No open questions identified.*`);
    lines.push(``);
  }
  for (let i = 0; i < v.openQuestions.length; i++) {
    const q = v.openQuestions[i];
    lines.push(`### ${i}. <a id="open-question-${i}"></a>  \`[${q.resolutionType}]\``);
    lines.push(``);
    lines.push(`**Q:** ${q.question}`);
    lines.push(``);
    lines.push(`**How it resolves:** ${q.resolutionSketch}`);
    lines.push(``);
    if (q.resolvesCruxIndices.length) {
      lines.push(
        `*Resolves cruxes:* ${q.resolvesCruxIndices.map((idx) => `#${idx}`).join(", ")}`,
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}
