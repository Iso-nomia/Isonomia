/**
 * agents/tracker.ts
 *
 * Phase-4 Concession Tracker agent runner. The tracker is a single-shot
 * judge: it reads the full dialectical record (root claim, topology,
 * Phase-2 from both, Phase-3 from both, Phase-4 from both, evidence
 * corpus) and produces a TrackerVerdict per the §4.1 schema.
 *
 * Run AFTER both advocates' Phase-4 outputs are minted. Sequential by
 * construction (no parallelism needed — one agent, one call).
 *
 * Uses the prod model (Opus in prod, Haiku in dev) and an elevated
 * maxTokens budget because the verdict's per-argument rationales plus
 * the central-claim rationale plus advocate-summary rationales add up.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildTrackerVerdictSchema,
  TrackerRefusalZ,
  isTrackerRefusal,
  type TrackerVerdict,
  type TrackerRefusal,
  type TrackerSchemaOpts,
} from "./tracker-schema";

export class TrackerValidationError extends Error {
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

export interface TrackerTurnInput {
  /** Path to the tracker system prompt (relative to experimentRoot). */
  promptPath: string;
  /** Renders into `## FRAMING`. */
  framing: string;
  /** Renders into `## TOPOLOGY` — central claim, sub-claims, dependency edges, hinges. */
  topologyPrompt: string;
  /** Renders into `## ADVOCATE_A_PHASE_2_ARGUMENTS`. */
  advocateAPhase2Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_2_ARGUMENTS`. */
  advocateBPhase2Prompt: string;
  /** Renders into `## ADVOCATE_A_PHASE_3_ATTACKS_ON_B`. */
  advocateAPhase3Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_3_ATTACKS_ON_A`. */
  advocateBPhase3Prompt: string;
  /**
   * Renders into `## METHODOLOGIST_PHASE_3_ATTACKS`. Empty/undefined →
   * omit the section (pre-Methodologist deliberations remain valid).
   */
  methodologistPhase3Prompt?: string;
  /** Renders into `## ADVOCATE_A_PHASE_4_RESPONSES`. */
  advocateAPhase4Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_4_RESPONSES`. */
  advocateBPhase4Prompt: string;
  /** Renders into `## EVIDENCE_CORPUS`. */
  evidenceCorpusPrompt: string;
  /**
   * Optional Iter-3 multi-round addendum block. When present, appended
   * to the rendered user message between `## EVIDENCE_CORPUS` and
   * `## YOUR_TASK`. Driver uses this to surface
   * `## ROUND_2_ATTACKS` + `## SUB_ROUND_B_RESPONSES` sections.
   * Iter-2 path leaves this undefined and behavior is unchanged.
   */
  appendedUserBlock?: string;
  /** Schema-binding parameters (known arguments, attack ids, response ids). */
  schemaOpts: TrackerSchemaOpts;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface TrackerTurnResult {
  response: TrackerVerdict | TrackerRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runTrackerTurn(input: TrackerTurnInput): Promise<TrackerTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf8");
  const model = modelFor(input.cfg, "tracker");
  const outputSchema = buildTrackerVerdictSchema(input.schemaOpts);

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
      // Tracker is a judgment task — slightly lower temp than advocates.
      temperature: 0.2,
      // Per-arg rationale (≤600) × ~30 args + 2 advocate summaries
      // (≤400 each) + central rationale (≤1200) + structural overhead
      // ≈ 24k chars / ~6k tokens. 16k is comfortable headroom.
      maxTokens: 16000,
      logger: input.logger,
      agentRole: "tracker",
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
        agent: "tracker",
        attempt,
        kind: "json-extract",
        phase: 4,
        error: msg,
      });
      if (attempt === 3) {
        throw new TrackerValidationError(
          `tracker: could not extract JSON after ${attempt} attempts: ${msg}`,
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
      input.logger.event("agent_retry", { agent: "tracker", attempt: attempt + 1, phase: 4, reason: "json-extract" });
      continue;
    }

    const refusalAttempt = TrackerRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: "tracker",
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

    const validation = outputSchema.safeParse(parsed);
    if (validation.success) {
      const v = validation.data;
      input.logger.event("agent_parsed_output", {
        agent: "tracker",
        attempt,
        phase: 4,
        kind: "tracker-verdict",
        argumentStandingCount: v.argumentStandings.length,
        verdict: v.centralClaimVerdict.verdict,
        aSummary: v.advocateSummaries.find((s) => s.advocateRole === "A"),
        bSummary: v.advocateSummaries.find((s) => s.advocateRole === "B"),
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
      agent: "tracker",
      attempt,
      phase: 4,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 3) {
      throw new TrackerValidationError(
        `tracker: hard-validation failed after 3 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", { agent: "tracker", attempt: attempt + 1, phase: 4, reason: "zod" });
  }

  // Unreachable.
  throw new Error("tracker: unreachable end of retry loop");
}

export { isTrackerRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(input: TrackerTurnInput): string {
  // Compute ground-truth counts from schemaOpts.knownArguments so the LLM
  // can match advocateSummaries totals exactly (off-by-one tally errors are
  // the leading cause of tracker hard-validation failures).
  const counts = { A: { total: 0, hinge: 0 }, B: { total: 0, hinge: 0 } } as const;
  // Recompute (counts is "as const" so mutate via Map iteration into a fresh object).
  const tally = { A: { total: 0, hinge: 0 }, B: { total: 0, hinge: 0 } };
  for (const b of input.schemaOpts.knownArguments.values()) {
    tally[b.advocateRole].total += 1;
    if (b.isHingeArgument) tally[b.advocateRole].hinge += 1;
  }
  void counts;
  const groundTruthBlock = [
    "## GROUND_TRUTH_COUNTS",
    "",
    "These are the authoritative Phase-2 argument counts. Your `advocateSummaries` MUST match exactly:",
    "",
    `- Role A: totalArguments = ${tally.A.total}, hinge arguments = ${tally.A.hinge}`,
    `- Role B: totalArguments = ${tally.B.total}, hinge arguments = ${tally.B.hinge}`,
    "",
    "For each role: `stoodCount + weakenedCount + fallenCount` MUST equal `totalArguments`,",
    "and `hingeStandings.{stoodCount + weakenedCount + fallenCount}` MUST equal the hinge count above.",
    "Cross-check: every argumentId in your `argumentStandings` whose `isHingeArgument=true` and `advocateRole=A`",
    "must contribute to `hingeStandings` for A (same for B). Count carefully — off-by-one errors are the",
    "single most common failure mode.",
  ].join("\n");
  return [
    groundTruthBlock,
    "",
    "## FRAMING",
    "",
    input.framing.trim(),
    "",
    "## TOPOLOGY",
    "",
    input.topologyPrompt.trim(),
    "",
    "## ADVOCATE_A_PHASE_2_ARGUMENTS",
    "",
    input.advocateAPhase2Prompt.trim(),
    "",
    "## ADVOCATE_B_PHASE_2_ARGUMENTS",
    "",
    input.advocateBPhase2Prompt.trim(),
    "",
    "## ADVOCATE_A_PHASE_3_ATTACKS_ON_B",
    "",
    input.advocateAPhase3Prompt.trim(),
    "",
    "## ADVOCATE_B_PHASE_3_ATTACKS_ON_A",
    "",
    input.advocateBPhase3Prompt.trim(),
    ...((input.methodologistPhase3Prompt ?? "").trim().length > 0
      ? [
          "",
          "## METHODOLOGIST_PHASE_3_ATTACKS",
          "",
          input.methodologistPhase3Prompt!.trim(),
        ]
      : []),
    "",
    "## ADVOCATE_A_PHASE_4_RESPONSES",
    "",
    input.advocateAPhase4Prompt.trim(),
    "",
    "## ADVOCATE_B_PHASE_4_RESPONSES",
    "",
    input.advocateBPhase4Prompt.trim(),
    "",
    "## EVIDENCE_CORPUS",
    "",
    input.evidenceCorpusPrompt.trim(),
    ...((input.appendedUserBlock ?? "").trim().length > 0
      ? ["", input.appendedUserBlock!.trim()]
      : []),
    "",
    "## YOUR_TASK",
    "",
    "You are the Concession Tracker. Produce a TrackerVerdict per §4 of your system prompt. Cite specific argumentIds, premiseIndices, cqKeys, and Phase-4 responseIds when you justify a verdict. Emit a single JSON object only — no prose before, after, or between.",
  ].join("\n");
}

function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .slice(0, 16)
    .join("\n");
}

function validationFollowupMessage(err: ZodError): string {
  return [
    "Your last verdict failed validation. Issues:",
    "",
    formatZodIssues(err),
    "",
    "Re-emit the COMPLETE verdict (not a diff) addressing every issue. Same schema, single JSON object, no prose. Recall that every Phase-2 argument from BOTH advocates must appear in `argumentStandings`, and `advocateSummaries` must contain exactly one entry for role A and one for role B with counts that sum correctly.",
  ].join("\n");
}
