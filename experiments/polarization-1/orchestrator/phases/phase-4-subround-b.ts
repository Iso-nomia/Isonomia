/**
 * phases/phase-4-subround-b.ts
 *
 * Iter-3 multi-round Phase 4 — sub-round-b driver. Symmetric to
 * `phase-3-round2.ts`. Gated behind `cfg.iter3MultiRound` and invoked
 * from `phase-4-defenses.ts#runPhase` AFTER sub-round-a has produced
 * outcome="ok" for both advocates.
 *
 * Sub-round-b semantics (per locked design memo):
 *   - Actors: advocate-a, advocate-b (no methodologist defenses).
 *   - Each defender now responds to ROUND-2 attacks targeting either:
 *       (a) their Phase-2 own arguments (NEW direct round-2 attacks), OR
 *       (b) their own ROUND-1 rebuttals (round-2 attacks-on-attacks).
 *   - Defense schema is unchanged; the LLM emits `subRound: "b"`.
 *
 * Outputs:
 *   - DB: argument + edge rows for sub-round-b defenses (translator
 *     skips the narrow-variant orphan-cleanup branch when
 *     `subRound: "b"` is passed so sub-round-a narrows are preserved).
 *   - File: `PHASE_4_SUBROUNDB_PARTIAL.json` next to PHASE_4_PARTIAL.json
 *     (separate file — finalize-merge into PHASE_4_COMPLETE is a
 *     follow-up task; tracker reads moves from DB regardless).
 *
 * Failure mode: if any actor refuses or validation-errors, sub-round-b
 * partial still records the failure record; sub-round-a results are
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
  runDefenseTurn,
  isDefenseRefusal,
  DefenseValidationError,
  type DefenseAgentRole,
} from "../agents/defense";
import type { DefenseRefusal } from "../agents/defense-schema";

import {
  translateDefenseOutput,
  type OwnArgumentBinding,
  type OpposingRebuttalBinding,
  type OpposingCqRaiseBinding,
} from "../translators/defense-mint";

import type {
  RebuttalRunRecord,
  MethodologistRunRecord,
} from "./phase-3-attacks";
import type { Phase3Round2PartialFile } from "./phase-3-round2";

import type {
  Phase3CompleteFile,
  Phase3CompleteAdvocate,
  Phase3CompleteMethodologist,
  Phase3CompleteRebuttal,
  Phase3CompleteMethodologistRebuttal,
} from "../finalize/phase-3-finalize";

import type { DefenseRunRecord } from "./phase-4-defenses";

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const PHASE_4_LLM_DIR = "llm";
const PHASE_4_SUBROUND_B_PARTIAL_FILE = "PHASE_4_SUBROUNDB_PARTIAL.json";
const PHASE_3_ROUND2_PARTIAL_FILE = "PHASE_3_ROUND2_PARTIAL.json";
const REFUSALS_DIR = "refusals";

// Round numbering inside the Phase-4 logger:
//   1 = sub-round-a advocate-a
//   2 = sub-round-a advocate-b
//   3 = sub-round-b advocate-a
//   4 = sub-round-b advocate-b
const PHASE_4_SUB_ROUND_B_BASE = 3 as const;

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RunPhase4SubRoundBOpts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  evidenceCorpusPrompt: string;
  allowedCitationTokens: Set<string>;
  tokenToSourceId: Record<string, string>;
  schemeCatalog: Array<{ id: string; key: string }>;
  registry: ClaimRegistry;
  /** Sub-round-a defense results (both advocates must be ok before calling). */
  subRoundA: { a: DefenseRunRecord; b: DefenseRunRecord };
  /** Phase-3 finalized data (used to extract own round-1 rebuttals). */
  phase3: Phase3CompleteFile;
  /** Pre-built Phase-2 ownArguments per advocate (extended in this driver with own round-1 rebuttals). */
  ownArgsByRole: {
    "advocate-a": ReadonlyMap<string, OwnArgumentBinding>;
    "advocate-b": ReadonlyMap<string, OwnArgumentBinding>;
  };
  /** Side index of every Phase-2 argument (used to route round-2 attacks). */
  phase2ArgSideById: ReadonlyMap<string, "A" | "B">;
  /** Pre-rendered YOUR_PHASE_2 prompts per defender (reused from sub-round-a). */
  yourPhase2PromptByRole: { "advocate-a": string; "advocate-b": string };
  /** scheme-key → scheme-id (resolved schemeId for OwnArgumentBinding extension). */
  schemeIdByKey: ReadonlyMap<string, string>;
}

export interface Phase4SubRoundBPartialFile {
  phase: 4;
  subPhase: "sub-round-b";
  status: "partial";
  generatedAt: string;
  deliberationId: string;
  modelTier: string;
  advocates: {
    a?: DefenseRunRecord;
    b?: DefenseRunRecord;
  };
  totals: {
    defensesCreated: number;
    edgesCreated: number;
    narrowsCreated: number;
    cqStatusesUpserted: number;
    inputTokens: number;
    outputTokens: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// Round-2 attack collection (across both advocates + methodologist)
// ─────────────────────────────────────────────────────────────────

/** A round-2 rebuttal viewed as a sub-round-b attack. */
interface Round2AttackRef {
  /** DB id of the round-2 rebuttal Argument (used as `targetAttackId` in defense schema). */
  rebuttalArgumentId: string;
  /** What this round-2 attack targets. */
  targetArgumentId: string;
  /** Phase-2 own arg vs round-1 rebuttal (from round-2 LLM output). */
  targetKind: "phase2-arg" | "round1-rebuttal";
  /** Author role of the round-2 attack (the OPPONENT of the defender). */
  authorRole: "advocate-a" | "advocate-b" | "methodologist";
  /** Side that needs to defend in sub-round-b ("A" or "B"). */
  defendingSide: "A" | "B";
  attackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  rebuttalPremiseCount: number;
  rebuttalPremiseClaimIds: readonly string[];
  rebuttalTargetPremiseIndex: number | null;
  rebuttalConclusionClaimId: string;
  conclusionText: string;
  premiseTexts: readonly string[];
  premiseCitationTokens: ReadonlyArray<string | null>;
  warrant: string | null;
  schemeKey: string;
  cqKey: string | null;
}

/** A round-2 CQ raise viewed as a sub-round-b attack. */
interface Round2CqRaiseRef {
  /** Synthesized stable id (no first-class CQResponse id is exposed). */
  cqResponseId: string;
  targetArgumentId: string;
  targetKind: "phase2-arg" | "round1-rebuttal";
  authorRole: "advocate-a" | "advocate-b" | "methodologist";
  defendingSide: "A" | "B";
  cqKey: string;
  rationale: string;
}

interface OwnRebuttalRef {
  /** This bot's round-1 rebuttal Argument id (treated as an "own argument" in sub-round-b). */
  rebuttalArgumentId: string;
  schemeKey: string;
  schemeId: string;
  conclusionClaimId: string;
  conclusionText: string;
  premiseClaimIds: readonly string[];
  premiseTexts: readonly string[];
  /** The Phase-2 argId this rebuttal originally attacked (carries side info). */
  targetPhase2ArgId: string;
  authorRole: "advocate-a" | "advocate-b" | "methodologist";
}

function collectOwnRebuttals(
  phase3: Phase3CompleteFile,
  schemeIdByKey: ReadonlyMap<string, string>,
): OwnRebuttalRef[] {
  const out: OwnRebuttalRef[] = [];

  function pushAdvocate(adv: Phase3CompleteAdvocate, authorRole: "advocate-a" | "advocate-b"): void {
    for (const r of adv.rebuttals) {
      const targetKind = (r as any).targetKind ?? "phase2-arg";
      if (targetKind !== "phase2-arg") continue;
      const round = (r as any).round ?? "1";
      if (round !== "1") continue;
      out.push({
        rebuttalArgumentId: r.rebuttalArgumentId,
        schemeKey: r.schemeKey,
        schemeId: schemeIdByKey.get(r.schemeKey) ?? "",
        conclusionClaimId: r.conclusionClaimId,
        conclusionText: r.conclusionText,
        premiseClaimIds: r.premiseClaimIds,
        premiseTexts: r.premiseTexts,
        targetPhase2ArgId: r.targetArgumentId,
        authorRole,
      });
    }
  }

  pushAdvocate(phase3.advocates.a, "advocate-a");
  pushAdvocate(phase3.advocates.b, "advocate-b");

  const meth = phase3.methodologist;
  if (meth) {
    for (const r of meth.rebuttals) {
      const targetKind = (r as any).targetKind ?? "phase2-arg";
      if (targetKind !== "phase2-arg") continue;
      const round = (r as any).round ?? "1";
      if (round !== "1") continue;
      out.push({
        rebuttalArgumentId: r.rebuttalArgumentId,
        schemeKey: r.schemeKey,
        schemeId: schemeIdByKey.get(r.schemeKey) ?? "",
        conclusionClaimId: r.conclusionClaimId,
        conclusionText: r.conclusionText,
        premiseClaimIds: r.premiseClaimIds,
        premiseTexts: r.premiseTexts,
        targetPhase2ArgId: r.targetArgumentId,
        authorRole: "methodologist",
      });
    }
  }

  return out;
}

function collectRound2Attacks(
  round2Actors: Phase3Round2PartialFile["actors"],
  phase2ArgSideById: ReadonlyMap<string, "A" | "B">,
  ownRebuttalsById: ReadonlyMap<string, OwnRebuttalRef>,
): { rebuttals: Round2AttackRef[]; cqRaises: Round2CqRaiseRef[] } {
  const rebuttals: Round2AttackRef[] = [];
  const cqRaises: Round2CqRaiseRef[] = [];

  function defendingSideFor(
    targetArgumentId: string,
    targetKind: "phase2-arg" | "round1-rebuttal",
  ): "A" | "B" | null {
    if (targetKind === "phase2-arg") {
      return phase2ArgSideById.get(targetArgumentId) ?? null;
    }
    // round1-rebuttal: defender is the actor who AUTHORED the
    // round-1 rebuttal that's now under attack.
    const own = ownRebuttalsById.get(targetArgumentId);
    if (!own) return null;
    if (own.authorRole === "advocate-a") return "A";
    if (own.authorRole === "advocate-b") return "B";
    // methodologist: round-2 attacks targeting the methodologist's
    // round-1 rebuttals don't get defended by an advocate. Skip.
    return null;
  }

  function collect(
    rec: RebuttalRunRecord | MethodologistRunRecord | undefined,
    authorRole: "advocate-a" | "advocate-b" | "methodologist",
  ): void {
    if (!rec || rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) return;
    const inputs = rec.llmOutput.rebuttals;
    for (const m of rec.mintResult.rebuttals) {
      const orig = inputs[m.inputIndex];
      if (!orig) continue;
      const round = (orig as any).round ?? "1";
      if (round !== "2") continue;
      const targetKind: "phase2-arg" | "round1-rebuttal" =
        (orig as any).targetKind ?? "phase2-arg";
      const side = defendingSideFor(m.targetArgumentId, targetKind);
      if (!side) continue;
      // Reconstruct minimal binding fields. premiseCitationTokens are
      // present on the LLM output; map them to the same length as premises.
      const premiseCitationTokens: Array<string | null> = orig.premises.map(
        (p: any) => (p.citationToken ?? null) as string | null,
      );
      rebuttals.push({
        rebuttalArgumentId: m.rebuttalArgumentId,
        targetArgumentId: m.targetArgumentId,
        targetKind,
        authorRole,
        defendingSide: side,
        attackType: m.attackType,
        rebuttalPremiseCount: m.premiseClaimIds.length,
        rebuttalPremiseClaimIds: m.premiseClaimIds,
        rebuttalTargetPremiseIndex: m.targetPremiseIndex,
        rebuttalConclusionClaimId: m.conclusionClaimId,
        conclusionText: orig.conclusionText,
        premiseTexts: orig.premises.map((p: any) => p.text),
        premiseCitationTokens,
        warrant: orig.warrant ?? null,
        schemeKey: m.schemeKey,
        cqKey: m.cqKey ?? null,
      });
    }
    // CQ raises in round 2.
    const cqs = (rec.llmOutput as any).cqResponses ?? [];
    for (let i = 0; i < cqs.length; i++) {
      const c = cqs[i];
      if (c.action !== "raise") continue;
      // round-2 CQ raise must mirror the rebuttal `targetKind`.
      const targetKind: "phase2-arg" | "round1-rebuttal" = c.targetKind ?? "phase2-arg";
      const side = defendingSideFor(c.targetArgumentId, targetKind);
      if (!side) continue;
      // De-dup against rebuttal cqKey embedding handled by attack-mint;
      // we surface raw raises here and rely on schema validation downstream.
      const cqResponseId = `cqraise-r2-${authorRole}:${c.targetArgumentId}:${c.cqKey}`;
      cqRaises.push({
        cqResponseId,
        targetArgumentId: c.targetArgumentId,
        targetKind,
        authorRole,
        defendingSide: side,
        cqKey: c.cqKey,
        rationale: c.rationale ?? "",
      });
    }
  }

  collect(round2Actors.a, "advocate-a");
  collect(round2Actors.b, "advocate-b");
  collect(round2Actors.methodologist, "methodologist");
  return { rebuttals, cqRaises };
}

// ─────────────────────────────────────────────────────────────────
// Binding builders
// ─────────────────────────────────────────────────────────────────

function buildExtendedOwnArgs(
  basePhase2: ReadonlyMap<string, OwnArgumentBinding>,
  defenderRole: "advocate-a" | "advocate-b",
  ownRebuttals: readonly OwnRebuttalRef[],
): Map<string, OwnArgumentBinding> {
  const out = new Map<string, OwnArgumentBinding>(basePhase2);
  for (const r of ownRebuttals) {
    if (r.authorRole !== defenderRole) continue;
    out.set(r.rebuttalArgumentId, {
      argumentId: r.rebuttalArgumentId,
      schemeKey: r.schemeKey,
      schemeId: r.schemeId,
      conclusionClaimId: r.conclusionClaimId,
      conclusionText: r.conclusionText,
      premiseClaimIds: r.premiseClaimIds,
      premiseTexts: r.premiseTexts,
    });
  }
  return out;
}

function buildOpposingRebuttalBindingsFromRound2(
  side: "A" | "B",
  rebuttals: readonly Round2AttackRef[],
  ownArgs: ReadonlyMap<string, OwnArgumentBinding>,
): Map<string, OpposingRebuttalBinding> {
  const out = new Map<string, OpposingRebuttalBinding>();
  for (const r of rebuttals) {
    if (r.defendingSide !== side) continue;
    if (!ownArgs.has(r.targetArgumentId)) continue;
    out.set(r.rebuttalArgumentId, {
      rebuttalArgumentId: r.rebuttalArgumentId,
      targetArgumentId: r.targetArgumentId,
      rebuttalPremiseCount: r.rebuttalPremiseCount,
      rebuttalPremiseClaimIds: r.rebuttalPremiseClaimIds,
      rebuttalAttackType: r.attackType,
      rebuttalTargetPremiseIndex: r.rebuttalTargetPremiseIndex,
      rebuttalConclusionClaimId: r.rebuttalConclusionClaimId,
      cqKey: r.cqKey,
    });
  }
  return out;
}

function buildOpposingCqRaiseBindingsFromRound2(
  side: "A" | "B",
  cqRaises: readonly Round2CqRaiseRef[],
  ownArgs: ReadonlyMap<string, OwnArgumentBinding>,
): Map<string, OpposingCqRaiseBinding> {
  const out = new Map<string, OpposingCqRaiseBinding>();
  for (const c of cqRaises) {
    if (c.defendingSide !== side) continue;
    if (!ownArgs.has(c.targetArgumentId)) continue;
    out.set(c.cqResponseId, {
      cqResponseId: c.cqResponseId,
      targetArgumentId: c.targetArgumentId,
      cqKey: c.cqKey,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Prompt block renderer (## ROUND_2_ATTACKS_AGAINST_YOU)
// ─────────────────────────────────────────────────────────────────

function renderRound2AttacksForDefender(
  side: "A" | "B",
  rebuttals: readonly Round2AttackRef[],
  cqRaises: readonly Round2CqRaiseRef[],
  ownRebuttalsById: ReadonlyMap<string, OwnRebuttalRef>,
): string {
  const lines: string[] = [];
  lines.push(`## ROUND_2_ATTACKS_AGAINST_YOU`);
  lines.push(``);
  lines.push(
    `Round-2 attacks below target either your Phase-2 own arguments OR your own ` +
      `round-1 rebuttals. Treat the listed \`targets:\` ARG id as the entity you ` +
      `must defend (or concede / narrow) in your sub-round-b response.`,
  );
  lines.push(``);

  let any = false;
  for (const r of rebuttals) {
    if (r.defendingSide !== side) continue;
    any = true;
    const targetLabel =
      r.targetKind === "round1-rebuttal" ? "ROUND_1_REBUTTAL" : "PHASE_2_ARG";
    lines.push(
      `ATTACK ${r.rebuttalArgumentId}  attackType=${r.attackType}  from=${r.authorRole}  round=2`,
    );
    lines.push(
      `  targets: ${targetLabel} ${r.targetArgumentId}  premise=${r.rebuttalTargetPremiseIndex ?? "null"}  cqKey=${r.cqKey ?? "null"}`,
    );
    if (r.targetKind === "round1-rebuttal") {
      const own = ownRebuttalsById.get(r.targetArgumentId);
      if (own) {
        lines.push(
          `  your round-1 rebuttal originally attacked your own Phase-2 ARG ${own.targetPhase2ArgId}`,
        );
      }
    }
    lines.push(`  concludes: "${r.conclusionText}"`);
    lines.push(`  premises (0-indexed):`);
    for (let i = 0; i < r.premiseTexts.length; i++) {
      const tok = r.premiseCitationTokens[i] ?? null;
      lines.push(`    [${i}] "${r.premiseTexts[i]}"  cite=${tok ?? "null"}`);
    }
    lines.push(`  warrant: ${r.warrant ? `"${r.warrant}"` : "null"}`);
    lines.push(`  scheme: ${r.schemeKey}`);
    lines.push(``);
  }
  for (const c of cqRaises) {
    if (c.defendingSide !== side) continue;
    any = true;
    const targetLabel =
      c.targetKind === "round1-rebuttal" ? "ROUND_1_REBUTTAL" : "PHASE_2_ARG";
    lines.push(`CQ_RAISE ${c.cqResponseId}  action=raise  from=${c.authorRole}  round=2`);
    lines.push(`  targets: ${targetLabel} ${c.targetArgumentId}  cqKey=${c.cqKey}`);
    lines.push(`  rationale: "${c.rationale}"`);
    lines.push(``);
  }
  if (!any) {
    lines.push(`(No round-2 attacks were filed against your arguments or rebuttals.)`);
  }
  return lines.join("\n");
}

function renderSubRoundADefensesForDefender(rec: DefenseRunRecord): string {
  if (rec.outcome !== "ok" || !rec.llmOutput) {
    return `## YOUR_SUB_ROUND_A_DEFENSES\n\n(No sub-round-a defense output to summarize.)\n`;
  }
  const lines: string[] = [];
  lines.push(`## YOUR_SUB_ROUND_A_DEFENSES`);
  lines.push(``);
  lines.push(
    `Below is your own sub-round-a output (responses + cqAnswers). Use it as ` +
      `context — do NOT re-emit these responses; sub-round-b only handles ` +
      `the round-2 attacks listed in ROUND_2_ATTACKS_AGAINST_YOU.`,
  );
  lines.push(``);
  for (let i = 0; i < rec.llmOutput.responses.length; i++) {
    const r: any = rec.llmOutput.responses[i];
    lines.push(`RESPONSE [${i}] kind=${r.kind}  targetAttackId=${r.targetAttackId}`);
    if (r.defense) {
      lines.push(
        `  defense: attackType=${r.defense.attackType}  scheme=${r.defense.schemeKey}  premises=${r.defense.premises.length}`,
      );
      lines.push(`  defense.concludes: "${r.defense.conclusionText}"`);
    }
    if (r.kind === "narrow" && r.narrowedConclusionText) {
      lines.push(`  narrowedConclusionText: "${r.narrowedConclusionText}"`);
    }
    if (r.rationale) lines.push(`  rationale: "${r.rationale}"`);
    lines.push(``);
  }
  for (let i = 0; i < rec.llmOutput.cqAnswers.length; i++) {
    const c: any = rec.llmOutput.cqAnswers[i];
    lines.push(`CQ_ANSWER [${i}] kind=${c.kind}  targetCqRaiseId=${c.targetCqRaiseId}`);
    if (c.rationale) lines.push(`  rationale: "${c.rationale}"`);
    lines.push(``);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Per-defender runner
// ─────────────────────────────────────────────────────────────────

interface RunSubRoundBDefenderOpts {
  role: DefenseAgentRole;
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  deliberationId: string;
  framing: string;
  yourPhase2ArgumentsPrompt: string;
  /** Empty here — sub-round-b folds opponent attacks into appendedUserBlock. */
  opponentAttacksPrompt: string;
  evidenceCorpusPrompt: string;
  ownArguments: ReadonlyMap<string, OwnArgumentBinding>;
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalBinding>;
  opposingCqRaises: ReadonlyMap<string, OpposingCqRaiseBinding>;
  tokenToSourceId: Record<string, string>;
  allowedCitationTokens: Set<string>;
  registry: ClaimRegistry;
  schemeCatalog: Array<{ id: string; key: string }>;
  appendedSystemPrompt: string;
  appendedUserBlock: string;
}

async function runSubRoundBDefender(
  opts: RunSubRoundBDefenderOpts,
): Promise<DefenseRunRecord> {
  const round =
    opts.role === "advocate-a"
      ? PHASE_4_SUB_ROUND_B_BASE
      : PHASE_4_SUB_ROUND_B_BASE + 1;
  const logger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 4,
    round,
    agentRole: opts.role,
  });
  const promptRel =
    opts.role === "advocate-a" ? "prompts/6-defense-a.md" : "prompts/7-defense-b.md";
  const promptPath = path.join(opts.cfg.experimentRoot, promptRel);
  const llmDir = path.join(opts.cfg.runtimeDir, PHASE_4_LLM_DIR);
  const llmOutputPath = path.join(llmDir, `phase-4-subroundb-${opts.role}-output.json`);
  const roundLogPath = path.join(
    opts.cfg.runtimeDir,
    "logs",
    `round-4-${round}-${opts.role}.jsonl`,
  );
  const baseArtifacts = { promptPath, roundLogPath };

  let turn;
  try {
    turn = await runDefenseTurn({
      role: opts.role,
      promptPath,
      framing: opts.framing,
      yourPhase2ArgumentsPrompt: opts.yourPhase2ArgumentsPrompt,
      opponentAttacksPrompt: opts.opponentAttacksPrompt,
      methodologistAttacksPrompt: "",
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      appendedSystemPrompt: opts.appendedSystemPrompt,
      appendedUserBlock: opts.appendedUserBlock,
      schemaOpts: {
        opposingRebuttals: new Map(
          Array.from(opts.opposingRebuttals.entries()).map(([id, b]) => [
            id,
            {
              rebuttalArgumentId: b.rebuttalArgumentId,
              targetArgumentId: b.targetArgumentId,
              rebuttalPremiseCount: b.rebuttalPremiseCount,
              rebuttalAttackType: b.rebuttalAttackType,
              rebuttalTargetPremiseIndex: b.rebuttalTargetPremiseIndex,
              cqKey: b.cqKey,
            },
          ]),
        ),
        opposingCqRaises: new Map(
          Array.from(opts.opposingCqRaises.entries()).map(([id, b]) => [
            id,
            {
              cqResponseId: b.cqResponseId,
              targetArgumentId: b.targetArgumentId,
              cqKey: b.cqKey,
            },
          ]),
        ),
        allowedCitationTokens: opts.allowedCitationTokens,
      },
      cfg: opts.cfg,
      llm: opts.llm,
      logger,
    });
  } catch (err) {
    if (err instanceof DefenseValidationError) {
      logger.event("phase_complete", {
        phase: 4,
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

  if (isDefenseRefusal(turn.response)) {
    const refusalPath = path.join(
      opts.cfg.runtimeDir,
      REFUSALS_DIR,
      `phase-4-subroundb-${opts.role}-refusal.json`,
    );
    mkdirSync(path.dirname(refusalPath), { recursive: true });
    writeFileSync(refusalPath, JSON.stringify(turn.response, null, 2));
    logger.event("phase_complete", {
      phase: 4,
      round,
      agent: opts.role,
      outcome: "refused",
      reason: (turn.response as DefenseRefusal).error,
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

  const mintResult = await translateDefenseOutput({
    output: turn.response,
    deliberationId: opts.deliberationId,
    iso: opts.iso,
    logger,
    cfg: opts.cfg,
    tokenToSourceId: opts.tokenToSourceId,
    registry: opts.registry,
    authorRole: opts.role,
    ownArguments: opts.ownArguments,
    opposingRebuttals: opts.opposingRebuttals,
    opposingCqRaises: opts.opposingCqRaises,
    schemeCatalog: opts.schemeCatalog,
    stackId: opts.cfg.deliberation.evidenceStackId ?? null,
    subRound: "b",
  });

  logger.event("phase_complete", {
    phase: 4,
    round,
    agent: opts.role,
    outcome: "ok",
    ...mintResult.totals,
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
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function runPhase4SubRoundB(
  opts: RunPhase4SubRoundBOpts,
): Promise<Phase4SubRoundBPartialFile> {
  const phaseLogger = RoundLogger.forRound({
    runtimeDir: opts.cfg.runtimeDir,
    phase: 4,
    round: PHASE_4_SUB_ROUND_B_BASE - 1,
  });
  phaseLogger.event("round_summary", {
    step: "sub-round-b-start",
    deliberationId: opts.deliberationId,
  });

  const partialPath = path.join(opts.cfg.runtimeDir, PHASE_4_SUBROUND_B_PARTIAL_FILE);

  // Resume support.
  let prior: Phase4SubRoundBPartialFile | null = null;
  if (existsSync(partialPath)) {
    try {
      const raw = JSON.parse(readFileSync(partialPath, "utf8")) as Phase4SubRoundBPartialFile;
      if (raw.deliberationId === opts.deliberationId) prior = raw;
    } catch {
      // ignore corrupt
    }
  }
  const advocates: Phase4SubRoundBPartialFile["advocates"] = {
    a: prior?.advocates.a,
    b: prior?.advocates.b,
  };

  // 1. Load PHASE_3_ROUND2_PARTIAL.json (required — sub-round-b is
  //    only invoked when round-2 ran).
  const round2PartialPath = path.join(opts.cfg.runtimeDir, PHASE_3_ROUND2_PARTIAL_FILE);
  if (!existsSync(round2PartialPath)) {
    phaseLogger.event("round_summary", {
      step: "sub-round-b-skip",
      reason: "PHASE_3_ROUND2_PARTIAL.json not present",
    });
    return writeSubRoundBPartial(partialPath, opts, advocates);
  }
  let round2Partial: Phase3Round2PartialFile;
  try {
    round2Partial = JSON.parse(readFileSync(round2PartialPath, "utf8")) as Phase3Round2PartialFile;
  } catch (err) {
    phaseLogger.event("round_summary", {
      step: "sub-round-b-skip",
      reason: `failed to read PHASE_3_ROUND2_PARTIAL.json: ${(err as Error).message}`,
    });
    return writeSubRoundBPartial(partialPath, opts, advocates);
  }

  // 2. Collect own round-1 rebuttals + round-2 attacks.
  const ownRebuttals = collectOwnRebuttals(opts.phase3, opts.schemeIdByKey);
  const ownRebuttalsById = new Map(ownRebuttals.map((r) => [r.rebuttalArgumentId, r] as const));
  const { rebuttals: round2Rebuttals, cqRaises: round2CqRaises } = collectRound2Attacks(
    round2Partial.actors,
    opts.phase2ArgSideById,
    ownRebuttalsById,
  );
  phaseLogger.event("round_summary", {
    step: "round-2-attacks-collected",
    rebuttalCount: round2Rebuttals.length,
    cqRaiseCount: round2CqRaises.length,
    bySide: {
      A: {
        rebuttals: round2Rebuttals.filter((r) => r.defendingSide === "A").length,
        cqRaises: round2CqRaises.filter((c) => c.defendingSide === "A").length,
      },
      B: {
        rebuttals: round2Rebuttals.filter((r) => r.defendingSide === "B").length,
        cqRaises: round2CqRaises.filter((c) => c.defendingSide === "B").length,
      },
    },
  });

  // 3. Read addendums.
  const addendumA = readAddendum(opts.cfg, "advocate-a");
  const addendumB = readAddendum(opts.cfg, "advocate-b");

  // 4. Run advocate-a then advocate-b.
  const defenders: Array<{
    role: DefenseAgentRole;
    side: "A" | "B";
    addendum: string;
    subRoundARecord: DefenseRunRecord;
  }> = [
    {
      role: "advocate-a",
      side: "A",
      addendum: addendumA,
      subRoundARecord: opts.subRoundA.a,
    },
    {
      role: "advocate-b",
      side: "B",
      addendum: addendumB,
      subRoundARecord: opts.subRoundA.b,
    },
  ];

  for (const def of defenders) {
    const slot = def.role === "advocate-a" ? "a" : "b";
    if (advocates[slot]?.outcome === "ok") continue;
    const ownArgs = buildExtendedOwnArgs(
      opts.ownArgsByRole[def.role],
      def.role,
      ownRebuttals,
    );
    const opposingRebuttals = buildOpposingRebuttalBindingsFromRound2(
      def.side,
      round2Rebuttals,
      ownArgs,
    );
    const opposingCqRaises = buildOpposingCqRaiseBindingsFromRound2(
      def.side,
      round2CqRaises,
      ownArgs,
    );

    if (opposingRebuttals.size === 0 && opposingCqRaises.size === 0) {
      phaseLogger.event("phase_skip_advocate", {
        phase: 4,
        subPhase: "sub-round-b",
        agent: def.role,
        reason: "no round-2 attacks against this defender",
      });
      const empty: DefenseRunRecord = {
        role: def.role,
        outcome: "ok",
        attempts: 0,
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        llmOutput: {
          phase: "4",
          advocateRole: def.side,
          subRound: "b",
          responses: [],
          cqAnswers: [],
        } as any,
        artifacts: {
          promptPath: path.join(
            opts.cfg.experimentRoot,
            def.role === "advocate-a" ? "prompts/6-defense-a.md" : "prompts/7-defense-b.md",
          ),
          roundLogPath: path.join(
            opts.cfg.runtimeDir,
            "logs",
            `round-4-${def.role === "advocate-a" ? PHASE_4_SUB_ROUND_B_BASE : PHASE_4_SUB_ROUND_B_BASE + 1}-${def.role}.jsonl`,
          ),
        },
      };
      advocates[slot] = empty;
      writeSubRoundBPartial(partialPath, opts, advocates);
      continue;
    }

    const userBlock = [
      renderRound2AttacksForDefender(
        def.side,
        round2Rebuttals,
        round2CqRaises,
        ownRebuttalsById,
      ),
      "",
      renderSubRoundADefensesForDefender(def.subRoundARecord),
    ].join("\n");

    const rec = await runSubRoundBDefender({
      role: def.role,
      cfg: opts.cfg,
      iso: opts.iso,
      llm: opts.llm,
      deliberationId: opts.deliberationId,
      framing: opts.framing,
      yourPhase2ArgumentsPrompt: opts.yourPhase2PromptByRole[def.role],
      // Sub-round-b folds all "opponent" inputs into appendedUserBlock,
      // but the schema requires a non-empty block for the existing
      // `## OPPONENT_ATTACKS_AGAINST_YOU` section. Provide a stub
      // pointing the LLM at the sub-round-b block.
      opponentAttacksPrompt:
        "(Sub-round-b: see ## ROUND_2_ATTACKS_AGAINST_YOU below for all attacks to address.)",
      evidenceCorpusPrompt: opts.evidenceCorpusPrompt,
      ownArguments: ownArgs,
      opposingRebuttals,
      opposingCqRaises,
      tokenToSourceId: opts.tokenToSourceId,
      allowedCitationTokens: opts.allowedCitationTokens,
      registry: opts.registry,
      schemeCatalog: opts.schemeCatalog,
      appendedSystemPrompt: def.addendum,
      appendedUserBlock: userBlock,
    });
    advocates[slot] = rec;
    writeSubRoundBPartial(partialPath, opts, advocates);
  }

  const partial = writeSubRoundBPartial(partialPath, opts, advocates);
  phaseLogger.event("round_summary", {
    step: "sub-round-b-complete",
    okCount:
      Number(advocates.a?.outcome === "ok") + Number(advocates.b?.outcome === "ok"),
    totals: partial.totals,
  });
  return partial;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function readAddendum(
  cfg: OrchestratorConfig,
  role: "advocate-a" | "advocate-b",
): string {
  const filename =
    role === "advocate-a"
      ? "6b-defense-a-subroundb-addendum.md"
      : "7b-defense-b-subroundb-addendum.md";
  const p = path.join(cfg.experimentRoot, "prompts", filename);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

function writeSubRoundBPartial(
  partialPath: string,
  opts: { cfg: OrchestratorConfig; deliberationId: string },
  advocates: Phase4SubRoundBPartialFile["advocates"],
): Phase4SubRoundBPartialFile {
  const totals = computeTotals(advocates);
  const partial: Phase4SubRoundBPartialFile = {
    phase: 4,
    subPhase: "sub-round-b",
    status: "partial",
    generatedAt: new Date().toISOString(),
    deliberationId: opts.deliberationId,
    modelTier: opts.cfg.modelTier,
    advocates,
    totals,
  };
  mkdirSync(path.dirname(partialPath), { recursive: true });
  writeFileSync(partialPath, JSON.stringify(partial, null, 2));
  return partial;
}

function computeTotals(
  advocates: Phase4SubRoundBPartialFile["advocates"],
): Phase4SubRoundBPartialFile["totals"] {
  const totals = {
    defensesCreated: 0,
    edgesCreated: 0,
    narrowsCreated: 0,
    cqStatusesUpserted: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  for (const slot of ["a", "b"] as const) {
    const r = advocates[slot];
    if (!r) continue;
    totals.inputTokens += r.tokenUsage.inputTokens;
    totals.outputTokens += r.tokenUsage.outputTokens;
    if (r.outcome !== "ok" || !r.mintResult) continue;
    totals.defensesCreated += r.mintResult.totals.defensesCreated;
    totals.edgesCreated += r.mintResult.totals.edgesCreated;
    totals.narrowsCreated += r.mintResult.totals.narrowsCreated;
    totals.cqStatusesUpserted += r.mintResult.totals.cqStatusesUpserted;
  }
  return totals;
}
