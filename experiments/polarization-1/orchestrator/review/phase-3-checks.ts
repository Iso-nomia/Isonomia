/**
 * orchestrator/review/phase-3-checks.ts
 *
 * Soft-track validation for Phase 3 (Dialectical Testing). Mirrors the
 * Phase-2 pattern: emit `ReviewFlag` rows; the human reviewer resolves
 * them in `runtime/reviews/phase-3-review.md`. None of these checks abort
 * the round.
 *
 * Phase-3 has its own checks (attack-targeting, scheme-cq-validity,
 * mutual-rebut detection, hinge-attack-concentration), reuses the
 * evidence_fidelity LLM-judge from Phase 2 against rebuttal premises,
 * and ports the per-rebuttal scheme_appropriateness heuristic.
 *
 * 1. **attack_targeting** (deterministic, soft)
 *    Validation that targeting is structurally consistent with the
 *    declared attackType. The Zod layer already enforces shape
 *    (UNDERMINE → premise index in range; REBUT/UNDERCUT → null index)
 *    and the translator runs the canonical guard at materialization
 *    time, so this check is largely belt-and-braces. Flagged: any
 *    deviation that slipped through (defensive — should be empty).
 *
 * 2. **scheme_cq_validity** (deterministic, soft)
 *    Every (rebuttal.cqKey, target.schemeKey) pair the rebuttal carries
 *    must be a valid CQ on the target's scheme. The Zod schema already
 *    enforces this; the soft check exists to surface the rare case where
 *    the catalog at translation time differs from the catalog at validation
 *    time (drift between phases).
 *
 * 3. **mutual_rebut** (deterministic, info)
 *    Detects (advocate-A rebuttal X attacks B-arg Y) AND (advocate-B
 *    rebuttal Y' attacks A-arg X-source) where X-source and Y' have very
 *    similar conclusions — i.e. both sides are mutually rebutting on the
 *    same hinge with the same factual disagreement. This is normal and
 *    valuable; the check just emits an info-level flag so the human
 *    reviewer notices the contested point. Similarity = string Jaccard
 *    over conclusion tokens, threshold ≥ 0.5.
 *
 * 4. **hinge_attack_concentration** (deterministic, soft)
 *    The strongest dialectical move is to attack opponent's hinge args.
 *    Flagged: an advocate filed > 0 rebuttals total but ≤ 25% of them
 *    target hinge arguments. Wasting attack budget on peripheral
 *    arguments is dialectical malpractice.
 *
 * 5. **scheme_appropriateness** (heuristic, soft)
 *    Same heuristics as Phase 2 applied to rebuttal premises.
 *
 * 6. **evidence_fidelity** (LLM-judge, soft)
 *    Same Haiku judge call as Phase 2, applied to (rebuttal-premise,
 *    cited-source) pairs. One batched call per rebuttal.
 *
 * Symmetric: every check runs on both advocates' outputs.
 */

import type { AnthropicClient } from "../anthropic-client";
import { extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import type { RoundLogger } from "../log/round-logger";
import type { RebuttalOutput, RebuttalArgument } from "../agents/rebuttal-schema";
import type { ReviewFlag, EvidenceSourceLite } from "./phase-2-checks";

export type { ReviewFlag, EvidenceSourceLite };

/** Role keys for soft-check iteration. Round 1 uses {"a","b"}; Iter-3
 *  round 2 adds "methodologist" as a third actor. */
export type SoftCheckRole = "a" | "b" | "methodologist";

export interface OpposingArgumentMeta {
  argumentId: string;
  /** Sub-claim index this argument concludes to. */
  conclusionClaimIndex: number;
  /** Conclusion text (used for mutual-rebut detection). */
  conclusionText: string;
  schemeKey: string;
}

export interface Phase3SoftCheckOpts {
  /**
   * Per-advocate rebuttal outputs. Same keying as Phase 2: "a" → A's
   * Phase-3 output, "b" → B's Phase-3 output. Either may be undefined
   * if that advocate refused or errored.
   */
  rebuttals: { a?: RebuttalOutput; b?: RebuttalOutput };

  /**
   * The OPPONENT arguments seen by each advocate, keyed by argumentId.
   * advocateA targets B-arguments, so `opponentByAdvocate.a` carries B's
   * arguments and vice versa. Used for hinge-targeting + mutual-rebut +
   * judge prompt context.
   */
  opponentByAdvocate: {
    a: ReadonlyMap<string, OpposingArgumentMeta>; // B's args, keyed
    b: ReadonlyMap<string, OpposingArgumentMeta>; // A's args, keyed
  };

  hingeIndices: number[];

  /** Same shape as Phase 2 — used by the LLM judge. */
  sources: EvidenceSourceLite[];

  /** Optional LLM client for the evidence-fidelity judge. */
  llm?: AnthropicClient;
  cfg?: OrchestratorConfig;
  logger?: RoundLogger;

  /** Tunables. */
  hingeAttackShareMin?: number; // default 0.25
  mutualRebutSimilarityThreshold?: number; // default 0.5
  judgeModel?: string;
  judgeTimeoutMs?: number;
}

export interface Phase3SoftCheckResult {
  flags: ReviewFlag[];
  judgeUsage: { calls: number; inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────────────────────────
// Top-level entry
// ─────────────────────────────────────────────────────────────────

export async function runPhase3SoftChecks(opts: Phase3SoftCheckOpts): Promise<Phase3SoftCheckResult> {
  const flags: ReviewFlag[] = [];

  for (const role of ["a", "b"] as const) {
    const out = opts.rebuttals[role];
    if (!out) continue;
    const opponent = role === "a" ? opts.opponentByAdvocate.a : opts.opponentByAdvocate.b;
    flags.push(...checkAttackTargeting(role, out, opponent));
    flags.push(...checkSchemeCqValidity(role, out, opponent));
    flags.push(
      ...checkHingeAttackConcentration(
        role,
        out,
        opponent,
        opts.hingeIndices,
        opts.hingeAttackShareMin ?? 0.25,
      ),
    );
    flags.push(...checkRebuttalSchemeAppropriateness(role, out));
  }

  // Mutual-rebut runs across both advocates simultaneously.
  if (opts.rebuttals.a && opts.rebuttals.b) {
    flags.push(
      ...checkMutualRebut(
        opts.rebuttals.a,
        opts.rebuttals.b,
        opts.opponentByAdvocate.a,
        opts.opponentByAdvocate.b,
        opts.mutualRebutSimilarityThreshold ?? 0.5,
      ),
    );
  }

  // LLM-judge evidence fidelity.
  let judgeUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  if (opts.llm && opts.cfg) {
    const sourceByToken = new Map(opts.sources.map((s) => [s.citationToken, s] as const));
    for (const role of ["a", "b"] as const) {
      const out = opts.rebuttals[role];
      if (!out) continue;
      const judged = await judgeRebuttalEvidenceFidelity({
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
// Iter-3 round-2 entry
// ─────────────────────────────────────────────────────────────────

/**
 * Iter-3 round-2 soft-check options. Round 2 has THREE actors (A, B,
 * methodologist) and a wider opponent set per actor (Phase-2 args ∪
 * round-1 rebuttals filed against own args). We deliberately SKIP two
 * round-1 checks here:
 *
 *   - `mutual_rebut`: round-2 attacks frequently target round-1 rebuttals,
 *     not the symmetric a-vs-b Phase-2 args; the same-hinge factual-
 *     disagreement semantics don't apply cleanly.
 *   - `hinge_attack_concentration`: targets are a mix of Phase-2 args
 *     (with conclusionClaimIndex) and round-1 rebuttals (free-form
 *     conclusions — `conclusionClaimIndex` is a sentinel `-1`); the
 *     hinge-share denominator is no longer meaningful.
 *
 * The remaining checks (`attack_targeting`, `scheme_cq_validity`,
 * `scheme_appropriateness`, `evidence_fidelity`) all run per-actor.
 *
 * Methodologist outputs are structurally compatible with `RebuttalOutput`
 * (rebuttals[] + cqResponses[] with the same field names the checks
 * read); call sites cast at the boundary.
 */
export interface Phase3Round2SoftCheckOpts {
  /** Per-actor round-2 outputs. Any may be undefined (refusal/error). */
  outputs: {
    a?: RebuttalOutput;
    b?: RebuttalOutput;
    methodologist?: RebuttalOutput;
  };

  /**
   * Per-actor opponent maps. For each actor, the keys are every
   * `argumentId` that the actor was permitted to target in round 2:
   * opponent's Phase-2 args + round-1 rebuttals filed against own args
   * (methodologist sees BOTH sides' Phase-2 args + ALL round-1
   * rebuttals). Round-1 rebuttal entries should set
   * `conclusionClaimIndex = -1` (they don't sit at a hinge sub-claim).
   */
  opponentByActor: {
    a: ReadonlyMap<string, OpposingArgumentMeta>;
    b: ReadonlyMap<string, OpposingArgumentMeta>;
    methodologist: ReadonlyMap<string, OpposingArgumentMeta>;
  };

  /** Same shape as Phase 2 — used by the LLM judge. */
  sources: EvidenceSourceLite[];

  llm?: AnthropicClient;
  cfg?: OrchestratorConfig;
  logger?: RoundLogger;
  judgeModel?: string;
  judgeTimeoutMs?: number;
}

export async function runPhase3Round2SoftChecks(
  opts: Phase3Round2SoftCheckOpts,
): Promise<Phase3SoftCheckResult> {
  const flags: ReviewFlag[] = [];
  const judgeUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };

  const roles: SoftCheckRole[] = ["a", "b", "methodologist"];
  const sourceByToken = opts.llm && opts.cfg
    ? new Map(opts.sources.map((s) => [s.citationToken, s] as const))
    : null;

  for (const role of roles) {
    const out = opts.outputs[role];
    if (!out) continue;
    const opponent = opts.opponentByActor[role];
    flags.push(...checkAttackTargeting(role, out, opponent));
    flags.push(...checkSchemeCqValidity(role, out, opponent));
    flags.push(...checkRebuttalSchemeAppropriateness(role, out));

    if (sourceByToken && opts.llm && opts.cfg) {
      const judged = await judgeRebuttalEvidenceFidelity({
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
// 1. attack_targeting (defensive)
// ─────────────────────────────────────────────────────────────────

function checkAttackTargeting(
  role: SoftCheckRole,
  out: RebuttalOutput,
  opponent: ReadonlyMap<string, OpposingArgumentMeta>,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  for (let i = 0; i < out.rebuttals.length; i++) {
    const r = out.rebuttals[i];
    const target = opponent.get(r.targetArgumentId);
    if (!target) {
      flags.push({
        ruleId: "attack_targeting:unknown-target",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: rebuttal #${i} targets argumentId=${r.targetArgumentId}, ` +
          `which is not in the opponent set. (Should have been caught at Zod layer.)`,
        evidence: { advocate: role, inputIndex: i, targetArgumentId: r.targetArgumentId },
      });
      continue;
    }
    if (r.attackType === "UNDERMINE") {
      if (r.targetPremiseIndex === null) {
        flags.push({
          ruleId: "attack_targeting:undermine-missing-index",
          severity: "warn",
          message:
            `Advocate ${role.toUpperCase()}: rebuttal #${i} declares UNDERMINE but targetPremiseIndex is null.`,
          evidence: { advocate: role, inputIndex: i },
        });
      }
    } else if (r.targetPremiseIndex !== null) {
      flags.push({
        ruleId: "attack_targeting:nonundermine-has-index",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: rebuttal #${i} declares ${r.attackType} but targetPremiseIndex=${r.targetPremiseIndex} (should be null).`,
        evidence: { advocate: role, inputIndex: i, attackType: r.attackType },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 2. scheme_cq_validity
// ─────────────────────────────────────────────────────────────────

function checkSchemeCqValidity(
  role: SoftCheckRole,
  out: RebuttalOutput,
  opponent: ReadonlyMap<string, OpposingArgumentMeta>,
): ReviewFlag[] {
  // The Zod schema already enforces this against the cqKeysByScheme map
  // passed in at validation time. This soft check just surfaces drift
  // between catalog snapshots — useful for prod debugging.
  const flags: ReviewFlag[] = [];
  for (let i = 0; i < out.cqResponses.length; i++) {
    const c = out.cqResponses[i];
    const target = opponent.get(c.targetArgumentId);
    if (!target) {
      flags.push({
        ruleId: "scheme_cq_validity:unknown-target",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: cqResponse #${i} targets argumentId=${c.targetArgumentId}, ` +
          `not in the opponent set.`,
        evidence: { advocate: role, inputIndex: i, targetArgumentId: c.targetArgumentId },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 3. mutual_rebut (info)
// ─────────────────────────────────────────────────────────────────

function checkMutualRebut(
  aOut: RebuttalOutput,
  bOut: RebuttalOutput,
  bArgsByA: ReadonlyMap<string, OpposingArgumentMeta>, // A sees B's args
  aArgsByB: ReadonlyMap<string, OpposingArgumentMeta>, // B sees A's args
  similarityThreshold: number,
): ReviewFlag[] {
  // Build (A-arg conclusion text, B-arg conclusion text) pairs where:
  //   - some A-rebuttal targets B-arg X  AND  some B-rebuttal targets A-arg Y
  //   - A's rebuttal-conclusion ≈ Y's actual conclusion (same factual claim)
  //   - B's rebuttal-conclusion ≈ X's actual conclusion (same factual claim)
  // ...meaning both sides are arguing the same disagreement on this hinge.
  const flags: ReviewFlag[] = [];

  // Index B's rebuttals by which A-arg they target (B is attacker; targets are A's args).
  const bAttacksOnAArg = new Map<string, RebuttalArgument[]>();
  for (const r of bOut.rebuttals) {
    const arr = bAttacksOnAArg.get(r.targetArgumentId) ?? [];
    arr.push(r);
    bAttacksOnAArg.set(r.targetArgumentId, arr);
  }

  for (const aRebuttal of aOut.rebuttals) {
    const targetB = bArgsByA.get(aRebuttal.targetArgumentId);
    if (!targetB) continue;
    // For each B-rebuttal, check whether the conclusions cross-match.
    for (const [aArgId, bRebuttals] of bAttacksOnAArg) {
      const targetA = aArgsByB.get(aArgId);
      if (!targetA) continue;
      // Sub-claim must match (mutual-rebut is a per-hinge phenomenon).
      if (targetA.conclusionClaimIndex !== targetB.conclusionClaimIndex) continue;

      for (const bRebuttal of bRebuttals) {
        const aRebSim = jaccardWords(aRebuttal.conclusionText, targetA.conclusionText);
        const bRebSim = jaccardWords(bRebuttal.conclusionText, targetB.conclusionText);
        if (aRebSim >= similarityThreshold && bRebSim >= similarityThreshold) {
          flags.push({
            ruleId: "mutual_rebut",
            severity: "info",
            message:
              `Mutual rebuttal on sub-claim #${targetA.conclusionClaimIndex}: A rebuts B-arg ` +
              `"${truncate(targetB.conclusionText, 100)}" and B rebuts A-arg ` +
              `"${truncate(targetA.conclusionText, 100)}". Both sides are arguing the same ` +
              `factual disagreement; this is the contested point on this hinge.`,
            evidence: {
              subClaim: targetA.conclusionClaimIndex,
              aRebuts: { targetArgumentId: aRebuttal.targetArgumentId, conclusion: aRebuttal.conclusionText },
              bRebuts: { targetArgumentId: bRebuttal.targetArgumentId, conclusion: bRebuttal.conclusionText },
              aRebuttalSimilarity: aRebSim,
              bRebuttalSimilarity: bRebSim,
            },
          });
        }
      }
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 4. hinge_attack_concentration
// ─────────────────────────────────────────────────────────────────

function checkHingeAttackConcentration(
  role: "a" | "b",
  out: RebuttalOutput,
  opponent: ReadonlyMap<string, OpposingArgumentMeta>,
  hingeIndices: number[],
  shareMin: number,
): ReviewFlag[] {
  if (out.rebuttals.length === 0) return [];
  const hingeSet = new Set(hingeIndices);
  let onHinge = 0;
  for (const r of out.rebuttals) {
    const target = opponent.get(r.targetArgumentId);
    if (target && hingeSet.has(target.conclusionClaimIndex)) onHinge++;
  }
  const share = onHinge / out.rebuttals.length;
  if (share >= shareMin) return [];
  return [{
    ruleId: "hinge_attack_concentration",
    severity: "warn",
    message:
      `Advocate ${role.toUpperCase()}: only ${onHinge}/${out.rebuttals.length} rebuttals (${(share * 100).toFixed(0)}%) ` +
      `target hinge arguments; recommended ≥ ${(shareMin * 100).toFixed(0)}%. Phase 3 attack budget should ` +
      `concentrate on opponent's hinges; peripheral attacks are low-leverage.`,
    evidence: { advocate: role, totalRebuttals: out.rebuttals.length, onHinge, hingeIndices },
  }];
}

// ─────────────────────────────────────────────────────────────────
// 5. scheme_appropriateness (heuristic)
// ─────────────────────────────────────────────────────────────────

const CAUSAL_LANG = /\b(cause|caused|causes|causing|causal|increase[ds]?|decrease[ds]?|leads? to|results? in|drives?|amplif|mechanism|exposure|effect)\b/i;
const POWER_LANG = /\b(powered|sample size|n\s*=\s*\d|pre-?registered|95% (CI|confidence)|effect size|null finding|did not detect)\b/i;
const EXPERT_ASSERTION_LANG = /\b(argues?|contends?|concludes?|holds?|maintains?|asserts?|recommends?|warns?)\b/i;

function checkRebuttalSchemeAppropriateness(role: SoftCheckRole, out: RebuttalOutput): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  for (let i = 0; i < out.rebuttals.length; i++) {
    const r = out.rebuttals[i];
    const text = r.premises.map((p) => p.text).join(" ");
    const issues: string[] = [];
    if (r.schemeKey === "cause_to_effect" && !CAUSAL_LANG.test(text)) {
      issues.push("`cause_to_effect` premises contain no causal/mechanism language");
    }
    if (r.schemeKey === "argument_from_lack_of_evidence" && !POWER_LANG.test(text)) {
      issues.push(
        "`argument_from_lack_of_evidence` premises do not address search adequacy " +
          "(power, sample size, pre-registration). The scheme's `search_adequate?` CQ requires this.",
      );
    }
    if (r.schemeKey === "expert_opinion" && !EXPERT_ASSERTION_LANG.test(text)) {
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
          `Advocate ${role.toUpperCase()}: rebuttal #${i} (${r.attackType} → ${r.targetArgumentId}, scheme=${r.schemeKey}): ${issue}.`,
        evidence: {
          advocate: role,
          inputIndex: i,
          attackType: r.attackType,
          schemeKey: r.schemeKey,
          premises: r.premises.map((p) => p.text),
        },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 6. evidence_fidelity (LLM-judge — same prompt as Phase 2)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_JUDGE_MODEL = "claude-haiku-4-5-20251001";

const JUDGE_SYSTEM = `You are an evidence-fidelity reviewer for a structured deliberation experiment.

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
  role: SoftCheckRole;
  out: RebuttalOutput;
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

async function judgeRebuttalEvidenceFidelity(opts: JudgeOpts): Promise<JudgeBatchResult> {
  const flags: ReviewFlag[] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const judgeModel = opts.judgeModel ?? DEFAULT_JUDGE_MODEL;

  for (let i = 0; i < opts.out.rebuttals.length; i++) {
    const r = opts.out.rebuttals[i];
    type Pair = {
      premiseIndex: number;
      premiseText: string;
      citationToken: string;
      source: EvidenceSourceLite;
    };
    const pairs: Pair[] = [];
    for (let p = 0; p < r.premises.length; p++) {
      const tok = r.premises[p].citationToken;
      if (!tok) continue;
      const src = opts.sourceByToken.get(tok);
      if (!src) continue;
      pairs.push({ premiseIndex: p, premiseText: r.premises[p].text, citationToken: tok, source: src });
    }
    if (pairs.length === 0) continue;

    const userMessage = renderJudgePrompt(opts.role, i, r, pairs);

    const res = await opts.llm.chat({
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      model: judgeModel,
      temperature: 0,
      maxTokens: 1500,
      logger: opts.logger,
      agentRole: `phase-3-judge-${opts.role}`,
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
          `Advocate ${opts.role.toUpperCase()}: judge call for rebuttal #${i} (${r.attackType} → ${r.targetArgumentId}) ` +
          `produced unparseable JSON. Manual review required.`,
        evidence: { advocate: opts.role, inputIndex: i, error: (err as Error).message, rawResponse: res.text.slice(0, 500) },
      });
      continue;
    }

    const verdicts: Array<{ premiseIndex?: number; verdict?: string; justification?: string }> =
      Array.isArray(parsed?.verdicts) ? parsed.verdicts : [];

    for (const v of verdicts) {
      const verdict = String(v.verdict ?? "").toLowerCase();
      if (verdict === "supported") continue;
      const pair = pairs.find((pp) => pp.premiseIndex === v.premiseIndex);
      if (!pair) continue;
      const sev: "warn" | "info" = "warn";
      flags.push({
        ruleId: `evidence_fidelity:${verdict || "unknown"}`,
        severity: sev,
        message:
          `Advocate ${opts.role.toUpperCase()}: rebuttal #${i} (${r.attackType} → ${r.targetArgumentId}), premise #${pair.premiseIndex}: ` +
          `judge verdict "${verdict}". ${v.justification ?? ""}`.trim(),
        evidence: {
          advocate: opts.role,
          inputIndex: i,
          premiseIndex: pair.premiseIndex,
          attackType: r.attackType,
          targetArgumentId: r.targetArgumentId,
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
  role: SoftCheckRole,
  rebuttalIndex: number,
  r: RebuttalArgument,
  pairs: Array<{ premiseIndex: number; premiseText: string; citationToken: string; source: EvidenceSourceLite }>,
): string {
  const lines: string[] = [];
  lines.push(`Advocate ${role.toUpperCase()}, Phase-3 rebuttal #${rebuttalIndex} (${r.attackType} → target argument ${r.targetArgumentId}, scheme=${r.schemeKey}).`);
  lines.push(`Rebuttal conclusion: "${r.conclusionText}"`);
  lines.push(``);
  lines.push(`Judge each (premise, cited source) pair below.`);
  lines.push(``);
  for (const pair of pairs) {
    const src = pair.source;
    lines.push(`---`);
    lines.push(`premiseIndex: ${pair.premiseIndex}`);
    lines.push(`premise: "${pair.premiseText}"`);
    lines.push(`source (${pair.citationToken}):`);
    if (src.title) lines.push(`  title: ${src.title}`);
    if (src.authors.length) lines.push(`  authors: ${src.authors.join(", ")}`);
    if (src.publishedAt) lines.push(`  publishedAt: ${src.publishedAt}`);
    if (src.abstract) lines.push(`  abstract: ${src.abstract}`);
    if (src.keyFindings.length) {
      lines.push(`  key findings:`);
      for (const f of src.keyFindings) lines.push(`    - ${f}`);
    }
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "is", "are", "be",
  "by", "with", "that", "this", "it", "as", "at", "from", "but", "not", "no",
  "than", "more", "less", "which", "their", "its", "have", "has", "had", "also",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

function jaccardWords(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}
