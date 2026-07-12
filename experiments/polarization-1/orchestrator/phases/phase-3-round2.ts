/**
 * phases/phase-3-round2.ts
 *
 * Iter-3 multi-round Phase 3 — round-2 driver. Gated behind
 * `cfg.iter3MultiRound`. Round 1 runs via the existing `runPhase`
 * code path; this module is invoked from `runPhase` AFTER round 1's
 * methodologist has succeeded.
 *
 * Round-2 semantics (per locked design memo):
 *   - Actors: advocate-a, advocate-b, methodologist (same three).
 *   - Each actor may emit:
 *       (a) NEW direct attacks on opponent's Phase-2 args
 *           (`targetKind = "phase2-arg"` — same as round 1).
 *       (b) Attacks-on-attacks against round-1 rebuttals filed
 *           against the actor's own Phase-2 args
 *           (`targetKind = "round1-rebuttal"`).
 *   - CQ raises in round 2 are bound to the TARGET's scheme — for
 *     attacks-on-attacks, that's the round-1 rebuttal's `schemeKey`.
 *
 * Outputs:
 *   - DB: argument + edge rows for round-2 rebuttals (translator
 *     handles minting; orphan-guard is skipped per `round: "2"`).
 *   - File: `PHASE_3_ROUND2_PARTIAL.json` next to PHASE_3_PARTIAL.json
 *     (separate file — finalize-merge into PHASE_3_COMPLETE is a
 *     follow-up task; tracker reads attacks from DB regardless).
 *
 * Failure mode: if any actor refuses or validation-errors, round-2
 * partial still records the failure record; round-1 results are
 * untouched. User can re-resume with the same gate flag.
 */

import path from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";
import { ClaimRegistry } from "../translators/claim-mint";

import {
  loadCqCatalog,
  buildSchemeMap,
  buildPremiseMap,
  buildConclusionMap,
  type RebuttalRunRecord,
  type MethodologistRunRecord,
  type Phase3PartialFile,
  type MethodologistOpposingArgumentBinding,
} from "./phase-3-attacks";

import {
  runRebuttalTurn,
  RebuttalValidationError,
  isRebuttalRefusal,
  type RebuttalAgentRole,
} from "../agents/rebuttal";
import {
  runMethodologistTurn,
  MethodologistValidationError,
  isMethodologistRefusal,
  METHODOLOGIST_AGENT_ROLE,
} from "../agents/methodologist";
import {
  type OpposingArgumentBinding,
} from "../agents/rebuttal-schema";
import type { ExperimentSchemeKey } from "../scheme-catalog";
import { isAllowedSchemeKey } from "../scheme-catalog";
import { translateRebuttalOutput } from "../translators/attack-mint";
import {
  type RebuttalOutput,
} from "../agents/rebuttal-schema";
import type { Phase3CompleteRebuttal, Phase3CompleteMethodologistRebuttal } from "../finalize/phase-3-finalize";
import {
  runPhase3Round2SoftChecks,
  type OpposingArgumentMeta,
  type ReviewFlag,
  type EvidenceSourceLite,
} from "../review/phase-3-checks";

// ─────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────

const PHASE_3_LLM_DIR = "llm";
const PHASE_3_ROUND2_PARTIAL_FILE = "PHASE_3_ROUND2_PARTIAL.json";
const REFUSALS_DIR = "refusals";

/** Round-1 rebuttal record viewed as a potential round-2 target. */
interface Round1RebuttalRef {
  rebuttalArgumentId: string;
  /** Scheme of the round-1 rebuttal (target schema for CQ raises). */
  schemeKey: string;
  premiseClaimIds: readonly string[];
  conclusionClaimId: string;
  conclusionText: string;
  premiseTexts: readonly string[];
  warrant: string | null;
  cqKey: string | null;
  /** Phase-2 argumentId this round-1 rebuttal attacked. */
  targetPhase2ArgId: string;
  attackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  /** Author role of the round-1 rebuttal. */
  authorRole: "advocate-a" | "advocate-b" | "methodologist";
  /** Side whose Phase-2 argument was attacked (the side that needs to
   *  defend / attack-back in round 2). */
  defendingSide: "A" | "B";
}

export interface RunPhase3Round2Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  evidenceCorpusPrompt: string;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  schemeCatalog: Array<{ id: string; key: string }>;
  schemeIdByKey: ReadonlyMap<string, string>;
  cqCatalogByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  registry: ClaimRegistry;
  /** Round-1 results. All three must have outcome="ok" before calling. */
  round1: {
    a: RebuttalRunRecord;
    b: RebuttalRunRecord;
    methodologist: MethodologistRunRecord;
  };
  /** Phase-2 opposing-argument bindings for each side (reused from round 1). */
  phase2OpponentBindings: {
    a: ReadonlyMap<string, OpposingArgumentBinding>; // for A: B's args
    b: ReadonlyMap<string, OpposingArgumentBinding>; // for B: A's args
  };
  /** Pre-rendered Phase-2 OPPONENT_ARGUMENTS prompt blocks (from round 1). */
  phase2OpponentPrompts: { a: string; b: string };
  /** Pre-rendered Phase-2 BOTH-SIDES prompt block for the methodologist. */
  methodologistPhase2Prompt: string;
  /** Methodologist's Phase-2 bindings (both sides). */
  methodologistPhase2Bindings: ReadonlyMap<string, MethodologistOpposingArgumentBinding>;
  /** Phase-2 premise/conclusion maps (one per side, indexed by Phase-2 argId). */
  phase2PremiseMaps: { a: ReadonlyMap<string, readonly string[]>; b: ReadonlyMap<string, readonly string[]> };
  phase2ConclusionMaps: { a: ReadonlyMap<string, string>; b: ReadonlyMap<string, string> };
  methodologistPhase2PremiseMap: ReadonlyMap<string, readonly string[]>;
  methodologistPhase2ConclusionMap: ReadonlyMap<string, string>;
  /** Phase-2 advocate sides keyed by argumentId — used to determine which
   *  Phase-2 args belong to A vs B for routing round-1 rebuttals. */
  phase2ArgSideById: ReadonlyMap<string, "A" | "B">;
  /** Optional EvidenceSourceLite[] for the round-2 evidence-fidelity
   *  judge. When omitted, deterministic soft-checks still run; only the
   *  LLM-judge call is skipped. */
  sources?: EvidenceSourceLite[];
}

export interface Phase3Round2PartialFile {
  phase: 3;
  subPhase: "round-2";
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  actors: {
    a?: RebuttalRunRecord;
    b?: RebuttalRunRecord;
    methodologist?: MethodologistRunRecord;
  };
  totals: {
    rebuttalsCreated: number;
    edgesCreated: number;
    cqStatusesUpserted: number;
    inputTokens: number;
    outputTokens: number;
  };
  /** Iter-3 task #6: round-2 soft-check flags (deterministic +
   *  optional LLM-judge). Empty array when no actor produced output. */
  reviewFlags?: ReviewFlag[];
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────────────────────────
// Round-1 → Round1RebuttalRef extraction
// ─────────────────────────────────────────────────────────────────

/**
 * Collect every round-1 rebuttal in the in-memory records, tagged with
 * its author and the side it attacked. Source of truth: each record's
 * `mintResult.rebuttals` (carries persisted DB ids) joined with
 * `llmOutput.rebuttals` (carries text + premises).
 */
function collectRound1Rebuttals(
  round1: RunPhase3Round2Opts["round1"],
  phase2ArgSideById: ReadonlyMap<string, "A" | "B">,
): Round1RebuttalRef[] {
  const out: Round1RebuttalRef[] = [];

  function collect(
    rec: RebuttalRunRecord | MethodologistRunRecord,
    authorRole: "advocate-a" | "advocate-b" | "methodologist",
  ): void {
    if (rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) return;
    const inputs = rec.llmOutput.rebuttals;
    for (const m of rec.mintResult.rebuttals) {
      const orig = inputs[m.inputIndex];
      if (!orig) continue;
      // Round-1 rebuttals only — defensive in case round-2 records ever
      // get appended in the future.
      const round = (orig as any).round ?? "1";
      if (round !== "1") continue;
      // Round-1 rebuttals only target Phase-2 args.
      const targetKind = (orig as any).targetKind ?? "phase2-arg";
      if (targetKind !== "phase2-arg") continue;
      const defendingSide = phase2ArgSideById.get(m.targetArgumentId);
      if (!defendingSide) continue; // unknown target — skip defensively
      out.push({
        rebuttalArgumentId: m.rebuttalArgumentId,
        schemeKey: m.schemeKey,
        premiseClaimIds: m.premiseClaimIds,
        conclusionClaimId: m.conclusionClaimId,
        conclusionText: orig.conclusionText,
        premiseTexts: orig.premises.map((p: any) => p.text),
        warrant: orig.warrant ?? null,
        cqKey: m.cqKey ?? null,
        targetPhase2ArgId: m.targetArgumentId,
        attackType: m.attackType,
        authorRole,
        defendingSide,
      });
    }
  }

  collect(round1.a, "advocate-a");
  collect(round1.b, "advocate-b");
  collect(round1.methodologist, "methodologist");
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Extended binding builders (Phase-2 args ∪ round-1 rebuttals)
// ─────────────────────────────────────────────────────────────────

function rebuttalBinding(rb: Round1RebuttalRef): OpposingArgumentBinding | null {
  if (!isAllowedSchemeKey(rb.schemeKey)) return null;
  return {
    argumentId: rb.rebuttalArgumentId,
    schemeKey: rb.schemeKey as ExperimentSchemeKey,
    premiseCount: rb.premiseClaimIds.length,
    // Round-1 rebuttal conclusions are free-form claims (no layer
    // assignment). Default to "empirical" — the layer-plausibility
    // rule then accepts any rebuttal scheme attacking them.
    conclusionLayer: "empirical",
  };
}

function buildAdvocateRound2Bindings(
  side: "A" | "B",
  phase2Bindings: ReadonlyMap<string, OpposingArgumentBinding>,
  round1Refs: readonly Round1RebuttalRef[],
): Map<string, OpposingArgumentBinding> {
  const out = new Map<string, OpposingArgumentBinding>(phase2Bindings);
  // Side A round-2 may attack round-1 rebuttals filed against A's args.
  for (const rb of round1Refs) {
    if (rb.defendingSide !== side) continue;
    const b = rebuttalBinding(rb);
    if (b) out.set(rb.rebuttalArgumentId, b);
  }
  return out;
}

function buildMethodologistRound2Bindings(
  phase2Bindings: ReadonlyMap<string, MethodologistOpposingArgumentBinding>,
  round1Refs: readonly Round1RebuttalRef[],
): Map<string, MethodologistOpposingArgumentBinding> {
  const out = new Map<string, MethodologistOpposingArgumentBinding>(phase2Bindings);
  // Methodologist round-2 may attack ANY round-1 rebuttal.
  for (const rb of round1Refs) {
    const b = rebuttalBinding(rb);
    if (!b) continue;
    out.set(rb.rebuttalArgumentId, {
      ...b,
      // Route the methodologist's targetAdvocateRole to the side whose
      // arg the round-1 rebuttal attacked. (Methodologist attacking a
      // rebuttal-against-A is conceptually "supporting A", so route
      // the criticism as targeting side A's defensive interest.)
      advocateRole: rb.defendingSide,
    });
  }
  return out;
}

function extendPremiseMap(
  base: ReadonlyMap<string, readonly string[]>,
  round1Refs: readonly Round1RebuttalRef[],
  filter: (rb: Round1RebuttalRef) => boolean,
): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>(base);
  for (const rb of round1Refs) {
    if (!filter(rb)) continue;
    out.set(rb.rebuttalArgumentId, rb.premiseClaimIds);
  }
  return out;
}

function extendConclusionMap(
  base: ReadonlyMap<string, string>,
  round1Refs: readonly Round1RebuttalRef[],
  filter: (rb: Round1RebuttalRef) => boolean,
): Map<string, string> {
  const out = new Map<string, string>(base);
  for (const rb of round1Refs) {
    if (!filter(rb)) continue;
    out.set(rb.rebuttalArgumentId, rb.conclusionClaimId);
  }
  return out;
}

function extendSchemeMap(
  base: ReadonlyMap<string, string>,
  round1Refs: readonly Round1RebuttalRef[],
  filter: (rb: Round1RebuttalRef) => boolean,
): Map<string, string> {
  const out = new Map<string, string>(base);
  for (const rb of round1Refs) {
    if (!filter(rb)) continue;
    out.set(rb.rebuttalArgumentId, rb.schemeKey);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Renderers
// ─────────────────────────────────────────────────────────────────

/**
 * Render the `## ROUND_1_ATTACKS_ON_YOU` block for an advocate
 * recipient. Lists every round-1 rebuttal filed against the
 * recipient's Phase-2 args by the opposing advocate or the
 * methodologist. The `rebuttalArgumentId` is a legal
 * `targetArgumentId` for round-2 attacks-on-attacks.
 */
function renderRound1AttacksForAdvocate(
  side: "A" | "B",
  round1Refs: readonly Round1RebuttalRef[],
  cqCatalog: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>,
): string {
  const mine = round1Refs.filter((rb) => rb.defendingSide === side);
  if (mine.length === 0) {
    return [
      "## ROUND_1_ATTACKS_ON_YOU",
      "",
      `(No round-1 attacks were filed against your Phase-2 arguments.)`,
      "",
    ].join("\n");
  }
  const lines: string[] = ["## ROUND_1_ATTACKS_ON_YOU", ""];
  for (const rb of mine) {
    lines.push(
      `REB ${rb.rebuttalArgumentId}  attacker=${rb.authorRole}  ` +
        `targets-your=${rb.targetPhase2ArgId}  attackType=${rb.attackType}  ` +
        `scheme=${rb.schemeKey}` + (rb.cqKey ? `  cqKey=${rb.cqKey}` : ""),
    );
    lines.push(`  conclusion: "${rb.conclusionText}"`);
    lines.push(`  premises (0-indexed):`);
    for (let i = 0; i < rb.premiseTexts.length; i++) {
      lines.push(`    [${i}] "${rb.premiseTexts[i]}"`);
    }
    lines.push(`  warrant: ${rb.warrant ? `"${rb.warrant}"` : "null"}`);
    if (isAllowedSchemeKey(rb.schemeKey)) {
      const cqs = cqCatalog.get(rb.schemeKey as ExperimentSchemeKey);
      if (cqs && cqs.size > 0) {
        lines.push(`  critical-questions for scheme=${rb.schemeKey}:`);
        for (const cq of [...cqs].sort()) {
          lines.push(`    ${cq}: (see CriticalQuestion catalog)`);
        }
      } else {
        lines.push(`  critical-questions: (none registered for ${rb.schemeKey})`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Render `## ROUND_1_ATTACKS_ALL` for the methodologist (every
 * round-1 rebuttal regardless of side).
 */
function renderRound1AttacksForMethodologist(
  round1Refs: readonly Round1RebuttalRef[],
  cqCatalog: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>,
): string {
  if (round1Refs.length === 0) {
    return ["## ROUND_1_ATTACKS_ALL", "", "(No round-1 attacks were filed.)", ""].join("\n");
  }
  const lines: string[] = ["## ROUND_1_ATTACKS_ALL", ""];
  for (const rb of round1Refs) {
    lines.push(
      `REB ${rb.rebuttalArgumentId}  side=${rb.defendingSide}-defender  ` +
        `attacker=${rb.authorRole}  targets-arg=${rb.targetPhase2ArgId}  ` +
        `attackType=${rb.attackType}  scheme=${rb.schemeKey}` +
        (rb.cqKey ? `  cqKey=${rb.cqKey}` : ""),
    );
    lines.push(`  conclusion: "${rb.conclusionText}"`);
    lines.push(`  premises (0-indexed):`);
    for (let i = 0; i < rb.premiseTexts.length; i++) {
      lines.push(`    [${i}] "${rb.premiseTexts[i]}"`);
    }
    lines.push(`  warrant: ${rb.warrant ? `"${rb.warrant}"` : "null"}`);
    if (isAllowedSchemeKey(rb.schemeKey)) {
      const cqs = cqCatalog.get(rb.schemeKey as ExperimentSchemeKey);
      if (cqs && cqs.size > 0) {
        lines.push(`  critical-questions for scheme=${rb.schemeKey}:`);
        for (const cq of [...cqs].sort()) {
          lines.push(`    ${cq}: (see CriticalQuestion catalog)`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Per-actor round-2 runners
// ─────────────────────────────────────────────────────────────────

const PHASE_3_ROUND_2 = 4 as const; // round 4 within Phase 3 logger (1=A,2=B,3=M; 4=A-r2,5=B-r2,6=M-r2)

interface RunRound2AdvocateOpts {
  side: "A" | "B";
  role: RebuttalAgentRole;
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  opponentArgumentsPrompt: string;
  evidenceCorpusPrompt: string;
  /** Extended bindings (Phase-2 ∪ round-1 rebuttals against this side). */
  opposingArguments: ReadonlyMap<string, OpposingArgumentBinding>;
  cqKeysByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  registry: ClaimRegistry;
  opposingArgumentSchemeByArgId: ReadonlyMap<string, string>;
  opposingArgumentPremisesByArgId: ReadonlyMap<string, readonly string[]>;
  opposingArgumentConclusionByArgId: ReadonlyMap<string, string>;
  schemeCatalog: Array<{ id: string; key: string }>;
  /** Round-2 addendum content + the rendered ROUND_1_ATTACKS_ON_YOU block. */
  appendedSystemPrompt: string;
  appendedUserBlock: string;
}

async function runRound2Advocate(opts: RunRound2AdvocateOpts): Promise<RebuttalRunRecord> {
  const round = opts.role === "advocate-a" ? PHASE_3_ROUND_2 : PHASE_3_ROUND_2 + 1;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round,
    agentRole: opts.role,
  });
  const promptRel = opts.role === "advocate-a" ? "prompts/4-rebuttal-a.md" : "prompts/5-rebuttal-b.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);
  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_3_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-3-round2-${opts.role}-output.json`);
  const roundLogPath = path.join(
    opts.cfg.runtimeDir,
    "logs",
    `round-3-${round}-${opts.role}.jsonl`,
  );
  const baseArtifacts = { promptPath, roundLogPath };

  let turn;
  try {
    turn = await runRebuttalTurn({
      role: opts.role,
      promptPath,
      framing: opts.framing,
      opponentArgumentsPrompt: opts.opponentArgumentsPrompt,
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      appendedSystemPrompt: opts.appendedSystemPrompt,
      appendedUserBlock: opts.appendedUserBlock,
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
        validationError: { message: err.message, rawResponsesCount: err.rawResponses.length },
        artifacts: baseArtifacts,
      };
    }
    throw err;
  }

  if (isRebuttalRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-3-round2-${opts.role}-refusal.json`,
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
    round: "2",
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

interface RunRound2MethodologistOpts {
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
  appendedSystemPrompt: string;
  appendedUserBlock: string;
}

async function runRound2Methodologist(
  opts: RunRound2MethodologistOpts,
): Promise<MethodologistRunRecord> {
  const round = PHASE_3_ROUND_2 + 2;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round,
    agentRole: METHODOLOGIST_AGENT_ROLE,
  });
  const promptRel = "prompts/10-methodologist.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);
  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_3_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-3-round2-methodologist-output.json`);
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
      appendedSystemPrompt: opts.appendedSystemPrompt,
      appendedUserBlock: opts.appendedUserBlock,
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
        validationError: { message: err.message, rawResponsesCount: err.rawResponses.length },
        artifacts: baseArtifacts,
      };
    }
    throw err;
  }

  if (isMethodologistRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-3-round2-methodologist-refusal.json`,
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

  const mintResult = await translateRebuttalOutput({
    output: turn.response as unknown as RebuttalOutput,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
    cfg: opts.cfg,
    tokenToSourceId: opts.tokenToSourceId,
    registry: opts.registry,
    authorRole: METHODOLOGIST_AGENT_ROLE,
    round: "2",
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
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase3Round2(
  opts: RunPhase3Round2Opts,
): Promise<Phase3Round2PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 3,
    round: PHASE_3_ROUND_2 - 1,
  });
  phaseLogger.event("round_summary", {
    step: "round-2-start",
    deliberationId: opts.deliberationId,
  });

  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_3_ROUND2_PARTIAL_FILE);

  // Resume support: if a prior round-2 partial exists for this delib,
  // use its records and re-run only actors that aren't ok.
  let prior: Phase3Round2PartialFile | null = null;
  if (existsSync(partialPath)) {
    try {
      const raw = JSON.parse(readFileSync(partialPath, "utf8")) as Phase3Round2PartialFile;
      if (raw.deliberationId === opts.deliberationId) prior = raw;
    } catch {
      // ignore corrupt
    }
  }
  const actors: Phase3Round2PartialFile["actors"] = {
    a: prior?.actors.a,
    b: prior?.actors.b,
    methodologist: prior?.actors.methodologist,
  };

  // 1. Collect round-1 rebuttals + extend cq catalog with rebuttal schemes.
  const round1Refs = collectRound1Rebuttals(opts.round1, opts.phase2ArgSideById);
  phaseLogger.event("round_summary", {
    step: "round-1-collected",
    rebuttalCount: round1Refs.length,
    bySide: {
      A: round1Refs.filter((r) => r.defendingSide === "A").length,
      B: round1Refs.filter((r) => r.defendingSide === "B").length,
    },
  });

  // Extend cq catalog with any rebuttal scheme keys not already present.
  const newSchemeKeys = new Set<string>();
  for (const rb of round1Refs) {
    if (!opts.cqCatalogByScheme.has(rb.schemeKey as ExperimentSchemeKey)) {
      newSchemeKeys.add(rb.schemeKey);
    }
  }
  let cqCatalogExtended: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>> =
    opts.cqCatalogByScheme;
  if (newSchemeKeys.size > 0) {
    const fresh = await loadCqCatalog(newSchemeKeys, opts.schemeIdByKey);
    const merged = new Map<ExperimentSchemeKey, Set<string>>();
    for (const [k, v] of opts.cqCatalogByScheme) merged.set(k, new Set(v));
    for (const [k, v] of fresh) merged.set(k, v);
    cqCatalogExtended = merged;
  }

  // 2. Run actors (advocate-a, advocate-b, methodologist) sequentially.
  const addendumA = readAddendum(opts.cfg, "advocate-a");
  const addendumB = readAddendum(opts.cfg, "advocate-b");
  const addendumM = readAddendum(opts.cfg, "methodologist");

  // ── Advocate A ──
  if (actors.a?.outcome !== "ok") {
    const bindingsA = buildAdvocateRound2Bindings(
      "A",
      opts.phase2OpponentBindings.a,
      round1Refs,
    );
    const premiseMapA = extendPremiseMap(
      opts.phase2PremiseMaps.a,
      round1Refs,
      (rb) => rb.defendingSide === "A",
    );
    const conclusionMapA = extendConclusionMap(
      opts.phase2ConclusionMaps.a,
      round1Refs,
      (rb) => rb.defendingSide === "A",
    );
    const schemeMapA = extendSchemeMap(
      buildSchemeMap(opts.phase2OpponentBindings.a),
      round1Refs,
      (rb) => rb.defendingSide === "A",
    );
    const userBlockA = renderRound1AttacksForAdvocate("A", round1Refs, cqCatalogExtended);
    try {
      actors.a = await runRound2Advocate({
        side: "A",
        role: "advocate-a",
        cfg: opts.cfg,
        iso: opts.iso,
        llm: opts.llm,
        deliberationId: opts.deliberationId,
        framing: opts.framing,
        opponentArgumentsPrompt: opts.phase2OpponentPrompts.a,
        evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
        opposingArguments: bindingsA,
        cqKeysByScheme: cqCatalogExtended,
        allowedCitationTokens: opts.allowedCitationTokens,
        tokenToSourceId: opts.tokenToSourceId,
        registry: opts.registry,
        opposingArgumentSchemeByArgId: schemeMapA,
        opposingArgumentPremisesByArgId: premiseMapA,
        opposingArgumentConclusionByArgId: conclusionMapA,
        schemeCatalog: opts.schemeCatalog,
        appendedSystemPrompt: addendumA,
        appendedUserBlock: userBlockA,
      });
    } catch (err) {
      phaseLogger.event("round_summary", {
        step: "round-2-actor-error",
        actor: "advocate-a",
        error: err instanceof Error ? err.message : String(err),
      });
      // Leave actors.a as-is (null or prior failed record) so resume retries.
    }
    writeRound2Partial(partialPath, opts, actors);
  }

  // ── Advocate B ──
  if (actors.b?.outcome !== "ok") {
    const bindingsB = buildAdvocateRound2Bindings(
      "B",
      opts.phase2OpponentBindings.b,
      round1Refs,
    );
    const premiseMapB = extendPremiseMap(
      opts.phase2PremiseMaps.b,
      round1Refs,
      (rb) => rb.defendingSide === "B",
    );
    const conclusionMapB = extendConclusionMap(
      opts.phase2ConclusionMaps.b,
      round1Refs,
      (rb) => rb.defendingSide === "B",
    );
    const schemeMapB = extendSchemeMap(
      buildSchemeMap(opts.phase2OpponentBindings.b),
      round1Refs,
      (rb) => rb.defendingSide === "B",
    );
    const userBlockB = renderRound1AttacksForAdvocate("B", round1Refs, cqCatalogExtended);
    try {
      actors.b = await runRound2Advocate({
        side: "B",
        role: "advocate-b",
        cfg: opts.cfg,
        iso: opts.iso,
        llm: opts.llm,
        deliberationId: opts.deliberationId,
        framing: opts.framing,
        opponentArgumentsPrompt: opts.phase2OpponentPrompts.b,
        evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
        opposingArguments: bindingsB,
        cqKeysByScheme: cqCatalogExtended,
        allowedCitationTokens: opts.allowedCitationTokens,
        tokenToSourceId: opts.tokenToSourceId,
        registry: opts.registry,
        opposingArgumentSchemeByArgId: schemeMapB,
        opposingArgumentPremisesByArgId: premiseMapB,
        opposingArgumentConclusionByArgId: conclusionMapB,
        schemeCatalog: opts.schemeCatalog,
        appendedSystemPrompt: addendumB,
        appendedUserBlock: userBlockB,
      });
    } catch (err) {
      phaseLogger.event("round_summary", {
        step: "round-2-actor-error",
        actor: "advocate-b",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    writeRound2Partial(partialPath, opts, actors);
  }

  // ── Methodologist ──
  if (actors.methodologist?.outcome !== "ok") {
    const bindingsM = buildMethodologistRound2Bindings(
      opts.methodologistPhase2Bindings,
      round1Refs,
    );
    const premiseMapM = extendPremiseMap(
      opts.methodologistPhase2PremiseMap,
      round1Refs,
      () => true,
    );
    const conclusionMapM = extendConclusionMap(
      opts.methodologistPhase2ConclusionMap,
      round1Refs,
      () => true,
    );
    const schemeMapM = extendSchemeMap(
      (() => {
        const m = new Map<string, string>();
        for (const [argId, b] of opts.methodologistPhase2Bindings) m.set(argId, b.schemeKey);
        return m;
      })(),
      round1Refs,
      () => true,
    );
    const userBlockM = renderRound1AttacksForMethodologist(round1Refs, cqCatalogExtended);
    try {
      actors.methodologist = await runRound2Methodologist({
        cfg: opts.cfg,
        iso: opts.iso,
        llm: opts.llm,
        deliberationId: opts.deliberationId,
        framing: opts.framing,
        phase2ArgumentsPrompt: opts.methodologistPhase2Prompt,
        evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
        opposingArguments: bindingsM,
        cqKeysByScheme: cqCatalogExtended,
        allowedCitationTokens: opts.allowedCitationTokens,
        tokenToSourceId: opts.tokenToSourceId,
        registry: opts.registry,
        opposingArgumentSchemeByArgId: schemeMapM,
        opposingArgumentPremisesByArgId: premiseMapM,
        opposingArgumentConclusionByArgId: conclusionMapM,
        schemeCatalog: opts.schemeCatalog,
        appendedSystemPrompt: addendumM,
        appendedUserBlock: userBlockM,
      });
    } catch (err) {
      phaseLogger.event("round_summary", {
        step: "round-2-actor-error",
        actor: "methodologist",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    writeRound2Partial(partialPath, opts, actors);
  }

  // ── Soft-check review (Iter-3 task #6) ──
  // Build per-actor opponent meta sets and run round-2 soft-checks.
  // mutual_rebut + hinge_attack_concentration are skipped per design;
  // remaining checks (attack_targeting, scheme_cq_validity,
  // scheme_appropriateness, evidence_fidelity) run per-actor.
  const review = await runRound2SoftChecks({
    opts,
    actors,
    round1Refs,
    logger: phaseLogger,
  });
  phaseLogger.event("round_summary", {
    step: "round-2-soft-review",
    flagCount: review.flags.length,
    judgeCalls: review.judgeUsage.calls,
  });

  const partial = writeRound2Partial(
    partialPath,
    opts,
    actors,
    review.flags,
    review.judgeUsage.calls > 0 ? review.judgeUsage : undefined,
  );
  phaseLogger.event("round_summary", {
    step: "round-2-complete",
    okCount:
      Number(actors.a?.outcome === "ok") +
      Number(actors.b?.outcome === "ok") +
      Number(actors.methodologist?.outcome === "ok"),
    totals: partial.totals,
    reviewFlagCount: review.flags.length,
    judgeCalls: review.judgeUsage.calls,
  });
  return partial;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function readAddendum(
  cfg: OrchestratorConfig,
  role: "advocate-a" | "advocate-b" | "methodologist",
): string {
  const filename =
    role === "advocate-a"
      ? "4b-rebuttal-a-round2-addendum.md"
      : role === "advocate-b"
        ? "5b-rebuttal-b-round2-addendum.md"
        : "10b-methodologist-round2-addendum.md";
  const p = path.join(cfg.experimentRoot, "prompts", filename);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

function writeRound2Partial(
  partialPath: string,
  opts: RunPhase3Round2Opts,
  actors: Phase3Round2PartialFile["actors"],
  reviewFlags?: ReviewFlag[],
  judgeUsage?: { calls: number; inputTokens: number; outputTokens: number },
): Phase3Round2PartialFile {
  const partial: Phase3Round2PartialFile = {
    phase: 3,
    subPhase: "round-2",
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    actors,
    totals: aggregateRound2Totals(actors),
    reviewFlags: reviewFlags ?? [],
    judgeUsage,
  };
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));
  return partial;
}

function aggregateRound2Totals(
  actors: Phase3Round2PartialFile["actors"],
): Phase3Round2PartialFile["totals"] {
  let rebuttalsCreated = 0,
    edgesCreated = 0,
    cqStatusesUpserted = 0,
    inputTokens = 0,
    outputTokens = 0;
  for (const rec of [actors.a, actors.b, actors.methodologist]) {
    if (!rec) continue;
    inputTokens += rec.tokenUsage.inputTokens;
    outputTokens += rec.tokenUsage.outputTokens;
    if (rec.outcome === "ok" && rec.mintResult) {
      rebuttalsCreated += rec.mintResult.totals.rebuttalsCreated;
      edgesCreated += rec.mintResult.totals.edgesCreated;
      cqStatusesUpserted += rec.mintResult.totals.cqStatusesUpserted;
    }
  }
  return { rebuttalsCreated, edgesCreated, cqStatusesUpserted, inputTokens, outputTokens };
}

// Keep imports referenced (silences "imported but unused" in tsc when
// the types are only used for documentation in this module).
type _KeepImports = Phase3PartialFile | Phase3CompleteRebuttal | Phase3CompleteMethodologistRebuttal;

// ─────────────────────────────────────────────────────────────────
// Iter-3 task #6: round-2 soft-check execution
// ─────────────────────────────────────────────────────────────────

/**
 * Build the per-actor opponent meta map (the set of every argumentId
 * the actor was permitted to target in round 2 — opponent's Phase-2
 * args + round-1 rebuttals filed against own args; methodologist sees
 * BOTH sides + ALL round-1 rebuttals) and dispatch the round-2 soft
 * checks.
 *
 * Phase-2 arg meta uses schemeKey lookup from `phase2OpponentBindings`
 * (advocates) / `methodologistPhase2Bindings`. Round-1 rebuttal meta
 * uses `Round1RebuttalRef.schemeKey` + `conclusionText`.
 *
 * `conclusionClaimIndex` is set to a sentinel `-1` since round-2 skips
 * the hinge-attack-concentration check (which would consume that field).
 */
async function runRound2SoftChecks(args: {
  opts: RunPhase3Round2Opts;
  actors: Phase3Round2PartialFile["actors"];
  round1Refs: readonly Round1RebuttalRef[];
  logger: RoundLogger;
}): Promise<{ flags: ReviewFlag[]; judgeUsage: { calls: number; inputTokens: number; outputTokens: number } }> {
  const { opts, actors, round1Refs, logger } = args;

  // Build per-actor opponent meta sets.
  function buildMeta(
    phase2Bindings: ReadonlyMap<string, OpposingArgumentBinding>,
    phase2ConclusionTexts: ReadonlyMap<string, string>,
    round1Visible: readonly Round1RebuttalRef[],
  ): ReadonlyMap<string, OpposingArgumentMeta> {
    const out = new Map<string, OpposingArgumentMeta>();
    for (const [argId, b] of phase2Bindings) {
      out.set(argId, {
        argumentId: argId,
        conclusionClaimIndex: -1, // sentinel — hinge check skipped in round 2
        conclusionText: phase2ConclusionTexts.get(argId) ?? "",
        schemeKey: b.schemeKey,
      });
    }
    for (const rb of round1Visible) {
      out.set(rb.rebuttalArgumentId, {
        argumentId: rb.rebuttalArgumentId,
        conclusionClaimIndex: -1,
        conclusionText: rb.conclusionText,
        schemeKey: rb.schemeKey,
      });
    }
    return out;
  }

  // For Phase-2 conclusion text lookup we don't have full text in the
  // bindings; the round-1 driver doesn't surface this map either. Use
  // an empty map (conclusion text is only consumed by mutual-rebut,
  // which we skip). The judge prompt does not need it.
  const emptyText: ReadonlyMap<string, string> = new Map();

  const metaA = buildMeta(
    opts.phase2OpponentBindings.a,
    emptyText,
    round1Refs.filter((rb) => rb.defendingSide === "A"),
  );
  const metaB = buildMeta(
    opts.phase2OpponentBindings.b,
    emptyText,
    round1Refs.filter((rb) => rb.defendingSide === "B"),
  );
  // Methodologist sees both sides' Phase-2 args + ALL round-1 rebuttals.
  const metaM = new Map<string, OpposingArgumentMeta>();
  for (const [argId, b] of opts.methodologistPhase2Bindings) {
    metaM.set(argId, {
      argumentId: argId,
      conclusionClaimIndex: -1,
      conclusionText: "",
      schemeKey: b.schemeKey,
    });
  }
  for (const rb of round1Refs) {
    metaM.set(rb.rebuttalArgumentId, {
      argumentId: rb.rebuttalArgumentId,
      conclusionClaimIndex: -1,
      conclusionText: rb.conclusionText,
      schemeKey: rb.schemeKey,
    });
  }

  // Methodologist output is structurally compatible with RebuttalOutput
  // for the fields the soft-checks read (rebuttals[].targetArgumentId/
  // attackType/targetPremiseIndex/schemeKey/premises/conclusionText/cqKey
  // and cqResponses[].targetArgumentId). Cast at the boundary.
  const outputs = {
    a: actors.a?.outcome === "ok" ? actors.a.llmOutput : undefined,
    b: actors.b?.outcome === "ok" ? actors.b.llmOutput : undefined,
    methodologist:
      actors.methodologist?.outcome === "ok"
        ? (actors.methodologist.llmOutput as unknown as RebuttalOutput | undefined)
        : undefined,
  };

  const anyOk = Boolean(outputs.a || outputs.b || outputs.methodologist);
  if (!anyOk) {
    return { flags: [], judgeUsage: { calls: 0, inputTokens: 0, outputTokens: 0 } };
  }

  return runPhase3Round2SoftChecks({
    outputs,
    opponentByActor: { a: metaA, b: metaB, methodologist: metaM },
    sources: opts.sources ?? [],
    llm: opts.sources && opts.sources.length > 0 ? opts.llm : undefined,
    cfg: opts.sources && opts.sources.length > 0 ? opts.cfg : undefined,
    logger,
  });
}
