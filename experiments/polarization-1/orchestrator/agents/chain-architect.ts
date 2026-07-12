/**
 * agents/chain-architect.ts
 *
 * Phase-6 Chain-Architect agent runner. Single-shot judge: it reads the
 * full dialectical record (Phase 1 topology with hinge designations,
 * Phase 2 arguments from both advocates, Phase 3 attacks from both +
 * Methodologist, Phase 4 defenses + concession-tracker per-argument
 * standings, Phase 5 synthesist verdict) and produces a
 * `ChainArchitectPlan` per the §4 schema: one TREE chain per hinge
 * sub-claim, with nodes (argumentId + role + epistemicStatus +
 * dialecticalRole) and edges (sourceArgumentId → targetArgumentId with
 * edgeType + strength + description).
 *
 * Run AFTER Phase 5 is finalized (i.e. after PHASE_5_COMPLETE.json
 * exists with `synthesist.outcome === "ok"`). The architect is
 * structurally a sibling of the synthesist — same prod tier, same
 * single-shot judge pattern, same `ZodError`-driven retry loop.
 *
 * Mirrors `synthesist.ts` structurally; differences are limited to the
 * input shape (more bookkeeping inputs, fewer narrative inputs), the
 * schema, and the user-message template.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildChainArchitectPlanSchema,
  ChainArchitectRefusalZ,
  isChainArchitectRefusal,
  type ChainArchitectPlan,
  type ChainArchitectRefusal,
  type ChainArchitectSchemaOpts,
} from "./chain-architect-schema";

export class ChainArchitectValidationError extends Error {
  attempts: number;
  rawResponses: string[];
  zodErrors: ZodError[];
  constructor(
    message: string,
    opts: { attempts: number; rawResponses: string[]; zodErrors: ZodError[] },
  ) {
    super(message);
    this.attempts = opts.attempts;
    this.rawResponses = opts.rawResponses;
    this.zodErrors = opts.zodErrors;
  }
}

export interface ChainArchitectTurnInput {
  /** Path to the chain-architect system prompt (relative to experimentRoot or absolute). */
  promptPath: string;
  framing: string;
  topologyPrompt: string;
  /** Hinge-only topology block (sub-claim text + claimId for each hinge index). */
  hingesPrompt: string;
  /** Phase-2 args grouped by `conclusionClaimIndex == hingeIndex` for each hinge. */
  phase2ByHingePrompt: string;
  /** Phase-3 attacks (both advocates + methodologist) targeting any P2 / P3 arg. */
  phase3Prompt: string;
  /** Phase-4 defenses + narrows + concedes (with retracted commitment ids). */
  phase4Prompt: string;
  /** Tracker per-argument standings (STANDS / WEAKENED / FALLEN). */
  trackerStandingsPrompt: string;
  /** Phase-5 synthesist verdict — for context on what cruxes the synthesist
   *  identified per hinge. */
  synthesistVerdictPrompt: string;
  schemaOpts: ChainArchitectSchemaOpts;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface ChainArchitectTurnResult {
  response: ChainArchitectPlan | ChainArchitectRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runChainArchitectTurn(
  input: ChainArchitectTurnInput,
): Promise<ChainArchitectTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf8");
  const model = modelFor(input.cfg, "chain-architect");
  const outputSchema = buildChainArchitectPlanSchema(input.schemaOpts);

  const userMessage = renderUserMessage(input);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const rawResponses: string[] = [];
  const zodErrors: ZodError[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await input.llm.chat({
      system: systemPrompt,
      messages,
      model,
      // Chain construction is a structural / annotation task — slightly
      // lower than synthesist (0.4) because we want disciplined edge
      // typing, not creative framings.
      temperature: 0.3,
      // Up to 8 chains × ~40 nodes × ~250 chars + 8 × ~80 edges × ~300 chars
      // ≈ 270k chars worst case but realistic 3 hinges × ~15 nodes ×
      // ~200 chars + 3 × ~30 edges × ~250 chars + chainSummary + purpose
      // + description ≈ 35k tokens. 32k cap is a comfortable budget.
      maxTokens: 32000,
      logger: input.logger,
      agentRole: "chain-architect",
    });
    totalInputTokens += res.usage.inputTokens;
    totalOutputTokens += res.usage.outputTokens;
    rawResponses.push(res.text);

    let parsed: unknown;
    try {
      parsed = extractJson(res.text);
    } catch (err) {
      const msg = (err as Error).message;
      input.logger.event("agent_validation_failure", {
        agent: "chain-architect",
        attempt,
        kind: "json-extract",
        phase: 6,
        error: msg,
      });
      if (attempt === 3) {
        throw new ChainArchitectValidationError(
          `chain-architect: could not extract JSON after ${attempt} attempts: ${msg}`,
          { attempts: attempt, rawResponses, zodErrors },
        );
      }
      messages.push({ role: "assistant", content: res.text });
      messages.push({
        role: "user",
        content:
          `Your last response could not be parsed as JSON: ${msg}\n\n` +
          `Re-emit per the prompt's §4 contract: a single JSON object, optionally inside a \`\`\`json fence, with no prose.`,
      });
      input.logger.event("agent_retry", {
        agent: "chain-architect",
        attempt: attempt + 1,
        phase: 6,
        reason: "json-extract",
      });
      continue;
    }

    const refusalAttempt = ChainArchitectRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: "chain-architect",
        attempt,
        phase: 6,
        kind: "refusal",
        output: refusalAttempt.data,
      });
      return {
        response: refusalAttempt.data,
        rawText: res.text,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        attempts: attempt,
      };
    }

    const validation = outputSchema.safeParse(parsed);
    if (validation.success) {
      const v = validation.data;
      input.logger.event("agent_parsed_output", {
        agent: "chain-architect",
        attempt,
        phase: 6,
        kind: "chain-architect-plan",
        chainCount: v.chains.length,
        nodeTotal: v.chains.reduce((s, c) => s + c.nodes.length, 0),
        edgeTotal: v.chains.reduce((s, c) => s + c.edges.length, 0),
      });
      return {
        response: v,
        rawText: res.text,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        attempts: attempt,
      };
    }

    zodErrors.push(validation.error);
    input.logger.event("agent_validation_failure", {
      agent: "chain-architect",
      attempt,
      phase: 6,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 3) {
      throw new ChainArchitectValidationError(
        `chain-architect: hard-validation failed after 3 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", {
      agent: "chain-architect",
      attempt: attempt + 1,
      phase: 6,
      reason: "zod",
    });
  }

  throw new Error("chain-architect: unreachable end of retry loop");
}

export { isChainArchitectRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(input: ChainArchitectTurnInput): string {
  const sections: string[] = [
    "## FRAMING",
    "",
    input.framing.trim(),
    "",
    "## TOPOLOGY",
    "",
    input.topologyPrompt.trim(),
    "",
    "## HINGE_SUB_CLAIMS",
    "",
    input.hingesPrompt.trim(),
    "",
    "## PHASE_2_ARGUMENTS_BY_HINGE",
    "",
    input.phase2ByHingePrompt.trim(),
    "",
    "## PHASE_3_ATTACKS",
    "",
    input.phase3Prompt.trim(),
    "",
    "## PHASE_4_RESPONSES",
    "",
    input.phase4Prompt.trim(),
    "",
    "## TRACKER_PER_ARGUMENT_STANDINGS",
    "",
    input.trackerStandingsPrompt.trim(),
    "",
    "## SYNTHESIST_VERDICT_SUMMARY",
    "",
    input.synthesistVerdictPrompt.trim(),
    "",
    "## YOUR_TASK",
    "",
    "Produce a `ChainArchitectPlan` JSON object per the §4 contract: one TREE chain per hinge sub-claim listed in `## HINGE_SUB_CLAIMS`, with nodes annotated by role + epistemicStatus + dialecticalRole and edges typed (SUPPORTS / REBUTS / UNDERCUTS / UNDERMINES / QUALIFIES / SUPPORTS / REFUTES) with strength ∈ [0,1].",
    "",
    "Emit a single JSON object, optionally inside a ```json fence, with no prose before or after.",
  ];
  return sections.join("\n");
}

function validationFollowupMessage(err: ZodError): string {
  return (
    `Your last response failed schema validation. Fix the issues below and re-emit the FULL JSON object per the prompt's §4 contract.\n\n` +
    formatZodIssues(err) +
    `\n\nRe-emit a single JSON object only.`
  );
}

function formatZodIssues(err: ZodError): string {
  return err.issues
    .slice(0, 25)
    .map((i) => `- path=${i.path.join(".")}: ${i.message}`)
    .join("\n");
}
