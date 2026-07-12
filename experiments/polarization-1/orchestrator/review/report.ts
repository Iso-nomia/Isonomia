/**
 * orchestrator/review/report.ts
 *
 * Phase-1 review-report Markdown generator + verdict parser.
 *
 * The report is the single source of truth for the human review pass:
 *
 *   ┌─ Header (deliberation id, generated-at, run summary)
 *   ├─ Per-flag block:
 *   │     ## Flag <N>: <ruleId> (<severity>)
 *   │     <message>
 *   │     **Verdict:** [ ] accept  [ ] revise  [ ] retract  Notes: <free text>
 *   │     <evidence as fenced JSON, if any>
 *   └─ Footer (manual review checklist; topology summary)
 *
 * `--apply` parses the file: the parser refuses (exit 1) on any flag with
 * zero or > 1 verdict box checked, with a path-line reference to the
 * malformed flag. Already-applied flags carry an `**Applied:** <ts>`
 * marker and are skipped on re-apply (idempotency).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

import type { ReviewFlag } from "./phase-1-checks";
import type { Phase1PartialFile } from "../phases/phase-1-topology";

export interface ParsedVerdict {
  flagIndex: number;        // 1-based, matches "## Flag N" header
  ruleId: string;
  severity: string;
  message: string;
  verdict: "accept" | "revise" | "retract";
  notes: string;
  applied: string | null;   // ISO ts if `**Applied:**` marker present
}

export function reportPathFor(runtimeDir: string, phase: number): string {
  return path.join(runtimeDir, "reviews", `phase-${phase}-review.md`);
}

export function produceReport(opts: { partial: Phase1PartialFile; runtimeDir: string; force?: boolean }): { path: string } {
  const out = reportPathFor(opts.runtimeDir, 1);
  if (existsSync(out) && !opts.force) {
    throw new Error(`Review report already exists at ${out}. Pass --force to overwrite.`);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportMarkdown(opts.partial));
  return { path: out };
}

export function renderReportMarkdown(partial: Phase1PartialFile): string {
  const lines: string[] = [];
  lines.push(`# Phase 1 Review Report`);
  lines.push(``);
  lines.push(`- Deliberation: \`${partial.deliberationId}\``);
  lines.push(`- Generated: ${partial.generatedAt}`);
  lines.push(`- Model tier: ${partial.modelTier}`);
  lines.push(`- Sub-claims: ${partial.topology.subClaims.length}`);
  lines.push(`- Edges: ${partial.topology.edges.length}`);
  lines.push(`- Token usage: in=${partial.tokenUsage.inputTokens}, out=${partial.tokenUsage.outputTokens}`);
  lines.push(``);
  lines.push(`## Flags (${partial.reviewFlags.length})`);
  lines.push(``);
  lines.push(`> For each flag below, check **exactly one** verdict box. Add notes after \`Notes:\`.`);
  lines.push(`> Then run: \`npm run orchestrator -- review --phase 1 --apply\``);
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

  // Manual checklist (per Stage-2 §4.4).
  lines.push(`## Manual review (no auto-flag)`);
  lines.push(``);
  lines.push(`Mark each as accept/revise; add a freestanding flag below if you want \`--apply\` to act on it.`);
  lines.push(``);
  lines.push(`- [ ] **Coverage:** the topology decomposes the central claim (no obvious gaps)`);
  lines.push(`- [ ] **Independence:** sub-claims are independently arguable, not rephrasings`);
  lines.push(`- [ ] **Tractability:** each sub-claim could carry 4–6 advocate arguments from the bound corpus`);
  lines.push(``);

  lines.push(`## Topology summary`);
  lines.push(``);
  lines.push(`Root claim id: \`${partial.rootClaimId}\``);
  lines.push(``);
  for (const sc of partial.topology.subClaims) {
    const deps = sc.dependsOn.length ? ` (depends on ${sc.dependsOn.join(", ")})` : "";
    lines.push(`- **#${sc.index}** [${sc.layer} / ${sc.claimType}]${deps}`);
    lines.push(`  - id: \`${sc.claimId}\``);
    lines.push(`  - text: ${sc.text}`);
  }
  lines.push(``);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────

const FLAG_HEADER = /^##\s+Flag\s+(\d+):\s+([^\s(]+)\s+\((\w+)\)\s*$/;
const VERDICT_LINE = /^\*\*Verdict:\*\*\s*\[(.)\]\s*accept\s*\[(.)\]\s*revise\s*\[(.)\]\s*retract\s*Notes:\s*(.*)$/i;
const APPLIED_LINE = /^\*\*Applied:\*\*\s*(.+)$/;

export function parseReport(reportText: string): ParsedVerdict[] {
  const lines = reportText.split(/\r?\n/);
  const verdicts: ParsedVerdict[] = [];

  let current: { idx: number; rule: string; sev: string; messageLines: string[] } | null = null;
  let pendingApplied: string | null = null;
  let messageOpen = false;

  const finalize = (verdictLine: string) => {
    if (!current) {
      throw new Error(`Verdict line found before any "## Flag N:" header: ${verdictLine}`);
    }
    const m = verdictLine.match(VERDICT_LINE);
    if (!m) {
      throw new Error(
        `Flag ${current.idx} (${current.rule}): malformed verdict line. Expected \`**Verdict:** [ ] accept  [ ] revise  [ ] retract  Notes: ...\``,
      );
    }
    const checks = [m[1], m[2], m[3]].map((c) => /[xX]/.test(c));
    const checked = checks.filter(Boolean).length;
    if (checked === 0) {
      throw new Error(
        `Flag ${current.idx} (${current.rule}): no verdict checked. Mark exactly one of accept/revise/retract.`,
      );
    }
    if (checked > 1) {
      throw new Error(
        `Flag ${current.idx} (${current.rule}): multiple verdicts checked. Mark exactly one of accept/revise/retract.`,
      );
    }
    const verdict: ParsedVerdict["verdict"] = checks[0] ? "accept" : checks[1] ? "revise" : "retract";
    verdicts.push({
      flagIndex: current.idx,
      ruleId: current.rule,
      severity: current.sev,
      message: current.messageLines.join("\n").trim(),
      verdict,
      notes: m[4].trim(),
      applied: pendingApplied,
    });
    pendingApplied = null;
  };

  for (const line of lines) {
    const hdr = line.match(FLAG_HEADER);
    if (hdr) {
      current = { idx: Number(hdr[1]), rule: hdr[2], sev: hdr[3], messageLines: [] };
      messageOpen = true;
      pendingApplied = null;
      continue;
    }
    const appliedMatch = line.match(APPLIED_LINE);
    if (appliedMatch) {
      // The annotateApplied() writer places `**Applied:**` immediately
      // after the verdict line, so attach it to the most recently
      // finalized verdict if any; otherwise stash for the next finalize.
      const ts = appliedMatch[1].trim();
      if (verdicts.length > 0 && current === null) {
        verdicts[verdicts.length - 1].applied = ts;
      } else {
        pendingApplied = ts;
      }
      continue;
    }
    if (line.startsWith("**Verdict:**")) {
      finalize(line);
      messageOpen = false;
      current = null;
      continue;
    }
    if (current && messageOpen && !line.startsWith("##") && !line.startsWith("**")) {
      current.messageLines.push(line);
    }
  }

  return verdicts;
}

/** Returns the report text with `**Applied:** <ts>` lines added beneath each verdict. */
export function annotateApplied(reportText: string, applied: Map<number, string>): string {
  const lines = reportText.split(/\r?\n/);
  const out: string[] = [];
  let currentFlag: number | null = null;
  for (const line of lines) {
    const hdr = line.match(FLAG_HEADER);
    if (hdr) currentFlag = Number(hdr[1]);
    out.push(line);
    if (line.startsWith("**Verdict:**") && currentFlag !== null) {
      const ts = applied.get(currentFlag);
      if (ts && !out.slice(-3).some((l) => APPLIED_LINE.test(l))) {
        out.push(`**Applied:** ${ts}`);
      }
      currentFlag = null;
    }
  }
  return out.join("\n");
}
