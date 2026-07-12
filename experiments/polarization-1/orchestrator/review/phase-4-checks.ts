/**
 * orchestrator/review/phase-4-checks.ts
 *
 * Soft-track validation for Phase 4 (Concessions & Defenses). Same
 * shape as phase-2/3-checks: emit `ReviewFlag` rows; never abort.
 *
 * Checks:
 *
 * 1. **defense_targeting** (deterministic, defensive)
 *    Per-response shape sanity (kind ↔ defense/narrowedConclusionText
 *    consistency, UNDERMINE.targetPremiseIndex bounded). Already enforced
 *    at the Zod layer; flagged only on drift.
 *
 * 2. **defense_coverage** (deterministic, soft)
 *    Every opposing rebuttal MUST be answered exactly once and every
 *    opposing CQ raise MUST be answered exactly once. Zod enforces this
 *    when the schema is built with the binding maps; this surfaces drift
 *    between the binding catalog and the Phase-4 output.
 *
 * 3. **hinge_defense_concentration** (deterministic, soft)
 *    Of all opposing rebuttals against this advocate's hinge args, at
 *    least N% must be DEFENDED (vs conceded/narrowed). Conceding hinges
 *    is fine occasionally but blanket concession on hinges = collapse.
 *    Default min defend-rate on hinge attacks: 50%.
 *
 * 4. **concession_discrimination** (heuristic, info)
 *    Compares concede rates across attacks: if an advocate concedes ≥ 80%
 *    of attacks regardless of attack quality, that's likely indiscriminate
 *    surrender (or genuine collapse — the human must judge). If concede
 *    rate is ≤ 5% on hinges with high-fidelity opposing evidence, that's
 *    likely stubbornness. Both surface as info flags for human review.
 *
 * 5. **defense_engagement** (LLM-judge, soft)
 *    For each `defend` response, judge whether the defense argument
 *    actually addresses the rebuttal's logic (vs deflecting, restating
 *    the original premise, or attacking a strawman of the rebuttal).
 *    One Haiku call per defended response.
 *
 * 6. **evidence_fidelity** (LLM-judge, soft)
 *    Same Haiku judge as Phase 2/3 applied to defense premises with
 *    citations. One batched call per defense argument.
 *
 * Symmetric: every check runs on both advocates' outputs.
 */

import type { AnthropicClient } from "../anthropic-client";
import { extractJson } from "../anthropic-client";
import type { OrchestratorConfig } from "../config";
import type { RoundLogger } from "../log/round-logger";
import type {
  DefenseOutput,
  DefenseResponse,
  DefenseArgument,
} from "../agents/defense-schema";
import type { ReviewFlag, EvidenceSourceLite } from "./phase-2-checks";

export type { ReviewFlag, EvidenceSourceLite };

/** Compact info about one opposing rebuttal (the attack this advocate is defending against). */
export interface OpposingRebuttalMeta {
  rebuttalArgumentId: string;
  /** The advocate's OWN argumentId being attacked. */
  targetArgumentId: string;
  /** Sub-claim index of the targeted own argument. */
  targetConclusionClaimIndex: number;
  rebuttalAttackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  rebuttalPremiseCount: number;
  rebuttalConclusionText: string;
  /** Premises of the OPPOSING rebuttal — used in judge prompts. */
  rebuttalPremiseTexts: string[];
  rebuttalPremiseCitationTokens: Array<string | null>;
  cqKey: string | null;
}

export interface OpposingCqRaiseMeta {
  cqResponseId: string;
  targetArgumentId: string;
  targetConclusionClaimIndex: number;
  cqKey: string;
  rationale: string;
}

export interface Phase4SoftCheckOpts {
  defenses: { a?: DefenseOutput; b?: DefenseOutput };

  /**
   * Opposing rebuttals indexed by `rebuttalArgumentId`. Per advocate:
   *   `opposingRebuttalsByAdvocate.a` = B's rebuttals against A's args.
   */
  opposingRebuttalsByAdvocate: {
    a: ReadonlyMap<string, OpposingRebuttalMeta>;
    b: ReadonlyMap<string, OpposingRebuttalMeta>;
  };

  /** Opposing CQ raises indexed by synthesized `cqResponseId`. */
  opposingCqRaisesByAdvocate: {
    a: ReadonlyMap<string, OpposingCqRaiseMeta>;
    b: ReadonlyMap<string, OpposingCqRaiseMeta>;
  };

  hingeIndices: number[];

  sources: EvidenceSourceLite[];

  llm?: AnthropicClient;
  cfg?: OrchestratorConfig;
  logger?: RoundLogger;

  /** Tunables. */
  hingeDefendRateMin?: number; // default 0.5
  blanketConcedeRateMin?: number; // default 0.8
  judgeModel?: string;
  judgeTimeoutMs?: number;
}

export interface Phase4SoftCheckResult {
  flags: ReviewFlag[];
  judgeUsage: { calls: number; inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────────────────────────
// Top-level entry
// ─────────────────────────────────────────────────────────────────

export async function runPhase4SoftChecks(opts: Phase4SoftCheckOpts): Promise<Phase4SoftCheckResult> {
  const flags: ReviewFlag[] = [];
  const hingeSet = new Set(opts.hingeIndices);
  const hingeDefendRateMin = opts.hingeDefendRateMin ?? 0.5;
  const blanketConcedeRateMin = opts.blanketConcedeRateMin ?? 0.8;

  for (const role of ["a", "b"] as const) {
    const out = opts.defenses[role];
    if (!out) continue;
    const oppReb = role === "a" ? opts.opposingRebuttalsByAdvocate.a : opts.opposingRebuttalsByAdvocate.b;
    const oppCq = role === "a" ? opts.opposingCqRaisesByAdvocate.a : opts.opposingCqRaisesByAdvocate.b;
    flags.push(...checkDefenseTargeting(role, out, oppReb));
    flags.push(...checkDefenseCoverage(role, out, oppReb, oppCq));
    flags.push(...checkHingeDefenseConcentration(role, out, oppReb, hingeSet, hingeDefendRateMin));
    flags.push(...checkConcessionDiscrimination(role, out, oppReb, hingeSet, blanketConcedeRateMin));
  }

  // LLM judges.
  const judgeUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  if (opts.llm && opts.cfg) {
    const sourceByToken = new Map(opts.sources.map((s) => [s.citationToken, s] as const));
    for (const role of ["a", "b"] as const) {
      const out = opts.defenses[role];
      if (!out) continue;
      const oppReb = role === "a" ? opts.opposingRebuttalsByAdvocate.a : opts.opposingRebuttalsByAdvocate.b;

      const eng = await judgeDefenseEngagement({
        role,
        out,
        opposingRebuttals: oppReb,
        llm: opts.llm,
        cfg: opts.cfg,
        logger: opts.logger,
        judgeModel: opts.judgeModel,
      });
      flags.push(...eng.flags);
      judgeUsage.calls += eng.usage.calls;
      judgeUsage.inputTokens += eng.usage.inputTokens;
      judgeUsage.outputTokens += eng.usage.outputTokens;

      const ev = await judgeDefenseEvidenceFidelity({
        role,
        out,
        opposingRebuttals: oppReb,
        sourceByToken,
        llm: opts.llm,
        cfg: opts.cfg,
        logger: opts.logger,
        judgeModel: opts.judgeModel,
      });
      flags.push(...ev.flags);
      judgeUsage.calls += ev.usage.calls;
      judgeUsage.inputTokens += ev.usage.inputTokens;
      judgeUsage.outputTokens += ev.usage.outputTokens;
    }
  }

  return { flags, judgeUsage };
}

// ─────────────────────────────────────────────────────────────────
// 1. defense_targeting
// ─────────────────────────────────────────────────────────────────

function checkDefenseTargeting(
  role: "a" | "b",
  out: DefenseOutput,
  opposing: ReadonlyMap<string, OpposingRebuttalMeta>,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  for (let i = 0; i < out.responses.length; i++) {
    const r = out.responses[i];
    const target = opposing.get(r.targetAttackId);
    if (!target) {
      flags.push({
        ruleId: "defense_targeting:unknown-target",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: response #${i} targets attackId=${r.targetAttackId}, ` +
          `which is not in the opposing rebuttal set.`,
        evidence: { advocate: role, inputIndex: i, targetAttackId: r.targetAttackId },
      });
      continue;
    }
    if (r.kind === "defend" && !r.defense) {
      flags.push({
        ruleId: "defense_targeting:defend-missing-defense",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: response #${i} kind="defend" but defense is null.`,
        evidence: { advocate: role, inputIndex: i },
      });
    }
    if (r.kind === "concede" && r.defense) {
      flags.push({
        ruleId: "defense_targeting:concede-has-defense",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: response #${i} kind="concede" but defense is non-null.`,
        evidence: { advocate: role, inputIndex: i },
      });
    }
    if (r.kind === "narrow" && !r.narrowedConclusionText) {
      flags.push({
        ruleId: "defense_targeting:narrow-missing-text",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: response #${i} kind="narrow" but narrowedConclusionText is null.`,
        evidence: { advocate: role, inputIndex: i },
      });
    }
    if (r.defense?.attackType === "UNDERMINE") {
      const idx = r.defense.targetPremiseIndex;
      if (idx === null) {
        flags.push({
          ruleId: "defense_targeting:undermine-missing-index",
          severity: "warn",
          message: `Advocate ${role.toUpperCase()}: response #${i} defense UNDERMINE has null targetPremiseIndex.`,
          evidence: { advocate: role, inputIndex: i },
        });
      } else if (idx < 0 || idx >= target.rebuttalPremiseCount) {
        flags.push({
          ruleId: "defense_targeting:undermine-index-out-of-range",
          severity: "warn",
          message:
            `Advocate ${role.toUpperCase()}: response #${i} defense UNDERMINE targetPremiseIndex=${idx} ` +
            `out of range [0,${target.rebuttalPremiseCount}).`,
          evidence: { advocate: role, inputIndex: i, idx, premiseCount: target.rebuttalPremiseCount },
        });
      }
    } else if (r.defense && r.defense.targetPremiseIndex !== null) {
      flags.push({
        ruleId: "defense_targeting:nonundermine-has-index",
        severity: "warn",
        message:
          `Advocate ${role.toUpperCase()}: response #${i} defense ${r.defense.attackType} has non-null targetPremiseIndex.`,
        evidence: { advocate: role, inputIndex: i, attackType: r.defense.attackType },
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 2. defense_coverage
// ─────────────────────────────────────────────────────────────────

function checkDefenseCoverage(
  role: "a" | "b",
  out: DefenseOutput,
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalMeta>,
  opposingCqRaises: ReadonlyMap<string, OpposingCqRaiseMeta>,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  const respByTarget = new Map<string, number>();
  for (const r of out.responses) {
    respByTarget.set(r.targetAttackId, (respByTarget.get(r.targetAttackId) ?? 0) + 1);
  }
  for (const id of opposingRebuttals.keys()) {
    if (!respByTarget.has(id)) {
      flags.push({
        ruleId: "defense_coverage:rebuttal-unanswered",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: opposing rebuttal ${id} has no response.`,
        evidence: { advocate: role, rebuttalArgumentId: id },
      });
    }
  }
  for (const [id, count] of respByTarget) {
    if (!opposingRebuttals.has(id)) continue; // unknown-target already flagged
    if (count > 1) {
      flags.push({
        ruleId: "defense_coverage:rebuttal-double-answered",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: opposing rebuttal ${id} has ${count} responses (expected 1).`,
        evidence: { advocate: role, rebuttalArgumentId: id, count },
      });
    }
  }

  const cqByTarget = new Map<string, number>();
  for (const c of out.cqAnswers) {
    cqByTarget.set(c.targetCqRaiseId, (cqByTarget.get(c.targetCqRaiseId) ?? 0) + 1);
  }
  for (const id of opposingCqRaises.keys()) {
    if (!cqByTarget.has(id)) {
      flags.push({
        ruleId: "defense_coverage:cq-unanswered",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: opposing CQ raise ${id} has no answer.`,
        evidence: { advocate: role, cqResponseId: id },
      });
    }
  }
  for (const [id, count] of cqByTarget) {
    if (!opposingCqRaises.has(id)) {
      flags.push({
        ruleId: "defense_coverage:unknown-cq-target",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: cqAnswer targets unknown cqResponseId=${id}.`,
        evidence: { advocate: role, cqResponseId: id },
      });
      continue;
    }
    if (count > 1) {
      flags.push({
        ruleId: "defense_coverage:cq-double-answered",
        severity: "warn",
        message: `Advocate ${role.toUpperCase()}: opposing CQ raise ${id} has ${count} answers (expected 1).`,
        evidence: { advocate: role, cqResponseId: id, count },
      });
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 3. hinge_defense_concentration
// ─────────────────────────────────────────────────────────────────

function checkHingeDefenseConcentration(
  role: "a" | "b",
  out: DefenseOutput,
  opposing: ReadonlyMap<string, OpposingRebuttalMeta>,
  hingeSet: Set<number>,
  defendRateMin: number,
): ReviewFlag[] {
  let hingeAttacks = 0;
  let hingeDefended = 0;
  for (const r of out.responses) {
    const target = opposing.get(r.targetAttackId);
    if (!target) continue;
    if (!hingeSet.has(target.targetConclusionClaimIndex)) continue;
    hingeAttacks++;
    if (r.kind === "defend") hingeDefended++;
  }
  if (hingeAttacks === 0) return [];
  const rate = hingeDefended / hingeAttacks;
  if (rate >= defendRateMin) return [];
  return [{
    ruleId: "hinge_defense_concentration",
    severity: "warn",
    message:
      `Advocate ${role.toUpperCase()}: only ${hingeDefended}/${hingeAttacks} attacks on hinge arguments ` +
      `(${(rate * 100).toFixed(0)}%) were DEFENDED; recommended ≥ ${(defendRateMin * 100).toFixed(0)}%. ` +
      `Conceding/narrowing on hinges erodes the central claim.`,
    evidence: { advocate: role, hingeAttacks, hingeDefended, defendRate: rate, hingeIndices: [...hingeSet] },
  }];
}

// ─────────────────────────────────────────────────────────────────
// 4. concession_discrimination
// ─────────────────────────────────────────────────────────────────

function checkConcessionDiscrimination(
  role: "a" | "b",
  out: DefenseOutput,
  opposing: ReadonlyMap<string, OpposingRebuttalMeta>,
  hingeSet: Set<number>,
  blanketConcedeRateMin: number,
): ReviewFlag[] {
  if (out.responses.length === 0) return [];
  let concedes = 0;
  let hingeConcedes = 0;
  let hingeTotal = 0;
  for (const r of out.responses) {
    if (r.kind === "concede") concedes++;
    const target = opposing.get(r.targetAttackId);
    if (target && hingeSet.has(target.targetConclusionClaimIndex)) {
      hingeTotal++;
      if (r.kind === "concede") hingeConcedes++;
    }
  }
  const overallConcedeRate = concedes / out.responses.length;
  const flags: ReviewFlag[] = [];
  if (overallConcedeRate >= blanketConcedeRateMin) {
    flags.push({
      ruleId: "concession_discrimination:blanket-concede",
      severity: "info",
      message:
        `Advocate ${role.toUpperCase()}: conceded ${concedes}/${out.responses.length} ` +
        `(${(overallConcedeRate * 100).toFixed(0)}%) of opposing rebuttals. Either genuine collapse or ` +
        `indiscriminate surrender — human review required.`,
      evidence: { advocate: role, concedes, total: out.responses.length, concedeRate: overallConcedeRate },
    });
  }
  if (hingeTotal > 0 && hingeConcedes / hingeTotal >= 0.5) {
    flags.push({
      ruleId: "concession_discrimination:hinge-collapse",
      severity: "info",
      message:
        `Advocate ${role.toUpperCase()}: conceded ${hingeConcedes}/${hingeTotal} ` +
        `(${((hingeConcedes / hingeTotal) * 100).toFixed(0)}%) of attacks on hinge arguments. ` +
        `Likely concedes the central claim — verify against tracker verdict.`,
      evidence: { advocate: role, hingeConcedes, hingeTotal },
    });
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 5. defense_engagement (LLM-judge)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_JUDGE_MODEL = "claude-haiku-4-5-20251001";

const ENGAGEMENT_JUDGE_SYSTEM = `You are a dialectical-engagement reviewer for a structured deliberation experiment.

Given (a) an opposing rebuttal and (b) a defense argument that purports to attack that rebuttal, judge whether the defense ACTUALLY engages the rebuttal's specific logic.

Verdict classes:
- "engages": the defense addresses the rebuttal's actual logic — for REBUT, contests the rebuttal's conclusion; for UNDERMINE, contests the targeted premise; for UNDERCUT, contests the warrant/inference. The defense's premises are responsive.
- "deflects": the defense raises a related but tangential point that does not address what the rebuttal actually claimed.
- "restates": the defense merely restates or paraphrases the original Phase-2 argument without engaging the rebuttal's specific objection.
- "strawman": the defense attacks a weaker or distorted version of the rebuttal.
- "uncertain": insufficient information to judge.

Output ONLY a JSON object: { "verdict": "<class>", "justification": "<one sentence>" }
No prose before or after.`;

interface EngagementJudgeOpts {
  role: "a" | "b";
  out: DefenseOutput;
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalMeta>;
  llm: AnthropicClient;
  cfg: OrchestratorConfig;
  logger?: RoundLogger;
  judgeModel?: string;
}

interface JudgeBatchResult {
  flags: ReviewFlag[];
  usage: { calls: number; inputTokens: number; outputTokens: number };
}

async function judgeDefenseEngagement(opts: EngagementJudgeOpts): Promise<JudgeBatchResult> {
  const flags: ReviewFlag[] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const judgeModel = opts.judgeModel ?? DEFAULT_JUDGE_MODEL;

  for (let i = 0; i < opts.out.responses.length; i++) {
    const r = opts.out.responses[i];
    if (r.kind !== "defend" || !r.defense) continue;
    const target = opts.opposingRebuttals.get(r.targetAttackId);
    if (!target) continue;

    const userMessage = renderEngagementJudgePrompt(opts.role, i, r, r.defense, target);

    const res = await opts.llm.chat({
      system: ENGAGEMENT_JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      model: judgeModel,
      temperature: 0,
      maxTokens: 600,
      logger: opts.logger,
      agentRole: `phase-4-engagement-judge-${opts.role}`,
    });
    usage.calls++;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;

    let parsed: any;
    try {
      parsed = extractJson(res.text);
    } catch (err) {
      flags.push({
        ruleId: "defense_engagement:judge-parse-failure",
        severity: "warn",
        message:
          `Advocate ${opts.role.toUpperCase()}: engagement-judge call for response #${i} produced unparseable JSON.`,
        evidence: { advocate: opts.role, inputIndex: i, error: (err as Error).message, rawResponse: res.text.slice(0, 500) },
      });
      continue;
    }
    const verdict = String(parsed?.verdict ?? "").toLowerCase();
    if (verdict === "engages") continue;
    flags.push({
      ruleId: `defense_engagement:${verdict || "unknown"}`,
      severity: "warn",
      message:
        `Advocate ${opts.role.toUpperCase()}: response #${i} (defend → ${r.targetAttackId}): ` +
        `judge verdict "${verdict}". ${parsed?.justification ?? ""}`.trim(),
      evidence: {
        advocate: opts.role,
        inputIndex: i,
        targetAttackId: r.targetAttackId,
        defenseAttackType: r.defense.attackType,
        defenseConclusion: r.defense.conclusionText,
        opposingConclusion: target.rebuttalConclusionText,
        judgeVerdict: verdict,
        judgeJustification: parsed?.justification ?? null,
      },
    });
  }
  return { flags, usage };
}

function renderEngagementJudgePrompt(
  role: "a" | "b",
  responseIndex: number,
  r: DefenseResponse,
  defense: DefenseArgument,
  target: OpposingRebuttalMeta,
): string {
  const lines: string[] = [];
  lines.push(`Advocate ${role.toUpperCase()}, Phase-4 response #${responseIndex} (defend → opposing rebuttal ${target.rebuttalArgumentId}).`);
  lines.push(``);
  lines.push(`### Opposing rebuttal (the attack being defended against)`);
  lines.push(`attackType: ${target.rebuttalAttackType}`);
  if (target.cqKey) lines.push(`cqKey: ${target.cqKey}`);
  lines.push(`conclusion: "${target.rebuttalConclusionText}"`);
  lines.push(`premises:`);
  for (let p = 0; p < target.rebuttalPremiseTexts.length; p++) {
    const tok = target.rebuttalPremiseCitationTokens[p];
    lines.push(`  [${p}] "${target.rebuttalPremiseTexts[p]}"  cite=${tok ?? "null"}`);
  }
  lines.push(``);
  lines.push(`### Defense (this advocate's response)`);
  lines.push(`attackType: ${defense.attackType}`);
  if (defense.targetPremiseIndex !== null) {
    lines.push(`targetPremiseIndex: ${defense.targetPremiseIndex} (i.e. attacking opposing rebuttal premise [${defense.targetPremiseIndex}])`);
  }
  lines.push(`conclusion: "${defense.conclusionText}"`);
  lines.push(`premises:`);
  for (let p = 0; p < defense.premises.length; p++) {
    lines.push(`  [${p}] "${defense.premises[p].text}"  cite=${defense.premises[p].citationToken ?? "null"}`);
  }
  if (defense.warrant) lines.push(`warrant: "${defense.warrant}"`);
  lines.push(`scheme: ${defense.schemeKey}`);
  lines.push(``);
  lines.push(`Rationale (advocate's own gloss): "${r.rationale}"`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// 6. evidence_fidelity (same Haiku judge as Phase 2/3)
// ─────────────────────────────────────────────────────────────────

const EVIDENCE_JUDGE_SYSTEM = `You are an evidence-fidelity reviewer for a structured deliberation experiment.

For each (premise, cited source) pair you receive, judge whether the source's abstract and key findings ACTUALLY support the premise as stated. You are not judging whether the premise is true in the world — only whether the cited source supports it.

Verdict classes:
- "supported": the source's abstract or key findings clearly support the premise as stated.
- "partial": the source supports a weaker version of the premise, or supports a related but distinct claim. The premise overstates or distorts what the source says.
- "not_supported": the source does not support the premise. The citation is mischaracterized.
- "uncertain": the abstract is too thin to judge. Use only when source data is genuinely insufficient.

Output ONLY a JSON object of shape:
{ "verdicts": [ { "premiseIndex": <int>, "verdict": "<class>", "justification": "<one sentence>" }, ... ] }
No prose before or after. premiseIndex is 0-based and matches the order in the input.`;

interface EvidenceJudgeOpts {
  role: "a" | "b";
  out: DefenseOutput;
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalMeta>;
  sourceByToken: Map<string, EvidenceSourceLite>;
  llm: AnthropicClient;
  cfg: OrchestratorConfig;
  logger?: RoundLogger;
  judgeModel?: string;
}

async function judgeDefenseEvidenceFidelity(opts: EvidenceJudgeOpts): Promise<JudgeBatchResult> {
  const flags: ReviewFlag[] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const judgeModel = opts.judgeModel ?? DEFAULT_JUDGE_MODEL;

  for (let i = 0; i < opts.out.responses.length; i++) {
    const r = opts.out.responses[i];
    if (!r.defense) continue;
    type Pair = { premiseIndex: number; premiseText: string; citationToken: string; source: EvidenceSourceLite };
    const pairs: Pair[] = [];
    for (let p = 0; p < r.defense.premises.length; p++) {
      const tok = r.defense.premises[p].citationToken;
      if (!tok) continue;
      const src = opts.sourceByToken.get(tok);
      if (!src) continue;
      pairs.push({ premiseIndex: p, premiseText: r.defense.premises[p].text, citationToken: tok, source: src });
    }
    if (pairs.length === 0) continue;

    const userMessage = renderEvidenceJudgePrompt(opts.role, i, r, r.defense, pairs);
    const res = await opts.llm.chat({
      system: EVIDENCE_JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      model: judgeModel,
      temperature: 0,
      maxTokens: 1500,
      logger: opts.logger,
      agentRole: `phase-4-evidence-judge-${opts.role}`,
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
          `Advocate ${opts.role.toUpperCase()}: evidence-judge call for response #${i} produced unparseable JSON.`,
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
      flags.push({
        ruleId: `evidence_fidelity:${verdict || "unknown"}`,
        severity: "warn",
        message:
          `Advocate ${opts.role.toUpperCase()}: response #${i} (defend → ${r.targetAttackId}), defense premise #${pair.premiseIndex}: ` +
          `judge verdict "${verdict}". ${v.justification ?? ""}`.trim(),
        evidence: {
          advocate: opts.role,
          inputIndex: i,
          premiseIndex: pair.premiseIndex,
          targetAttackId: r.targetAttackId,
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

function renderEvidenceJudgePrompt(
  role: "a" | "b",
  responseIndex: number,
  r: DefenseResponse,
  defense: DefenseArgument,
  pairs: Array<{ premiseIndex: number; premiseText: string; citationToken: string; source: EvidenceSourceLite }>,
): string {
  const lines: string[] = [];
  lines.push(`Advocate ${role.toUpperCase()}, Phase-4 defense response #${responseIndex} (${defense.attackType} → opposing rebuttal ${r.targetAttackId}, scheme=${defense.schemeKey}).`);
  lines.push(`Defense conclusion: "${defense.conclusionText}"`);
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
