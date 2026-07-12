// lib/schemes/practical-goal-type.ts
//
// Item 3 of the practical-reasoning enhancements
// (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md):
// expose the goal/value premise as a first-class, contestable slot — and the
// piece that was still missing, **the goal-vs-value type** that routes a
// practical argument to the right scheme.
//
// The slot itself already exists (seed B gives `practical_reasoning` a `goal`
// slot via slotHints; `PR.GOAL_ACCEPTED` makes it contestable as an ordinary
// premise). What was missing is the Macagno distinction between:
//   • INSTRUMENTAL practical reasoning  — goal G + action A is a means to G ⇒
//     ought A.  Scheme: `practical_reasoning`.
//   • VALUE-BASED practical reasoning   — value V + A promotes V ⇒ ought A.
//     Scheme: `value_based_pr`.
//
// This module is the de-Lumered form of "expose where evaluation bottoms out":
// the goal/value premise is exactly that bottoming-out point, and its *type*
// (instrumental goal vs. standing value) is a first-class, inspectable property
// — NOT a `DesirabilityProfile`, no versioned profile object, no netting.
//
// Pure, heuristic, no DB write, no migration. It is a routing *signal*; it does
// not mutate `schemeInference` scoring (a consumer may fold it in deliberately).
// Every classification discloses the signals it matched (house "show every
// input" style), so the routing decision is auditable and contestable.

export type GoalPremiseKind = "instrumental" | "value-based" | "ambiguous";

export interface GoalTypeClassification {
  kind: GoalPremiseKind;
  /** The PR-family scheme this premise type routes to, or null when ambiguous. */
  preferredScheme: "practical_reasoning" | "value_based_pr" | null;
  /** Matched lexical signals, by side, for transparency. */
  signals: { instrumental: string[]; valueBased: string[] };
  /**
   * Confidence in [0,1] = |dominant - other| / (dominant + other), 0 when no
   * signal fires. Deliberately simple and inspectable, not a trained score.
   */
  confidence: number;
}

// Heuristic lexicons. Kept modest and honest — these are cues, not a parser.
// Instrumental cues: means-end / efficiency framing.
const INSTRUMENTAL_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "in order to", re: /\bin order to\b/i },
  { label: "so that", re: /\bso that\b/i },
  { label: "means to", re: /\b(a |the )?means to\b/i },
  { label: "to achieve", re: /\bto achieve\b/i },
  { label: "efficient/effective", re: /\b(efficient|effective|optimal)(ly)?\b/i },
  { label: "the best way to", re: /\bthe best way to\b/i },
  { label: "goal/objective/target", re: /\b(goal|objective|target|aim)\b/i },
];

// Value cues: standing values / principles / normative commitments.
const VALUE_PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: "value/principle",
    re: /\b(value|values|principle|principles)\b/i,
  },
  {
    label: "named value",
    re: /\b(fairness|justice|equality|equity|dignity|freedom|liberty|autonomy|solidarity|integrity|sustainability)\b/i,
  },
  { label: "rights", re: /\b(right|rights)\b/i },
  { label: "moral/ethical", re: /\b(moral|morally|ethical|ethically)\b/i },
  { label: "promotes/upholds/honors", re: /\b(promotes?|upholds?|honou?rs?|respects?)\b/i },
  { label: "matters/important in itself", re: /\b(matters in itself|important in itself|intrinsically|for its own sake)\b/i },
];

function matched(text: string, patterns: { label: string; re: RegExp }[]): string[] {
  return patterns.filter((p) => p.re.test(text)).map((p) => p.label);
}

/**
 * Classify a goal/value premise as instrumental (→ practical_reasoning) or
 * value-based (→ value_based_pr). Returns `ambiguous` when neither side wins
 * (no signal, or a tie), so the caller can keep the default scheme rather than
 * force a route.
 */
export function classifyGoalPremise(text: string): GoalTypeClassification {
  const instrumental = matched(text, INSTRUMENTAL_PATTERNS);
  const valueBased = matched(text, VALUE_PATTERNS);
  const i = instrumental.length;
  const v = valueBased.length;

  const signals = { instrumental, valueBased };
  const total = i + v;
  const confidence = total === 0 ? 0 : Math.abs(i - v) / total;

  if (i > v) {
    return { kind: "instrumental", preferredScheme: "practical_reasoning", signals, confidence };
  }
  if (v > i) {
    return { kind: "value-based", preferredScheme: "value_based_pr", signals, confidence };
  }
  // Tie (including 0–0): ambiguous, no forced route.
  return { kind: "ambiguous", preferredScheme: null, signals, confidence };
}
