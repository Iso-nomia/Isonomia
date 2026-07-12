/**
 * orchestrator/review/phase-3-report.ts
 *
 * Phase-3 review-report Markdown generator. Mirrors `phase-2-report.ts`
 * exactly — same per-flag block format and verdict-line shape so the
 * shared parser in `report.ts` works without modification.
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import { reportPathFor } from "./report";
import type { Phase3PartialFile } from "../phases/phase-3-attacks";

export function produceReportPhase3(opts: {
  partial: Phase3PartialFile;
  runtimeDir: string;
  force?: boolean;
}): { path: string } {
  const out = reportPathFor(opts.runtimeDir, 3);
  if (existsSync(out) && !opts.force) {
    throw new Error(`Review report already exists at ${out}. Pass --force to overwrite.`);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportMarkdownPhase3(opts.partial));
  return { path: out };
}

export function renderReportMarkdownPhase3(partial: Phase3PartialFile): string {
  const lines: string[] = [];
  lines.push(`# Phase 3 Review Report (Dialectical Testing)`);
  lines.push(``);
  lines.push(`- Deliberation: \`${partial.deliberationId}\``);
  lines.push(`- Generated: ${partial.generatedAt}`);
  lines.push(`- Model tier: ${partial.modelTier}`);
  lines.push(`- Evidence stack: \`${partial.evidenceStackId}\``);
  lines.push(`- Hinges: ${partial.hingeIndices.map((h) => `#${h}`).join(", ") || "(none)"}`);
  lines.push(`- CQ catalog: ${Object.keys(partial.cqCatalog).length} schemes, ` +
    `${Object.values(partial.cqCatalog).reduce((n, s) => n + s.cqKeys.length, 0)} CQ keys`);
  lines.push(``);
  lines.push(`## Run summary`);
  lines.push(``);
  for (const role of ["a", "b"] as const) {
    const rec = role === "a" ? partial.advocates.a : partial.advocates.b;
    if (!rec) {
      lines.push(`- **Advocate ${role.toUpperCase()}:** _not run_`);
      continue;
    }
    const rebuttalCount = rec.outcome === "ok" ? rec.mintResult?.totals.rebuttalsCreated ?? 0 : 0;
    const cqCount = rec.outcome === "ok" ? rec.mintResult?.totals.cqStatusesUpserted ?? 0 : 0;
    lines.push(
      `- **Advocate ${role.toUpperCase()}:** outcome=${rec.outcome}, attempts=${rec.attempts}, ` +
        `rebuttals=${rebuttalCount}, cqStatuses=${cqCount}, ` +
        `tokens(in/out)=${rec.tokenUsage.inputTokens}/${rec.tokenUsage.outputTokens}`,
    );
  }
  lines.push(``);
  lines.push(
    `Totals: ${partial.totals.rebuttalsCreated} rebuttals, ${partial.totals.edgesCreated} attack edges, ` +
      `${partial.totals.cqStatusesUpserted} CQ statuses, ` +
      `${partial.totals.premiseClaimsMinted} premise claims minted ` +
      `(+${partial.totals.premiseClaimsDeduped} deduped), ` +
      `${partial.totals.citationsAttached} citations.`,
  );
  if (partial.judgeUsage) {
    lines.push(``);
    lines.push(`Evidence-fidelity judge: ${partial.judgeUsage.calls} calls, ` +
      `tokens(in/out)=${partial.judgeUsage.inputTokens}/${partial.judgeUsage.outputTokens}.`);
  }
  lines.push(``);

  lines.push(`## Flags (${partial.reviewFlags.length})`);
  lines.push(``);
  lines.push(`> For each flag below, check **exactly one** verdict box. Add notes after \`Notes:\`.`);
  lines.push(`> Then add an \`**Applied:** <ts>\` line under each verdict to mark the flag as resolved.`);
  lines.push(`> finalize will refuse until every flag carries an \`**Applied:**\` marker.`);
  lines.push(``);

  if (partial.reviewFlags.length === 0) {
    lines.push(`_No soft-flag issues detected._`);
    lines.push(``);
  } else {
    partial.reviewFlags.forEach((f, i) => {
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

  lines.push(`## Manual review (no auto-flag)`);
  lines.push(``);
  lines.push(`- [ ] **Attack coverage:** each side mounted attacks against opponent's hinge arguments`);
  lines.push(`- [ ] **Defense restraint:** no rebuttal is a paraphrase of the advocate's own Phase-2 case`);
  lines.push(`- [ ] **CQ honesty (spot-check):** sample 3–5 raised CQs and verify the rationale identifies a real weakness, not boilerplate`);
  lines.push(`- [ ] **Skeptical proportionality (B):** B's REBUTs do not overshoot ("no algorithmic effects exist") past the framing's ≥10% threshold`);
  lines.push(``);

  return lines.join("\n");
}
