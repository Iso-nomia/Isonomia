/**
 * agents/challenger.ts
 *
 * Phase-7 Challenger agent runner. Single-shot read-only judge: given
 * the load-bearing argument set (P2 + P3 + P4 owned by other sides), the
 * caller's own already-minted P2/P3/P4 arguments, the catalog of valid
 * (schemeKey, cqKey) tuples, and the current per-arg open/answered CQ
 * state, the challenger returns a `ChallengerPlan` enumerating up to
 * `maxRaises` (target, scheme, cq, voice) raise tuples. No new
 * arguments are minted by Phase 7 — the translator only POSTs `/ask`
 * + `/api/ca` against existing argument ids.
 *
 * Mirrors `chain-architect.ts` structurally: `ZodError`-driven retry
 * loop with a refusal short-circuit, single-shot per agent role.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildChallengerPlanSchema,
  ChallengerPlanRefusalGuard,
  isChallengerRefusal,
  type ChallengerPlan,
  type ChallengerPlanRefusal,
  type ChallengerSchemaOpts,
} from "./challenger-schema";

export class ChallengerValidationError extends Error {
  attempts: number;
  rawResponses: string[];
  zodErrors: ZodError[];
  agentRole: string;
  constructor(
    message: string,
    opts: {
      attempts: number;
      rawResponses: string[];
      zodErrors: ZodError[];
      agentRole: string;
    },
  ) {
    super(message);
    this.attempts = opts.attempts;
    this.rawResponses = opts.rawResponses;
    this.zodErrors = opts.zodErrors;
    this.agentRole = opts.agentRole;
  }
}

export interface ChallengerTurnInput {
  /** Path to the challenger system prompt (relative to experimentRoot or absolute). */
  promptPath: string;
  /** Agent role for logging + model selection (advocate-a / advocate-b / methodologist). */
  agentRole: string;
  framing: string;
  topologyPrompt: string;
  /** Load-bearing target arguments rendered by hinge + scheme + standing. */
  targetMenuPrompt: string;
  /** Agent's own minted args (P2/P3/P4) — the voice menu. */
  voiceMenuPrompt: string;
  /** Catalog: scheme → CQ list (key + prompt + targetScope). */
  cqCatalogPrompt: string;
  /** Per-target CQs already raised / answered (so the agent doesn't dupe). */
  existingCqStatePrompt: string;
  schemaOpts: ChallengerSchemaOpts;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface ChallengerTurnResult {
  response: ChallengerPlan | ChallengerPlanRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runChallengerTurn(
  input: ChallengerTurnInput,
): Promise<ChallengerTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf8");
  // Phase-7 shares the methodologist's tier — a single-shot judge across
  // the full dialectical surface, like Phase 5/6.
  const model = modelFor(input.cfg, "challenger");
  const outputSchema = buildChallengerPlanSchema(input.schemaOpts);

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
      // Selecting CQs from a catalog against named targets is a
      // structural pattern-match, not a creative task. Keep temperature
      // low so the agent picks the most-applicable CQ for each target
      // rather than improvising.
      temperature: 0.2,
      // Up to ~maxRaises raises × ~600 chars per raise + summary
      // ≈ comfortable budget at 16k tokens.
      maxTokens: 16000,
      logger: input.logger,
      agentRole: input.agentRole,
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
        agent: input.agentRole,
        attempt,
        kind: "json-extract",
        phase: 7,
        error: msg,
      });
      if (attempt === 3) {
        throw new ChallengerValidationError(
          `${input.agentRole}: could not extract JSON after ${attempt} attempts: ${msg}`,
          {
            attempts: attempt,
            rawResponses,
            zodErrors,
            agentRole: input.agentRole,
          },
        );
      }
      messages.push({ role: "assistant", content: res.text });
      messages.push({
        role: "user",
        content:
          `Your last response could not be parsed as JSON: ${msg}\n\n` +
          "Re-emit per the prompt's §4 contract: a single JSON object, optionally inside a ```json fence, with no prose.",
      });
      input.logger.event("agent_retry", {
        agent: input.agentRole,
        attempt: attempt + 1,
        phase: 7,
        reason: "json-extract",
      });
      continue;
    }

    const refusalAttempt = ChallengerPlanRefusalGuard.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: input.agentRole,
        attempt,
        phase: 7,
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
    if (validation.success && validation.data.outcome === "ok") {
      const v = validation.data;
      input.logger.event("agent_parsed_output", {
        agent: input.agentRole,
        attempt,
        phase: 7,
        kind: "challenger-plan",
        raiseCount: v.raises.length,
      });
      return {
        response: v as ChallengerPlan,
        rawText: res.text,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        attempts: attempt,
      };
    }

    if (validation.success && validation.data.outcome === "refused") {
      // discriminatedUnion already routed refusal — but keep the path
      // explicit for symmetry with the bare-refusal short-circuit above.
      return {
        response: validation.data as ChallengerPlanRefusal,
        rawText: res.text,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        attempts: attempt,
      };
    }

    if (!validation.success) {
      zodErrors.push(validation.error);
      input.logger.event("agent_validation_failure", {
        agent: input.agentRole,
        attempt,
        phase: 7,
        kind: "zod",
        issues: validation.error.issues,
      });

      if (attempt === 3) {
        throw new ChallengerValidationError(
          `${input.agentRole}: hard-validation failed after 3 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
          {
            attempts: attempt,
            rawResponses,
            zodErrors,
            agentRole: input.agentRole,
          },
        );
      }
      messages.push({ role: "assistant", content: res.text });
      messages.push({
        role: "user",
        content: validationFollowupMessage(validation.error),
      });
      input.logger.event("agent_retry", {
        agent: input.agentRole,
        attempt: attempt + 1,
        phase: 7,
        reason: "zod",
      });
    }
  }

  throw new Error(`${input.agentRole}: unreachable end of retry loop`);
}

export { isChallengerRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(input: ChallengerTurnInput): string {
  const sections: string[] = [
    "## FRAMING",
    "",
    input.framing.trim(),
    "",
    "## TOPOLOGY",
    "",
    input.topologyPrompt.trim(),
    "",
    "## TARGET_MENU (load-bearing arguments owned by OTHER sides — pick from these)",
    "",
    input.targetMenuPrompt.trim(),
    "",
    "## VOICE_MENU (your own minted P2/P3/P4 arguments — pick the one you speak under for each raise)",
    "",
    input.voiceMenuPrompt.trim(),
    "",
    "## CQ_CATALOG (scheme → cqs[] you may invoke; obey the catalog parity rule attackType↔targetScope)",
    "",
    input.cqCatalogPrompt.trim(),
    "",
    "## EXISTING_CQ_STATE (skip these — they are already raised or answered)",
    "",
    input.existingCqStatePrompt.trim(),
    "",
    "## YOUR_TASK",
    "",
    `Produce a ChallengerPlan JSON object per the §4 contract enumerating up to ${input.schemaOpts.maxRaises} (target, scheme, cq, voice) raises.`,
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
