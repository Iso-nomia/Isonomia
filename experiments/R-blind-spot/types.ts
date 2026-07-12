/**
 * experiments/R-blind-spot/types.ts
 *
 * Shared shapes for the R pilot — the differential-blind-spot go/no-go.
 * See docs/"R — Differential Blind-Spot Experiment Protocol.md".
 *
 * The pilot exercises the ONE judgment-laden confirm check that already exists
 * verbatim in production-adjacent code: evidence-supports-premise
 * (`JUDGE_SYSTEM`, phase-2-checks.ts). An ITEM is a (premise, cited source)
 * pair; a CATCH is any non-"supported" verdict on a seeded-wrong item.
 */

export type ItemType = "clean_correct" | "obvious_error" | "plausible_correlated";

/** Which family generated the item — needed for the generator×panel crossing (§4). */
export type GeneratorFamily = "gpt" | "claude";

/** A minimal cited source, matching the fields JUDGE_SYSTEM reasons over. */
export interface SourceLite {
  title: string;
  authors: string[];
  publishedAt: string | null; // ISO; only the year is shown to the judge
  abstract: string | null;
  keyFindings: string[];
}

/** One evidence item: a premise and the source cited for it. */
export interface Item {
  id: string;
  itemType: ItemType;
  generatorFamily: GeneratorFamily;
  premiseText: string;
  citationToken: string; // e.g. "S1" — cosmetic, mirrors production rendering
  source: SourceLite;

  /**
   * Ground truth, set by the HUMAN FILTER pass (not the generator):
   * true  = the source genuinely does NOT support the premise (a real error),
   * false = the source genuinely supports it (clean control).
   * `null` until filtered. Items the human cannot cleanly label are dropped.
   */
  groundTruthError: boolean | null;
  /** Human filter note — e.g. why it's "wrong but looks right", or why dropped. */
  filterNote?: string;
  /** Set true by the filter to exclude from the run (a discarded tell / ambiguous). */
  dropped?: boolean;

  /**
   * Matched-pair id. A clean_correct and its plausible_correlated twin cite the
   * SAME source and differ only in whether the premise matches or overclaims it,
   * so item difficulty is held constant by construction (the strong design that
   * replaced surface-distribution matching after the first pilot bank leaked the
   * type via duration language). obvious_error items are unpaired.
   */
  pairId?: string;
  /** For the plausible twin: which single dimension the premise overclaims (a-e). */
  overclaimDimension?: string;
}

export type VerdictClass = "supported" | "partial" | "not_supported" | "uncertain";

/**
 * One independent checker's verdict on one item — the flat pool the analyzer
 * composes arms from. `checkerId` is the independence coordinate that matters:
 * distinct per independent context, so N checkers of one family = N genuinely
 * distinct error sources (the N-1 contextLineageId distinction, made real).
 */
export interface PoolVerdict {
  itemId: string;
  family: "claude" | "gpt" | "human";
  modelVersion: string;
  checkerId: string; // "claude:0" | "gpt:1" | "human:alice" — a distinct context
  verdict: VerdictClass | "parse_error";
  justification: string;
  /** verdict flags the item as wrong (partial | not_supported). */
  caught: boolean;
  raw?: string;
}

/**
 * Arm keys for the pilot. The core contrast is the two N=2 arms: does the
 * SECOND checker's family matter? (claude_2 vs cross_2.)
 */
export type ArmKey =
  | "claude_1"
  | "claude_2"
  | "claude_3"
  | "cross_2" // { claude, gpt }
  | "cross_3" // { claude, gpt, gpt } — best decorrelation available with 2 families
  | "human";

export interface ArmSpec {
  key: ArmKey;
  /** Ordered checker families composing the panel (length = N). */
  members: Array<"claude" | "gpt" | "human">;
  label: string;
}

/** Per-(arm, itemType) catch-rate cell. */
export interface CatchCell {
  arm: ArmKey;
  itemType: ItemType;
  n: number; // items in this cell
  panelCaught: number; // panels where ≥1 member caught (on error items)
  catchRate: number; // panelCaught / n
  falsePositives?: number; // on clean_correct items: panels that wrongly flagged
  falsePositiveRate?: number;
}
