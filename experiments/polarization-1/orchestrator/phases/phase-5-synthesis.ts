/**
 * orchestrator/phases/phase-5-synthesis.ts
 *
 * Phase-5 (Synthesis / Crux-Finder) control flow.
 *
 *   loadFraming
 *     → loadPhase1Complete (topology)
 *     → loadPhase2Complete
 *     → loadPhase3Complete
 *     → loadPhase4Complete (must have tracker.outcome === "ok")
 *     → fetch evidence corpus from iso (now includes web-discovered sources
 *        materialized by Phases 2-4 in loosened mode)
 *     → build prompt blocks (topology, A/B Phase-2, A/B Phase-3, A/B Phase-4,
 *        tracker verdict, evidence corpus)
 *     → build schema bindings (knownArgumentIds, knownAttackIds,
 *        knownPhase4ResponseIds, subClaimCount, knownCitationTokens)
 *     → runSynthesistTurn (single-shot judge)
 *     → write PHASE_5_PARTIAL.json + persist verdict / refusal
 *
 * Phase 5 is read-only on the platform: the Synthesist does not mint
 * arguments, edges, or claims. The output is a JSON verdict + (in
 * finalize) a human-readable SYNTHESIS.md report.
 *
 * Resumability: if a prior PHASE_5_PARTIAL.json has tracker.outcome="ok"
 * (i.e. a synthesist verdict already exists) and `resume` is set, this
 * is a no-op.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { modelFor } from "../config";
import { RoundLogger } from "../log/round-logger";

import { loadFraming } from "../util/framing";
import { renderEvidenceCorpus } from "../util/evidence-corpus";

import {
  runSynthesistTurn,
  isSynthesistRefusal,
  SynthesistValidationError,
} from "../agents/synthesist";
import type {
  SynthesistVerdict,
  SynthesistRefusal,
} from "../agents/synthesist-schema";

import {
  renderTopology,
  renderOwnPhase2,
  renderPhase3Block,
  renderMethodologistPhase3Block,
} from "./phase-4-defenses";

import type { Phase1CompleteFile } from "../finalize/phase-1-finalize";
import type {
  Phase2CompleteFile,
  Phase2CompleteAdvocate,
} from "../finalize/phase-2-finalize";
import type {
  Phase3CompleteFile,
  Phase3CompleteAdvocate,
} from "../finalize/phase-3-finalize";
import type {
  Phase4CompleteFile,
  Phase4CompleteAdvocate,
} from "../finalize/phase-4-finalize";
import type { TrackerVerdict } from "../agents/tracker-schema";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RunPhase5Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  resume?: boolean;
}

export interface SynthesistRunRecord {
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  verdict?: SynthesistVerdict;
  refusal?: SynthesistRefusal;
  refusalPath?: string;
  validationError?: { message: string; rawResponsesCount: number };
  artifacts: {
    promptPath: string;
    verdictPath?: string;
    roundLogPath: string;
  };
}

export interface Phase5PartialFile {
  phase: 5;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  synthesist: SynthesistRunRecord;
  artifacts: { partialPath: string };
}

const PHASE_5_LLM_DIR = "llm";
const PHASE_5_PARTIAL_FILE = "PHASE_5_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase(opts: RunPhase5Opts): Promise<Phase5PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 5,
    round: 0,
  });

  // 1. Resume short-circuit.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_5_PARTIAL_FILE);
  if (opts.resume && existsSync(partialPath)) {
    try {
      const prior = JSON.parse(readFileSync(partialPath, "utf8")) as Phase5PartialFile;
      if (prior.synthesist?.outcome === "ok" && prior.deliberationId === opts.deliberationId) {
        phaseLogger.event("phase_skip", {
          phase: 5,
          reason: "synthesist already complete in prior partial; resume=true",
        });
        return prior;
      }
    } catch {
      // fall through and re-run
    }
  }

  // 2. Prereqs.
  const phase1 = loadPhase1Complete(opts.cfg.runtimeDir, opts.deliberationId);
  const phase2 = loadPhase2Complete(opts.cfg.runtimeDir, opts.deliberationId);
  const phase3 = loadPhase3Complete(opts.cfg.runtimeDir, opts.deliberationId);
  const phase4 = loadPhase4Complete(opts.cfg.runtimeDir, opts.deliberationId);

  if (phase4.tracker?.outcome !== "ok" || !phase4.tracker.verdict) {
    throw new Error(
      `Phase 5 prereq invalid: PHASE_4_COMPLETE.json tracker.outcome=` +
        `"${phase4.tracker?.outcome}", expected "ok" with a verdict. The Synthesist ` +
        `consumes the Tracker verdict as authoritative input.`,
    );
  }
  const trackerVerdict = phase4.tracker.verdict;

  const framing = loadFraming(opts.cfg.experimentRoot);

  // 3. Topology bindings (sub-claim text + layer + hinge indices).
  const subClaimTextByIndex: Record<number, string> = {};
  const layerByIndex: Record<number, string> = {};
  for (const [k, v] of Object.entries(phase1.topology)) {
    const i = Number(k);
    subClaimTextByIndex[i] = v.text;
    layerByIndex[i] = v.layer;
  }
  const subClaimCount = Object.keys(phase1.topology).length;
  const hingeIndices = phase4.hingeIndices ?? phase2.topologyBinding.hingeIndices;

  // 4. Evidence corpus (now includes web-materialized sources from loosened mode).
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, {
    role: "advocate-a",
    logger: phaseLogger,
  });
  const evidenceCorpusPrompt = renderEvidenceCorpus({ stack: ec.stack, sources: ec.sources });
  const knownCitationTokens = new Set<string>(ec.sources.map((s) => s.citationToken));

  // 5. Render prompt blocks.
  const topologyPrompt = renderTopology({
    centralClaim: framing.centralClaim,
    subClaimTextByIndex,
    hingeIndices,
    layerByIndex,
  });
  const aPhase2Prompt = renderOwnPhase2(phase2.advocates.a, "A", subClaimTextByIndex);
  const bPhase2Prompt = renderOwnPhase2(phase2.advocates.b, "B", subClaimTextByIndex);
  const aPhase3Prompt = renderPhase3Block(phase3.advocates.a, "A");
  const bPhase3Prompt = renderPhase3Block(phase3.advocates.b, "B");
  const methodologistPhase3Prompt = renderMethodologistPhase3Block(phase3.methodologist);
  const aPhase4Prompt = renderPhase4FromComplete(phase4.advocates.a, "A");
  const bPhase4Prompt = renderPhase4FromComplete(phase4.advocates.b, "B");
  const trackerVerdictPrompt = renderTrackerVerdict(trackerVerdict);

  // 6. Schema bindings: every id the Synthesist may cite must be resolvable.
  const knownArgumentIds = new Set<string>();
  for (const a of phase2.advocates.a.arguments) knownArgumentIds.add(a.argumentId);
  for (const a of phase2.advocates.b.arguments) knownArgumentIds.add(a.argumentId);

  const knownAttackIds = new Set<string>();
  for (const r of phase3.advocates.a.rebuttals) knownAttackIds.add(r.rebuttalArgumentId);
  for (const r of phase3.advocates.b.rebuttals) knownAttackIds.add(r.rebuttalArgumentId);
  if (phase3.methodologist) {
    for (const r of phase3.methodologist.rebuttals) {
      knownAttackIds.add(r.rebuttalArgumentId);
    }
  }

  const knownPhase4ResponseIds = new Set<string>();
  for (let i = 0; i < phase4.advocates.a.responses.length; i++) {
    knownPhase4ResponseIds.add(`phase4-A-r${i}`);
  }
  for (let i = 0; i < phase4.advocates.a.cqAnswers.length; i++) {
    knownPhase4ResponseIds.add(`phase4-A-cq${i}`);
  }
  for (let i = 0; i < phase4.advocates.b.responses.length; i++) {
    knownPhase4ResponseIds.add(`phase4-B-r${i}`);
  }
  for (let i = 0; i < phase4.advocates.b.cqAnswers.length; i++) {
    knownPhase4ResponseIds.add(`phase4-B-cq${i}`);
  }

  // Iter-3: when the multi-round flag is set AND partial files exist,
  // augment the synthesist inputs with round-2 attacks + sub-round-b
  // responses. No-op when flag is off or partials missing.
  let appendedUserBlock: string | undefined;
  if (opts.cfg.iter3MultiRound) {
    const { loadIter3Augmentation } = await import("../util/iter3-augment");
    const aug = loadIter3Augmentation({
      runtimeDir: opts.cfg.runtimeDir,
      deliberationId: opts.deliberationId,
    });
    if (aug.anyData) {
      for (const id of aug.round2AttackIds) knownAttackIds.add(id);
      for (const id of aug.subRoundBResponseIds) knownPhase4ResponseIds.add(id);
      appendedUserBlock = aug.appendedUserBlock;
    }
  }

  // 7. Run the synthesist.
  const round = 0;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 5,
    round,
    agentRole: "synthesist",
  });
  const promptPath = path.join(opts.cfg.experimentRoot, "prompts/9-synthesist.md");
  const verdictPath = path.join(opts.cfg.runtimeDir, PHASE_5_LLM_DIR, "phase-5-synthesist-verdict.json");
  const baseArtifacts = {
    promptPath,
    roundLogPath: path.join(opts.cfg.runtimeDir, "logs", `round-5-${round}-synthesist.jsonl`),
  };

  let record: SynthesistRunRecord;
  try {
    const turn = await runSynthesistTurn({
      promptPath,
      framing: framing.full,
      topologyPrompt,
      advocateAPhase2Prompt: aPhase2Prompt,
      advocateBPhase2Prompt: bPhase2Prompt,
      advocateAPhase3Prompt: aPhase3Prompt,
      advocateBPhase3Prompt: bPhase3Prompt,
      methodologistPhase3Prompt,
      advocateAPhase4Prompt: aPhase4Prompt,
      advocateBPhase4Prompt: bPhase4Prompt,
      trackerVerdictPrompt,
      evidenceCorpusPrompt,
      appendedUserBlock,
      schemaOpts: {
        knownArgumentIds,
        knownAttackIds,
        knownPhase4ResponseIds,
        subClaimCount,
        knownCitationTokens,
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });

    if (isSynthesistRefusal(turn.response)) {
      const refusalPath = path.join(opts.cfg.runtimeDir, REFUSALS_DIR, `phase-5-synthesist-refusal.json`);
      mkdirSync(path.dirname(refusalPath), { recursive: true });
      writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
      logger.event("phase_complete", {
        phase: 5,
        round,
        agent: "synthesist",
        outcome: "refused",
        reason: turn.response.error,
      });
      record = {
        outcome: "refused",
        attempts: turn.attempts,
        tokenUsage: turn.usage,
        refusal: turn.response,
        refusalPath,
        artifacts: baseArtifacts,
      };
    } else {
      mkdirSync(path.dirname(verdictPath), { recursive: true });
      writeFileSync(verdictPath, JSON.stringify(turn.response, null, 2));
      logger.event("phase_complete", {
        phase: 5,
        round,
        agent: "synthesist",
        outcome: "ok",
        netEpistemicValue: turn.response.epistemicShift.netEpistemicValue,
        cruxCount: turn.response.cruxes.length,
        agreementCount: turn.response.agreements.length,
        originalContributionCount: turn.response.originalContributions.length,
        openQuestionCount: turn.response.openQuestions.length,
      });
      record = {
        outcome: "ok",
        attempts: turn.attempts,
        tokenUsage: turn.usage,
        verdict: turn.response,
        artifacts: { ...baseArtifacts, verdictPath },
      };
    }
  } catch (err) {
    if (err instanceof SynthesistValidationError) {
      logger.event("phase_complete", {
        phase: 5,
        round,
        agent: "synthesist",
        outcome: "validation-error",
        attempts: err.attempts,
      });
      record = {
        outcome: "validation-error",
        attempts: err.attempts,
        validationError: { message: err.message, rawResponsesCount: err.rawResponses.length },
        artifacts: baseArtifacts,
      };
    } else {
      throw err;
    }
  }

  // 8. Persist partial.
  const partial: Phase5PartialFile = {
    phase: 5,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    evidenceStackId: ec.stack.id,
    hingeIndices,
    synthesist: record,
    artifacts: { partialPath },
  };
  mkdirSync(path.dirname(partialPath), { recursive: true });
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));

  phaseLogger.event("phase_partial_written", {
    phase: 5,
    partialPath,
    synthesistOutcome: record.outcome,
  });
  return partial;
}

// ─────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────

function loadPhase1Complete(runtimeDir: string, deliberationId: string): Phase1CompleteFile {
  const p = path.join(runtimeDir, "PHASE_1_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(`Phase 5 prereq missing: ${p}. Run phase 1 + finalize.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase1CompleteFile;
  if (raw.status !== "complete") {
    throw new Error(`Phase 5 prereq invalid: ${p} status="${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 5 prereq mismatch: PHASE_1_COMPLETE.json deliberationId=${raw.deliberationId} but current=${deliberationId}`,
    );
  }
  return raw;
}

function loadPhase2Complete(runtimeDir: string, deliberationId: string): Phase2CompleteFile {
  const p = path.join(runtimeDir, "PHASE_2_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(`Phase 5 prereq missing: ${p}. Run phase 2 + finalize.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase2CompleteFile;
  if (raw.status !== "complete") {
    throw new Error(`Phase 5 prereq invalid: ${p} status="${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 5 prereq mismatch: PHASE_2_COMPLETE.json deliberationId=${raw.deliberationId} but current=${deliberationId}`,
    );
  }
  return raw;
}

function loadPhase3Complete(runtimeDir: string, deliberationId: string): Phase3CompleteFile {
  const p = path.join(runtimeDir, "PHASE_3_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(`Phase 5 prereq missing: ${p}. Run phase 3 + finalize.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase3CompleteFile;
  if (raw.status !== "complete") {
    throw new Error(`Phase 5 prereq invalid: ${p} status="${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 5 prereq mismatch: PHASE_3_COMPLETE.json deliberationId=${raw.deliberationId} but current=${deliberationId}`,
    );
  }
  return raw;
}

function loadPhase4Complete(runtimeDir: string, deliberationId: string): Phase4CompleteFile {
  const p = path.join(runtimeDir, "PHASE_4_COMPLETE.json");
  if (!existsSync(p)) {
    throw new Error(`Phase 5 prereq missing: ${p}. Run phase 4 + finalize.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Phase4CompleteFile;
  if (raw.status !== "complete") {
    throw new Error(`Phase 5 prereq invalid: ${p} status="${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 5 prereq mismatch: PHASE_4_COMPLETE.json deliberationId=${raw.deliberationId} but current=${deliberationId}`,
    );
  }
  return raw;
}

// ─────────────────────────────────────────────────────────────────
// Renderers (Phase-4 Complete file shape + tracker verdict)
// ─────────────────────────────────────────────────────────────────

/**
 * Like `renderPhase4Block` in phase-4-defenses, but takes the persisted
 * `Phase4CompleteAdvocate` shape (read from PHASE_4_COMPLETE.json) rather
 * than the in-memory `DefenseRunRecord`. The persisted shape is normalized
 * (`responses[]` + `cqAnswers[]` directly, with full premise text) and
 * doesn't carry the same `llmOutput.responses` indirection.
 *
 * Synthesizes the canonical `phase4-{A|B}-r{idx}` / `phase4-{A|B}-cq{idx}`
 * response ids that the Synthesist schema validates against.
 */
function renderPhase4FromComplete(adv: Phase4CompleteAdvocate, letter: "A" | "B"): string {
  if (adv.responses.length === 0 && adv.cqAnswers.length === 0) {
    return `(Advocate ${letter} produced no Phase-4 responses or cqAnswers.)`;
  }
  const lines: string[] = [];
  for (let i = 0; i < adv.responses.length; i++) {
    const r = adv.responses[i];
    const responseId = `phase4-${letter}-r${i}`;
    lines.push(`RESPONSE ${responseId}  targets: ATTACK ${r.targetAttackId}`);
    lines.push(`  kind: ${r.kind}`);
    lines.push(`  rationale: "${r.rationale}"`);
    if (r.defense) {
      lines.push(`  defense:`);
      lines.push(`    attackType: ${r.defense.attackType}`);
      if (r.defense.targetPremiseIndex !== null) {
        lines.push(`    targetPremiseIndex: ${r.defense.targetPremiseIndex}`);
      }
      lines.push(`    conclusionText: "${r.defense.conclusionText}"`);
      lines.push(`    premises:`);
      for (let j = 0; j < r.defense.premiseTexts.length; j++) {
        const tok = r.defense.premiseCitationTokens[j];
        lines.push(`      [${j}] "${r.defense.premiseTexts[j]}"  cite=${tok ?? "null"}`);
      }
      lines.push(`    schemeKey: ${r.defense.schemeKey}`);
      if (r.defense.warrant) lines.push(`    warrant: "${r.defense.warrant}"`);
    }
    if (r.narrowedConclusionText) {
      lines.push(`  narrowedConclusionText: "${r.narrowedConclusionText}"`);
    }
    lines.push(``);
  }
  for (let i = 0; i < adv.cqAnswers.length; i++) {
    const c = adv.cqAnswers[i];
    const cqAnswerId = `phase4-${letter}-cq${i}`;
    lines.push(`CQ_ANSWER ${cqAnswerId}  targets: CQ_RAISE ${c.targetCqRaiseId}`);
    lines.push(`  kind: ${c.kind}`);
    lines.push(`  rationale: "${c.rationale}"`);
    lines.push(``);
  }
  return lines.join("\n");
}

/**
 * Serializes the Phase-4 Tracker verdict into a markdown-ish block for
 * the Synthesist's CONCESSION_TRACKER_VERDICT input. The Synthesist
 * treats this as authoritative input on per-argument standings.
 */
function renderTrackerVerdict(v: TrackerVerdict): string {
  const lines: string[] = [];
  lines.push(`Tracker model phase: ${v.phase}`);
  lines.push(``);

  // Central-claim verdict.
  lines.push(`### Central-claim verdict`);
  lines.push(`  verdict: ${v.centralClaimVerdict.verdict}`);
  lines.push(`  rationale: "${v.centralClaimVerdict.rationale}"`);
  if (v.centralClaimVerdict.primarySupportingArguments.length) {
    lines.push(
      `  primarySupportingArguments: [${v.centralClaimVerdict.primarySupportingArguments.join(", ")}]`,
    );
  }
  if (v.centralClaimVerdict.primaryUnderminingArguments.length) {
    lines.push(
      `  primaryUnderminingArguments: [${v.centralClaimVerdict.primaryUnderminingArguments.join(", ")}]`,
    );
  }
  lines.push(``);

  // Per-argument standings.
  lines.push(`### Argument standings (${v.argumentStandings.length})`);
  for (const s of v.argumentStandings) {
    lines.push(
      `- ARG ${s.argumentId} [${s.advocateRole}]  standing=${s.standing}` +
        (s.isHingeArgument ? "  (hinge)" : ""),
    );
    lines.push(`    rationale: "${s.rationale}"`);
    if (s.effectiveConcessions.length) {
      lines.push(`    effectiveConcessions:`);
      for (const c of s.effectiveConcessions) {
        lines.push(
          `      - drivenBy=${c.drivenBy} kind=${c.kind}` +
            (c.premiseIndex !== null ? ` premise=${c.premiseIndex}` : "") +
            (c.cqKey !== null ? ` cqKey=${c.cqKey}` : ""),
        );
      }
    }
    if (s.successfulDefenses.length) {
      lines.push(`    successfulDefenses:`);
      for (const d of s.successfulDefenses) {
        lines.push(
          `      - drivenBy=${d.drivenBy} againstAttack=${d.againstAttackId} rationale="${d.rationale}"`,
        );
      }
    }
  }
  lines.push(``);

  // Per-advocate summaries.
  lines.push(`### Advocate summaries`);
  for (const a of v.advocateSummaries) {
    lines.push(`- Advocate ${a.advocateRole}`);
    lines.push(
      `    totals: ${a.totalArguments} args  ` +
        `stood=${a.stoodCount}  weakened=${a.weakenedCount}  fallen=${a.fallenCount}`,
    );
    lines.push(
      `    hinge: stood=${a.hingeStandings.stoodCount}  ` +
        `weakened=${a.hingeStandings.weakenedCount}  fallen=${a.hingeStandings.fallenCount}`,
    );
    lines.push(`    concessionDiscrimination: ${a.concessionDiscrimination}`);
    lines.push(`    rationale: "${a.concessionDiscriminationRationale}"`);
  }

  return lines.join("\n");
}
