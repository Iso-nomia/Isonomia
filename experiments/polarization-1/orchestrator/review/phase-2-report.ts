/**
 * orchestrator/review/phase-2-report.ts
 *
 * Phase-2 review-report Markdown generator. Reuses the shared parser in
 * `report.ts` (the verdict-line format is phase-agnostic).
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import { reportPathFor } from "./report";
import type { Phase2PartialFile } from "../phases/phase-2-arguments";

export function produceReportPhase2(opts: {
  partial: Phase2PartialFile;
  runtimeDir: string;
  force?: boolean;
}): { path: string } {
  const out = reportPathFor(opts.runtimeDir, 2);
  if (existsSync(out) && !opts.force) {
    throw new Error(`Review report already exists at ${out}. Pass --force to overwrite.`);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportMarkdownPhase2(opts.partial));
  return { path: out };
}

export function renderReportMarkdownPhase2(partial: Phase2PartialFile): string {
  const lines: string[] = [];
  lines.push(`# Phase 2 Review Report`);
  lines.push(``);
  lines.push(`- Deliberation: \`${partial.deliberationId}\``);
  lines.push(`- Generated: ${partial.generatedAt}`);
  lines.push(`- Model tier: ${partial.modelTier}`);
  lines.push(`- Evidence stack: \`${partial.evidenceStackId}\``);
  lines.push(`- Sub-claims: ${partial.topologyBinding.count}`);
  lines.push(`- Hinges: ${partial.topologyBinding.hingeIndices.map((h) => `#${h}`).join(", ") || "(none)"}`);
  lines.push(``);
  lines.push(`## Run summary`);
  lines.push(``);
  for (const role of ["a", "b"] as const) {
    const rec = role === "a" ? partial.advocates.a : partial.advocates.b;
    if (!rec) {
      lines.push(`- **Advocate ${role.toUpperCase()}:** _not run_`);
      continue;
    }
    const argCount = rec.outcome === "ok" ? rec.mintResult?.totals.argumentsCreated ?? 0 : 0;
    lines.push(
      `- **Advocate ${role.toUpperCase()}:** outcome=${rec.outcome}, attempts=${rec.attempts}, ` +
        `arguments=${argCount}, tokens(in/out)=${rec.tokenUsage.inputTokens}/${rec.tokenUsage.outputTokens}`,
    );
  }
  lines.push(``);
  lines.push(`Totals: ${partial.totals.argumentsCreated} args, ` +
    `${partial.totals.premiseClaimsMinted} premise claims minted ` +
    `(+${partial.totals.premiseClaimsDeduped} deduped), ` +
    `${partial.totals.citationsAttached} citations.`);
  if (partial.judgeUsage) {
    lines.push(``);
    lines.push(`Evidence-fidelity judge: ${partial.judgeUsage.calls} calls, ` +
      `tokens(in/out)=${partial.judgeUsage.inputTokens}/${partial.judgeUsage.outputTokens}.`);
  }
  lines.push(``);

  lines.push(`## Flags (${partial.reviewFlags.length})`);
  lines.push(``);
  lines.push(`> For each flag below, check **exactly one** verdict box. Add notes after \`Notes:\`.`);
  lines.push(`> Then run: \`npm run orchestrator -- review --phase 2 --apply\``);
  lines.push(``);

  if (partial.reviewFlags.length === 0) {
    lines.push(`_No soft-flag issues detected._`);
    lines.push(``);
  } else {
    // Group by ruleId for readability, but preserve original ordering for
    // flagIndex (the parser keys on "## Flag N").
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
  lines.push(`- [ ] **Argument coverage:** each sub-claim reads as adequately argued by both sides`);
  lines.push(`- [ ] **Topology balance:** advocate B did not concede the field on hinges`);
  lines.push(`- [ ] **Citation honesty (spot-check):** sample 3–5 (premise, source) pairs flagged \`uncertain\` or unflagged; manually verify the source supports the premise`);
  lines.push(``);

  return lines.join("\n");
}
