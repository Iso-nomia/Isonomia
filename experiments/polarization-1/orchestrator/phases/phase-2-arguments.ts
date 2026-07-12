/**
 * orchestrator/phases/phase-2-arguments.ts
 *
 * Phase-2 control flow per Stage-3 §1:
 *
 *   loadFraming → loadPhase1Complete → renderTopologyPrompt
 *     → renderEvidenceCorpus (with citation tokens)
 *     → for each advocate (A, B, sequentially to keep budget under control):
 *           runAdvocateTurn → translateAdvocateOutput
 *     → write PHASE_2_PARTIAL.json
 *
 * Sequential rather than parallel because:
 *   - Anthropic per-key concurrent-call quota is tight on large outputs
 *   - The shared ClaimRegistry across advocates lets us count cross-advocate
 *     premise dedup (a metric we want for the writeup)
 *   - If A fails, we know before spending tokens on B
 *
 * Refusals (per advocate) are persisted to runtime/refusals/ and the phase
 * continues with the other advocate. If both refuse, the phase aborts with
 * exit code 2. Hard validation failures abort with exit code 1 (per §10
 * "abort the round" rule on second violation).
 *
 * Resumability: if PHASE_2_PARTIAL.json exists for the same deliberationId
 * with both advocates complete, the phase is a no-op (caller can re-run
 * `finalize` instead). If only one advocate is complete, the phase resumes
 * with the missing advocate (the LLM call is re-issued — there is no
 * cached LLM-output resume path for Phase 2 because per-argument writes
 * are not reversible without a manual cleanup script).
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";

import { loadFraming } from "../util/framing";
import { renderEvidenceCorpus } from "../util/evidence-corpus";
import { formatTopologyForPrompt } from "../state/format-for-prompt";
import {
  runAdvocateTurn,
  isAdvocateRefusal,
  AdvocateValidationError,
  type AdvocateRole,
} from "../agents/advocate";
import type { AdvocateLayer, TopologyBinding } from "../agents/advocate-schema";
import type { AdvocateOutput, AdvocateRefusal } from "../agents/advocate-schema";
import {
  translateAdvocateOutput,
  buildTokenToSourceIdMap,
  type ArgumentMintResult,
} from "../translators/argument-mint";
import { ClaimRegistry } from "../translators/claim-mint";
import { runPhase2SoftChecks, type ReviewFlag } from "../review/phase-2-checks";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RunPhase2Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  /**
   * If set, only run this advocate (skip the other). Used by the resume
   * path when one advocate has already completed.
   */
  onlyAdvocate?: AdvocateRole;
  /** Reserved for future use; ignored in v1. */
  resume?: boolean;
  /** Reserved for future use; ignored in v1 (one round per advocate). */
  maxRounds?: number;
}

export interface AdvocateRunRecord {
  role: AdvocateRole;
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  /** Present iff outcome === "ok". */
  llmOutput?: AdvocateOutput;
  mintResult?: ArgumentMintResult;
  /** Present iff outcome === "refused". */
  refusal?: AdvocateRefusal;
  refusalPath?: string;
  /** Present iff outcome === "validation-error". */
  validationError?: { message: string; rawResponsesCount: number };
  artifacts: {
    promptPath: string;
    llmOutputPath?: string;
    roundLogPath: string;
  };
}

export interface Phase2PartialFile {
  phase: 2;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  topologyBinding: TopologyBinding;
  evidenceStackId: string;
  advocates: { a?: AdvocateRunRecord; b?: AdvocateRunRecord };
  totals: {
    argumentsCreated: number;
    premiseClaimsMinted: number;
    premiseClaimsDeduped: number;
    citationsAttached: number;
    inputTokens: number;
    outputTokens: number;
  };
  /**
   * Soft-track review flags from runPhase2SoftChecks. Populated after both
   * advocates finish (or all that will finish in this run). Empty array if
   * no advocates completed successfully.
   */
  reviewFlags: ReviewFlag[];
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
  artifacts: { partialPath: string };
}

const PHASE_2_LLM_DIR = "llm";
const PHASE_2_PARTIAL_FILE = "PHASE_2_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase(opts: RunPhase2Opts): Promise<Phase2PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 2,
    round: 0,
  });

  // 1. Load gates: Phase 1 must be complete; framing must be readable.
  const phase1 = loadPhase1Complete(opts.cfg.runtimeDir, opts.deliberationId);
  const framing = loadFraming(opts.cfg.experimentRoot);

  // 2. Build the topology binding the Zod factory needs.
  const topologyBinding = buildTopologyBinding(phase1);
  phaseLogger.event("round_summary", {
    step: "topology-binding",
    subClaimCount: topologyBinding.count,
    hingeIndices: topologyBinding.hingeIndices,
  });

  // 3. Render the topology prose for the user message.
  const topologyPrompt = renderTopologyPrompt(phase1, topologyBinding.hingeIndices);

  // 4. Fetch the bound evidence corpus + render it for the prompt.
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, {
    role: "advocate-a",
    logger: phaseLogger,
  });
  const evidenceCorpusPrompt = renderEvidenceCorpus({ stack: ec.stack, sources: ec.sources });
  const tokenToSourceId = buildTokenToSourceIdMap(ec);
  const allowedCitationTokens = new Set(Object.keys(tokenToSourceId));

  // Hard-fail before LLM spend if the corpus has zero citation tokens.
  if (allowedCitationTokens.size === 0) {
    throw new Error(
      `Phase 2: bound evidence corpus has no usable citationTokens (stackId=${ec.stack.id}). ` +
        `Re-run setup to bind a stack with sources, or check the /api/.../evidence-context shape.`,
    );
  }

  // 5. Pre-fetch the scheme catalog once and pass to both translators.
  const schemeCatalog = await opts.iso.listSchemes("advocate-a", phaseLogger);

  // 6. Build a single ClaimRegistry shared across both advocates so that
  //    identical premise text collapses to one canonical Claim across A
  //    and B. This is intended; shared premises are a feature.
  const registry = new ClaimRegistry();

  // 7. Resume: load any existing partial.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_2_PARTIAL_FILE);
  let priorPartial: Phase2PartialFile | null = null;
  if (existsSync(partialPath)) {
    try {
      const raw = JSON.parse(readFileSync(partialPath, "utf8")) as Phase2PartialFile;
      if (raw.deliberationId === opts.deliberationId) priorPartial = raw;
    } catch {
      // Corrupt partial — ignore and overwrite.
    }
  }

  // 8. Decide which advocates to run.
  const advocatesToRun: AdvocateRole[] = (() => {
    if (opts.onlyAdvocate) return [opts.onlyAdvocate];
    const all: AdvocateRole[] = ["advocate-a", "advocate-b"];
    if (!priorPartial) return all;
    return all.filter((r) => {
      const rec = r === "advocate-a" ? priorPartial!.advocates.a : priorPartial!.advocates.b;
      return !rec || rec.outcome !== "ok";
    });
  })();

  if (advocatesToRun.length === 0) {
    phaseLogger.event("phase_complete", {
      phase: 2,
      outcome: "already-complete",
      partialPath,
    });
    return priorPartial!;
  }

  // 9. Run each advocate sequentially.
  const results: { a?: AdvocateRunRecord; b?: AdvocateRunRecord } = {
    a: priorPartial?.advocates.a,
    b: priorPartial?.advocates.b,
  };

  for (const role of advocatesToRun) {
    const rec = await runOneAdvocate({
      role,
      cfg: opts.cfg,
      iso: opts.iso,
      llm: opts.llm,
      deliberationId: opts.deliberationId,
      framing: framing.full,
      topologyPrompt,
      evidenceCorpusPrompt,
      topologyBinding,
      allowedCitationTokens,
      tokenToSourceId,
      indexToClaimId: phase1.indexToClaimId,
      registry,
      schemeCatalog,
    });
    if (role === "advocate-a") results.a = rec;
    else results.b = rec;

    // Write partial after each advocate so a crash mid-B preserves A.
    // (Review flags are computed only at the end, once all advocates finish.)
    writePartial(partialPath, opts, topologyBinding, ec.stack.id, results, [], undefined);
  }

  // 10. Run soft-track review checks. Skip the LLM judge if no advocate
  //     completed (deterministic checks return [] anyway).
  const advocateOutputs = {
    a: results.a?.outcome === "ok" ? results.a.llmOutput : undefined,
    b: results.b?.outcome === "ok" ? results.b.llmOutput : undefined,
  };
  const anyOk = Boolean(advocateOutputs.a || advocateOutputs.b);
  const reviewSourcesLite = ec.sources.map((s: any) => ({
    sourceId: s.sourceId,
    citationToken: s.citationToken,
    title: s.title ?? null,
    authors: Array.isArray(s.authors) ? s.authors : [],
    publishedAt: s.publishedAt ?? null,
    abstract: s.abstract ?? null,
    keyFindings: Array.isArray(s.keyFindings) ? s.keyFindings : [],
    tags: Array.isArray(s.tags) ? s.tags : [],
  }));
  const review = anyOk
    ? await runPhase2SoftChecks({
        advocates: advocateOutputs,
        hingeIndices: topologyBinding.hingeIndices,
        sources: reviewSourcesLite,
        llm: opts.llm,
        cfg: opts.cfg,
        logger: phaseLogger,
      })
    : { flags: [] as ReviewFlag[], judgeUsage: { calls: 0, inputTokens: 0, outputTokens: 0 } };
  phaseLogger.event("round_summary", {
    step: "soft-review",
    flagCount: review.flags.length,
    judgeCalls: review.judgeUsage.calls,
    judgeInputTokens: review.judgeUsage.inputTokens,
    judgeOutputTokens: review.judgeUsage.outputTokens,
  });

  // 11. Compose totals + return.
  const partial = writePartial(
    partialPath,
    opts,
    topologyBinding,
    ec.stack.id,
    results,
    review.flags,
    review.judgeUsage.calls > 0 ? review.judgeUsage : undefined,
  );

  // Decide overall outcome for the phase log.
  const okCount = Number(results.a?.outcome === "ok") + Number(results.b?.outcome === "ok");
  const refusedCount = Number(results.a?.outcome === "refused") + Number(results.b?.outcome === "refused");
  const errorCount =
    Number(results.a?.outcome === "validation-error") + Number(results.b?.outcome === "validation-error");

  phaseLogger.event("phase_complete", {
    phase: 2,
    outcome: okCount === 2 ? "partial-written" : refusedCount === 2 ? "both-refused" : "incomplete",
    okCount,
    refusedCount,
    errorCount,
    totals: partial.totals,
    partialPath,
  });

  // Per Stage-2 §9 Q4: refusal-only phase exits with code 2.
  if (okCount === 0 && refusedCount > 0) {
    const err = new BothAdvocatesRefusedError(
      `Phase 2: both advocates refused. See refusals at runtime/${REFUSALS_DIR}/.`,
    );
    err.partial = partial;
    throw err;
  }
  // Hard-validation failures already threw inside runOneAdvocate; if we got
  // here with errorCount > 0 it means the second advocate errored after the
  // first wrote a partial — propagate via a separate exit code.
  if (errorCount > 0 && okCount === 0) {
    throw new Error(
      `Phase 2: hard-validation failed for advocate(s) without any successful run. See partial at ${partialPath}.`,
    );
  }

  return partial;
}

// ─────────────────────────────────────────────────────────────────
// One-advocate driver
// ─────────────────────────────────────────────────────────────────

interface RunOneAdvocateOpts {
  role: AdvocateRole;
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  topologyPrompt: string;
  evidenceCorpusPrompt: string;
  topologyBinding: TopologyBinding;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  indexToClaimId: Record<number, string>;
  registry: ClaimRegistry;
  schemeCatalog: Array<{ id: string; key: string }>;
}

async function runOneAdvocate(opts: RunOneAdvocateOpts): Promise<AdvocateRunRecord> {
  const round = opts.role === "advocate-a" ? 1 : 2;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 2,
    round,
    agentRole: opts.role,
  });
  const promptRel = opts.role === "advocate-a" ? "prompts/2-advocate-a.md" : "prompts/3-advocate-b.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);

  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_2_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-2-${opts.role}-output.json`);
  const roundLogPath = path.join(opts.cfg.runtimeDir, "logs", `round-2-${round}-${opts.role}.jsonl`);
  const baseArtifacts = { promptPath, roundLogPath };

  let turn;
  try {
    turn = await runAdvocateTurn({
      role: opts.role,
      promptPath,
      framing: opts.framing,
      topologyPrompt: opts.topologyPrompt,
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      schemaOpts: {
        topology: opts.topologyBinding,
        allowedCitationTokens: opts.allowedCitationTokens,
        // Dev tier (Haiku) is materially less prolific than prod (Opus);
        // relax the per-sub-claim floor so the dry-run pipeline can pass.
        // Hinge concentration is still enforced as a soft check (≥ 4/hinge).
        ...(opts.cfg.modelTier === "dev"
          ? { perSubClaimMin: 1, totalArgumentsMin: 9 }
          : {}),
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });
  } catch (err) {
    if (err instanceof AdvocateValidationError) {
      logger.event("phase_complete", {
        phase: 2,
        round,
        agent: opts.role,
        outcome: "validation-error",
        attempts: err.attempts,
      });
      return {
        role: opts.role,
        outcome: "validation-error",
        attempts: err.attempts,
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        validationError: {
          message: err.message,
          rawResponsesCount: err.rawResponses.length,
        },
        artifacts: baseArtifacts,
      };
    }
    throw err;
  }

  // Refusal path.
  if (isAdvocateRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-2-${opts.role}-refusal.json`,
    );
    mkdirSync(path.dirname(refusalPath), { recursive: true });
    writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
    logger.event("phase_complete", {
      phase: 2,
      round,
      agent: opts.role,
      outcome: "refused",
      reason: turn.response.error,
      refusalPath,
    });
    return {
      role: opts.role,
      outcome: "refused",
      attempts: turn.attempts,
      tokenUsage: turn.usage,
      refusal: turn.response,
      refusalPath,
      artifacts: baseArtifacts,
    };
  }

  // Success path: persist raw LLM output, then mint to the platform.
  mkdirSync(llmDir, { recursive: true });
  writeFileSync(llmOutputPath, JSON.stringify(turn.response, null, 2));

  const mintResult = await translateAdvocateOutput({
    output: turn.response,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
    cfg: opts.cfg,
    indexToClaimId: opts.indexToClaimId,
    tokenToSourceId: opts.tokenToSourceId,
    registry: opts.registry,
    authorRole: opts.role,
    schemeCatalog: opts.schemeCatalog,
    stackId: opts.cfg.deliberation.evidenceStackId ?? null,
  });

  logger.event("phase_complete", {
    phase: 2,
    round,
    agent: opts.role,
    outcome: "ok",
    argumentsCreated: mintResult.totals.argumentsCreated,
    citationsAttached: mintResult.totals.citationsAttached,
  });

  return {
    role: opts.role,
    outcome: "ok",
    attempts: turn.attempts,
    tokenUsage: turn.usage,
    llmOutput: turn.response,
    mintResult,
    artifacts: { ...baseArtifacts, llmOutputPath },
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

interface Phase1CompleteShape {
  phase: 1;
  status: "complete";
  deliberationId: string;
  rootClaimId: string;
  topology: Record<
    string,
    {
      claimId: string;
      text: string;
      layer: AdvocateLayer;
      claimType: string;
      dependsOn: number[];
    }
  >;
  edges: Array<{ from: number | "root"; to: number | "root"; type: "supports" }>;
  /** Derived field added at load time. */
  indexToClaimId: Record<number, string>;
}

function loadPhase1Complete(runtimeDir: string, deliberationId: string): Phase1CompleteShape {
  const p = path.join(runtimeDir, "PHASE_1_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(
      `Phase 2 prerequisite missing: ${p} not found. Run \`npm run orchestrator -- phase 1\` and \`finalize\` first.`,
    );
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase1CompleteShape;
  if (raw.status !== "complete") {
    throw new Error(`Phase 2 prerequisite invalid: ${p} status is "${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 2 prerequisite mismatch: PHASE_1_COMPLETE.json deliberationId=${raw.deliberationId} but current deliberation=${deliberationId}`,
    );
  }

  // Derive index→claimId for downstream use.
  const indexToClaimId: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw.topology)) {
    indexToClaimId[Number(k)] = v.claimId;
  }
  return { ...raw, indexToClaimId };
}

function buildTopologyBinding(phase1: Phase1CompleteShape): TopologyBinding {
  const indices = Object.keys(phase1.topology).map(Number).sort((a, b) => a - b);
  const layerByIndex: Record<number, AdvocateLayer> = {};
  for (const idx of indices) layerByIndex[idx] = phase1.topology[String(idx)].layer;

  // Hinge = sub-claim with ≥ 2 inbound dependsOn edges from other sub-claims.
  // (Edges to "root" don't count.)
  const inbound = new Map<number, number>();
  for (const idx of indices) inbound.set(idx, 0);
  for (const idx of indices) {
    const deps = phase1.topology[String(idx)].dependsOn ?? [];
    for (const d of deps) inbound.set(d, (inbound.get(d) ?? 0) + 1);
  }
  const hingeIndices = indices.filter((i) => (inbound.get(i) ?? 0) >= 2).sort((a, b) => a - b);

  return {
    count: indices.length,
    layerByIndex,
    hingeIndices,
  };
}

function renderTopologyPrompt(phase1: Phase1CompleteShape, hingeIndices: number[]): string {
  const subClaims = Object.entries(phase1.topology).map(([k, v]) => ({
    index: Number(k),
    text: v.text,
    layer: v.layer,
    claimType: v.claimType,
    dependsOn: v.dependsOn,
  }));
  // Use the existing formatter; append a hinge marker line so advocates see
  // which sub-claims they MUST cover (per prompt §5 #2).
  const base = formatTopologyForPrompt({
    rootClaimText: "(see FRAMING for the central claim)",
    subClaims,
  });
  const hingeLine = hingeIndices.length
    ? `\n\nHinge sub-claims (you MUST mount arguments on each of these): ${hingeIndices.map((h) => `#${h}`).join(", ")}`
    : "";
  return base + hingeLine;
}

function writePartial(
  partialPath: string,
  opts: RunPhase2Opts,
  topologyBinding: TopologyBinding,
  evidenceStackId: string,
  results: { a?: AdvocateRunRecord; b?: AdvocateRunRecord },
  reviewFlags: ReviewFlag[],
  judgeUsage: { calls: number; inputTokens: number; outputTokens: number } | undefined,
): Phase2PartialFile {
  const totals = aggregateTotals(results);
  const partial: Phase2PartialFile = {
    phase: 2,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    topologyBinding,
    evidenceStackId,
    advocates: results,
    totals,
    reviewFlags,
    judgeUsage,
    artifacts: { partialPath },
  };
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));
  return partial;
}

function aggregateTotals(results: {
  a?: AdvocateRunRecord;
  b?: AdvocateRunRecord;
}): Phase2PartialFile["totals"] {
  let argumentsCreated = 0;
  let premiseClaimsMinted = 0;
  let premiseClaimsDeduped = 0;
  let citationsAttached = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const rec of [results.a, results.b]) {
    if (!rec) continue;
    inputTokens += rec.tokenUsage.inputTokens;
    outputTokens += rec.tokenUsage.outputTokens;
    if (rec.mintResult) {
      argumentsCreated += rec.mintResult.totals.argumentsCreated;
      premiseClaimsMinted += rec.mintResult.totals.premiseClaimsMinted;
      premiseClaimsDeduped += rec.mintResult.totals.premiseClaimsDeduped;
      citationsAttached += rec.mintResult.totals.citationsAttached;
    }
  }
  return {
    argumentsCreated,
    premiseClaimsMinted,
    premiseClaimsDeduped,
    citationsAttached,
    inputTokens,
    outputTokens,
  };
}

export class BothAdvocatesRefusedError extends Error {
  partial?: Phase2PartialFile;
  exitCode = 2;
}
