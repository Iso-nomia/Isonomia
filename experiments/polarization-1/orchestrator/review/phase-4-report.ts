/**
 * orchestrator/review/phase-4-report.ts
 *
 * Phase-4 review-report Markdown generator. Mirrors phase-2/3-report
 * exactly — same per-flag block format and verdict-line shape so the
 * shared parser in `report.ts` works without modification.
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import { reportPathFor } from "./report";
import type { Phase4PartialFile } from "../phases/phase-4-defenses";

export function produceReportPhase4(opts: {
  partial: Phase4PartialFile;
  runtimeDir: string;
  force?: boolean;
}): { path: string } {
  const out = reportPathFor(opts.runtimeDir, 4);
  if (existsSync(out) && !opts.force) {
    throw new Error(`Review report already exists at ${out}. Pass --force to overwrite.`);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportMarkdownPhase4(opts.partial));
  return { path: out };
}

export function renderReportMarkdownPhase4(partial: Phase4PartialFile): string {
  const lines: string[] = [];
  lines.push(`# Phase 4 Review Report (Concessions & Defenses)`);
  lines.push(``);
  lines.push(`- Deliberation: \`${partial.deliberationId}\``);
  lines.push(`- Generated: ${partial.generatedAt}`);
  lines.push(`- Model tier: ${partial.modelTier}`);
  lines.push(`- Evidence stack: \`${partial.evidenceStackId}\``);
  lines.push(`- Hinges: ${partial.hingeIndices.map((h) => `#${h}`).join(", ") || "(none)"}`);
  lines.push(``);
  lines.push(`## Run summary`);
  lines.push(``);
  for (const role of ["a", "b"] as const) {
    const rec = role === "a" ? partial.advocates.a : partial.advocates.b;
    if (!rec) {
      lines.push(`- **Advocate ${role.toUpperCase()}:** _not run_`);
      continue;
    }
    const t = rec.mintResult?.totals;
    const defended = t?.defensesCreated ?? 0;
    const conceded = t?.concedesApplied ?? 0;
    const narrowed = t?.narrowsCreated ?? 0;
    lines.push(
      `- **Advocate ${role.toUpperCase()}:** outcome=${rec.outcome}, attempts=${rec.attempts}, ` +
        `defenses=${defended}, concedes=${conceded}, narrows=${narrowed}, ` +
        `tokens(in/out)=${rec.tokenUsage.inputTokens}/${rec.tokenUsage.outputTokens}`,
    );
  }
  lines.push(``);
  lines.push(`- **Tracker:** outcome=${partial.tracker.outcome}` +
    (partial.tracker.verdict
      ? `, central-claim verdict=${partial.tracker.verdict.centralClaimVerdict.verdict}`
      : ``) +
    (partial.tracker.tokenUsage
      ? `, tokens(in/out)=${partial.tracker.tokenUsage.inputTokens}/${partial.tracker.tokenUsage.outputTokens}`
      : ``));
  lines.push(``);
  lines.push(
    `Totals: ${partial.totals.defensesCreated} defenses, ${partial.totals.concedesApplied} concedes, ` +
      `${partial.totals.narrowsCreated} narrows, ${partial.totals.edgesCreated} attack edges, ` +
      `${partial.totals.commitmentsRetracted} commitments retracted, ` +
      `${partial.totals.cqStatusesUpserted} CQ statuses, ` +
      `${partial.totals.premiseClaimsMinted} premise claims minted ` +
      `(+${partial.totals.premiseClaimsDeduped} deduped), ` +
      `${partial.totals.citationsAttached} citations.`,
  );
  lines.push(``);

  const flags = partial.reviewFlags as Array<{
    ruleId: string;
    severity: string;
    message: string;
    evidence?: unknown;
  }>;
  lines.push(`## Flags (${flags.length})`);
  lines.push(``);
  lines.push(`> For each flag below, check **exactly one** verdict box. Add notes after \`Notes:\`.`);
  lines.push(`> Then add an \`**Applied:** <ts>\` line under each verdict to mark the flag as resolved.`);
  lines.push(`> finalize will refuse until every flag carries an \`**Applied:**\` marker.`);
  lines.push(``);

  if (flags.length === 0) {
    lines.push(`_No soft-flag issues detected._`);
    lines.push(``);
  } else {
    flags.forEach((f, i) => {
      lines.push(`## Flag ${i + 1}: ${f.ruleId} (${f.severity})`);
      lines.push(``);
      lines.push(f.message);
      lines.push(``);
      lines.push(`**Verdict:** [ ] accept  [ ] revise  [ ] retract  Notes:`);
      lines.push(``);
      if (f.evidence !== undefined) {
        lines.push(`<details><summary>Evidence</summary>`);
        lines.push(``);
        lines.push("```json");
        lines.push(JSON.stringify(f.evidence, null, 2));
        lines.push("```");
        lines.push(``);
        lines.push(`</details>`);
        lines.push(``);
      }
    });
  }

  // Tracker verdict block.
  if (partial.tracker.verdict) {
    const v = partial.tracker.verdict;
    lines.push(`## Tracker verdict`);
    lines.push(``);
    lines.push(`**Central claim:** ${v.centralClaimVerdict.verdict}`);
    lines.push(``);
    lines.push(`> ${v.centralClaimVerdict.rationale}`);
    lines.push(``);
    for (const role of ["A", "B"] as const) {
      const summary = v.advocateSummaries.find((s) => s.advocateRole === role);
      if (!summary) {
        lines.push(`- **Advocate ${role}:** _no summary_`);
        continue;
      }
      lines.push(
        `- **Advocate ${role}:** stood=${summary.stoodCount}, ` +
          `weakened=${summary.weakenedCount}, fallen=${summary.fallenCount} ` +
          `(hinges stood=${summary.hingeStandings.stoodCount}, ` +
          `weakened=${summary.hingeStandings.weakenedCount}, fallen=${summary.hingeStandings.fallenCount}); ` +
          `concession-discrimination=${summary.concessionDiscrimination}`,
      );
    }
    lines.push(``);
  }

  lines.push(`## Manual review (no auto-flag)`);
  lines.push(``);
  lines.push(`- [ ] **Defense quality (spot-check):** sample 3–5 defenses and verify they actually engage the rebuttal's logic`);
  lines.push(`- [ ] **Concession honesty:** sample concedes and verify the rationale identifies why the rebuttal was decisive`);
  lines.push(`- [ ] **Narrow plausibility:** sample narrows and verify the narrowed conclusion is genuinely weaker (not a paraphrase)`);
  lines.push(`- [ ] **Tracker calibration:** independently sanity-check the tracker's central-claim verdict against the visible attack/defense pattern`);
  lines.push(``);

  return lines.join("\n");
}
