/**
 * orchestrator/phases/phase-1-topology.ts
 *
 * Top-to-bottom Phase 1 control flow per Stage-2 §1 diagram:
 *
 *   loadFraming → renderEvidenceOverview → claim-analyst.runTurn →
 *     soft-flag review checks → translators/topology → write
 *     PHASE_1_PARTIAL.json.
 *
 * Refusals abort with exit code 2 (caller distinguishes); hard validation
 * failures abort with exit code 1.
 *
 * Resumability: if PHASE_1_PARTIAL.json already exists with the same
 * deliberationId AND the LLM hasn't been re-prompted, the orchestrator
 * does NOT re-call the LLM — it re-files claims/edges (idempotent via
 * moid + edge upsert) and rewrites the partial. Useful when an Isonomia
 * 5xx aborted mid-translation.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";

import { loadFraming } from "../util/framing";
import { renderEvidenceOverview } from "../util/evidence-overview";
import {
  runClaimAnalystTurn,
  HardValidationError,
  isRefusal,
  asTopology,
} from "../agents/claim-analyst";
import { translateClaimAnalystOutput, type TopologyResult } from "../translators/topology";
import { runSoftReviewChecks, type ReviewFlag } from "../review/phase-1-checks";
import type { ClaimAnalystOutput } from "../agents/claim-analyst-schema";

export interface RunPhase1Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  /** If true, skip LLM call and re-translate from runtime/llm/phase-1-output.json. */
  resume?: boolean;
}

export interface Phase1PartialFile {
  phase: 1;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  rootClaimId: string;
  topology: TopologyResult;
  llmOutput: ClaimAnalystOutput;
  reviewFlags: ReviewFlag[];
  tokenUsage: { inputTokens: number; outputTokens: number };
  artifacts: {
    llmOutputPath: string;
    roundLogPath: string;
    partialPath: string;
  };
}

const PHASE_1_OUTPUT_DIR = "llm";
const PHASE_1_OUTPUT_FILE = "phase-1-output.json";
const PHASE_1_PARTIAL_FILE = "PHASE_1_PARTIAL.json";
const PHASE_1_REFUSAL_FILE = "phase-1-refusal.json";

export async function runPhase(opts: RunPhase1Opts): Promise<Phase1PartialFile> {
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 1,
    round: 1,
    agentRole: "claim-analyst",
  });

  // Load framing (also validates the FRAMING.md format).
  const framing = loadFraming(opts.cfg.experimentRoot);

  // Load evidence overview from the bound stack.
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, { role: "claim-analyst", logger });
  const evidenceOverview = renderEvidenceOverview({ stack: ec.stack, sources: ec.sources });

  // ── Resume path: skip LLM, re-run translator with the cached output. ──
  let llmOutput: ClaimAnalystOutput;
  let usage: { inputTokens: number; outputTokens: number };

  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_1_OUTPUT_DIR);
  const llmOutputPath = path.join(llmDir, PHASE_1_OUTPUT_FILE);

  if (opts.resume && existsSync(llmOutputPath)) {
    const cached = JSON.parse(readFileSync(llmOutputPath, "utf8"));
    llmOutput = asTopology(cached);
    usage = { inputTokens: 0, outputTokens: 0 };
    logger.event("round_summary", { step: "resume-from-cached-llm-output", path: llmOutputPath });
  } else {
    const turn = await runClaimAnalystTurn({
      framing: framing.full,
      centralClaim: framing.centralClaim,
      evidenceCorpusOverview: evidenceOverview,
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });

    if (isRefusal(turn.response)) {
      const refusalPath = path.join(opts.cfg.runtimeDir, "refusals", PHASE_1_REFUSAL_FILE);
      mkdirSync(path.dirname(refusalPath), { recursive: true });
      writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
      logger.event("phase_complete", { phase: 1, outcome: "refused", refusalPath });
      const err = new ClaimAnalystRefusedError(
        `Claim Analyst refused: ${turn.response.error}. ` +
          `Details: ${turn.response.details}. ` +
          (turn.response.suggestedFraming ? `Suggested framing change: ${turn.response.suggestedFraming}` : "") +
          ` Refusal persisted to ${refusalPath}.`,
      );
      err.refusalPath = refusalPath;
      throw err;
    }

    llmOutput = asTopology(turn.response);
    usage = turn.usage;

    // Persist raw LLM output so we can resume without re-calling the LLM.
    mkdirSync(llmDir, { recursive: true });
    writeFileSync(llmOutputPath, JSON.stringify(turn.response, null, 2));
  }

  // Soft-flag review checks (do not abort).
  const reviewFlags = runSoftReviewChecks({
    output: llmOutput,
    framing: framing.full,
  });
  for (const flag of reviewFlags) logger.event("review_flag", flag as unknown as Record<string, unknown>);

  // Materialize topology to the live deliberation.
  const topology = await translateClaimAnalystOutput({
    output: llmOutput,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
  });

  // Write partial gate file.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_1_PARTIAL_FILE);
  const partial: Phase1PartialFile = {
    phase: 1,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    rootClaimId: topology.rootClaimId,
    topology,
    llmOutput,
    reviewFlags,
    tokenUsage: usage,
    artifacts: {
      llmOutputPath,
      roundLogPath: path.join(opts.cfg.runtimeDir, "logs", "round-1-1-claim-analyst.jsonl"),
      partialPath,
    },
  };
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));

  logger.event("phase_complete", {
    phase: 1,
    outcome: "partial-written",
    partialPath,
    subClaims: topology.subClaims.length,
    edges: topology.edges.length,
    flags: reviewFlags.length,
  });

  return partial;
}

export class ClaimAnalystRefusedError extends Error {
  refusalPath?: string;
  exitCode = 2;
}

export { type ReviewFlag };
