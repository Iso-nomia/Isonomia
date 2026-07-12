/**
 * orchestrator/review/phase-2-checks.ts
 *
 * Soft-track validation for Phase 2 — per the prompt §6 "Quality
 * expectations" rubric. Emits `review_flag` events instead of aborting;
 * the human reviewer resolves flags in `runtime/reviews/phase-2-review.md`.
 *
 * Stage-3 §3 specifies six review checks:
 *
 *   1. **evidence_fidelity** (LLM-judge, soft)
 *      For every premise that cites a source, ask Claude Haiku whether the
 *      source's abstract / key findings actually support the premise. Output
 *      classes: "supported" | "partial" | "not_supported" | "uncertain".
 *      One batched call per argument (covers all that argument's premises).
 *      Flagged: any "not_supported" or "partial" verdict.
 *
 *   2. **scheme_appropriateness** (heuristic, soft)
 *      Schemes vs. premise structure. Heuristics:
 *        - `cause_to_effect` arg whose premises contain no causal/mechanism
 *          language is suspect.
 *        - `argument_from_lack_of_evidence` arg without a power/sample-size
 *          premise is suspect (the scheme's `search_adequate?` CQ).
 *        - `expert_opinion` arg whose only premise is a study finding (not
 *          an expert assertion) is suspect.
 *      Heuristic only — the human reviewer decides.
 *
 *   3. **argument_distinctness** (deterministic, soft)
 *      Within a single sub-claim, premise-set Jaccard between any two of
 *      that sub-claim's arguments. Threshold ≥ 0.6 = "near-duplicate."
 *      Flagged: any pair above threshold.
 *
 *   4. **hinge_concentration** (deterministic, soft)
 *      Hinges should carry ≥ 4 arguments each (per §6 #4). Flagged: any
 *      hinge with < 4 arguments.
 *
 *   5. **padding** (deterministic, soft)
 *      Same-source repetition: within a single sub-claim, no source should
 *      back > 60 % of that sub-claim's premises. Flagged: any source
 *      exceeding the cap.
 *
 *   6. **critique_consistency** (Advocate-B-only, manual)
 *      Heuristic too brittle to automate; emits a manual-review prompt with
 *      the list of methodological-critique arguments B filed and the list
 *      of skeptical-side studies B cites elsewhere. Reviewer eyeballs.
 *
 * The review module is async only because of (1). All other checks are
 * pure functions over the partial.
 */

import type { AnthropicClient } from "../anthropic-client";
import { extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import type { RoundLogger } from "../log/round-logger";
import type { AdvocateOutput, AdvocateArgument } from "../agents/advocate-schema";

export interface ReviewFlag {
  ruleId: string;
  severity: "info" | "warn";
  message: string;
  evidence?: unknown;
}

// Re-shape of the evidence-context source object that this module needs.
// (Kept minimal so callers can pass either the IsonomiaClient response
// directly or a mocked subset for tests.)
export interface EvidenceSourceLite {
  sourceId: string;
  citationToken: string;
  title: string | null;
  authors: string[];
  publishedAt: string | null;
  abstract: string | null;
  keyFindings: string[];
  tags: string[];
}

export interface Phase2SoftCheckOpts {
  /** Per-advocate LLM outputs (the validated AdvocateOutput, before mint). */
  advocates: { a?: AdvocateOutput; b?: AdvocateOutput };
  /** Hinge sub-claim indices computed by the phase driver. */
  hingeIndices: number[];
  /** Bound evidence corpus (token → metadata for the judge call). */
  sources: EvidenceSourceLite[];

  /**
   * Optional LLM client for the evidence-fidelity judge. If omitted, the
   * judge step is skipped (deterministic checks still run). The judge
   * always uses Haiku regardless of orchestrator tier — judge calls are
   * structured "does X support Y?" decisions, not generative work.
   */
  llm?: AnthropicClient;
  cfg?: OrchestratorConfig;
  logger?: RoundLogger;

  /** Tunables; defaults match the design notes above. */
  distinctnessThreshold?: number;     // default 0.6
  hingeMinArguments?: number;         // default 4
  paddingShareThreshold?: number;     // default 0.6
  judgeModel?: string;                // default "claude-haiku-4-5-20251001"
  judgeTimeoutMs?: number;            // default 30_000
}

export interface Phase2SoftCheckResult {
  flags: ReviewFlag[];
  judgeUsage: { calls: number; inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────────────────────────
// Top-level entry
// ─────────────────────────────────────────────────────────────────

export async function runPhase2SoftChecks(opts: Phase2SoftCheckOpts): Promise<Phase2SoftCheckResult> {
  const flags: ReviewFlag[] = [];

  for (const role of ["a", "b"] as const) {
    const out = opts.advocates[role];
    if (!out) continue;
    flags.push(...checkArgumentDistinctness(role, out, opts.distinctnessThreshold ?? 0.6));
    flags.push(...checkHingeConcentration(role, out, opts.hingeIndices, opts.hingeMinArguments ?? 4));
    flags.push(...checkPadding(role, out, opts.paddingShareThreshold ?? 0.6));
    flags.push(...checkSchemeAppropriateness(role, out));
  }

  // Critique-consistency flag is B-only, manual-review.
  if (opts.advocates.b) flags.push(...emitCritiqueConsistencyManualFlag(opts.advocates.b));

  // LLM-judge evidence fidelity (optional).
  let judgeUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  if (opts.llm && opts.cfg) {
    const sourceByToken = new Map(opts.sources.map((s) => [s.citationToken, s] as const));
    for (const role of ["a", "b"] as const) {
      const out = opts.advocates[role];
      if (!out) continue;
      const judged = await judgeEvidenceFidelity({
        role,
        out,
        sourceByToken,
        llm: opts.llm,
        cfg: opts.cfg,
        logger: opts.logger,
        judgeModel: opts.judgeModel,
        judgeTimeoutMs: opts.judgeTimeoutMs,
      });
      flags.push(...judged.flags);
      judgeUsage.calls += judged.usage.calls;
      judgeUsage.inputTokens += judged.usage.inputTokens;
      judgeUsage.outputTokens += judged.usage.outputTokens;
    }
  }

  return { flags, judgeUsage };
}

// ─────────────────────────────────────────────────────────────────
// 3. argument_distinctness
// ─────────────────────────────────────────────────────────────────

function checkArgumentDistinctness(
  role: "a" | "b",
  out: AdvocateOutput,
  threshold: number,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const bySubClaim = groupByConclusion(out);
  for (const [idx, args] of bySubClaim) {
    if (args.length < 2) continue;
    for (let i = 0; i < args.length; i++) {
      for (let j = i + 1; j < args.length; j++) {
        const a = args[i], b = args[j];
        const score = jaccard(premiseTokenSet(a), premiseTokenSet(b));
        if (score >= threshold) {
          flags.push({
            ruleId: "argument_distinctness",
            severity: "warn",
            message:
              `Advocate ${role.toUpperCase()}: arguments on sub-claim #${idx} have premise-token Jaccard ${score.toFixed(2)} ≥ ${threshold} ` +
              `(near-duplicates). Consider pruning one or differentiating their inferential routes.`,
            evidence: {
              advocate: role,
              subClaim: idx,
              argA: { schemeKey: a.schemeKey, premises: a.premises.map((p) => p.text) },
              argB: { schemeKey: b.schemeKey, premises: b.premises.map((p) => p.text) },
              jaccard: score,
            },
          });
        }
      }
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 4. hinge_concentration
// ─────────────────────────────────────────────────────────────────

function checkHingeConcentration(
  role: "a" | "b",
  out: AdvocateOutput,
  hingeIndices: number[],
  minArguments: number,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const bySubClaim = groupByConclusion(out);
  for (const h of hingeIndices) {
    const n = bySubClaim.get(h)?.length ?? 0;
    if (n < minArguments) {
      flags.push({
        ruleId: "hinge_concentration",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: hinge sub-claim #${h} has ${n} argument(s); recommended ≥ ${minArguments}. ` +
          `Phase 3 spends most rounds on hinges; under-arguing a hinge concedes ground.`,
        evidence: { advocate: role, subClaim: h, count: n, recommendedMin: minArguments },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 5. padding (same-source over-reliance per sub-claim)
// ─────────────────────────────────────────────────────────────────

function checkPadding(role: "a" | "b", out: AdvocateOutput, shareThreshold: number): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const bySubClaim = groupByConclusion(out);
  for (const [idx, args] of bySubClaim) {
    const tokenCounts = new Map<string, number>();
    let totalCited = 0;
    for (const a of args) {
      for (const p of a.premises) {
        if (!p.citationToken) continue;
        totalCited++;
        tokenCounts.set(p.citationToken, (tokenCounts.get(p.citationToken) ?? 0) + 1);
      }
    }
    if (totalCited < 3) continue; // don't flag tiny clusters
    for (const [tok, n] of tokenCounts) {
      const share = n / totalCited;
      if (share > shareThreshold) {
        flags.push({
          ruleId: "padding",
          severity: "warn",
          message:
            `Advocate ${role.toUpperCase()}: source ${tok} backs ${n}/${totalCited} cited premises (${(share * 100).toFixed(0)}%) ` +
            `on sub-claim #${idx}, exceeding the ${(shareThreshold * 100).toFixed(0)}% cap. ` +
            `Convergent independent evidence is the strongest Phase-2 case; consider diversifying sources.`,
          evidence: { advocate: role, subClaim: idx, citationToken: tok, count: n, totalCited, share },
        });
      }
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 2. scheme_appropriateness (heuristic)
// ─────────────────────────────────────────────────────────────────

const CAUSAL_LANG = /\b(cause|caused|causes|causing|causal|increase[ds]?|decrease[ds]?|leads? to|results? in|drives?|amplif|mechanism|exposure|effect)\b/i;
const POWER_LANG = /\b(powered|sample size|n\s*=\s*\d|pre-?registered|95% (CI|confidence)|effect size|null finding|did not detect)\b/i;
const EXPERT_ASSERTION_LANG = /\b(argues?|contends?|concludes?|holds?|maintains?|asserts?|recommends?|warns?)\b/i;

function checkSchemeAppropriateness(role: "a" | "b", out: AdvocateOutput): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  for (let i = 0; i < out.arguments.length; i++) {
    const arg = out.arguments[i];
    const text = arg.premises.map((p) => p.text).join(" ");
    const issues: string[] = [];

    if (arg.schemeKey === "cause_to_effect" && !CAUSAL_LANG.test(text)) {
      issues.push("`cause_to_effect` premises contain no causal/mechanism language");
    }
    if (arg.schemeKey === "argument_from_lack_of_evidence" && !POWER_LANG.test(text)) {
      issues.push(
        "`argument_from_lack_of_evidence` premises do not address search adequacy " +
          "(power, sample size, pre-registration). The scheme's `search_adequate?` CQ requires this.",
      );
    }
    if (arg.schemeKey === "expert_opinion" && !EXPERT_ASSERTION_LANG.test(text)) {
      issues.push(
        "`expert_opinion` premises do not contain expert-assertion language " +
          "(argues, contends, concludes, recommends). Looks like a study citation, not an expert claim.",
      );
    }

    for (const issue of issues) {
      flags.push({
        ruleId: "scheme_appropriateness",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: argument #${i} (sub-claim #${arg.conclusionClaimIndex}, scheme=${arg.schemeKey}): ${issue}.`,
        evidence: {
          advocate: role,
          inputIndex: i,
          subClaim: arg.conclusionClaimIndex,
          schemeKey: arg.schemeKey,
          premises: arg.premises.map((p) => p.text),
        },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 6. critique_consistency (B-only, manual prompt)
// ─────────────────────────────────────────────────────────────────

function emitCritiqueConsistencyManualFlag(b: AdvocateOutput): ReviewFlag[] {
  const critiques = b.arguments
    .map((a, i) => ({ i, a }))
    .filter(({ a }) => a.schemeKey === "methodological_critique");
  const skepticalCitations = new Set<string>();
  for (const a of b.arguments) {
    if (a.schemeKey === "methodological_critique") continue;
    for (const p of a.premises) if (p.citationToken) skepticalCitations.add(p.citationToken);
  }
  if (critiques.length === 0) return [];
  return [{
    ruleId: "critique_consistency",
    severity: "info",
    message:
      `Advocate B filed ${critiques.length} methodological_critique argument(s). Manual check: ` +
      `do any of the skeptical-side studies B cites elsewhere have the same defect(s) raised here? ` +
      `Asymmetric critique application is a common skeptical-position weakness.`,
    evidence: {
      methodologicalCritiques: critiques.map(({ i, a }) => ({
        inputIndex: i,
        subClaim: a.conclusionClaimIndex,
        premises: a.premises.map((p) => p.text),
      })),
      skepticalSideCitations: [...skepticalCitations].sort(),
    },
  }];
}

// ─────────────────────────────────────────────────────────────────
// 1. evidence_fidelity (LLM-judge)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_JUDGE_MODEL = "claude-haiku-4-5-20251001";

// Exported so the R blind-spot experiment (experiments/R-blind-spot/) can run
// this EXACT judgment-laden confirm prompt verbatim across model families —
// re-declaring it there would risk silent drift and void the "verbatim
// production check prompt" invariant.
export const JUDGE_SYSTEM = `You are an evidence-fidelity reviewer for a structured deliberation experiment.

For each (premise, cited source) pair you receive, judge whether the source's abstract and key findings ACTUALLY support the premise as stated. You are not judging whether the premise is true in the world — only whether the cited source supports it.

Verdict classes:
- "supported": the source's abstract or key findings clearly support the premise as stated.
- "partial": the source supports a weaker version of the premise, or supports a related but distinct claim. The premise overstates or distorts what the source says.
- "not_supported": the source does not support the premise. The citation is mischaracterized.
- "uncertain": the abstract is too thin to judge (e.g. abstract is null or 1-2 sentences with no findings). Do NOT use this to avoid hard calls; use it only when the source data is genuinely insufficient.

Output ONLY a JSON object of shape:
{ "verdicts": [ { "premiseIndex": <int>, "verdict": "<class>", "justification": "<one sentence>" }, ... ] }
No prose before or after. premiseIndex is 0-based and matches the order in the input.`;

interface JudgeOpts {
  role: "a" | "b";
  out: AdvocateOutput;
  sourceByToken: Map<string, EvidenceSourceLite>;
  llm: AnthropicClient;
  cfg: OrchestratorConfig;
  logger?: RoundLogger;
  judgeModel?: string;
  judgeTimeoutMs?: number;
}

interface JudgeBatchResult {
  flags: ReviewFlag[];
  usage: { calls: number; inputTokens: number; outputTokens: number };
}

async function judgeEvidenceFidelity(opts: JudgeOpts): Promise<JudgeBatchResult> {
  const flags: ReviewFlag[] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const judgeModel = opts.judgeModel ?? DEFAULT_JUDGE_MODEL;

  for (let i = 0; i < opts.out.arguments.length; i++) {
    const arg = opts.out.arguments[i];

    // Build the (premise → source) pairs for this argument.
    type Pair = {
      premiseIndex: number;
      premiseText: string;
      citationToken: string;
      source: EvidenceSourceLite;
    };
    const pairs: Pair[] = [];
    for (let p = 0; p < arg.premises.length; p++) {
      const tok = arg.premises[p].citationToken;
      if (!tok) continue;
      const src = opts.sourceByToken.get(tok);
      if (!src) continue; // already enforced upstream, but defensive
      pairs.push({ premiseIndex: p, premiseText: arg.premises[p].text, citationToken: tok, source: src });
    }
    if (pairs.length === 0) continue;

    const userMessage = renderJudgePrompt(opts.role, i, arg, pairs);

    const res = await opts.llm.chat({
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      model: judgeModel,
      temperature: 0,
      maxTokens: 1500,
      logger: opts.logger,
      agentRole: `phase-2-judge-${opts.role}`,
    });
    usage.calls++;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;

    let parsed: any;
    try {
      parsed = extractJson(res.text);
    } catch (err) {
      flags.push({
        ruleId: "evidence_fidelity:judge-parse-failure",
        severity: "warn",
        message:
          `Advocate ${opts.role.toUpperCase()}: judge call for argument #${i} (sub-claim #${arg.conclusionClaimIndex}) ` +
          `produced unparseable JSON. Manual review required.`,
        evidence: { advocate: opts.role, inputIndex: i, error: (err as Error).message, rawResponse: res.text.slice(0, 500) },
      });
      continue;
    }

    const verdicts: Array<{ premiseIndex?: number; verdict?: string; justification?: string }> =
      Array.isArray(parsed?.verdicts) ? parsed.verdicts : [];

    for (const v of verdicts) {
      const verdict = String(v.verdict ?? "").toLowerCase();
      if (verdict === "supported") continue; // no flag

      const pair = pairs.find((pp) => pp.premiseIndex === v.premiseIndex);
      if (!pair) continue;

      // partial / not_supported / uncertain → flag (severity scales).
      const sev: "warn" | "info" = verdict === "supported" ? "info" : "warn";

      flags.push({
        ruleId: `evidence_fidelity:${verdict || "unknown"}`,
        severity: sev,
        message:
          `Advocate ${opts.role.toUpperCase()}: argument #${i} (sub-claim #${arg.conclusionClaimIndex}), premise #${pair.premiseIndex}: ` +
          `judge verdict "${verdict}". ${v.justification ?? ""}`.trim(),
        evidence: {
          advocate: opts.role,
          inputIndex: i,
          subClaim: arg.conclusionClaimIndex,
          schemeKey: arg.schemeKey,
          premiseIndex: pair.premiseIndex,
          premiseText: pair.premiseText,
          citationToken: pair.citationToken,
          sourceTitle: pair.source.title,
          sourceAbstract: pair.source.abstract,
          judgeVerdict: verdict,
          judgeJustification: v.justification ?? null,
        },
      });
    }
  }

  return { flags, usage };
}

function renderJudgePrompt(
  role: "a" | "b",
  inputIndex: number,
  arg: AdvocateArgument,
  pairs: Array<{ premiseIndex: number; premiseText: string; citationToken: string; source: EvidenceSourceLite }>,
): string {
  const lines: string[] = [];
  lines.push(`Advocate ${role.toUpperCase()} — argument #${inputIndex} on sub-claim #${arg.conclusionClaimIndex}, scheme \`${arg.schemeKey}\`.`);
  lines.push(``);
  lines.push(`For each (premise, source) pair below, classify the source's support per the system prompt.`);
  lines.push(``);
  for (const p of pairs) {
    lines.push(`### Premise ${p.premiseIndex}`);
    lines.push(`Text: "${p.premiseText}"`);
    lines.push(``);
    lines.push(`Cited source (${p.citationToken}):`);
    const yr = p.source.publishedAt ? p.source.publishedAt.slice(0, 4) : "n.d.";
    const authors = p.source.authors.length
      ? p.source.authors.length > 3
        ? `${p.source.authors[0]} et al.`
        : p.source.authors.join(", ")
      : "Anonymous";
    lines.push(`  ${authors} (${yr}). ${p.source.title ?? "(untitled)"}`);
    if (p.source.abstract) {
      lines.push(`  abstract: ${p.source.abstract.trim().replace(/\s+/g, " ")}`);
    } else {
      lines.push(`  abstract: (none on record)`);
    }
    if (p.source.keyFindings.length) {
      lines.push(`  key findings:`);
      for (const f of p.source.keyFindings) lines.push(`    - ${f.trim().replace(/\s+/g, " ")}`);
    }
    lines.push(``);
  }
  lines.push(`Emit a single JSON object: { "verdicts": [...] }. One entry per premise above.`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function groupByConclusion(out: AdvocateOutput): Map<number, AdvocateArgument[]> {
  const m = new Map<number, AdvocateArgument[]>();
  for (const a of out.arguments) {
    if (!m.has(a.conclusionClaimIndex)) m.set(a.conclusionClaimIndex, []);
    m.get(a.conclusionClaimIndex)!.push(a);
  }
  return m;
}

const STOP = new Set([
  "with", "from", "have", "this", "that", "these", "those", "their", "them",
  "they", "between", "within", "across", "about", "would", "could", "should",
  "into", "such", "than", "more", "most", "very", "been", "were",
  "will", "shall", "does", "doing", "done", "your", "yours", "ours", "also",
  "where", "which", "while", "when", "what", "whom", "whose", "after", "before",
  "study", "studies", "data", "result", "results", "find", "found", "show",
  "shows", "showed", "report", "reports", "reported",
]);

function premiseTokenSet(arg: AdvocateArgument): Set<string> {
  const all = arg.premises.map((p) => p.text).join(" ");
  return new Set(
    all
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

