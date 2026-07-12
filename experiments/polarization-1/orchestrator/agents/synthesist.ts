/**
 * agents/synthesist.ts
 *
 * Phase-5 Synthesist / Crux-Finder agent runner. Single-shot judge: it
 * reads the entire dialectical record (Phase 1 topology, Phase 2 from
 * both, Phase 3 from both, Phase 4 from both, the Concession Tracker
 * verdict, evidence corpus + web-citation provenance) and produces a
 * SynthesistVerdict per the §4 schema.
 *
 * Run AFTER Phase 4 is finalized (i.e. after PHASE_4_COMPLETE.json
 * exists and its `tracker.outcome === "ok"`).
 *
 * Uses the prod model with an elevated maxTokens budget and a low
 * temperature — this is a synthesis/judgment task, not generative.
 *
 * Mirrors `tracker.ts` structurally; differences are limited to the
 * input shape (more sources to render), the schema, and the user-message
 * template.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ZodError } from "zod";

import { AnthropicClient, extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import { modelFor } from "../config";
import type { RoundLogger } from "../log/round-logger";
import {
  buildSynthesistVerdictSchema,
  SynthesistRefusalZ,
  isSynthesistRefusal,
  type SynthesistVerdict,
  type SynthesistRefusal,
  type SynthesistSchemaOpts,
} from "./synthesist-schema";

export class SynthesistValidationError extends Error {
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

export interface SynthesistTurnInput {
  /** Path to the synthesist system prompt (relative to experimentRoot or absolute). */
  promptPath: string;
  /** Renders into `## FRAMING`. */
  framing: string;
  /** Renders into `## TOPOLOGY` — central claim, sub-claims, hinge designations. */
  topologyPrompt: string;
  /** Renders into `## ADVOCATE_A_PHASE_2_ARGUMENTS`. */
  advocateAPhase2Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_2_ARGUMENTS`. */
  advocateBPhase2Prompt: string;
  /** Renders into `## ADVOCATE_A_PHASE_3_ATTACKS_ON_B`. */
  advocateAPhase3Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_3_ATTACKS_ON_A`. */
  advocateBPhase3Prompt: string;
  /** Renders into `## ADVOCATE_A_PHASE_4_RESPONSES`. */
  advocateAPhase4Prompt: string;
  /** Renders into `## ADVOCATE_B_PHASE_4_RESPONSES`. */
  advocateBPhase4Prompt: string;
  /** Renders into `## CONCESSION_TRACKER_VERDICT` — the Phase-4 tracker
   *  output (argument standings + central-claim verdict + advocate
   *  summaries). The Synthesist treats this as authoritative input on
   *  per-argument standings; it is NOT re-litigating standings, it is
   *  building synthesis on top of them. */
  trackerVerdictPrompt: string;
  /** Renders into `## EVIDENCE_CORPUS` — both bound corpus sources and
   *  web-discovered sources materialized during Phase 2-4. */
  evidenceCorpusPrompt: string;
  /**
   * Optional Iter-3 multi-round addendum block. When present, appended
   * to the rendered user message between `## EVIDENCE_CORPUS` and
   * `## YOUR_TASK`. Driver uses this to surface
   * `## ROUND_2_ATTACKS` + `## SUB_ROUND_B_RESPONSES` sections.
   * Iter-2 path leaves this undefined and behavior is unchanged.
   */
  appendedUserBlock?: string;
  /** Schema-binding parameters (known argument ids, attack ids, response
   *  ids, sub-claim count, citation tokens). */
  schemaOpts: SynthesistSchemaOpts;
  cfg: OrchestratorConfig;
  llm: AnthropicClient;
  logger: RoundLogger;
}

export interface SynthesistTurnResult {
  response: SynthesistVerdict | SynthesistRefusal;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

export async function runSynthesistTurn(input: SynthesistTurnInput): Promise<SynthesistTurnResult> {
  const promptPath = path.isAbsolute(input.promptPath)
    ? input.promptPath
    : path.join(input.cfg.experimentRoot, input.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf8");
  const model = modelFor(input.cfg, "synthesist");
  const outputSchema = buildSynthesistVerdictSchema(input.schemaOpts);

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
      // Synthesis is a judgment task — slightly higher than tracker (0.2)
      // because we *want* original framings of cruxes / contributions, but
      // still constrained.
      temperature: 0.4,
      // Up to 20 cruxes × ~600 chars + 25 originalContributions × ~800
      // chars + 20 agreements × ~500 chars + 20 openQuestions × ~700 chars
      // + epistemicShift × ~1500 chars ≈ 70k chars / ~18k tokens. 24k is
      // the budget with overhead.
      maxTokens: 24000,
      logger: input.logger,
      agentRole: "synthesist",
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
        agent: "synthesist",
        attempt,
        kind: "json-extract",
        phase: 5,
        error: msg,
      });
      if (attempt === 3) {
        throw new SynthesistValidationError(
          `synthesist: could not extract JSON after ${attempt} attempts: ${msg}`,
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
      input.logger.event("agent_retry", { agent: "synthesist", attempt: attempt + 1, phase: 5, reason: "json-extract" });
      continue;
    }

    const refusalAttempt = SynthesistRefusalZ.safeParse(parsed);
    if (refusalAttempt.success) {
      input.logger.event("agent_parsed_output", {
        agent: "synthesist",
        attempt,
        phase: 5,
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
        agent: "synthesist",
        attempt,
        phase: 5,
        kind: "synthesist-verdict",
        cruxCount: v.cruxes.length,
        agreementCount: v.agreements.length,
        originalContributionCount: v.originalContributions.length,
        openQuestionCount: v.openQuestions.length,
        netEpistemicValue: v.epistemicShift.netEpistemicValue,
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
      agent: "synthesist",
      attempt,
      phase: 5,
      kind: "zod",
      issues: validation.error.issues,
    });

    if (attempt === 3) {
      throw new SynthesistValidationError(
        `synthesist: hard-validation failed after 3 attempts. Last issues:\n${formatZodIssues(validation.error)}`,
        { attempts: attempt, rawResponses, zodErrors },
      );
    }
    messages.push({ role: "assistant", content: res.text });
    messages.push({ role: "user", content: validationFollowupMessage(validation.error) });
    input.logger.event("agent_retry", { agent: "synthesist", attempt: attempt + 1, phase: 5, reason: "zod" });
  }

  throw new Error("synthesist: unreachable end of retry loop");
}

export { isSynthesistRefusal };

// ─────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────

function renderUserMessage(input: SynthesistTurnInput): string {
  const sections: string[] = [
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
  ];

  const methPrompt = (input.methodologistPhase3Prompt ?? "").trim();
  if (methPrompt.length > 0) {
    sections.push(
      "",
      "## METHODOLOGIST_PHASE_3_ATTACKS",
      "",
      methPrompt,
    );
  }

  sections.push(
    "",
    "## ADVOCATE_A_PHASE_4_RESPONSES",
    "",
    input.advocateAPhase4Prompt.trim(),
    "",
    "## ADVOCATE_B_PHASE_4_RESPONSES",
    "",
    input.advocateBPhase4Prompt.trim(),
    "",
    "## CONCESSION_TRACKER_VERDICT",
    "",
    input.trackerVerdictPrompt.trim(),
    "",
    "## EVIDENCE_CORPUS",
    "",
    input.evidenceCorpusPrompt.trim(),
  );

  const appended = (input.appendedUserBlock ?? "").trim();
  if (appended.length > 0) {
    sections.push("", appended);
  }

  sections.push(
    "",
    "## YOUR_TASK",
    "",
    "You are the Synthesist / Crux-Finder. Per your §4 contract, produce one JSON object characterizing the dialectical state at the END of Phase 4: identified cruxes (with diagnostic status), agreements (including ones the dialectic *revealed* that weren't visible at Phase 1), originalContributions (the originality test from §6), openQuestions (what would actually resolve remaining cruxes), and epistemicShift (a narrative + net rating). Cite specific Phase-2 argumentIds, Phase-3 rebuttalArgumentIds (from advocates AND from the Methodologist when present), and Phase-4 response ids when justifying every claim. Do NOT relitigate the Concession Tracker's per-argument standings — treat them as authoritative input. Emit the JSON object only — no prose before, after, or between.",
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
    "Your last verdict failed validation. Issues:",
    "",
    formatZodIssues(err),
    "",
    "Re-emit the COMPLETE verdict (not a diff) addressing every issue. Same schema, single JSON object, no prose. Recall: every id you cite in `keyArgumentIds`, `basisInRecord`, or `contributingIds` must appear in the record (Phase-2 argumentIds, Phase-3 rebuttalArgumentIds, or `phase4-{A|B}-{r|cq}{idx}` response ids). Citation tokens in `evidenceTokens` must be ones some premise actually used. Cross-references between cruxes and openQuestions use array indices, not ids.",
  ].join("\n");
}
