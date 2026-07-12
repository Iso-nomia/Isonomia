/**
 * orchestrator/phases/phase-6-chains.ts
 *
 * Phase-6 (Chain-Architect) control flow.
 *
 *   loadFraming
 *     → loadPhase1Complete (topology + hinge claimIds)
 *     → loadPhase2Complete (P2 args grouped by conclusionClaimIndex)
 *     → loadPhase3Complete (P3 attacks + methodologist attacks)
 *     → loadPhase4Complete (responses + tracker per-arg standings)
 *     → loadPhase5Complete (synthesist verdict — for crux summary)
 *     → build hinge-keyed prompt blocks
 *     → build schema bindings (knownArgumentIds covering P2 + P3 + P4 + narrow-variants;
 *        hingeIndices)
 *     → runChainArchitectTurn (single-shot judge)
 *     → write PHASE_6_PARTIAL.json with the architect's plan
 *
 * Phase 6 IS NOT read-only — finalize-6 calls the chain-mint translator
 * which posts to `/api/argument-chains` (and nodes/edges) under the
 * Methodologist agent's bearer token. But the Phase-6 PARTIAL stage
 * itself is read-only on the platform; the writes happen in finalize.
 *
 * Resumability: if a prior PHASE_6_PARTIAL.json has architect.outcome="ok"
 * (i.e. a plan already exists) and `resume` is set, this is a no-op.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";

import { loadFraming } from "../util/framing";

import {
  runChainArchitectTurn,
  isChainArchitectRefusal,
  ChainArchitectValidationError,
} from "../agents/chain-architect";
import type {
  ChainArchitectPlan,
  ChainArchitectRefusal,
} from "../agents/chain-architect-schema";

import {
  renderTopology,
  renderOwnPhase2,
} from "./phase-4-defenses";

import type { Phase1CompleteFile } from "../finalize/phase-1-finalize";
import type { Phase2CompleteFile } from "../finalize/phase-2-finalize";
import type { Phase3CompleteFile } from "../finalize/phase-3-finalize";
import type { Phase4CompleteFile } from "../finalize/phase-4-finalize";
import type { Phase5CompleteFile } from "../finalize/phase-5-finalize";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RunPhase6Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  resume?: boolean;
}

export interface ChainArchitectRunRecord {
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  plan?: ChainArchitectPlan;
  refusal?: ChainArchitectRefusal;
  refusalPath?: string;
  validationError?: { message: string; rawResponsesCount: number };
  artifacts: {
    promptPath: string;
    planPath?: string;
    roundLogPath: string;
  };
}

export interface Phase6PartialFile {
  phase: 6;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  hingeIndices: number[];
  architect: ChainArchitectRunRecord;
  artifacts: { partialPath: string };
}

const PHASE_6_LLM_DIR = "llm";
const PHASE_6_PARTIAL_FILE = "PHASE_6_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase(opts: RunPhase6Opts): Promise<Phase6PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 6,
    round: 0,
  });

  // 1. Resume short-circuit.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_6_PARTIAL_FILE);
  if (opts.resume && existsSync(partialPath)) {
    try {
      const prior = JSON.parse(readFileSync(partialPath, "utf8")) as Phase6PartialFile;
      if (prior.architect?.outcome === "ok" && prior.deliberationId === opts.deliberationId) {
        phaseLogger.event("phase_skip", {
          phase: 6,
          reason: "architect already complete in prior partial; resume=true",
        });
        return prior;
      }
    } catch {
      // fall through and re-run
    }
  }

  // 2. Prereqs.
  const phase1 = loadPhaseComplete<Phase1CompleteFile>(opts.cfg.runtimeDir, opts.deliberationId, 1);
  const phase2 = loadPhaseComplete<Phase2CompleteFile>(opts.cfg.runtimeDir, opts.deliberationId, 2);
  const phase3 = loadPhaseComplete<Phase3CompleteFile>(opts.cfg.runtimeDir, opts.deliberationId, 3);
  const phase4 = loadPhaseComplete<Phase4CompleteFile>(opts.cfg.runtimeDir, opts.deliberationId, 4);
  const phase5 = loadPhaseComplete<Phase5CompleteFile>(opts.cfg.runtimeDir, opts.deliberationId, 5);

  if (phase4.tracker?.outcome !== "ok" || !phase4.tracker.verdict) {
    throw new Error(
      `Phase 6 prereq invalid: PHASE_4_COMPLETE.json tracker.outcome=` +
        `"${phase4.tracker?.outcome}", expected "ok" with a verdict.`,
    );
  }
  if (phase5.synthesist?.outcome !== "ok" || !phase5.synthesist.verdict) {
    throw new Error(
      `Phase 6 prereq invalid: PHASE_5_COMPLETE.json synthesist.outcome=` +
        `"${phase5.synthesist?.outcome}", expected "ok" with a verdict.`,
    );
  }

  const trackerVerdict = phase4.tracker.verdict;
  const synthesistVerdict = phase5.synthesist.verdict;
  const framing = loadFraming(opts.cfg.experimentRoot);

  // 3. Topology bindings (sub-claim text + claimId + layer + hinge indices).
  const subClaimTextByIndex: Record<number, string> = {};
  const subClaimIdByIndex: Record<number, string> = {};
  const layerByIndex: Record<number, string> = {};
  for (const [k, v] of Object.entries(phase1.topology)) {
    const i = Number(k);
    subClaimTextByIndex[i] = v.text;
    subClaimIdByIndex[i] = v.claimId;
    layerByIndex[i] = v.layer;
  }
  const hingeIndices = phase4.hingeIndices ?? phase2.topologyBinding.hingeIndices;

  // 4. Evidence corpus — used only to surface the stackId in the partial.
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, {
    role: "advocate-a",
    logger: phaseLogger,
  });

  // 5. Render prompt blocks.
  const topologyPrompt = renderTopology({
    centralClaim: framing.centralClaim,
    subClaimTextByIndex,
    hingeIndices,
    layerByIndex,
  });
  const hingesPrompt = renderHinges({
    hingeIndices,
    subClaimIdByIndex,
    subClaimTextByIndex,
  });
  const phase2ByHingePrompt = renderPhase2ByHinge({
    phase2,
    hingeIndices,
    subClaimTextByIndex,
  });
  const phase3Prompt = renderPhase3Attacks(phase3);
  const phase4Prompt = renderPhase4Responses(phase4);
  const trackerStandingsPrompt = renderTrackerStandings(trackerVerdict);
  const synthesistVerdictPrompt = renderSynthesistVerdictSummary(synthesistVerdict);

  // 6. Schema bindings: every argumentId the architect may reference must resolve.
  const knownArgumentIds = new Set<string>();
  for (const a of phase2.advocates.a.arguments) knownArgumentIds.add(a.argumentId);
  for (const a of phase2.advocates.b.arguments) knownArgumentIds.add(a.argumentId);
  for (const r of phase3.advocates.a.rebuttals) knownArgumentIds.add(r.rebuttalArgumentId);
  for (const r of phase3.advocates.b.rebuttals) knownArgumentIds.add(r.rebuttalArgumentId);
  if (phase3.methodologist) {
    for (const r of phase3.methodologist.rebuttals) knownArgumentIds.add(r.rebuttalArgumentId);
  }
  for (const resp of phase4.advocates.a.responses) {
    if (resp.defenseArgumentId) knownArgumentIds.add(resp.defenseArgumentId);
    if (resp.narrowVariantArgumentId) knownArgumentIds.add(resp.narrowVariantArgumentId);
  }
  for (const resp of phase4.advocates.b.responses) {
    if (resp.defenseArgumentId) knownArgumentIds.add(resp.defenseArgumentId);
    if (resp.narrowVariantArgumentId) knownArgumentIds.add(resp.narrowVariantArgumentId);
  }

  // 7. Run the chain-architect.
  const round = 0;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 6,
    round,
    agentRole: "chain-architect",
  });
  const promptPath = path.join(opts.cfg.experimentRoot, "prompts/11-chain-architect.md");
  const planPath = path.join(opts.cfg.runtimeDir, PHASE_6_LLM_DIR, "phase-6-chain-architect-plan.json");
  const baseArtifacts = {
    promptPath,
    roundLogPath: path.join(opts.cfg.runtimeDir, "logs", `round-6-${round}-chain-architect.jsonl`),
  };

  let record: ChainArchitectRunRecord;
  try {
    const turn = await runChainArchitectTurn({
      promptPath,
      framing: framing.full,
      topologyPrompt,
      hingesPrompt,
      phase2ByHingePrompt,
      phase3Prompt,
      phase4Prompt,
      trackerStandingsPrompt,
      synthesistVerdictPrompt,
      schemaOpts: {
        knownArgumentIds,
        hingeIndices: new Set(hingeIndices),
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });

    if (isChainArchitectRefusal(turn.response)) {
      const refusalPath = path.join(opts.cfg.runtimeDir, REFUSALS_DIR, `phase-6-chain-architect-refusal.json`);
      mkdirSync(path.dirname(refusalPath), { recursive: true });
      writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
      logger.event("phase_complete", {
        phase: 6,
        round,
        agent: "chain-architect",
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
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, JSON.stringify(turn.response, null, 2));
      logger.event("phase_complete", {
        phase: 6,
        round,
        agent: "chain-architect",
        outcome: "ok",
        chainCount: turn.response.chains.length,
        nodeTotal: turn.response.chains.reduce((s, c) => s + c.nodes.length, 0),
        edgeTotal: turn.response.chains.reduce((s, c) => s + c.edges.length, 0),
      });
      record = {
        outcome: "ok",
        attempts: turn.attempts,
        tokenUsage: turn.usage,
        plan: turn.response,
        artifacts: { ...baseArtifacts, planPath },
      };
    }
  } catch (err) {
    if (err instanceof ChainArchitectValidationError) {
      logger.event("phase_complete", {
        phase: 6,
        round,
        agent: "chain-architect",
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
  const partial: Phase6PartialFile = {
    phase: 6,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    evidenceStackId: ec.stack.id,
    hingeIndices,
    architect: record,
    artifacts: { partialPath },
  };
  mkdirSync(path.dirname(partialPath), { recursive: true });
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));

  phaseLogger.event("phase_partial_written", {
    phase: 6,
    partialPath,
    architectOutcome: record.outcome,
  });
  return partial;
}

// ─────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────

function loadPhaseComplete<T extends { status?: string; deliberationId?: string }>(
  runtimeDir: string,
  deliberationId: string,
  phase: 1 | 2 | 3 | 4 | 5,
): T {
  const p = path.join(runtimeDir, `PHASE_${phase}_COMPLETE.json`);
  if (!existsSync(p)) {
    throw new Error(`Phase 6 prereq missing: ${p}. Run phase ${phase} + finalize.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8")) as T;
  if (raw.status !== "complete") {
    throw new Error(`Phase 6 prereq invalid: ${p} status="${raw.status}", expected "complete"`);
  }
  if (raw.deliberationId && raw.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 6 prereq mismatch: ${p} deliberationId=${raw.deliberationId} but current=${deliberationId}`,
    );
  }
  return raw;
}

// ─────────────────────────────────────────────────────────────────
// Renderers
// ─────────────────────────────────────────────────────────────────

function renderHinges(opts: {
  hingeIndices: number[];
  subClaimIdByIndex: Record<number, string>;
  subClaimTextByIndex: Record<number, string>;
}): string {
  const lines: string[] = [];
  for (const h of opts.hingeIndices) {
    const text = (opts.subClaimTextByIndex[h] ?? "").replace(/\s+/g, " ").trim();
    lines.push(`HINGE #${h}  claimId=${opts.subClaimIdByIndex[h] ?? "?"}  text="${text}"`);
  }
  return lines.join("\n");
}

function renderPhase2ByHinge(opts: {
  phase2: Phase2CompleteFile;
  hingeIndices: number[];
  subClaimTextByIndex: Record<number, string>;
}): string {
  const lines: string[] = [];
  for (const h of opts.hingeIndices) {
    lines.push(`### Hinge #${h}: ${opts.subClaimTextByIndex[h] ?? "?"}`);
    lines.push("");
    for (const advocateRole of ["a", "b"] as const) {
      const adv = opts.phase2.advocates[advocateRole];
      const matched = adv.arguments.filter((a) => a.conclusionClaimIndex === h);
      for (const arg of matched) {
        lines.push(
          `ARG ${arg.argumentId}  advocate=${advocateRole.toUpperCase()}  scheme=${arg.schemeKey}  concludes-to=#${arg.conclusionClaimIndex}`,
        );
        // Premises are present on the persisted shape; render briefly.
        for (let i = 0; i < (arg.premiseTexts?.length ?? 0); i++) {
          const t = (arg.premiseTexts[i] ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
          lines.push(`  premise[${i}] "${t}"`);
        }
        if (arg.warrant) {
          lines.push(`  warrant: "${String(arg.warrant).replace(/\s+/g, " ").trim().slice(0, 240)}"`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderPhase3Attacks(phase3: Phase3CompleteFile): string {
  const lines: string[] = [];
  function emit(side: "A" | "B" | "M", rebuttals: any[]) {
    for (const r of rebuttals ?? []) {
      const tgtScope = r.targetPremiseClaimId ? "premise" : (r.attackType === "REBUT" ? "conclusion" : "inference");
      const round = r.round ?? "1";
      lines.push(
        `ATTACK ${r.rebuttalArgumentId}  attacker=${side}  round=${round}  attackType=${r.attackType}  targetScope=${tgtScope}  target=${r.targetArgumentId}  scheme=${r.schemeKey ?? "?"}  cqKey=${r.cqKey ?? "-"}`,
      );
      const concl = (r.conclusionText ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (concl) lines.push(`  conclusion: "${concl}"`);
    }
  }
  emit("A", phase3.advocates.a.rebuttals);
  emit("B", phase3.advocates.b.rebuttals);
  if (phase3.methodologist) emit("M", phase3.methodologist.rebuttals);
  return lines.join("\n");
}

function renderPhase4Responses(phase4: Phase4CompleteFile): string {
  const lines: string[] = [];
  function emit(side: "A" | "B", responses: any[]) {
    for (const resp of responses ?? []) {
      const subRound = resp.subRound ?? "a";
      lines.push(
        `RESPONSE  defender=${side}  subRound=${subRound}  kind=${resp.kind}  targetAttack=${resp.targetAttackId}  ` +
          `defenseArgumentId=${resp.defenseArgumentId ?? "-"}  narrowVariantArgumentId=${resp.narrowVariantArgumentId ?? "-"}  ` +
          `retractedCommitmentClaimId=${resp.retractedCommitmentClaimId ?? "-"}`,
      );
      const rationale = (resp.rationale ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
      if (rationale) lines.push(`  rationale: "${rationale}"`);
    }
  }
  emit("A", phase4.advocates.a.responses);
  emit("B", phase4.advocates.b.responses);
  return lines.join("\n");
}

function renderTrackerStandings(verdict: any): string {
  const lines: string[] = [];
  for (const s of verdict.argumentStandings ?? []) {
    lines.push(
      `STANDING  argumentId=${s.argumentId}  standing=${s.standing}  isHinge=${!!s.isHingeArgument}  advocate=${s.advocateRole}`,
    );
  }
  return lines.join("\n");
}

function renderSynthesistVerdictSummary(verdict: any): string {
  const lines: string[] = [];
  lines.push(`netEpistemicValue: ${verdict.epistemicShift?.netEpistemicValue ?? "?"}`);
  lines.push("");
  lines.push("Cruxes (all hinges):");
  for (const c of verdict.cruxes ?? []) {
    const lbl = (c.label ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    lines.push(`  - subClaim=${c.subClaimIndex ?? "*"}  status=${c.status}  "${lbl}"`);
  }
  return lines.join("\n");
}
