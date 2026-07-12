/**
 * agents/claim-analyst.ts
 *
 * Phase-1-only agent. Loads `prompts/1-claim-analyst.md`, renders the user
 * message exactly per the prompt's §3 input contract, calls Anthropic,
 * parses + validates the JSON response, and retries once on hard-validation
 * failure with the validation error appended.
 *
 * Refusals are returned to the caller (not thrown) — the orchestrator
 * persists them to `runtime/refusals/phase-1-refusal.json` and exits with
 * status 2 (per Stage 2 §9 Q4).
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  ClaimAnalystResponseZ,
  ClaimAnalystOutputZ,
  isRefusal,
  type ClaimAnalystResponse,
  type ClaimAnalystOutput,
} from "./claim-analyst-schema";

export class HardValidationError extends Error {
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

export interface ClaimAnalystTurnInput {
  framing: string;
  centralClaim: string;
  evidenceCorpusOverview: string;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface ClaimAnalystTurnResult {
  response: ClaimAnalystResponse; // refusal or valid output
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

/** Convenience type guard re-export. */
export { isRefusal };

export async function runClaimAnalystTurn(input: ClaimAnalystTurnInput): Promise<ClaimAnalystTurnResult> {
  const promptPath = path.join(input.cfg.experimentRoot, "prompts", "1-claim-analyst.md");
  const systemPrompt = readFileSync(promptPath, "utf8");
  const model = modelFor(input.cfg, "claim-analyst");

  const userMessage = renderUserMessage({
    framing: input.framing,
    centralClaim: input.centralClaim,
    evidenceCorpusOverview: input.evidenceCorpusOverview,
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
      temperature: 0.2, // analytic role — keep variance low
      logger: input.logger,
      agentRole: "claim-analyst",
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
        agent: "claim-analyst",
        attempt,
        kind: "json-extract",
        error: msg,
      });
      if (attempt === 2) {
        throw new HardValidationError(
          `Claim Analyst: could not extract JSON after ${attempt} attempts: ${msg}`,
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
      input.logger.event("agent_retry", { agent: "claim-analyst", attempt: attempt + 1, reason: "json-extract" });
      continue;
    }

    const validation = ClaimAnalystResponseZ.safeParse(parsed);
    if (validation.success) {
      input.logger.event("agent_parsed_output", {
        agent: "claim-analyst",
        attempt,
        kind: isRefusal(validation.data) ? "refusal" : "topology",
        output: validation.data,
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
      agent: "claim-analyst",
      attempt,
      kind: "zod",
      issues: validation.error.issues,
    });
    if (attempt === 2) {
      throw new HardValidationError(
        `Claim Analyst: hard-validation failed after 2 attempts. Last issues: ${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", { agent: "claim-analyst", attempt: attempt + 1, reason: "zod" });
  }

  // Unreachable — the loop either returns or throws above.
  throw new Error("Claim Analyst: unreachable end of retry loop");
}

function renderUserMessage(opts: {
  framing: string;
  centralClaim: string;
  evidenceCorpusOverview: string;
}): string {
  return [
    "## FRAMING",
    "",
    opts.framing.trim(),
    "",
    "## CENTRAL_CLAIM",
    "",
    opts.centralClaim.trim(),
    "",
    "## EVIDENCE_CORPUS_OVERVIEW",
    "",
    opts.evidenceCorpusOverview.trim(),
    "",
    "## YOUR_TASK",
    "",
    "Produce a ClaimAnalystOutput per §4 of your system prompt. Emit a single JSON object only.",
  ].join("\n");
}

function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .slice(0, 10)
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

/**
 * Convenience for downstream phase logic that wants the topology shape
 * specifically (not the refusal). Throws on refusal.
 */
export function asTopology(r: ClaimAnalystResponse): ClaimAnalystOutput {
  if (isRefusal(r)) {
    throw new Error(`Claim Analyst refused: ${r.error} — ${r.details}`);
  }
  // Already validated; type guard.
  return ClaimAnalystOutputZ.parse(r);
}
