// lib/thesis/confidence.ts
//
// Living Thesis — Phase 4.1: confidence formula module.
//
// Pure functions that turn aggregate per-prong / per-thesis evidence into
// an auditable confidence score. The formula and weights live here so the
// /confidence endpoint can echo them verbatim and the ConfidenceBadge can
// display them to the user without divergence.
//
// Score is in [0, 1]. Each input contributes a normalized term in [0, 1]
// multiplied by its weight; weights sum to 1 within a level.

export type ConfidenceLevel = "low" | "medium" | "high";

export interface ConfidenceInputRef {
  /** Stable id of the contributing object, when applicable. */
  id?: string;
  /** Object kind for deep-link via openInspector. */
  kind?: "claim" | "argument" | "proposition";
}

export interface ConfidenceInput {
  /** Stable key, e.g. "argLabelIn". */
  key: string;
  /** Human-readable label rendered in the badge popover. */
  name: string;
  /** Raw value (already normalized to [0, 1]). */
  value: number;
  /** Weight applied to value when summing. */
  weight: number;
  /** Optional contributing object refs for deep-linking. */
  refs?: ConfidenceInputRef[];
  /** Optional short explanation, e.g. "3 of 4 arguments labeled IN". */
  detail?: string;
}

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  formula: string;
  inputs: ConfidenceInput[];
}

// ─────────────────────────────────────────────────────────────────────────
// Per-prong weights. Sum to 1.0.
// ─────────────────────────────────────────────────────────────────────────
export const PRONG_WEIGHTS = {
  argLabelIn: 0.4, // share of prong arguments with ground label IN
  cqSatisfied: 0.25, // CQ satisfaction ratio across prong arguments
  attacksDefended: 0.2, // defended / total inbound attacks (1 if no attacks)
  evidenceDensity: 0.15, // evidence-bearing arguments / total arguments
} as const;

export const PRONG_FORMULA =
  "score = 0.40·argLabelIn + 0.25·cqSatisfied + 0.20·attacksDefended + 0.15·evidenceDensity";

// ─────────────────────────────────────────────────────────────────────────
// Per-thesis weights. Sum to 1.0.
// ─────────────────────────────────────────────────────────────────────────
export const THESIS_WEIGHTS = {
  prongAggregate: 0.7, // arithmetic mean of prong scores
  thesisClaimLabel: 0.2, // 1 if thesis main claim is IN, 0.5 UNDEC, 0 OUT
  thesisAttackPosture: 0.1, // 1 - (undefendedAttacks / totalAttacks); 1 if none
} as const;

export const THESIS_FORMULA =
  "score = 0.70·meanProngScore + 0.20·thesisClaimLabel + 0.10·thesisAttackPosture";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function ratio(num: number, den: number, fallback = 0): number {
  if (den <= 0) return fallback;
  return clamp01(num / den);
}

function levelFor(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function sumWeighted(inputs: ConfidenceInput[]): number {
  let s = 0;
  for (const i of inputs) s += clamp01(i.value) * i.weight;
  return clamp01(s);
}

// ─────────────────────────────────────────────────────────────────────────
// Per-prong scoring.
// ─────────────────────────────────────────────────────────────────────────

export interface ProngEvidence {
  /** Argument ids belonging to this prong. */
  argumentIds: string[];
  /** Subset of argumentIds whose ClaimLabel/grounded label is IN. */
  argumentsLabeledIn: string[];
  /** Total CQs across prong arguments. */
  cqTotal: number;
  /** Satisfied (statusEnum != OPEN) CQs across prong arguments. */
  cqSatisfied: number;
  /** Inbound attacks against any prong claim/argument. */
  attacksTotal: number;
  /** Subset of attacksTotal whose attacker has its own inbound counter. */
  attacksDefended: number;
  /** Subset of argumentIds with at least one EvidenceLink. */
  argumentsWithEvidence: string[];
}

export function scoreProng(ev: ProngEvidence): ConfidenceResult {
  const argTotal = ev.argumentIds.length;

  const argLabelInValue = ratio(ev.argumentsLabeledIn.length, argTotal, 0);
  const cqValue = ratio(ev.cqSatisfied, ev.cqTotal, 1); // no CQs ⇒ neutral 1
  const defendedValue = ratio(ev.attacksDefended, ev.attacksTotal, 1); // no attacks ⇒ 1
  const evidenceValue = ratio(ev.argumentsWithEvidence.length, argTotal, 0);

  const inputs: ConfidenceInput[] = [
    {
      key: "argLabelIn",
      name: "Arguments labeled IN",
      value: argLabelInValue,
      weight: PRONG_WEIGHTS.argLabelIn,
      detail: `${ev.argumentsLabeledIn.length} of ${argTotal} arguments grounded IN`,
      refs: ev.argumentsLabeledIn.map((id) => ({ id, kind: "argument" })),
    },
    {
      key: "cqSatisfied",
      name: "Critical questions satisfied",
      value: cqValue,
      weight: PRONG_WEIGHTS.cqSatisfied,
      detail:
        ev.cqTotal > 0
          ? `${ev.cqSatisfied} of ${ev.cqTotal} CQs satisfied`
          : "no CQs raised",
    },
    {
      key: "attacksDefended",
      name: "Attacks defended",
      value: defendedValue,
      weight: PRONG_WEIGHTS.attacksDefended,
      detail:
        ev.attacksTotal > 0
          ? `${ev.attacksDefended} of ${ev.attacksTotal} attacks defended`
          : "no inbound attacks",
    },
    {
      key: "evidenceDensity",
      name: "Evidence density",
      value: evidenceValue,
      weight: PRONG_WEIGHTS.evidenceDensity,
      detail: `${ev.argumentsWithEvidence.length} of ${argTotal} arguments cite evidence`,
      refs: ev.argumentsWithEvidence.map((id) => ({ id, kind: "argument" })),
    },
  ];

  const score = sumWeighted(inputs);
  return { score, level: levelFor(score), formula: PRONG_FORMULA, inputs };
}

// ─────────────────────────────────────────────────────────────────────────
// Per-thesis scoring.
// ─────────────────────────────────────────────────────────────────────────

export interface ThesisEvidence {
  prongScores: number[]; // already-computed prong scores in [0,1]
  thesisClaimLabel: "IN" | "OUT" | "UNDEC" | null;
  thesisAttacksTotal: number;
  thesisAttacksUndefended: number;
}

function labelToValue(label: ThesisEvidence["thesisClaimLabel"]): number {
  if (label === "IN") return 1;
  if (label === "OUT") return 0;
  return 0.5; // UNDEC or null
}

export function scoreThesis(ev: ThesisEvidence): ConfidenceResult {
  const meanProng =
    ev.prongScores.length > 0
      ? ev.prongScores.reduce((a, b) => a + b, 0) / ev.prongScores.length
      : 0;
  const labelValue = labelToValue(ev.thesisClaimLabel);
  const postureValue =
    ev.thesisAttacksTotal > 0
      ? clamp01(1 - ev.thesisAttacksUndefended / ev.thesisAttacksTotal)
      : 1;

  const inputs: ConfidenceInput[] = [
    {
      key: "prongAggregate",
      name: "Mean prong score",
      value: clamp01(meanProng),
      weight: THESIS_WEIGHTS.prongAggregate,
      detail: `${ev.prongScores.length} prong${ev.prongScores.length === 1 ? "" : "s"} averaged`,
    },
    {
      key: "thesisClaimLabel",
      name: "Thesis claim label",
      value: labelValue,
      weight: THESIS_WEIGHTS.thesisClaimLabel,
      detail: ev.thesisClaimLabel ? `label = ${ev.thesisClaimLabel}` : "no label yet",
    },
    {
      key: "thesisAttackPosture",
      name: "Thesis-level attack posture",
      value: postureValue,
      weight: THESIS_WEIGHTS.thesisAttackPosture,
      detail:
        ev.thesisAttacksTotal > 0
          ? `${ev.thesisAttacksTotal - ev.thesisAttacksUndefended} of ${ev.thesisAttacksTotal} attacks defended`
          : "no inbound attacks on thesis claim",
    },
  ];

  const score = sumWeighted(inputs);
  return { score, level: levelFor(score), formula: THESIS_FORMULA, inputs };
}
