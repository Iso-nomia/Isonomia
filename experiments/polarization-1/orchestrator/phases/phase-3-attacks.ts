/**
 * orchestrator/phases/phase-3-attacks.ts
 *
 * Phase-3 (Dialectical Testing) control flow.
 *
 *   loadFraming → loadPhase2Complete → loadCqCatalog
 *     → for each advocate (A, B, sequentially — same reasoning as Phase 2):
 *           build OPPONENT_ARGUMENTS prompt block (opponent's Phase-2 output
 *             with each argument's CQ catalog inlined per §3 of the prompt)
 *           runRebuttalTurn → translateRebuttalOutput
 *     → write PHASE_3_PARTIAL.json
 *     → run runPhase3SoftChecks (deterministic + LLM-judge on rebuttal premises)
 *     → write PHASE_3_PARTIAL.json again with reviewFlags
 *
 * Prereqs: PHASE_2_COMPLETE.json must exist for the same deliberationId
 * (Phase 3 attacks Phase 2's arguments).
 *
 * Resumability: same shape as Phase 2. If both advocates already have
 * outcome="ok" in a prior partial, this is a no-op. If one is missing
 * or errored, only the missing/errored advocate runs; the other's prior
 * record is preserved.
 *
 * Both advocates run sequentially (not parallel). Reasoning:
 *   - Anthropic per-key concurrency budget is tight on Opus runs.
 *   - The translator's orphan-guard cascades by `createdById`, so concurrent
 *     A and B writes don't interfere; sequential is purely a budget choice.
 *   - If A fails, we know before spending B-tokens.
 *
 * Both advocates see the OPPOSING Phase-2 snapshot — i.e. A reads B's
 * arguments and vice versa. The snapshot is the Phase-2 output as
 * persisted; no live re-fetch (so the contest is against the already-
 * reviewed-and-finalized argument set).
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";
import { prisma } from "@/lib/prismaclient";

import { loadFraming } from "../util/framing";
import { renderEvidenceCorpus } from "../util/evidence-corpus";
import {
  runRebuttalTurn,
  isRebuttalRefusal,
  RebuttalValidationError,
  type RebuttalAgentRole,
} from "../agents/rebuttal";
import type {
  RebuttalOutput,
  RebuttalRefusal,
  OpposingArgumentBinding,
} from "../agents/rebuttal-schema";
import {
  runMethodologistTurn,
  isMethodologistRefusal,
  MethodologistValidationError,
  METHODOLOGIST_AGENT_ROLE,
} from "../agents/methodologist";
import type {
  MethodologistOutput,
  MethodologistRefusal,
} from "../agents/methodologist-schema";
import type { ExperimentSchemeKey } from "../scheme-catalog";
import { isAllowedSchemeKey } from "../scheme-catalog";
import {
  translateRebuttalOutput,
  type AttackMintResult,
} from "../translators/attack-mint";
import { ClaimRegistry } from "../translators/claim-mint";
import { buildTokenToSourceIdMap } from "../translators/argument-mint";
import {
  runPhase3SoftChecks,
  type ReviewFlag,
  type OpposingArgumentMeta,
} from "../review/phase-3-checks";
import type {
  Phase2CompleteFile,
  Phase2CompleteAdvocate,
  Phase2CompleteArgument,
} from "../finalize/phase-2-finalize";
import type { AdvocateLayer } from "../agents/advocate-schema";
import { runPhase3Round2 } from "./phase-3-round2";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RunPhase3Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  onlyAdvocate?: RebuttalAgentRole;
  resume?: boolean;
  maxRounds?: number;
  /**
   * Iter-3 round filter for resume granularity.
   * - undefined: default behavior (round-1 then iter3 round-2 hook if flag set).
   * - "1": run only round-1; skip the iter3 round-2 hook even when flag set.
   * - "2": skip round-1 actor loop (must be ok in PHASE_3_PARTIAL.json);
   *        run only the round-2 hook. Requires `cfg.iter3MultiRound`.
   */
  roundFilter?: "1" | "2";
}

export interface RebuttalRunRecord {
  role: RebuttalAgentRole;
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  llmOutput?: RebuttalOutput;
  mintResult?: AttackMintResult;
  refusal?: RebuttalRefusal;
  refusalPath?: string;
  validationError?: { message: string; rawResponsesCount: number };
  artifacts: {
    promptPath: string;
    llmOutputPath?: string;
    roundLogPath: string;
  };
}

/**
 * Methodologist runs once per Phase-3 round, as a third actor after
 * advocates A and B. Same outcome shape as RebuttalRunRecord but typed
 * to the Methodologist's output/refusal shapes; the mint result is the
 * same `AttackMintResult` because we reuse `translateRebuttalOutput`.
 */
export interface MethodologistRunRecord {
  role: typeof METHODOLOGIST_AGENT_ROLE;
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
  llmOutput?: MethodologistOutput;
  mintResult?: AttackMintResult;
  refusal?: MethodologistRefusal;
  refusalPath?: string;
  validationError?: { message: string; rawResponsesCount: number };
  artifacts: {
    promptPath: string;
    llmOutputPath?: string;
    roundLogPath: string;
  };
}

export interface Phase3PartialFile {
  phase: 3;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  /** Same hinge indices used in Phase 2 (loaded from PHASE_2_COMPLETE). */
  hingeIndices: number[];
  /** Subset of CriticalQuestion catalog keyed by schemeId, frozen at run time. */
  cqCatalog: Record<string, { schemeKey: string; cqKeys: string[] }>;
  advocates: { a?: RebuttalRunRecord; b?: RebuttalRunRecord };
  /** Phase-3 third-actor record (cross-side methodological critic).
   *  Optional: pre-Methodologist runs and partials remain valid. */
  methodologist?: MethodologistRunRecord;
  totals: {
    rebuttalsCreated: number;
    edgesCreated: number;
    cqStatusesUpserted: number;
    premiseClaimsMinted: number;
    premiseClaimsDeduped: number;
    citationsAttached: number;
    inputTokens: number;
    outputTokens: number;
  };
  reviewFlags: ReviewFlag[];
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
  artifacts: { partialPath: string };
}

const PHASE_3_LLM_DIR = "llm";
const PHASE_3_PARTIAL_FILE = "PHASE_3_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase(opts: RunPhase3Opts): Promise<Phase3PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round: 0,
  });

  // 1. Prereqs.
  const phase2 = loadPhase2Complete(opts.cfg.runtimeDir, opts.deliberationId);
  const framing = loadFraming(opts.cfg.experimentRoot);

  // 2. Evidence corpus + scheme catalog.
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, {
    role: "advocate-a",
    logger: phaseLogger,
  });
  const evidenceCorpusPrompt = renderEvidenceCorpus({ stack: ec.stack, sources: ec.sources });
  const tokenToSourceId = buildTokenToSourceIdMap(ec);
  const allowedCitationTokens = new Set(Object.keys(tokenToSourceId));
  if (allowedCitationTokens.size === 0) {
    throw new Error(
      `Phase 3: bound evidence corpus has no usable citationTokens (stackId=${ec.stack.id}).`,
    );
  }
  const schemeCatalog = await opts.iso.listSchemes("advocate-a", phaseLogger);
  const schemeIdByKey = new Map<string, string>(schemeCatalog.map((s) => [s.key, s.id]));

  // 3. Load CQ catalog from prisma (CriticalQuestion table) for all
  //    schemes that appear in either advocate's Phase-2 output. We use
  //    the in-process `prisma` client because there is no clean public
  //    API endpoint that returns the full per-scheme CQ list.
  const usedSchemeKeys = new Set<string>();
  for (const a of [...phase2.advocates.a.arguments, ...phase2.advocates.b.arguments]) {
    usedSchemeKeys.add(a.schemeKey);
  }
  const cqCatalogByScheme = await loadCqCatalog(usedSchemeKeys, schemeIdByKey);
  const cqCatalogForFile: Phase3PartialFile["cqCatalog"] = {};
  for (const [schemeKey, cqKeys] of cqCatalogByScheme) {
    const schemeId = schemeIdByKey.get(schemeKey);
    if (schemeId) {
      cqCatalogForFile[schemeId] = { schemeKey, cqKeys: [...cqKeys].sort() };
    }
  }
  phaseLogger.event("round_summary", {
    step: "cq-catalog",
    schemeCount: cqCatalogByScheme.size,
    totalCqs: Array.from(cqCatalogByScheme.values()).reduce((n, s) => n + s.size, 0),
  });

  // 4. Build per-advocate opponent argument maps + the prompt block.
  const opponentBindings = {
    a: buildOpposingArgumentBindings(phase2.advocates.b, phase2.topologyBinding.layerByIndex),
    b: buildOpposingArgumentBindings(phase2.advocates.a, phase2.topologyBinding.layerByIndex),
  };
  const opponentMeta = {
    a: buildOpponentMetaMap(phase2.advocates.b),
    b: buildOpponentMetaMap(phase2.advocates.a),
  };
  const opponentPrompts = {
    a: renderOpponentArguments(phase2.advocates.b, "B", cqCatalogByScheme, phase2.topologyBinding.layerByIndex, phase2.indexToText),
    b: renderOpponentArguments(phase2.advocates.a, "A", cqCatalogByScheme, phase2.topologyBinding.layerByIndex, phase2.indexToText),
  };

  // 5. Resume.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_3_PARTIAL_FILE);
  let priorPartial: Phase3PartialFile | null = null;
  if (existsSync(partialPath)) {
    try {
      const raw = JSON.parse(readFileSync(partialPath, "utf8")) as Phase3PartialFile;
      if (raw.deliberationId === opts.deliberationId) priorPartial = raw;
    } catch {
      // ignore corrupt
    }
  }

  // 6. Decide which advocates to run.
  //    Iter-3 `--round 2` short-circuits the round-1 actor loop entirely:
  //    round-1 must already be complete in PHASE_3_PARTIAL.json.
  if (opts.roundFilter === "2") {
    if (!opts.cfg.iter3MultiRound) {
      throw new Error(
        "--round 2 requires ITER3_MULTI_ROUND=1 (set the env var or `iter3MultiRound: true` in agents.json).",
      );
    }
    if (
      !priorPartial ||
      priorPartial.advocates.a?.outcome !== "ok" ||
      priorPartial.advocates.b?.outcome !== "ok" ||
      priorPartial.methodologist?.outcome !== "ok"
    ) {
      throw new Error(
        "--round 2 requires PHASE_3_PARTIAL.json with all 3 round-1 actors `outcome=ok`. Run `--phase 3 --round 1` (or `--phase 3`) first.",
      );
    }
  }
  const advocatesToRun: RebuttalAgentRole[] = (() => {
    if (opts.roundFilter === "2") return [];
    if (opts.onlyAdvocate) return [opts.onlyAdvocate];
    const all: RebuttalAgentRole[] = ["advocate-a", "advocate-b"];
    if (!priorPartial) return all;
    return all.filter((r) => {
      const rec = r === "advocate-a" ? priorPartial!.advocates.a : priorPartial!.advocates.b;
      return !rec || rec.outcome !== "ok";
    });
  })();

  // Iter-3 `--round 2` skips this short-circuit because the round-2 hook
  // below is the entire point of the run. Iter-3 default also bypasses
  // when the round-2 partial doesn't yet exist on disk, so re-running
  // `--phase 3` after round-1 completes still triggers the round-2 hook.
  const round2PartialExists = existsSync(
    path.join(opts.cfg.runtimeDir, "PHASE_3_ROUND2_PARTIAL.json"),
  );
  const skipShortCircuitForRound2 =
    opts.roundFilter === "2" ||
    (opts.cfg.iter3MultiRound &&
      opts.roundFilter !== "1" &&
      !opts.onlyAdvocate &&
      !round2PartialExists);
  if (
    !skipShortCircuitForRound2 &&
    advocatesToRun.length === 0 &&
    (priorPartial?.methodologist?.outcome === "ok" || opts.onlyAdvocate)
  ) {
    phaseLogger.event("phase_complete", {
      phase: 3,
      outcome: "already-complete",
      partialPath,
    });
    return priorPartial!;
  }

  // 7. Shared ClaimRegistry across both advocates within this run.
  const registry = new ClaimRegistry();

  // 8. Run each advocate sequentially.
  const results: { a?: RebuttalRunRecord; b?: RebuttalRunRecord } = {
    a: priorPartial?.advocates.a,
    b: priorPartial?.advocates.b,
  };
  let methodologistResult: MethodologistRunRecord | undefined =
    priorPartial?.methodologist;

  for (const role of advocatesToRun) {
    const opponentKey = role === "advocate-a" ? "a" : "b";
    const rec = await runOneAdvocate({
      role,
      cfg: opts.cfg,
      iso: opts.iso,
      llm: opts.llm,
      deliberationId: opts.deliberationId,
      framing: framing.full,
      opponentArgumentsPrompt: opponentPrompts[opponentKey],
      evidenceCorpusPrompt,
      opposingArguments: opponentBindings[opponentKey],
      cqKeysByScheme: cqCatalogByScheme,
      allowedCitationTokens,
      tokenToSourceId,
      registry,
      opposingArgumentSchemeByArgId: buildSchemeMap(opponentBindings[opponentKey]),
      opposingArgumentPremisesByArgId: buildPremiseMap(opponentKey === "a" ? phase2.advocates.b : phase2.advocates.a),
      opposingArgumentConclusionByArgId: buildConclusionMap(opponentKey === "a" ? phase2.advocates.b : phase2.advocates.a),
      schemeCatalog,
    });
    if (role === "advocate-a") results.a = rec;
    else results.b = rec;

    writePartial(partialPath, opts, ec.stack.id, phase2.topologyBinding.hingeIndices, cqCatalogForFile, results, methodologistResult, [], undefined);
  }

  // 8b. Run the Methodologist (third actor) iff both advocates have ok
  //     outcomes and (resume) the methodologist hasn't already run.
  //     `onlyAdvocate` scopes the run to that advocate only — skip the
  //     methodologist in that case.
  const methodologistShouldRun =
    opts.roundFilter !== "2" &&
    !opts.onlyAdvocate &&
    results.a?.outcome === "ok" &&
    results.b?.outcome === "ok" &&
    methodologistResult?.outcome !== "ok";

  if (methodologistShouldRun) {
    const methBindings = buildMethodologistBindings(
      phase2.advocates.a,
      phase2.advocates.b,
      phase2.topologyBinding.layerByIndex,
    );
    const methPrompt = renderMethodologistPhase2Block(
      phase2.advocates.a,
      phase2.advocates.b,
      cqCatalogByScheme,
      phase2.topologyBinding.layerByIndex,
      phase2.indexToText,
    );
    methodologistResult = await runMethodologist({
      cfg: opts.cfg,
      iso: opts.iso,
      llm: opts.llm,
      deliberationId: opts.deliberationId,
      framing: framing.full,
      phase2ArgumentsPrompt: methPrompt,
      evidenceCorpusPrompt,
      opposingArguments: methBindings,
      cqKeysByScheme: cqCatalogByScheme,
      allowedCitationTokens,
      tokenToSourceId,
      registry,
      opposingArgumentSchemeByArgId: buildMethodologistSchemeMap(methBindings),
      opposingArgumentPremisesByArgId: buildMethodologistPremiseMap(phase2.advocates.a, phase2.advocates.b),
      opposingArgumentConclusionByArgId: buildMethodologistConclusionMap(phase2.advocates.a, phase2.advocates.b),
      schemeCatalog,
    });
    writePartial(partialPath, opts, ec.stack.id, phase2.topologyBinding.hingeIndices, cqCatalogForFile, results, methodologistResult, [], undefined);
  }

  // Build EvidenceSourceLite list once — consumed by both the iter-3
  // round-2 soft-check pass (below) and the round-1 soft-check pass (§9).
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

  // 8c. Iter-3 multi-round: run round 2 immediately if all 3 round-1
  //     actors are ok and the gate flag is set. Round-2 mints to the
  //     DB (translator skips orphan-guard) and writes its own
  //     PHASE_3_ROUND2_PARTIAL.json. Round-1 partial is untouched.
  if (
    opts.cfg.iter3MultiRound &&
    opts.roundFilter !== "1" &&
    !opts.onlyAdvocate &&
    results.a?.outcome === "ok" &&
    results.b?.outcome === "ok" &&
    methodologistResult?.outcome === "ok"
  ) {
    const methBindings = buildMethodologistBindings(
      phase2.advocates.a,
      phase2.advocates.b,
      phase2.topologyBinding.layerByIndex,
    );
    const methPrompt = renderMethodologistPhase2Block(
      phase2.advocates.a,
      phase2.advocates.b,
      cqCatalogByScheme,
      phase2.topologyBinding.layerByIndex,
      phase2.indexToText,
    );
    const phase2ArgSideById = new Map<string, "A" | "B">();
    for (const arg of phase2.advocates.a.arguments) phase2ArgSideById.set(arg.argumentId, "A");
    for (const arg of phase2.advocates.b.arguments) phase2ArgSideById.set(arg.argumentId, "B");
    try {
      await runPhase3Round2({
        cfg: opts.cfg,
        iso: opts.iso,
        llm: opts.llm,
        deliberationId: opts.deliberationId,
        framing: framing.full,
        evidenceCorpusPrompt,
        allowedCitationTokens,
        tokenToSourceId,
        schemeCatalog,
        schemeIdByKey,
        cqCatalogByScheme,
        registry,
        round1: {
          a: results.a!,
          b: results.b!,
          methodologist: methodologistResult!,
        },
        phase2OpponentBindings: opponentBindings,
        phase2OpponentPrompts: opponentPrompts,
        methodologistPhase2Prompt: methPrompt,
        methodologistPhase2Bindings: methBindings,
        phase2PremiseMaps: {
          a: buildPremiseMap(phase2.advocates.b),
          b: buildPremiseMap(phase2.advocates.a),
        },
        phase2ConclusionMaps: {
          a: buildConclusionMap(phase2.advocates.b),
          b: buildConclusionMap(phase2.advocates.a),
        },
        methodologistPhase2PremiseMap: buildMethodologistPremiseMap(phase2.advocates.a, phase2.advocates.b),
        methodologistPhase2ConclusionMap: buildMethodologistConclusionMap(phase2.advocates.a, phase2.advocates.b),
        phase2ArgSideById,
        sources: reviewSourcesLite,
      });
    } catch (err) {
      // Round-2 failure must NOT poison round-1 partial. Log and
      // continue to soft-track review on round-1 results.
      phaseLogger.event("round_summary", {
        step: "round-2-error",
        error: (err as Error).message,
      });
    }
  }

  // 9. Soft-track review.
  const rebuttalOutputs = {
    a: results.a?.outcome === "ok" ? results.a.llmOutput : undefined,
    b: results.b?.outcome === "ok" ? results.b.llmOutput : undefined,
  };
  const anyOk = Boolean(rebuttalOutputs.a || rebuttalOutputs.b);
  const review = anyOk
    ? await runPhase3SoftChecks({
        rebuttals: rebuttalOutputs,
        opponentByAdvocate: opponentMeta,
        hingeIndices: phase2.topologyBinding.hingeIndices,
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
  });

  // 10. Final partial write.
  const partial = writePartial(
    partialPath,
    opts,
    ec.stack.id,
    phase2.topologyBinding.hingeIndices,
    cqCatalogForFile,
    results,
    methodologistResult,
    review.flags,
    review.judgeUsage.calls > 0 ? review.judgeUsage : undefined,
  );

  const okCount = Number(results.a?.outcome === "ok") + Number(results.b?.outcome === "ok");
  const refusedCount = Number(results.a?.outcome === "refused") + Number(results.b?.outcome === "refused");
  const errorCount =
    Number(results.a?.outcome === "validation-error") + Number(results.b?.outcome === "validation-error");

  phaseLogger.event("phase_complete", {
    phase: 3,
    outcome: okCount === 2 ? "partial-written" : refusedCount === 2 ? "both-refused" : "incomplete",
    okCount,
    refusedCount,
    errorCount,
    totals: partial.totals,
    partialPath,
  });

  if (okCount === 0 && refusedCount > 0) {
    const err = new BothAdvocatesRefusedError(
      `Phase 3: both advocates refused. See refusals at runtime/${REFUSALS_DIR}/.`,
    );
    err.partial = partial;
    throw err;
  }
  if (errorCount > 0 && okCount === 0) {
    throw new Error(
      `Phase 3: hard-validation failed for advocate(s) without any successful run. See partial at ${partialPath}.`,
    );
  }

  return partial;
}

// ─────────────────────────────────────────────────────────────────
// One-advocate driver
// ─────────────────────────────────────────────────────────────────

interface RunOneAdvocateOpts {
  role: RebuttalAgentRole;
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  opponentArgumentsPrompt: string;
  evidenceCorpusPrompt: string;
  opposingArguments: ReadonlyMap<string, OpposingArgumentBinding>;
  cqKeysByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  registry: ClaimRegistry;
  opposingArgumentSchemeByArgId: ReadonlyMap<string, string>;
  opposingArgumentPremisesByArgId: ReadonlyMap<string, readonly string[]>;
  opposingArgumentConclusionByArgId: ReadonlyMap<string, string>;
  schemeCatalog: Array<{ id: string; key: string }>;
}

async function runOneAdvocate(opts: RunOneAdvocateOpts): Promise<RebuttalRunRecord> {
  const round = opts.role === "advocate-a" ? 1 : 2;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round,
    agentRole: opts.role,
  });
  const promptRel = opts.role === "advocate-a" ? "prompts/4-rebuttal-a.md" : "prompts/5-rebuttal-b.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);

  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_3_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-3-${opts.role}-output.json`);
  const roundLogPath = path.join(opts.cfg.runtimeDir, "logs", `round-3-${round}-${opts.role}.jsonl`);
  const baseArtifacts = { promptPath, roundLogPath };

  let turn;
  try {
    turn = await runRebuttalTurn({
      role: opts.role,
      promptPath,
      framing: opts.framing,
      opponentArgumentsPrompt: opts.opponentArgumentsPrompt,
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      schemaOpts: {
        opposingArguments: opts.opposingArguments,
        cqKeysByScheme: opts.cqKeysByScheme,
        allowedCitationTokens: opts.allowedCitationTokens,
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });
  } catch (err) {
    if (err instanceof RebuttalValidationError) {
      logger.event("phase_complete", {
        phase: 3,
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
  if (isRebuttalRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-3-${opts.role}-refusal.json`,
    );
    mkdirSync(path.dirname(refusalPath), { recursive: true });
    writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
    logger.event("phase_complete", {
      phase: 3,
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

  // Success: persist LLM output, then mint.
  mkdirSync(llmDir, { recursive: true });
  writeFileSync(llmOutputPath, JSON.stringify(turn.response, null, 2));

  const mintResult = await translateRebuttalOutput({
    output: turn.response,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
    cfg: opts.cfg,
    tokenToSourceId: opts.tokenToSourceId,
    registry: opts.registry,
    authorRole: opts.role,
    opposingArgumentSchemeByArgId: opts.opposingArgumentSchemeByArgId,
    opposingArgumentPremisesByArgId: opts.opposingArgumentPremisesByArgId,
    opposingArgumentConclusionByArgId: opts.opposingArgumentConclusionByArgId,
    schemeCatalog: opts.schemeCatalog,
    stackId: opts.cfg.deliberation.evidenceStackId ?? null,
  });

  logger.event("phase_complete", {
    phase: 3,
    round,
    agent: opts.role,
    outcome: "ok",
    rebuttalsCreated: mintResult.totals.rebuttalsCreated,
    edgesCreated: mintResult.totals.edgesCreated,
    cqStatusesUpserted: mintResult.totals.cqStatusesUpserted,
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

interface Phase2CompleteShape extends Phase2CompleteFile {
  /** Derived field: sub-claim index → original sub-claim text. */
  indexToText: Record<number, string>;
}

function loadPhase2Complete(runtimeDir: string, deliberationId: string): Phase2CompleteShape {
  const p = path.join(runtimeDir, "PHASE_2_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(
      `Phase 3 prerequisite missing: ${p} not found. Run \`npm run orchestrator -- phase 2\` and \`finalize --phase 2\` first.`,
    );
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase2CompleteFile;
  if (raw.status !== "complete") {
    throw new Error(`Phase 3 prerequisite invalid: ${p} status is "${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 3 prerequisite mismatch: PHASE_2_COMPLETE.json deliberationId=${raw.deliberationId} but current deliberation=${deliberationId}`,
    );
  }

  // Pull sub-claim text from PHASE_1_COMPLETE.json (Phase 2 doesn't carry it).
  const phase1Path = path.join(runtimeDir, "PHASE_1_COMPLETE.json");
  const indexToText: Record<number, string> = {};
  if (existsSync(phase1Path)) {
    try {
      const phase1 = JSON.parse(readFileSync(phase1Path, "utf8")) as {
        topology?: Record<string, { text: string }>;
      };
      if (phase1.topology) {
        for (const [k, v] of Object.entries(phase1.topology)) {
          indexToText[Number(k)] = v.text;
        }
      }
    } catch {
      // Soft fall-through; opponent prompt will say "(text unavailable)".
    }
  }

  return { ...raw, indexToText };
}

/**
 * Load the per-scheme CQ catalog from the `CriticalQuestion` table for
 * exactly the schemes that appear in this Phase-3 run. Returns a Map
 * keyed by scheme KEY (not id) so it matches the rebuttal-schema's
 * `cqKeysByScheme` shape.
 */
export async function loadCqCatalog(
  usedSchemeKeys: ReadonlySet<string>,
  schemeIdByKey: ReadonlyMap<string, string>,
): Promise<Map<ExperimentSchemeKey, Set<string>>> {
  const out = new Map<ExperimentSchemeKey, Set<string>>();
  const schemeIds: string[] = [];
  const idToKey = new Map<string, ExperimentSchemeKey>();
  for (const k of usedSchemeKeys) {
    const id = schemeIdByKey.get(k);
    if (!id) continue;
    if (!isAllowedSchemeKey(k)) continue;
    schemeIds.push(id);
    idToKey.set(id, k);
    out.set(k, new Set());
  }
  if (schemeIds.length === 0) return out;
  const rows = await prisma.criticalQuestion.findMany({
    where: { schemeId: { in: schemeIds }, cqKey: { not: null } },
    select: { schemeId: true, cqKey: true },
  });
  for (const row of rows) {
    if (!row.schemeId || !row.cqKey) continue;
    const key = idToKey.get(row.schemeId);
    if (!key) continue;
    out.get(key)!.add(row.cqKey);
  }
  return out;
}

function buildOpposingArgumentBindings(
  opp: Phase2CompleteAdvocate,
  layerByIndex: Record<number, AdvocateLayer>,
): Map<string, OpposingArgumentBinding> {
  const m = new Map<string, OpposingArgumentBinding>();
  for (const a of opp.arguments) {
    if (!isAllowedSchemeKey(a.schemeKey)) continue; // skip if catalog drift
    const layer = layerByIndex[a.conclusionClaimIndex] ?? "empirical";
    m.set(a.argumentId, {
      argumentId: a.argumentId,
      schemeKey: a.schemeKey as ExperimentSchemeKey,
      premiseCount: a.premiseClaimIds.length,
      conclusionLayer: layer,
    });
  }
  return m;
}

function buildOpponentMetaMap(opp: Phase2CompleteAdvocate): Map<string, OpposingArgumentMeta> {
  const m = new Map<string, OpposingArgumentMeta>();
  for (const a of opp.arguments) {
    m.set(a.argumentId, {
      argumentId: a.argumentId,
      conclusionClaimIndex: a.conclusionClaimIndex,
      // PHASE_2_COMPLETE doesn't store conclusion text; we use the first
      // premise concatenation as a proxy is too noisy. Use a synthesized
      // reference that the mutual-rebut check tokenizes on premise words +
      // sub-claim text from indexToText if available. We just use the
      // first 200 chars of joined premise text — good enough for Jaccard
      // similarity detection of mutual disagreements.
      conclusionText: a.premiseTexts.join(" ").slice(0, 240),
      schemeKey: a.schemeKey,
    });
  }
  return m;
}

export function buildSchemeMap(bindings: ReadonlyMap<string, OpposingArgumentBinding>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [argId, b] of bindings) m.set(argId, b.schemeKey);
  return m;
}

export function buildPremiseMap(opp: Phase2CompleteAdvocate): Map<string, readonly string[]> {
  const m = new Map<string, readonly string[]>();
  for (const a of opp.arguments) m.set(a.argumentId, a.premiseClaimIds);
  return m;
}

export function buildConclusionMap(opp: Phase2CompleteAdvocate): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of opp.arguments) m.set(a.argumentId, a.conclusionClaimId);
  return m;
}

/**
 * Render the OPPONENT_ARGUMENTS prompt block per §3 of the Phase-3 prompts.
 * One block per opposing argument with its premise list (0-indexed for
 * UNDERMINE.targetPremiseIndex), warrant, and inline CQ catalog for its scheme.
 */
function renderOpponentArguments(
  opp: Phase2CompleteAdvocate,
  oppLetter: "A" | "B",
  cqCatalog: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>,
  layerByIndex: Record<number, AdvocateLayer>,
  indexToText: Record<number, string>,
): string {
  const lines: string[] = [];
  for (const arg of opp.arguments) {
    const layer = layerByIndex[arg.conclusionClaimIndex] ?? "empirical";
    const subClaimText = indexToText[arg.conclusionClaimIndex] ?? "(text unavailable)";
    lines.push(
      `ARG ${arg.argumentId}  scheme=${arg.schemeKey}  layer=${layer}`,
    );
    lines.push(`  concludes-to: sub-claim #${arg.conclusionClaimIndex} "${subClaimText}"`);
    lines.push(`  premises (0-indexed):`);
    for (let i = 0; i < arg.premiseTexts.length; i++) {
      const tok = arg.premiseCitationTokens[i];
      lines.push(`    [${i}] "${arg.premiseTexts[i]}"  cite=${tok ?? "null"}`);
    }
    lines.push(`  warrant: ${arg.warrant ? `"${arg.warrant}"` : "null"}`);
    const cqKeys = isAllowedSchemeKey(arg.schemeKey)
      ? cqCatalog.get(arg.schemeKey as ExperimentSchemeKey)
      : undefined;
    if (cqKeys && cqKeys.size > 0) {
      lines.push(`  critical-questions for scheme=${arg.schemeKey}:`);
      for (const cq of [...cqKeys].sort()) {
        lines.push(`    ${cq}: (see CriticalQuestion catalog)`);
      }
    } else {
      lines.push(`  critical-questions: (none registered for ${arg.schemeKey})`);
    }
    lines.push(``);
  }
  if (lines.length === 0) {
    return `(Advocate ${oppLetter} produced no arguments — nothing to attack.)`;
  }
  return lines.join("\n");
}

function writePartial(
  partialPath: string,
  opts: RunPhase3Opts,
  evidenceStackId: string,
  hingeIndices: number[],
  cqCatalog: Phase3PartialFile["cqCatalog"],
  results: { a?: RebuttalRunRecord; b?: RebuttalRunRecord },
  methodologist: MethodologistRunRecord | undefined,
  reviewFlags: ReviewFlag[],
  judgeUsage: { calls: number; inputTokens: number; outputTokens: number } | undefined,
): Phase3PartialFile {
  const totals = aggregateTotals(results, methodologist);
  const partial: Phase3PartialFile = {
    phase: 3,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    evidenceStackId,
    hingeIndices,
    cqCatalog,
    advocates: results,
    methodologist,
    totals,
    reviewFlags,
    judgeUsage,
    artifacts: { partialPath },
  };
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));
  return partial;
}

function aggregateTotals(
  results: { a?: RebuttalRunRecord; b?: RebuttalRunRecord },
  methodologist: MethodologistRunRecord | undefined,
): Phase3PartialFile["totals"] {
  let rebuttalsCreated = 0;
  let edgesCreated = 0;
  let cqStatusesUpserted = 0;
  let premiseClaimsMinted = 0;
  let premiseClaimsDeduped = 0;
  let citationsAttached = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const rec of [results.a, results.b, methodologist]) {
    if (!rec) continue;
    inputTokens += rec.tokenUsage.inputTokens;
    outputTokens += rec.tokenUsage.outputTokens;
    if (rec.mintResult) {
      rebuttalsCreated += rec.mintResult.totals.rebuttalsCreated;
      edgesCreated += rec.mintResult.totals.edgesCreated;
      cqStatusesUpserted += rec.mintResult.totals.cqStatusesUpserted;
      premiseClaimsMinted += rec.mintResult.totals.premiseClaimsMinted;
      premiseClaimsDeduped += rec.mintResult.totals.premiseClaimsDeduped;
      citationsAttached += rec.mintResult.totals.citationsAttached;
    }
  }
  return {
    rebuttalsCreated,
    edgesCreated,
    cqStatusesUpserted,
    premiseClaimsMinted,
    premiseClaimsDeduped,
    citationsAttached,
    inputTokens,
    outputTokens,
  };
}

export class BothAdvocatesRefusedError extends Error {
  partial?: Phase3PartialFile;
  exitCode = 2;
}

// ─────────────────────────────────────────────────────────────────
// Methodologist (third actor)
// ─────────────────────────────────────────────────────────────────

export interface MethodologistOpposingArgumentBinding extends OpposingArgumentBinding {
  advocateRole: "A" | "B";
}

interface RunMethodologistOpts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  phase2ArgumentsPrompt: string;
  evidenceCorpusPrompt: string;
  opposingArguments: ReadonlyMap<string, MethodologistOpposingArgumentBinding>;
  cqKeysByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  registry: ClaimRegistry;
  opposingArgumentSchemeByArgId: ReadonlyMap<string, string>;
  opposingArgumentPremisesByArgId: ReadonlyMap<string, readonly string[]>;
  opposingArgumentConclusionByArgId: ReadonlyMap<string, string>;
  schemeCatalog: Array<{ id: string; key: string }>;
}

async function runMethodologist(
  opts: RunMethodologistOpts,
): Promise<MethodologistRunRecord> {
  const round = 3; // round 3 within Phase 3 — A=1, B=2, M=3
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round,
    agentRole: METHODOLOGIST_AGENT_ROLE,
  });

  const promptRel = "prompts/10-methodologist.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);
  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_3_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-3-methodologist-output.json`);
  const roundLogPath = path.join(
    opts.cfg.runtimeDir,
    "logs",
    `round-3-${round}-methodologist.jsonl`,
  );
  const baseArtifacts = { promptPath, roundLogPath };

  let turn;
  try {
    turn = await runMethodologistTurn({
      promptPath,
      framing: opts.framing,
      phase2ArgumentsPrompt: opts.phase2ArgumentsPrompt,
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      schemaOpts: {
        opposingArguments: opts.opposingArguments,
        cqKeysByScheme: opts.cqKeysByScheme,
        allowedCitationTokens: opts.allowedCitationTokens,
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });
  } catch (err) {
    if (err instanceof MethodologistValidationError) {
      logger.event("phase_complete", {
        phase: 3,
        round,
        agent: METHODOLOGIST_AGENT_ROLE,
        outcome: "validation-error",
        attempts: err.attempts,
      });
      return {
        role: METHODOLOGIST_AGENT_ROLE,
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

  if (isMethodologistRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-3-methodologist-refusal.json`,
    );
    mkdirSync(path.dirname(refusalPath), { recursive: true });
    writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
    logger.event("phase_complete", {
      phase: 3,
      round,
      agent: METHODOLOGIST_AGENT_ROLE,
      outcome: "refused",
      reason: turn.response.error,
      refusalPath,
    });
    return {
      role: METHODOLOGIST_AGENT_ROLE,
      outcome: "refused",
      attempts: turn.attempts,
      tokenUsage: turn.usage,
      refusal: turn.response,
      refusalPath,
      artifacts: baseArtifacts,
    };
  }

  mkdirSync(llmDir, { recursive: true });
  writeFileSync(llmOutputPath, JSON.stringify(turn.response, null, 2));

  // The translator only consumes `rebuttals`, `cqResponses`, and
  // `webCitations` — all three are structurally identical between
  // RebuttalOutput and MethodologistOutput (Methodologist's per-item
  // `targetAdvocateRole` field is extra and ignored). We cast to
  // RebuttalOutput at the boundary to satisfy the translator's static
  // type without altering its parameterization.
  const mintResult = await translateRebuttalOutput({
    output: turn.response as unknown as RebuttalOutput,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
    cfg: opts.cfg,
    tokenToSourceId: opts.tokenToSourceId,
    registry: opts.registry,
    authorRole: METHODOLOGIST_AGENT_ROLE,
    opposingArgumentSchemeByArgId: opts.opposingArgumentSchemeByArgId,
    opposingArgumentPremisesByArgId: opts.opposingArgumentPremisesByArgId,
    opposingArgumentConclusionByArgId: opts.opposingArgumentConclusionByArgId,
    schemeCatalog: opts.schemeCatalog,
    stackId: opts.cfg.deliberation.evidenceStackId ?? null,
  });

  logger.event("phase_complete", {
    phase: 3,
    round,
    agent: METHODOLOGIST_AGENT_ROLE,
    outcome: "ok",
    rebuttalsCreated: mintResult.totals.rebuttalsCreated,
    edgesCreated: mintResult.totals.edgesCreated,
    cqStatusesUpserted: mintResult.totals.cqStatusesUpserted,
  });

  return {
    role: METHODOLOGIST_AGENT_ROLE,
    outcome: "ok",
    attempts: turn.attempts,
    tokenUsage: turn.usage,
    llmOutput: turn.response,
    mintResult,
    artifacts: { ...baseArtifacts, llmOutputPath },
  };
}

// ─────────────────────────────────────────────────────────────────
// Methodologist helpers — unified bindings + prompt rendering
// ─────────────────────────────────────────────────────────────────

function buildMethodologistBindings(
  a: Phase2CompleteAdvocate,
  b: Phase2CompleteAdvocate,
  layerByIndex: Record<number, AdvocateLayer>,
): Map<string, MethodologistOpposingArgumentBinding> {
  const m = new Map<string, MethodologistOpposingArgumentBinding>();
  for (const arg of a.arguments) {
    if (!isAllowedSchemeKey(arg.schemeKey)) continue;
    const layer = layerByIndex[arg.conclusionClaimIndex] ?? "empirical";
    m.set(arg.argumentId, {
      argumentId: arg.argumentId,
      schemeKey: arg.schemeKey as ExperimentSchemeKey,
      premiseCount: arg.premiseClaimIds.length,
      conclusionLayer: layer,
      advocateRole: "A",
    });
  }
  for (const arg of b.arguments) {
    if (!isAllowedSchemeKey(arg.schemeKey)) continue;
    const layer = layerByIndex[arg.conclusionClaimIndex] ?? "empirical";
    m.set(arg.argumentId, {
      argumentId: arg.argumentId,
      schemeKey: arg.schemeKey as ExperimentSchemeKey,
      premiseCount: arg.premiseClaimIds.length,
      conclusionLayer: layer,
      advocateRole: "B",
    });
  }
  return m;
}

function buildMethodologistSchemeMap(
  bindings: ReadonlyMap<string, MethodologistOpposingArgumentBinding>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const [argId, b] of bindings) m.set(argId, b.schemeKey);
  return m;
}

function buildMethodologistPremiseMap(
  a: Phase2CompleteAdvocate,
  b: Phase2CompleteAdvocate,
): Map<string, readonly string[]> {
  const m = new Map<string, readonly string[]>();
  for (const arg of a.arguments) m.set(arg.argumentId, arg.premiseClaimIds);
  for (const arg of b.arguments) m.set(arg.argumentId, arg.premiseClaimIds);
  return m;
}

function buildMethodologistConclusionMap(
  a: Phase2CompleteAdvocate,
  b: Phase2CompleteAdvocate,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const arg of a.arguments) m.set(arg.argumentId, arg.conclusionClaimId);
  for (const arg of b.arguments) m.set(arg.argumentId, arg.conclusionClaimId);
  return m;
}

/**
 * Render the PHASE_2_ARGUMENTS prompt block — both advocates' arguments
 * grouped by side (A first, then B), one block per argument with side
 * label, premises (0-indexed for UNDERMINE.targetPremiseIndex), warrant,
 * and inline CQ catalog. Mirrors `renderOpponentArguments` but covers
 * BOTH sides and tags each ARG line with `side=A|B` so the Methodologist
 * can populate `targetAdvocateRole` correctly.
 */
function renderMethodologistPhase2Block(
  a: Phase2CompleteAdvocate,
  b: Phase2CompleteAdvocate,
  cqCatalog: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>,
  layerByIndex: Record<number, AdvocateLayer>,
  indexToText: Record<number, string>,
): string {
  const sections: string[] = [];
  for (const [side, advocate] of [["A", a], ["B", b]] as const) {
    const lines: string[] = [`### Advocate ${side}`, ``];
    for (const arg of advocate.arguments) {
      const layer = layerByIndex[arg.conclusionClaimIndex] ?? "empirical";
      const subClaimText =
        indexToText[arg.conclusionClaimIndex] ?? "(text unavailable)";
      lines.push(
        `ARG ${arg.argumentId}  side=${side}  scheme=${arg.schemeKey}  layer=${layer}`,
      );
      lines.push(
        `  concludes-to: sub-claim #${arg.conclusionClaimIndex} "${subClaimText}"`,
      );
      lines.push(`  premises (0-indexed):`);
      for (let i = 0; i < arg.premiseTexts.length; i++) {
        const tok = arg.premiseCitationTokens[i];
        lines.push(`    [${i}] "${arg.premiseTexts[i]}"  cite=${tok ?? "null"}`);
      }
      lines.push(`  warrant: ${arg.warrant ? `"${arg.warrant}"` : "null"}`);
      const cqKeys = isAllowedSchemeKey(arg.schemeKey)
        ? cqCatalog.get(arg.schemeKey as ExperimentSchemeKey)
        : undefined;
      if (cqKeys && cqKeys.size > 0) {
        lines.push(`  critical-questions for scheme=${arg.schemeKey}:`);
        for (const cq of [...cqKeys].sort()) {
          lines.push(`    ${cq}: (see CriticalQuestion catalog)`);
        }
      } else {
        lines.push(
          `  critical-questions: (none registered for ${arg.schemeKey})`,
        );
      }
      lines.push(``);
    }
    if (advocate.arguments.length === 0) {
      lines.push(`(No arguments — nothing to attack on this side.)`, ``);
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n");
}

export { runMethodologist as _runMethodologistForTesting };
