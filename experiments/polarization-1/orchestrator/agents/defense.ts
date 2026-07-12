/**
 * agents/defense.ts
 *
 * Phase-4 (Concessions & Defenses) agent runner shared by Advocate A and
 * Advocate B. Mirror of `rebuttal.ts` for Phase 3:
 *   - Loads role's Phase-4 system prompt.
 *   - Renders a user message per the prompt's §3 input contract
 *     (FRAMING, YOUR_PHASE_2_ARGUMENTS, OPPONENT_ATTACKS_AGAINST_YOU,
 *      EVIDENCE_CORPUS, YOUR_TASK).
 *   - Calls Anthropic with temperature 0.4 + maxTokens 16000 (Phase-4
 *     outputs can be larger than Phase-3 because every attack and CQ
 *     raise must receive a response).
 *   - Parses + validates JSON against a per-role parameterized Zod schema
 *     (built in `defense-schema.ts`).
 *   - Retries once on hard-validation failure (per the experiment's
 *     two-attempt rule).
 *
 * Refusals are returned to the caller (not thrown) — the phase driver
 * persists them to `runtime/refusals/phase-4-{role}-refusal.json` and
 * decides whether to abort.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildDefenseOutputSchema,
  DefenseRefusalZ,
  isDefenseRefusal,
  type DefenseOutput,
  type DefenseRefusal,
  type DefenseSchemaOpts,
} from "./defense-schema";

export class DefenseValidationError extends Error {
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

export type DefenseAgentRole = "advocate-a" | "advocate-b";

export interface DefenseTurnInput {
  /** "advocate-a" or "advocate-b" — selects prompt file and schema role. */
  role: DefenseAgentRole;
  /** Path to the role's Phase-4 system prompt (relative to experimentRoot). */
  promptPath: string;
  /** Renders into the `## FRAMING` section. */
  framing: string;
  /** Renders into `## YOUR_PHASE_2_ARGUMENTS` (THIS advocate's Phase-2 output). */
  yourPhase2ArgumentsPrompt: string;
  /** Renders into `## OPPONENT_ATTACKS_AGAINST_YOU` (other advocate's Phase-3 attacks targeting THIS advocate). */
  opponentAttacksPrompt: string;
  /**
   * Renders into `## METHODOLOGIST_ATTACKS_AGAINST_YOU` (the
   * Methodologist's Phase-3 attacks targeting THIS advocate's args).
   * Empty string → omit the section entirely (pre-Methodologist runs
   * pass "" or default-undefined). The validator's
   * `schemaOpts.opposingRebuttals` map already includes methodologist
   * attack ids (the Phase-4 driver merges both opponents into a single
   * map), so defense responses may target any of them.
   */
  methodologistAttacksPrompt?: string;
  /** Renders into `## EVIDENCE_CORPUS`. */
  evidenceCorpusPrompt: string;
  /**
   * Optional Iter-3 sub-round-b addendum content. When present, appended
   * verbatim to the base system prompt (after a blank line). Iter-2 and
   * sub-round-a code paths leave this undefined and behavior is unchanged.
   */
  appendedSystemPrompt?: string;
  /**
   * Optional Iter-3 sub-round-b user-message addendum (e.g. the
   * `## ROUND_2_ATTACKS_AGAINST_YOU` block). When present, appended to
   * the rendered user message between `## EVIDENCE_CORPUS` and
   * `## YOUR_TASK`.
   */
  appendedUserBlock?: string;
  /** Schema-binding parameters (opposing rebuttals, opposing CQ raises, allowed citation tokens). */
  schemaOpts: Omit<DefenseSchemaOpts, "advocateRole">;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface DefenseTurnResult {
  response: DefenseOutput | DefenseRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runDefenseTurn(input: DefenseTurnInput): Promise<DefenseTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const baseSystemPrompt = readFileSync(promptPath, "utf8");
  const systemPrompt =
    input.appendedSystemPrompt && input.appendedSystemPrompt.trim().length > 0
      ? `${baseSystemPrompt}\n\n${input.appendedSystemPrompt.trim()}\n`
      : baseSystemPrompt;
  const model = modelFor(input.cfg, "defense");

  const advocateRole: "A" | "B" = input.role === "advocate-a" ? "A" : "B";
  const outputSchema = buildDefenseOutputSchema({ ...input.schemaOpts, advocateRole });

  const userMessage = renderUserMessage({
    framing: input.framing,
    yourPhase2: input.yourPhase2ArgumentsPrompt,
    opponentAttacks: input.opponentAttacksPrompt,
    methodologistAttacks: input.methodologistAttacksPrompt ?? "",
    evidence: input.evidenceCorpusPrompt,
    appendedUserBlock: input.appendedUserBlock ?? "",
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
      // Same elevated temperature as Phase 2/3 in loosened mode.
      temperature: 0.8,
      // Loosened-mode ceiling: defenses may now cite web sources and
      // mount longer rationales. 32k headroom; typical output 6–12k.
      maxTokens: 32000,
      logger: input.logger,
      agentRole: input.role,
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
        phase: 4,
        error: msg,
      });
      if (attempt === 2) {
        throw new DefenseValidationError(
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
      input.logger.event("agent_retry", { agent: input.role, attempt: attempt + 1, phase: 4, reason: "json-extract" });
      continue;
    }

    // Try refusal first (cheap, distinctive shape).
    const refusalAttempt = DefenseRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: input.role,
        attempt,
        phase: 4,
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
        phase: 4,
        kind: "defense-output",
        responseCount: validation.data.responses.length,
        cqAnswerCount: validation.data.cqAnswers.length,
        defendCount: validation.data.responses.filter((r) => r.kind === "defend").length,
        concedeCount: validation.data.responses.filter((r) => r.kind === "concede").length,
        narrowCount: validation.data.responses.filter((r) => r.kind === "narrow").length,
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
      phase: 4,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 2) {
      throw new DefenseValidationError(
        `${input.role}: hard-validation failed after 2 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", { agent: input.role, attempt: attempt + 1, phase: 4, reason: "zod" });
  }

  // Unreachable.
  throw new Error(`${input.role}: unreachable end of retry loop`);
}

export { isDefenseRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(opts: {
  framing: string;
  yourPhase2: string;
  opponentAttacks: string;
  methodologistAttacks: string;
  evidence: string;
  appendedUserBlock: string;
  role: DefenseAgentRole;
}): string {
  const taskLine =
    opts.role === "advocate-a"
      ? "You are Advocate A (causal-link position). Produce a Phase-4 DefenseOutput per §4 of your system prompt. Every rebuttal in OPPONENT_ATTACKS_AGAINST_YOU and METHODOLOGIST_ATTACKS_AGAINST_YOU must receive exactly one response in `responses`; every CQ_RAISE in either block must receive exactly one entry in `cqAnswers`. Emit a single JSON object only — no prose before, after, or between."
      : "You are Advocate B (skeptical position). Produce a Phase-4 DefenseOutput per §4 of your system prompt. Every rebuttal in OPPONENT_ATTACKS_AGAINST_YOU and METHODOLOGIST_ATTACKS_AGAINST_YOU must receive exactly one response in `responses`; every CQ_RAISE in either block must receive exactly one entry in `cqAnswers`. Emit a single JSON object only — no prose before, after, or between.";

  const sections: string[] = [
    "## FRAMING",
    "",
    opts.framing.trim(),
    "",
    "## YOUR_PHASE_2_ARGUMENTS",
    "",
    opts.yourPhase2.trim(),
    "",
    "## OPPONENT_ATTACKS_AGAINST_YOU",
    "",
    opts.opponentAttacks.trim(),
  ];

  if (opts.methodologistAttacks.trim().length > 0) {
    sections.push(
      "",
      "## METHODOLOGIST_ATTACKS_AGAINST_YOU",
      "",
      opts.methodologistAttacks.trim(),
    );
  }

  sections.push(
    "",
    "## EVIDENCE_CORPUS",
    "",
    opts.evidence.trim(),
  );

  if (opts.appendedUserBlock.trim().length > 0) {
    sections.push("", opts.appendedUserBlock.trim());
  }

  sections.push(
    "",
    "## YOUR_TASK",
    "",
    taskLine,
  );

  return sections.join("\n");
}

function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .slice(0, 16)
    .join("\n");
}

function validationFollowupMessage(err: ZodError): string {
  return [
    "Your last response failed validation. Issues:",
    "",
    formatZodIssues(err),
    "",
    "Re-emit the COMPLETE response (not a diff) addressing every issue. Same schema, single JSON object, no prose. Recall that every opposing rebuttal must receive exactly one entry in `responses` and every opposing CQ raise must receive exactly one entry in `cqAnswers`.",
  ].join("\n");
}
