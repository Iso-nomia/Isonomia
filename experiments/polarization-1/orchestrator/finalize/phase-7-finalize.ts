/**
 * orchestrator/finalize/phase-7-finalize.ts
 *
 * Validates `PHASE_7_PARTIAL.json`, runs the cq-raise-mint translator
 * (writes CQStatus + WHY DialogueMove + ConflictApplication rows under
 * each challenger's bearer token), then writes
 * `PHASE_7_COMPLETE.json` and a human-readable `CHALLENGES.md`
 * rendered from the per-agent plans + mint report.
 *
 * Validation gate: at least ONE challenger has `outcome === "ok"` with
 * a non-empty plan. Per-raise mint failures are soft-degraded (logged
 * into the mint report, surfaced in CHALLENGES.md). Phase 7 finalize
 * does NOT throw on partial mint success. It only throws on:
 *   (a) zero challengers had outcome="ok" (the deliberation has no
 *       Phase-7 plan to execute);
 *   (b) the mint phase failed to create ANY raise across all
 *       challengers (every raise was either pre-filtered as a
 *       duplicate or hit a hard error).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import { prisma } from "@/lib/prismaclient";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import { RoundLogger } from "../log/round-logger";
import type {
  Phase7PartialFile,
  ChallengerRunRecord,
  ChallengerRole,
} from "../phases/phase-7-cq-raise";
import {
  mintCqRaises,
  type RaiseMintReport,
} from "../translators/cq-raise-mint";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface Phase7CompleteFile {
  phase: 7;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  readoutContentHash: string | null;
  maxRaisesPerAgent: number;
  challengers: ChallengerRunRecord[];
  mint: RaiseMintReport;
  /** Path to the rendered human-readable challenges report. */
  challengesReportPath: string;
}

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function finalizePhase7(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase7CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_7_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(
      `PHASE_7_PARTIAL.json not found. Run \`npm run orchestrator -- phase 7\` first.`,
    );
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase7PartialFile;

  const okChallengers = partial.challengers.filter(
    (c) => c.outcome === "ok" && c.plan && c.plan.raises.length > 0,
  );
  if (okChallengers.length === 0) {
    const refusedReasons = partial.challengers
      .filter((c) => c.outcome !== "ok")
      .map((c) =>
        c.outcome === "refused"
          ? `${c.agentRole} refused: ${c.refusal?.error ?? "(no error)"}`
          : `${c.agentRole} validation-error after ${c.attempts} attempts`,
      )
      .join("; ");
    throw new Error(
      `Phase 7 finalize blocked: no challenger produced a usable plan. ${refusedReasons}`,
    );
  }

  // 1. Refresh existing CQStatus snapshot — this drifts between
  //    partial-write time and finalize time (humans / earlier passes
  //    may have answered CQs in the interim).
  const allTargetIds = new Set<string>();
  for (const c of okChallengers) {
    for (const r of c.plan!.raises) allTargetIds.add(r.targetArgumentId);
  }
  const existingCqStateKeys = await loadExistingCqStateKeys([...allTargetIds]);

  // 2. Mint via translator.
  const finalizeLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 7,
    round: 99,
    agentRole: "cq-raise-mint",
  });

  const mint = await mintCqRaises({
    cfg: opts.cfg,
    iso: opts.iso,
    deliberationId: partial.deliberationId,
    plansByAgent: okChallengers.map((c) => ({
      agentRole: c.agentRole,
      plan: c.plan!,
    })),
    existingCqStateKeys,
    logger: finalizeLogger,
  });

  if (mint.totals.raisesMinted === 0) {
    throw new Error(
      `Phase 7 finalize blocked: cq-raise-mint produced zero raises ` +
        `(${mint.totals.raisesRequested} requested, ${mint.totals.raisesPreFiltered} pre-filtered as duplicates, ${mint.totals.raisesSkipped} hard-failed). ` +
        `Inspect logs/round-7-99-cq-raise-mint.jsonl.`,
    );
  }

  // 3. Render CHALLENGES.md.
  const challengesReportPath = path.join(opts.cfg.runtimeDir, "CHALLENGES.md");
  const md = renderChallengesMarkdown(partial, mint, {
    completedAt: new Date().toISOString(),
  });
  mkdirSync(path.dirname(challengesReportPath), { recursive: true });
  writeFileSync(challengesReportPath, md);

  // 4. Write PHASE_7_COMPLETE.json.
  const complete: Phase7CompleteFile = {
    phase: 7,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    readoutContentHash: partial.readoutContentHash,
    maxRaisesPerAgent: partial.maxRaisesPerAgent,
    challengers: partial.challengers,
    mint,
    challengesReportPath,
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_7_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function loadExistingCqStateKeys(targetArgIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (targetArgIds.length === 0) return out;
  // Dedup against ConflictApplications previously minted by Phase 7
  // (or any source that records cqKey in metaJson). A bare CQStatus
  // row is *not* a duplicate: the orchestrator may have opened the CQ
  // in a prior aborted finalize but failed to mint the anchoring CA,
  // and re-running finalize must mint the CA on retry. The per-agent
  // dedup key is `${createdById}::${argId}::${cqKey}`; the translator
  // composes the same key when checking.
  const cas = await prisma.conflictApplication.findMany({
    where: { conflictedArgumentId: { in: targetArgIds } },
    select: { conflictedArgumentId: true, createdById: true, metaJson: true },
  });
  for (const r of cas) {
    const meta = (r.metaJson ?? {}) as { cqKey?: string };
    if (!meta.cqKey || !r.conflictedArgumentId || !r.createdById) continue;
    out.add(`${r.createdById}::${r.conflictedArgumentId}::${meta.cqKey}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────────

function renderChallengesMarkdown(
  partial: Phase7PartialFile,
  mint: RaiseMintReport,
  meta: { completedAt: string },
): string {
  const lines: string[] = [];
  lines.push(`# Critical-Question Raises — Phase 7 (Challenger Round)`);
  lines.push(``);
  lines.push(`- **Deliberation:** \`${partial.deliberationId}\``);
  lines.push(`- **Model tier:** ${partial.modelTier}`);
  lines.push(`- **Generated:** ${meta.completedAt}`);
  lines.push(`- **Max raises / agent:** ${partial.maxRaisesPerAgent}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── Totals.
  lines.push(`## Totals`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Raises requested | ${mint.totals.raisesRequested} |`);
  lines.push(`| Raises minted | ${mint.totals.raisesMinted} |`);
  lines.push(`| Raises skipped (hard error) | ${mint.totals.raisesSkipped} |`);
  lines.push(`| Raises pre-filtered (duplicate of existing) | ${mint.totals.raisesPreFiltered} |`);
  lines.push(``);

  // ── Per-agent breakdown.
  lines.push(`## Per-agent breakdown`);
  lines.push(``);
  lines.push(`| Agent | Outcome | Requested | Minted | Skipped | Pre-filtered |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const c of partial.challengers) {
    const m = mint.perAgent.find((p) => p.agentRole === c.agentRole);
    const requested = m?.requested ?? 0;
    const minted = m?.minted ?? 0;
    const skipped = m?.skipped ?? 0;
    const pre = m?.preFiltered ?? 0;
    lines.push(
      `| \`${c.agentRole}\` | ${c.outcome} | ${requested} | ${minted} | ${skipped} | ${pre} |`,
    );
  }
  lines.push(``);

  // ── Per-agent rationales.
  for (const c of partial.challengers) {
    lines.push(`## ${c.agentRole}`);
    lines.push(``);
    if (c.outcome === "refused") {
      lines.push(`**Refused.** ${c.refusal?.error ?? "(no error message)"}`);
      lines.push(``);
      continue;
    }
    if (c.outcome === "validation-error") {
      lines.push(
        `**Validation error** after ${c.attempts} attempts. See ${c.artifacts.roundLogPath}.`,
      );
      lines.push(``);
      continue;
    }
    if (!c.plan) continue;
    lines.push(`**Summary:** ${c.plan.summary}`);
    lines.push(``);
    lines.push(`### Raises`);
    lines.push(``);
    if (c.plan.raises.length === 0) {
      lines.push(`_(none)_`);
      lines.push(``);
      continue;
    }
    for (const r of c.plan.raises) {
      const wasMinted = mint.raised.some(
        (m) =>
          m.agentRole === c.agentRole &&
          m.targetArgumentId === r.targetArgumentId &&
          m.cqKey === r.cqKey,
      );
      const wasSkipped = mint.skipped.find(
        (m) =>
          m.agentRole === c.agentRole &&
          m.targetArgumentId === r.targetArgumentId &&
          m.cqKey === r.cqKey,
      );
      const status = wasMinted ? "✅ minted" : wasSkipped ? `⚠️ ${wasSkipped.step} failed` : "⏭️ skipped (duplicate)";
      lines.push(
        `- **${status}** \`${r.attackType}\` / \`${r.targetScope}\` — target=\`${r.targetArgumentId}\` cq=\`${r.schemeKey}.${r.cqKey}\``,
      );
      lines.push(`  - voice: \`${r.voiceArgumentId}\``);
      lines.push(`  - rationale: ${r.rationale}`);
      if (r.cqContext) lines.push(`  - context: "${r.cqContext}"`);
      if (wasSkipped) lines.push(`  - error: ${wasSkipped.errorMessage}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
