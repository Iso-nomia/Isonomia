/**
 * orchestrator/phases/phase-7-cq-raise.ts
 *
 * Phase-7 (CQ-Raise Round) control flow.
 *
 * Three challenger agents (advocate-a, advocate-b, methodologist) each
 * read the closed dialectical record + the synthetic readout's
 * load-bearingness ranking and pick up to N catalog CQs to raise on
 * load-bearing arguments owned by the OTHER sides. No new arguments
 * are minted in Phase 7 — the translator (cq-raise-mint.ts) only POSTs
 * `/api/arguments/{id}/cqs/{cqKey}/ask` (opens CQStatus + WHY move) and
 * `/api/ca` (creates a ConflictApplication crediting the agent as
 * challengerAuthor for fingerprint counting purposes).
 *
 *   loadFraming
 *     → loadPhase1Complete (topology)
 *     → loadPhase2Complete (P2 args by author)
 *     → loadPhase3Complete (P3 attacks + methodologist)
 *     → loadPhase4Complete (defense + narrow-variant args)
 *     → loadPhase6Complete (chain-architect chains — for load-bearing signal)
 *     → fetch synthetic readout (loadBearingnessRanking + topArguments + mostContested)
 *     → load CQ catalog from prisma (scheme.cq JSON)
 *     → load existing CQStatus rows for all P2/P3/P4 args
 *     → for each challenger role:
 *          build TARGET_MENU (load-bearing args owned by other sides)
 *          build VOICE_MENU (caller's own minted args)
 *          build CQ_CATALOG (full per-scheme cq list)
 *          build EXISTING_CQ_STATE (per-target raised/answered keys)
 *          runChallengerTurn → ChallengerPlan | refusal
 *     → write PHASE_7_PARTIAL.json with all three records
 *
 * Resumability: if a prior PHASE_7_PARTIAL.json has at least one
 * `challenger.outcome="ok"` and `resume` is set, this is a no-op.
 *
 * Phase 7 PARTIAL stage is read-only on the platform; mints happen in
 * `finalize/phase-7-finalize.ts`.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

import { prisma } from "@/lib/prismaclient";
import { computeSyntheticReadout, type SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

import type { OrchestratorConfig } from "../config";
import { agentByRole } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import { RoundLogger } from "../log/round-logger";

import { loadFraming } from "../util/framing";

import {
  runChallengerTurn,
  isChallengerRefusal,
  ChallengerValidationError,
} from "../agents/challenger";
import type {
  ChallengerPlan,
  ChallengerPlanRefusal,
} from "../agents/challenger-schema";

import { renderTopology } from "./phase-4-defenses";
import { EXPERIMENT_SCHEME_KEYS, isAllowedSchemeKey } from "../scheme-catalog";

import type { Phase1CompleteFile } from "../finalize/phase-1-finalize";
import type { Phase2CompleteFile, Phase2CompleteArgument } from "../finalize/phase-2-finalize";
import type { Phase3CompleteFile, Phase3CompleteRebuttal } from "../finalize/phase-3-finalize";
import type { Phase4CompleteFile } from "../finalize/phase-4-finalize";
import type { Phase6PartialFile } from "./phase-6-chains";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export type ChallengerRole = "advocate-a" | "advocate-b" | "methodologist";

const CHALLENGER_ROLES: ChallengerRole[] = [
  "advocate-a",
  "advocate-b",
  "methodologist",
];

/** Default max raises per challenger turn. Conservative — better to
 *  ship 6 well-targeted raises × 3 agents = 18 than 30 noisy ones. */
const DEFAULT_MAX_RAISES_PER_AGENT = 8;

export interface RunPhase7Opts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  resume?: boolean;
  /** Override default per-agent raise budget. */
  maxRaisesPerAgent?: number;
}

export interface ChallengerRunRecord {
  agentRole: ChallengerRole;
  outcome: "ok" | "refused" | "validation-error";
  attempts: number;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  plan?: ChallengerPlan;
  refusal?: ChallengerPlanRefusal;
  refusalPath?: string;
  validationError?: { message: string; rawResponsesCount: number };
  /** Sizes of the menus the agent saw (audit trail). */
  menuSizes: {
    targetCount: number;
    voiceCount: number;
    schemesInCatalog: number;
    existingCqStateCount: number;
  };
  artifacts: {
    promptPath: string;
    planPath?: string;
    roundLogPath: string;
  };
}

export interface Phase7PartialFile {
  phase: 7;
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  evidenceStackId: string;
  /** Snapshot of the synthetic-readout fingerprint hash this turn was
   *  computed against — lets finalize detect a stale partial. */
  readoutContentHash: string | null;
  maxRaisesPerAgent: number;
  challengers: ChallengerRunRecord[];
  artifacts: { partialPath: string };
}

const PHASE_7_LLM_DIR = "llm";
const PHASE_7_PARTIAL_FILE = "PHASE_7_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase(opts: RunPhase7Opts): Promise<Phase7PartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 7,
    round: 0,
  });

  // 1. Resume short-circuit.
  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_7_PARTIAL_FILE);
  if (opts.resume && existsSync(partialPath)) {
    try {
      const prior = JSON.parse(readFileSync(partialPath, "utf8")) as Phase7PartialFile;
      if (
        prior.deliberationId === opts.deliberationId &&
        prior.challengers.some((c) => c.outcome === "ok")
      ) {
        phaseLogger.event("phase_skip", {
          phase: 7,
          reason: "challenger turns already complete in prior partial; resume=true",
          okCount: prior.challengers.filter((c) => c.outcome === "ok").length,
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
  // Phase 6 (chain-architect) runs after Phase 5 and writes PARTIAL +
  // COMPLETE. Phase 7 prefers COMPLETE but accepts PARTIAL — chains are
  // a load-bearing signal, not a hard prereq.
  const phase6 = tryLoadPhase6(opts.cfg.runtimeDir, opts.deliberationId);

  // 3. Topology bindings.
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
  const framing = loadFraming(opts.cfg.experimentRoot);

  // 4. Evidence corpus stack (audit trail only).
  const ec = await opts.iso.getEvidenceContext(opts.deliberationId, {
    role: "advocate-a",
    logger: phaseLogger,
  });

  // 5. Synthetic readout — drives load-bearingness ranking.
  const readout = await computeSyntheticReadout(opts.deliberationId);
  if (!readout) {
    throw new Error(
      `Phase 7 prereq failed: synthetic-readout unavailable for ${opts.deliberationId}.`,
    );
  }

  // 6. Resolve scheme keys → ids and load full CQ catalog (cqKey + text + scope).
  const schemeCatalog = await opts.iso.listSchemes("advocate-a", phaseLogger);
  const schemeIdByKey = new Map<string, string>(schemeCatalog.map((s) => [s.key, s.id]));
  const cqCatalog = await loadFullCqCatalog(EXPERIMENT_SCHEME_KEYS, schemeIdByKey);

  // 7. Catalog of every minted argument → owning agent role + scheme key.
  const argMeta = buildArgumentMeta(phase2, phase3, phase4);

  // 8. Load chain-architect chains (if available) — used to up-rank
  //    arguments that appear in chains as ASSERTED-class nodes.
  const chainNodeArgIds = collectChainArgIds(phase6);

  // 9. Build the load-bearing target set. Use the readout's
  //    loadBearingnessRanking + contestednessRanking (top 25 each by
  //    default) + chain-architect node set, intersected with argMeta
  //    keys (i.e. only experiment-minted arguments). Sort stable by
  //    rank, dedup.
  const orderedTargetIds = buildOrderedTargetIds(readout, chainNodeArgIds, argMeta);

  // 10. Existing CQStatus rows per target (key = `${argId}::${cqKey}`).
  const existingCqStateByArg = await loadExistingCqState(orderedTargetIds);

  // 11. Run each challenger.
  const challengerRecords: ChallengerRunRecord[] = [];
  const maxRaises = opts.maxRaisesPerAgent ?? DEFAULT_MAX_RAISES_PER_AGENT;

  for (const role of CHALLENGER_ROLES) {
    const agent = agentByRole(opts.cfg, role);
    const ownArgIds = new Set<string>();
    for (const [argId, m] of argMeta) {
      if (m.agentRole === role) ownArgIds.add(argId);
    }

    // Targets = ordered load-bearing list MINUS the agent's own args.
    const targetIds = orderedTargetIds.filter((id) => {
      const m = argMeta.get(id);
      return m && m.agentRole !== role;
    });

    const targetMenuPrompt = renderTargetMenu(targetIds, argMeta, readout, chainNodeArgIds);
    const voiceMenuPrompt = renderVoiceMenu(ownArgIds, argMeta);
    const cqCatalogPrompt = renderCqCatalog(cqCatalog);
    const existingCqStatePrompt = renderExistingCqState(targetIds, existingCqStateByArg);

    const validSchemeKeys = new Set<string>(Object.keys(cqCatalog));
    const cqsBySchemeKey: Record<string, Set<string>> = {};
    for (const [k, cqs] of Object.entries(cqCatalog)) {
      cqsBySchemeKey[k] = new Set(cqs.map((c) => c.cqKey));
    }

    const round = 0;
    const logger = RoundLogger.forRound({
      runtimeDir: opts.cfg.runtimeDir,
      phase: 7,
      round,
      agentRole: role,
    });
    const promptPath = path.join(opts.cfg.experimentRoot, "prompts/12-challenger.md");
    const planPath = path.join(
      opts.cfg.runtimeDir,
      PHASE_7_LLM_DIR,
      `phase-7-${role}-plan.json`,
    );
    const baseArtifacts = {
      promptPath,
      roundLogPath: path.join(opts.cfg.runtimeDir, "logs", `round-7-${round}-${role}.jsonl`),
    };

    const menuSizes = {
      targetCount: targetIds.length,
      voiceCount: ownArgIds.size,
      schemesInCatalog: Object.keys(cqCatalog).length,
      existingCqStateCount: Array.from(existingCqStateByArg.values()).reduce(
        (n, s) => n + s.size,
        0,
      ),
    };

    if (targetIds.length === 0 || ownArgIds.size === 0) {
      // Nothing to challenge with / against. Skip the LLM call.
      logger.event("phase_complete", {
        phase: 7,
        round,
        agent: role,
        outcome: "refused",
        reason:
          targetIds.length === 0
            ? "no-targets-after-self-filter"
            : "agent-has-no-voice-arguments",
      });
      challengerRecords.push({
        agentRole: role,
        outcome: "refused",
        attempts: 0,
        refusal: {
          outcome: "refused",
          error:
            targetIds.length === 0
              ? "No load-bearing targets remain after filtering out the agent's own arguments."
              : `Agent ${role} has no minted P2/P3/P4 arguments to use as voice.`,
        },
        menuSizes,
        artifacts: baseArtifacts,
      });
      continue;
    }

    try {
      const turn = await runChallengerTurn({
        promptPath,
        agentRole: role,
        framing: framing.full,
        topologyPrompt: renderTopology({
          centralClaim: framing.centralClaim,
          subClaimTextByIndex,
          hingeIndices,
          layerByIndex,
        }),
        targetMenuPrompt,
        voiceMenuPrompt,
        cqCatalogPrompt,
        existingCqStatePrompt,
        schemaOpts: {
          knownArgumentIds: new Set(targetIds),
          ownArgumentIds: ownArgIds,
          validSchemeKeys,
          cqsBySchemeKey,
          maxRaises,
        },
        cfg: opts.cfg,
        llm: opts.llm,
        logger,
      });

      if (isChallengerRefusal(turn.response)) {
        const refusalPath = path.join(
          opts.cfg.runtimeDir,
          REFUSALS_DIR,
          `phase-7-${role}-refusal.json`,
        );
        mkdirSync(path.dirname(refusalPath), { recursive: true });
        writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
        logger.event("phase_complete", {
          phase: 7,
          round,
          agent: role,
          outcome: "refused",
          reason: turn.response.error,
        });
        challengerRecords.push({
          agentRole: role,
          outcome: "refused",
          attempts: turn.attempts,
          tokenUsage: turn.usage,
          refusal: turn.response,
          refusalPath,
          menuSizes,
          artifacts: baseArtifacts,
        });
      } else {
        mkdirSync(path.dirname(planPath), { recursive: true });
        writeFileSync(planPath, JSON.stringify(turn.response, null, 2));
        logger.event("phase_complete", {
          phase: 7,
          round,
          agent: role,
          outcome: "ok",
          raiseCount: turn.response.raises.length,
        });
        challengerRecords.push({
          agentRole: role,
          outcome: "ok",
          attempts: turn.attempts,
          tokenUsage: turn.usage,
          plan: turn.response,
          menuSizes,
          artifacts: { ...baseArtifacts, planPath },
        });
      }

      // Be a good citizen — log unique authorId so finalize can spot
      // misconfigured agents.json that would credit the wrong author.
      logger.event("phase_progress", {
        phase: 7,
        agent: role,
        agentUserId: agent.userId,
      });
    } catch (err) {
      if (err instanceof ChallengerValidationError) {
        logger.event("phase_complete", {
          phase: 7,
          round,
          agent: role,
          outcome: "validation-error",
          attempts: err.attempts,
        });
        challengerRecords.push({
          agentRole: role,
          outcome: "validation-error",
          attempts: err.attempts,
          validationError: { message: err.message, rawResponsesCount: err.rawResponses.length },
          menuSizes,
          artifacts: baseArtifacts,
        });
      } else {
        throw err;
      }
    }
  }

  // 12. Persist partial.
  const partial: Phase7PartialFile = {
    phase: 7,
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    evidenceStackId: ec.stack.id,
    readoutContentHash: readout.contentHash ?? null,
    maxRaisesPerAgent: maxRaises,
    challengers: challengerRecords,
    artifacts: { partialPath },
  };
  mkdirSync(path.dirname(partialPath), { recursive: true });
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));

  phaseLogger.event("phase_partial_written", {
    phase: 7,
    partialPath,
    okCount: challengerRecords.filter((c) => c.outcome === "ok").length,
    refusedCount: challengerRecords.filter((c) => c.outcome === "refused").length,
    validationErrorCount: challengerRecords.filter((c) => c.outcome === "validation-error").length,
    totalRaises: challengerRecords.reduce(
      (n, c) => n + (c.plan?.raises.length ?? 0),
      0,
    ),
  });
  return partial;
}

// ─────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────

function loadPhaseComplete<T extends { status?: string; deliberationId?: string }>(
  runtimeDir: string,
  deliberationId: string,
  phase: 1 | 2 | 3 | 4,
): T {
  const p = path.join(runtimeDir, `PHASE_${phase}_COMPLETE.json`);
  if (!existsSync(p)) {
    throw new Error(`Phase 7 prereq missing: ${p}. Run phase ${phase} + finalize.`);
  }
  const f = JSON.parse(readFileSync(p, "utf8")) as T;
  if (f.status !== "complete") {
    throw new Error(`Phase 7 prereq invalid: ${p} has status="${f.status}", expected "complete".`);
  }
  if (f.deliberationId && f.deliberationId !== deliberationId) {
    throw new Error(
      `Phase 7 prereq mismatch: ${p} deliberationId="${f.deliberationId}" but expected "${deliberationId}".`,
    );
  }
  return f;
}

function tryLoadPhase6(runtimeDir: string, deliberationId: string): Phase6PartialFile | null {
  const completePath = path.join(runtimeDir, "PHASE_6_COMPLETE.json");
  const partialPath = path.join(runtimeDir, "PHASE_6_PARTIAL.json");
  for (const p of [completePath, partialPath]) {
    if (!existsSync(p)) continue;
    try {
      const f = JSON.parse(readFileSync(p, "utf8")) as Phase6PartialFile;
      if (f.deliberationId === deliberationId && f.architect?.outcome === "ok") {
        return f;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Load the full CQ catalog (cqKey + cqText + targetScope hint) for the
 * experiment scheme set. Mirrors `loadCqCatalog` in phase-3-attacks.ts
 * but returns the full per-CQ payload so the prompt can render
 * `cqKey | scope | text`.
 */
async function loadFullCqCatalog(
  schemeKeys: ReadonlyArray<string>,
  schemeIdByKey: ReadonlyMap<string, string>,
): Promise<Record<string, Array<{ cqKey: string; cqText: string; targetScope: string | null }>>> {
  const out: Record<string, Array<{ cqKey: string; cqText: string; targetScope: string | null }>> =
    {};
  const schemeIds: string[] = [];
  const idToKey = new Map<string, string>();
  for (const k of schemeKeys) {
    const id = schemeIdByKey.get(k);
    if (!id) continue;
    schemeIds.push(id);
    idToKey.set(id, k);
    out[k] = [];
  }
  if (schemeIds.length === 0) return out;
  const rows = await prisma.criticalQuestion.findMany({
    where: { schemeId: { in: schemeIds }, cqKey: { not: null } },
    select: { schemeId: true, cqKey: true, text: true, targetScope: true },
  });
  for (const row of rows) {
    if (!row.schemeId || !row.cqKey) continue;
    const key = idToKey.get(row.schemeId);
    if (!key) continue;
    out[key].push({
      cqKey: row.cqKey,
      cqText: row.text ?? "",
      targetScope: (row.targetScope as string | null) ?? null,
    });
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.cqKey.localeCompare(b.cqKey));
  }
  return out;
}

/**
 * Per-target set of cqKeys that are already in CQStatus (any status —
 * raised, open, answered, contested). The challenger should not
 * re-raise these.
 */
async function loadExistingCqState(targetArgIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (targetArgIds.length === 0) return out;
  const rows = await prisma.cQStatus.findMany({
    where: { argumentId: { in: targetArgIds } },
    select: { argumentId: true, cqKey: true },
  });
  for (const r of rows) {
    if (!r.cqKey) continue;
    const set = out.get(r.argumentId) ?? new Set<string>();
    set.add(r.cqKey);
    out.set(r.argumentId, set);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Argument-meta + ordering helpers
// ─────────────────────────────────────────────────────────────────

interface ArgumentMeta {
  argumentId: string;
  agentRole: ChallengerRole;
  /** Where the argument was minted. */
  origin: "P2" | "P3" | "P3-methodologist" | "P4-defense" | "P4-narrow";
  /** Primary scheme key (P2 origin) or null otherwise — used so the
   *  challenger can look up the correct cq list for the target. */
  schemeKey: string | null;
  /** Conclusion claim text snippet (≤200 chars) for the menu render. */
  conclusionText: string;
}

function buildArgumentMeta(
  phase2: Phase2CompleteFile,
  phase3: Phase3CompleteFile,
  phase4: Phase4CompleteFile,
): Map<string, ArgumentMeta> {
  const m = new Map<string, ArgumentMeta>();

  const addP2 = (a: Phase2CompleteArgument, role: ChallengerRole): void => {
    m.set(a.argumentId, {
      argumentId: a.argumentId,
      agentRole: role,
      origin: "P2",
      schemeKey: isAllowedSchemeKey(a.schemeKey) ? a.schemeKey : null,
      conclusionText: a.premiseTexts[0]?.slice(0, 200) ?? "",
    });
  };
  for (const a of phase2.advocates.a.arguments) addP2(a, "advocate-a");
  for (const a of phase2.advocates.b.arguments) addP2(a, "advocate-b");

  const addP3 = (
    r: Phase3CompleteRebuttal,
    role: ChallengerRole,
    origin: ArgumentMeta["origin"],
  ): void => {
    m.set(r.rebuttalArgumentId, {
      argumentId: r.rebuttalArgumentId,
      agentRole: role,
      origin,
      schemeKey: isAllowedSchemeKey(r.schemeKey) ? r.schemeKey : null,
      conclusionText: r.conclusionText?.slice(0, 200) ?? "",
    });
  };
  for (const r of phase3.advocates.a.rebuttals) addP3(r, "advocate-a", "P3");
  for (const r of phase3.advocates.b.rebuttals) addP3(r, "advocate-b", "P3");
  if (phase3.methodologist) {
    for (const r of phase3.methodologist.rebuttals) {
      addP3(r as unknown as Phase3CompleteRebuttal, "methodologist", "P3-methodologist");
    }
  }

  const addP4 = (
    role: ChallengerRole,
    responses: Phase4CompleteFile["advocates"]["a"]["responses"],
  ): void => {
    for (const r of responses) {
      if (r.defenseArgumentId && r.defense) {
        m.set(r.defenseArgumentId, {
          argumentId: r.defenseArgumentId,
          agentRole: role,
          origin: "P4-defense",
          schemeKey: isAllowedSchemeKey(r.defense.schemeKey) ? r.defense.schemeKey : null,
          conclusionText: r.defense.conclusionText?.slice(0, 200) ?? "",
        });
      }
      if (r.narrowVariantArgumentId) {
        m.set(r.narrowVariantArgumentId, {
          argumentId: r.narrowVariantArgumentId,
          agentRole: role,
          origin: "P4-narrow",
          schemeKey: null,
          conclusionText: r.narrowedConclusionText?.slice(0, 200) ?? "",
        });
      }
    }
  };
  addP4("advocate-a", phase4.advocates.a.responses);
  addP4("advocate-b", phase4.advocates.b.responses);

  return m;
}

function collectChainArgIds(phase6: Phase6PartialFile | null): Set<string> {
  const out = new Set<string>();
  if (!phase6 || !phase6.architect.plan) return out;
  for (const c of phase6.architect.plan.chains) {
    for (const n of c.nodes) {
      out.add(n.argumentId);
    }
  }
  return out;
}

function buildOrderedTargetIds(
  readout: SyntheticReadout,
  chainNodeArgIds: Set<string>,
  argMeta: Map<string, ArgumentMeta>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  // 1. loadBearingnessRanking (degree + foundation) — primary signal.
  for (const t of readout.topArguments) {
    if (argMeta.has(t.id) && !seen.has(t.id)) {
      seen.add(t.id);
      ordered.push(t.id);
    }
  }
  // 2. contestednessRanking (unanswered-attack-count) — complementary.
  for (const t of readout.mostContested) {
    if (argMeta.has(t.id) && !seen.has(t.id)) {
      seen.add(t.id);
      ordered.push(t.id);
    }
  }
  // 3. chain-architect node set — explicit load-bearing votes.
  for (const id of chainNodeArgIds) {
    if (argMeta.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

// ─────────────────────────────────────────────────────────────────
// Prompt-block renderers
// ─────────────────────────────────────────────────────────────────

function renderTargetMenu(
  targetIds: string[],
  argMeta: Map<string, ArgumentMeta>,
  readout: SyntheticReadout,
  chainNodeArgIds: Set<string>,
): string {
  const topRank = new Map<string, number>();
  for (const t of readout.topArguments) topRank.set(t.id, t.rankIndex);
  const contestedRank = new Map<string, { rank: number; unanswered: number }>();
  for (const t of readout.mostContested) {
    contestedRank.set(t.id, { rank: t.rankIndex, unanswered: t.unansweredAttackCount });
  }
  const lines: string[] = [];
  for (const id of targetIds) {
    const m = argMeta.get(id);
    if (!m) continue;
    const lb = topRank.get(id);
    const ct = contestedRank.get(id);
    const inChain = chainNodeArgIds.has(id);
    const tags: string[] = [];
    tags.push(`owner=${m.agentRole}`);
    tags.push(`origin=${m.origin}`);
    if (m.schemeKey) tags.push(`scheme=${m.schemeKey}`);
    if (lb !== undefined) tags.push(`loadBearingRank=${lb}`);
    if (ct) tags.push(`contestedRank=${ct.rank} unansweredAttacks=${ct.unanswered}`);
    if (inChain) tags.push("inChain=true");
    lines.push(`- argId=${id}  ${tags.join("  ")}`);
    if (m.conclusionText) lines.push(`    "${m.conclusionText.replace(/\s+/g, " ")}"`);
  }
  if (lines.length === 0) return "(no eligible targets)";
  return lines.join("\n");
}

function renderVoiceMenu(
  ownArgIds: Set<string>,
  argMeta: Map<string, ArgumentMeta>,
): string {
  const lines: string[] = [];
  for (const id of ownArgIds) {
    const m = argMeta.get(id);
    if (!m) continue;
    const tags: string[] = [];
    tags.push(`origin=${m.origin}`);
    if (m.schemeKey) tags.push(`scheme=${m.schemeKey}`);
    lines.push(`- argId=${id}  ${tags.join("  ")}`);
    if (m.conclusionText) lines.push(`    "${m.conclusionText.replace(/\s+/g, " ")}"`);
  }
  if (lines.length === 0) return "(no own arguments)";
  return lines.join("\n");
}

function renderCqCatalog(
  cqCatalog: Record<string, Array<{ cqKey: string; cqText: string; targetScope: string | null }>>,
): string {
  const lines: string[] = [];
  for (const schemeKey of Object.keys(cqCatalog).sort()) {
    const cqs = cqCatalog[schemeKey];
    if (cqs.length === 0) continue;
    lines.push(`### ${schemeKey}`);
    for (const c of cqs) {
      const scopeTag = c.targetScope ? `[${c.targetScope}]` : "[scope=?]";
      lines.push(
        `- cqKey=${c.cqKey} ${scopeTag}: ${c.cqText.replace(/\s+/g, " ").slice(0, 240)}`,
      );
    }
    lines.push("");
  }
  if (lines.length === 0) return "(empty catalog)";
  return lines.join("\n");
}

function renderExistingCqState(
  targetIds: string[],
  existingCqStateByArg: Map<string, Set<string>>,
): string {
  const lines: string[] = [];
  for (const id of targetIds) {
    const set = existingCqStateByArg.get(id);
    if (!set || set.size === 0) continue;
    lines.push(`- argId=${id}  alreadyRaised=[${[...set].sort().join(", ")}]`);
  }
  if (lines.length === 0) return "(no existing CQs on these targets)";
  return lines.join("\n");
}
