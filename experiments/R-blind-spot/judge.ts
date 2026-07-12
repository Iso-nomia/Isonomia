/**
 * experiments/R-blind-spot/judge.ts
 *
 * Runs the ONE judgment-laden confirm check under test — evidence-supports-
 * premise — using the VERBATIM production system prompt (`JUDGE_SYSTEM`,
 * imported, not re-declared, so it can never drift). The user message mirrors
 * the exact rendering `renderJudgePrompt` produces in phase-2-checks.ts, reduced
 * to a single premise so each item is one independent call.
 *
 * CRITICAL (blinding invariant): this prompt is the production check verbatim.
 * It NEVER says "find the planted error" — that would turn checking into
 * trap-hunting and void external validity.
 */

import { JUDGE_SYSTEM } from "../polarization-1/orchestrator/review/phase-2-checks";
import type { ChatClient } from "./clients";
import type { Item, VerdictClass } from "./types";

export { JUDGE_SYSTEM };

/** Render a single evidence item exactly as the production judge sees it. */
export function renderItemPrompt(item: Item): string {
  const s = item.source;
  const yr = s.publishedAt ? s.publishedAt.slice(0, 4) : "n.d.";
  const authors = s.authors.length
    ? s.authors.length > 3
      ? `${s.authors[0]} et al.`
      : s.authors.join(", ")
    : "Anonymous";

  const lines: string[] = [];
  lines.push(`For each (premise, source) pair below, classify the source's support per the system prompt.`);
  lines.push(``);
  lines.push(`### Premise 0`);
  lines.push(`Text: "${item.premiseText}"`);
  lines.push(``);
  lines.push(`Cited source (${item.citationToken}):`);
  lines.push(`  ${authors} (${yr}). ${s.title ?? "(untitled)"}`);
  lines.push(`  abstract: ${s.abstract ? s.abstract.trim().replace(/\s+/g, " ") : "(none on record)"}`);
  if (s.keyFindings.length) {
    lines.push(`  key findings:`);
    for (const f of s.keyFindings) lines.push(`    - ${f.trim().replace(/\s+/g, " ")}`);
  }
  lines.push(``);
  lines.push(`Emit a single JSON object: { "verdicts": [...] }. One entry per premise above.`);
  return lines.join("\n");
}

/** Tolerant JSON extraction (models sometimes wrap the object in prose/fences). */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object found");
  }
  return JSON.parse(body.slice(start, end + 1));
}

export interface JudgeOutcome {
  verdict: VerdictClass | "parse_error";
  justification: string;
  raw: string;
  usage: { inputTokens: number; outputTokens: number };
}

const VALID: ReadonlySet<string> = new Set(["supported", "partial", "not_supported", "uncertain"]);

/**
 * Run one checker (one model call, fresh context) against one item.
 *
 * `temperature` matters: at 0 the model is deterministic, so N same-family
 * checkers would return IDENTICAL verdicts and the same-family panel would be a
 * degenerate single checker (flat curve by construction — trivially "confirms"
 * R while measuring nothing). Real same-family panels get their independence
 * from distinct sessions/harnesses, which at the model level is sampling
 * variation — so panel members sample at temperature > 0. The VERBATIM part of
 * the production check is the SYSTEM PROMPT (the judgment content), not the
 * temperature (a panel-sampling parameter).
 */
export async function judgeItem(
  client: ChatClient,
  model: string,
  item: Item,
  temperature = 0.7,
): Promise<JudgeOutcome> {
  const res = await client.chat({
    system: JUDGE_SYSTEM,
    user: renderItemPrompt(item),
    model,
    temperature,
    maxTokens: 800,
  });

  try {
    const parsed = extractJson(res.text);
    const v = Array.isArray(parsed?.verdicts) ? parsed.verdicts[0] : undefined;
    const cls = String(v?.verdict ?? "").toLowerCase();
    if (!VALID.has(cls)) {
      return { verdict: "parse_error", justification: `unrecognized verdict "${cls}"`, raw: res.text, usage: res.usage };
    }
    return {
      verdict: cls as VerdictClass,
      justification: String(v?.justification ?? ""),
      raw: res.text,
      usage: res.usage,
    };
  } catch (err) {
    return {
      verdict: "parse_error",
      justification: (err as Error).message,
      raw: res.text,
      usage: res.usage,
    };
  }
}

/** A catch = any non-"supported", non-"uncertain" verdict flags the item as wrong. */
export function isCatch(verdict: VerdictClass | "parse_error"): boolean {
  return verdict === "partial" || verdict === "not_supported";
}
