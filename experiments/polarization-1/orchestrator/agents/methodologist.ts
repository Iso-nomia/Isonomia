/**
 * agents/methodologist.ts
 *
 * Phase-3 Methodologist runner. The Methodologist is a third voice that
 * runs AFTER Advocate A and Advocate B in Phase 3, produces critical-
 * question raises and rebuttals against arguments from BOTH sides, and
 * has no position of its own. Its outputs feed Phase 4 (each advocate
 * defends against any Methodologist attack targeting their arguments)
 * and Phase 5 (Synthesist sees Methodologist record alongside A/B).
 *
 * This file mirrors `rebuttal.ts` in shape: read prompt, render user
 * message, call Anthropic with web search enabled, parse + Zod-validate,
 * 2-attempt retry. The sole structural differences:
 *   - System prompt is `prompts/10-methodologist.md`.
 *   - User message renders BOTH advocates' Phase-2 args under
 *     `## PHASE_2_ARGUMENTS` (single block, with side labels per arg).
 *   - Schema is `MethodologistOutputZ` from `methodologist-schema.ts`.
 *   - Logged `agentRole` is the literal string `"methodologist"`.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildMethodologistOutputSchema,
  MethodologistRefusalZ,
  isMethodologistRefusal,
  type MethodologistOutput,
  type MethodologistRefusal,
  type MethodologistSchemaOpts,
} from "./methodologist-schema";

export class MethodologistValidationError extends Error {
  attempts: number;
  rawResponses: string[];
  zodErrors: ZodError[];
  constructor(message: string, opts: { attempts: number; rawResponses: string[]; zodErrors: ZodError[] }) {
    super(message);
    this.attempts = opts.attempts;
    this.rawResponses = opts.rawResponses;
    this.zodErrors = opts.zodErrors;
  }
}

export const METHODOLOGIST_AGENT_ROLE = "methodologist" as const;
export type MethodologistAgentRole = typeof METHODOLOGIST_AGENT_ROLE;

export interface MethodologistTurnInput {
  /** Path to the Methodologist's Phase-3 system prompt (relative to experimentRoot or absolute). */
  promptPath: string;
  framing: string;
  /**
   * Combined prompt block listing BOTH advocates' Phase-2 arguments,
   * built by the phase driver. Each argument line carries an
   * "(advocate A)" or "(advocate B)" tag so the Methodologist can route
   * `targetAdvocateRole` correctly.
   */
  phase2ArgumentsPrompt: string;
  evidenceCorpusPrompt: string;
  /** Iter-3: optional content appended to system prompt (round-2 addendum). */
  appendedSystemPrompt?: string;
  /** Iter-3: optional extra block appended to user message. */
  appendedUserBlock?: string;
  schemaOpts: MethodologistSchemaOpts;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface MethodologistTurnResult {
  response: MethodologistOutput | MethodologistRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runMethodologistTurn(
  input: MethodologistTurnInput,
): Promise<MethodologistTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const baseSystemPrompt = readFileSync(promptPath, "utf8");
  const systemPrompt = input.appendedSystemPrompt
    ? `${baseSystemPrompt}\n\n${input.appendedSystemPrompt}`
    : baseSystemPrompt;
  const model = modelFor(input.cfg, "methodologist");

  const outputSchema = buildMethodologistOutputSchema(input.schemaOpts);

  const baseUserMessage = renderUserMessage({
    framing: input.framing,
    phase2Arguments: input.phase2ArgumentsPrompt,
    evidence: input.evidenceCorpusPrompt,
  });
  const userMessage = input.appendedUserBlock
    ? `${baseUserMessage}\n\n${input.appendedUserBlock}`
    : baseUserMessage;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const rawResponses: string[] = [];
  const zodErrors: ZodError[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await input.llm.chat({
      system: systemPrompt,
      messages,
      model,
      // Slightly cooler than advocates (0.8): the Methodologist's job is
      // disciplined methodological diagnosis, not creative argument
      // generation.
      temperature: 0.6,
      // Larger headroom: the Methodologist may emit up to 24 rebuttals
      // and 24 CQ raises, each with multiple premises and citations.
      maxTokens: 28000,
      logger: input.logger,
      agentRole: METHODOLOGIST_AGENT_ROLE,
      useWebSearch: true,
      webSearchMaxUses: 12,
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
        agent: METHODOLOGIST_AGENT_ROLE,
        attempt,
        kind: "json-extract",
        phase: 3,
        error: msg,
      });
      if (attempt === 2) {
        throw new MethodologistValidationError(
          `methodologist: could not extract JSON after ${attempt} attempts: ${msg}`,
          { attempts: attempt, rawResponses, zodErrors },
        );
      }
      messages.push({ role: "assistant", content: res.text });
      messages.push({
        role: "user",
        content:
          `Your last response could not be parsed as JSON: ${msg}\n\n` +
          `Re-emit the response per the prompt's §4 output contract: a single JSON object, ` +
          `optionally inside a \`\`\`json fence, with no prose before or after.`,
      });
      input.logger.event("agent_retry", {
        agent: METHODOLOGIST_AGENT_ROLE,
        attempt: attempt + 1,
        phase: 3,
        reason: "json-extract",
      });
      continue;
    }

    const refusalAttempt = MethodologistRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: METHODOLOGIST_AGENT_ROLE,
        attempt,
        phase: 3,
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
      input.logger.event("agent_parsed_output", {
        agent: METHODOLOGIST_AGENT_ROLE,
        attempt,
        phase: 3,
        kind: "methodologist-output",
        cqResponseCount: validation.data.cqResponses.length,
        rebuttalCount: validation.data.rebuttals.length,
      });
      return {
        response: validation.data,
        rawText: res.text,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        attempts: attempt,
      };
    }

    zodErrors.push(validation.error);
    input.logger.event("agent_validation_failure", {
      agent: METHODOLOGIST_AGENT_ROLE,
      attempt,
      phase: 3,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 2) {
      throw new MethodologistValidationError(
        `methodologist: hard-validation failed after 2 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", {
      agent: METHODOLOGIST_AGENT_ROLE,
      attempt: attempt + 1,
      phase: 3,
      reason: "zod",
    });
  }

  throw new Error("methodologist: unreachable end of retry loop");
}

export { isMethodologistRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(opts: {
  framing: string;
  phase2Arguments: string;
  evidence: string;
}): string {
  return [
    "## FRAMING",
    "",
    opts.framing.trim(),
    "",
    "## PHASE_2_ARGUMENTS",
    "",
    opts.phase2Arguments.trim(),
    "",
    "## EVIDENCE_CORPUS",
    "",
    opts.evidence.trim(),
    "",
    "## YOUR_TASK",
    "",
    "You are the Methodologist. You have NO position. Produce a Phase-3 MethodologistOutput per §4 of your system prompt. Attack methodologically weak arguments on BOTH sides. Emit a single JSON object only — no prose before, after, or between.",
  ].join("\n");
}

function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .slice(0, 12)
    .join("\n");
}

function validationFollowupMessage(err: ZodError): string {
  return [
    "Your last response failed validation. Issues:",
    formatZodIssues(err),
    "",
    "Re-emit the entire JSON object with these issues fixed. Do not include any prose outside the JSON.",
    "",
    "Common traps to double-check before re-emitting:",
    "- `targetAdvocateRole` MUST equal the author of `targetArgumentId`, irrespective of which side your attack ultimately defends. For `targetKind: \"phase2-arg\"`, look up the `side=A|B` tag on the ARG line in `## PHASE_2_ARGUMENTS`. For `targetKind: \"round1-rebuttal\"`, set it to the side whose Phase-2 argument that round-1 rebuttal attacked (shown as `side=<X>-defender` in `## ROUND_1_ATTACKS_ALL`).",
    "- `cqKey` must be copied verbatim from the target argument's own scheme catalog (`critical-questions for scheme=<schemeKey>:`). Do NOT mix keys across schemes; do NOT add or strip a trailing `?`.",
    "- `citationToken` must include its prefix (e.g. `src:bail2018`, `block:cmoq...`, `web:<slug>`) and match `^[a-z]+:[A-Za-z0-9._-]+$`. A bare cuid is hard-rejected.",
  ].join("\n");
}
