/**
 * orchestrator/finalize/phase-6-finalize.ts
 *
 * Validates `PHASE_6_PARTIAL.json`, runs the chain-mint translator
 * (writes ArgumentChain / ArgumentChainNode / ArgumentChainEdge rows
 * via `IsonomiaClient.createArgumentChain` etc. under the methodologist
 * agent's bearer token), then writes `PHASE_6_COMPLETE.json` and a
 * human-readable `CHAINS.md` rendered from the architect's plan + mint
 * report.
 *
 * Validation gate: `architect.outcome === "ok"` with a non-empty plan.
 *
 * Per-node and per-edge mint failures are soft-degraded (logged into
 * the mint report, surfaced in CHAINS.md) — Phase 6 finalize does NOT
 * throw on partial mint success. It only throws on (a) the architect
 * refused / hit validation-error, or (b) the mint phase failed to
 * create ANY chain.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import { RoundLogger } from "../log/round-logger";
import type {
  Phase6PartialFile,
  ChainArchitectRunRecord,
} from "../phases/phase-6-chains";
import type { ChainArchitectPlan } from "../agents/chain-architect-schema";
import {
  mintArgumentChains,
  summarizePlan,
  type MintReport,
} from "../translators/chain-mint";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface Phase6CompleteFile {
  phase: 6;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  architect: ChainArchitectRunRecord;
  mint: MintReport;
  /** Path to the rendered human-readable chains report. */
  chainsReportPath: string;
}

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function finalizePhase6(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase6CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_6_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_6_PARTIAL.json not found. Run \`npm run orchestrator -- phase 6\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase6PartialFile;

  if (partial.architect.outcome !== "ok" || !partial.architect.plan) {
    const detail =
      partial.architect.outcome === "refused"
        ? `Chain-Architect refused (${partial.architect.refusal?.error}). See ${partial.architect.refusalPath}.`
        : partial.architect.outcome === "validation-error"
          ? `Chain-Architect exhausted retries (${partial.architect.attempts} attempts). Inspect logs at ${partial.architect.artifacts.roundLogPath} and re-run phase 6.`
          : `Chain-Architect outcome="${partial.architect.outcome}".`;
    throw new Error(`Phase 6 finalize blocked: ${detail}`);
  }

  // 1. Mint chains via the chain-mint translator.
  const finalizeLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 6,
    round: 99,
    agentRole: "chain-mint",
  });

  const mint = await mintArgumentChains({
    cfg: opts.cfg,
    iso: opts.iso,
    deliberationId: partial.deliberationId,
    plan: partial.architect.plan,
    logger: finalizeLogger,
  });

  if (mint.totals.chainsMinted === 0) {
    throw new Error(
      `Phase 6 finalize blocked: chain-mint failed to create any chain ` +
        `(${mint.skippedChains.length} chain(s) skipped). Inspect ${finalizeLogger["roundLogPath"] ?? "logs/round-6-99-chain-mint.jsonl"}.`,
    );
  }

  // 2. Render human-readable CHAINS.md.
  const chainsReportPath = path.join(opts.cfg.runtimeDir, "CHAINS.md");
  const md = renderChainsMarkdown(partial.architect.plan, mint, {
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    completedAt: new Date().toISOString(),
  });
  mkdirSync(path.dirname(chainsReportPath), { recursive: true });
  writeFileSync(chainsReportPath, md);

  // 3. Write PHASE_6_COMPLETE.json.
  const complete: Phase6CompleteFile = {
    phase: 6,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    evidenceStackId: partial.evidenceStackId,
    hingeIndices: partial.hingeIndices,
    architect: partial.architect,
    mint,
    chainsReportPath,
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_6_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}

// ─────────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────────

function renderChainsMarkdown(
  plan: ChainArchitectPlan,
  mint: MintReport,
  meta: { deliberationId: string; modelTier: string; completedAt: string },
): string {
  const summary = summarizePlan(plan);
  const lines: string[] = [];
  lines.push(`# Argument Chains — Phase 6 (Chain-Architect)`);
  lines.push(``);
  lines.push(`- **Deliberation:** \`${meta.deliberationId}\``);
  lines.push(`- **Model tier:** ${meta.modelTier}`);
  lines.push(`- **Generated:** ${meta.completedAt}`);
  lines.push(`- **Author role (bearer):** \`${mint.authorRole}\``);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── Top-level totals.
  lines.push(`## Totals`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Chains requested | ${mint.totals.chainsRequested} |`);
  lines.push(`| Chains minted | ${mint.totals.chainsMinted} |`);
  lines.push(`| Nodes requested | ${mint.totals.nodesRequested} |`);
  lines.push(`| Nodes minted | ${mint.totals.nodesMinted} |`);
  lines.push(`| Nodes skipped | ${mint.totals.nodesSkipped} |`);
  lines.push(`| Edges requested | ${mint.totals.edgesRequested} |`);
  lines.push(`| Edges minted | ${mint.totals.edgesMinted} |`);
  lines.push(`| Edges skipped | ${mint.totals.edgesSkipped} |`);
  lines.push(``);

  // ── Per-chain breakdown.
  lines.push(`## Per-chain breakdown`);
  lines.push(``);
  for (const minted of mint.chains) {
    const planned = plan.chains.find((c) => c.hingeIndex === minted.hingeIndex);
    if (!planned) continue;
    const sum = summary.perChain.find((s) => s.hingeIndex === minted.hingeIndex)!;

    lines.push(`### Hinge #${minted.hingeIndex} — ${minted.name}`);
    lines.push(``);
    lines.push(`- **chainId:** \`${minted.chainId}\``);
    lines.push(`- **chainType:** ${minted.chainType}`);
    lines.push(`- **Purpose:** ${planned.purpose}`);
    lines.push(``);
    lines.push(`- **Nodes:** ${minted.nodes.length} minted (${minted.skippedNodes.length} skipped)`);
    lines.push(`- **Edges:** ${minted.edges.length} minted (${minted.skippedEdges.length} skipped)`);
    lines.push(``);

    lines.push(`#### Epistemic-status breakdown`);
    lines.push(``);
    const statuses = Object.entries(sum.statusBreakdown).sort();
    for (const [status, n] of statuses) {
      lines.push(`- \`${status}\`: ${n}`);
    }
    lines.push(``);

    lines.push(`#### Edge-type breakdown`);
    lines.push(``);
    const edgeTypes = Object.entries(sum.edgeTypeBreakdown).sort();
    for (const [t, n] of edgeTypes) {
      lines.push(`- \`${t}\`: ${n}`);
    }
    lines.push(``);

    lines.push(`#### Architect's chain summary`);
    lines.push(``);
    lines.push(planned.chainSummary);
    lines.push(``);

    if (minted.skippedNodes.length > 0) {
      lines.push(`#### Skipped nodes`);
      lines.push(``);
      for (const s of minted.skippedNodes) {
        lines.push(`- \`${s.argumentId}\` — ${s.reason}: ${s.errorMessage}`);
      }
      lines.push(``);
    }
    if (minted.skippedEdges.length > 0) {
      lines.push(`#### Skipped edges`);
      lines.push(``);
      for (const s of minted.skippedEdges) {
        lines.push(`- \`${s.sourceArgumentId}\` → \`${s.targetArgumentId}\` (\`${s.edgeType}\`) — ${s.reason}: ${s.errorMessage}`);
      }
      lines.push(``);
    }
  }

  if (mint.skippedChains.length > 0) {
    lines.push(`## Skipped chains`);
    lines.push(``);
    for (const s of mint.skippedChains) {
      lines.push(`- Hinge #${s.hingeIndex} — ${s.name}: ${s.reason}: ${s.errorMessage}`);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`Generated by the polarization-1 orchestrator's Phase 6 chain-architect.`);
  lines.push(`See \`PHASE_6_COMPLETE.json\` for the structured record and the architect's full plan in \`llm/phase-6-chain-architect-plan.json\`.`);

  return lines.join("\n");
}
