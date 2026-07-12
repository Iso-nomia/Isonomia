/**
 * agents/advocate.ts
 *
 * Phase-2 / Phase-3 agent runner shared by Advocate A and Advocate B.
 * Loads the role's system prompt, renders the user message per the
 * prompt's §3 input contract, calls Anthropic, parses + validates the
 * JSON response against a per-role parameterized Zod schema, and retries
 * once on hard-validation failure (per Stage-1 §6 "two-attempt rule").
 *
 * Refusals are returned to the caller (not thrown) — the phase driver
 * persists them to `runtime/refusals/phase-2-advocate-{a,b}-refusal.json`
 * and decides whether to abort the phase (Stage-2 §9 Q4).
 *
 * The Phase-3 schema/prompt is a separate document; for now this runner
 * only handles Phase-2 advocate output.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError, ZodSchema } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildAdvocateOutputSchema,
  AdvocateRefusalZ,
  isAdvocateRefusal,
  type AdvocateOutput,
  type AdvocateRefusal,
  type AdvocateSchemaOpts,
} from "./advocate-schema";

export class AdvocateValidationError extends Error {
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

export type AdvocateRole = "advocate-a" | "advocate-b";

export interface AdvocateTurnInput {
  /** "advocate-a" or "advocate-b" — selects the prompt file and the schema's role discriminator. */
  role: AdvocateRole;
  /** Path to the role's system prompt (relative to experimentRoot). */
  promptPath: string;
  /** Renders into the `## FRAMING` section of the user message. */
  framing: string;
  /** Renders into the `## TOPOLOGY` section. */
  topologyPrompt: string;
  /** Renders into the `## EVIDENCE_CORPUS` section. */
  evidenceCorpusPrompt: string;
  /** Schema-binding parameters (topology shape + allowed citation tokens). */
  schemaOpts: Omit<AdvocateSchemaOpts, "advocateRole">;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface AdvocateTurnResult {
  response: AdvocateOutput | AdvocateRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runAdvocateTurn(input: AdvocateTurnInput): Promise<AdvocateTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf8");
  const model = modelFor(input.cfg, "advocate");

  const advocateRole: "A" | "B" = input.role === "advocate-a" ? "A" : "B";
  const outputSchema = buildAdvocateOutputSchema({ ...input.schemaOpts, advocateRole });

  const userMessage = renderUserMessage({
    framing: input.framing,
    topology: input.topologyPrompt,
    evidence: input.evidenceCorpusPrompt,
    role: input.role,
  });

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
      // Loosened-mode (May 2026): higher temperature unlocks original
      // synthesis and cross-domain analogies that the strict run
      // suppressed. Structured-output discipline is still enforced by
      // the Zod schema + two-attempt rule.
      temperature: 0.8,
      // Loosened mode runs with bigger argument ceilings + more premises
      // per argument; budget bumped accordingly. Anthropic bills only on
      // actual use.
      maxTokens: 32000,
      logger: input.logger,
      agentRole: input.role,
      // Advocates may discover and cite web sources beyond the bound
      // corpus. The translator accepts `web:*` tokens (see
      // argument-mint.ts) and attaches them as ClaimEvidence with
      // provenance.
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
        agent: input.role,
        attempt,
        kind: "json-extract",
        error: msg,
      });
      if (attempt === 2) {
        throw new AdvocateValidationError(
          `${input.role}: could not extract JSON after ${attempt} attempts: ${msg}`,
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
      input.logger.event("agent_retry", { agent: input.role, attempt: attempt + 1, reason: "json-extract" });
      continue;
    }

    // Try refusal first (cheap, distinctive shape).
    const refusalAttempt = AdvocateRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: input.role,
        attempt,
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

    // Try the full output schema.
    const validation = outputSchema.safeParse(parsed);
    if (validation.success) {
      input.logger.event("agent_parsed_output", {
        agent: input.role,
        attempt,
        kind: "advocate-output",
        argumentCount: validation.data.arguments.length,
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
      agent: input.role,
      attempt,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 2) {
      throw new AdvocateValidationError(
        `${input.role}: hard-validation failed after 2 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", { agent: input.role, attempt: attempt + 1, reason: "zod" });
  }

  // Unreachable.
  throw new Error(`${input.role}: unreachable end of retry loop`);
}

export { isAdvocateRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(opts: {
  framing: string;
  topology: string;
  evidence: string;
  role: AdvocateRole;
}): string {
  const taskLine =
    opts.role === "advocate-a"
      ? "You are Advocate A (causal-link position). Produce an AdvocateArgumentOutput per §4 of your system prompt. Emit a single JSON object only — no prose before, after, or between."
      : "You are Advocate B (skeptical position). Produce an AdvocateArgumentOutput per §4 of your system prompt. Emit a single JSON object only — no prose before, after, or between.";

  return [
    "## FRAMING",
    "",
    opts.framing.trim(),
    "",
    "## TOPOLOGY",
    "",
    opts.topology.trim(),
    "",
    "## EVIDENCE_CORPUS",
    "",
    opts.evidence.trim(),
    "",
    "## YOUR_TASK",
    "",
    taskLine,
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
    "",
    formatZodIssues(err),
    "",
    "Re-emit the COMPLETE response (not a diff) addressing every issue. Same schema, single JSON object, no prose.",
  ].join("\n");
}
