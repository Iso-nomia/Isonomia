/**
 * ToneStrategy — lifted from Milestone 4 of the Chain Essay Prose
 * Generator roadmap. This file defines the *shape* of a tone so M6's
 * LLM polish step has a structured handle to pass into a prompt, and so
 * downstream callers (and the eventual template rewrite in the full
 * M4) can read tone parameters off a single source of truth rather
 * than recomputing them from `tone === "persuasive"` checks scattered
 * across `essayGenerator.ts`.
 *
 * Scope: interface + the three concrete strategies (`persuasive`,
 * `deliberative`, `expository`). No template rewrite yet — the
 * essay generator still does its own per-tone branching. The intent is
 * that the M6 polish prompt can read this object to constrain the
 * model's tone without re-deriving it from the deterministic prose.
 */

/**
 * Tonal parameters that meaningfully change a chain's rendered prose.
 *
 * - `openingVerbs`: short list of verbs the prose may use to introduce
 *   the chain's thesis. Distinct per tone so two tones never produce
 *   identical opening sentences for the same chain.
 * - `hedgeLevel`: maximum permitted hedge density.
 *   `none` for emphatic registers (persuasive), `med` or `high` for
 *   deliberative/academic where epistemic humility is the point.
 * - `person`: narrative person. `first` permits "I" / "we"
 *   (persuasive, op-ed); `third` forces impersonal voice (academic).
 * - `antithesisTreatment`: `steelman` reconstructs the strongest form
 *   of the counter-claim before responding; `dismiss` is licensed to
 *   summarise and move on (rare; only persuasive when consensus is
 *   strong).
 * - `conclusionStrength`: caps the strongest closer the tone may emit.
 *   `assertive` permits "Therefore X."; `qualified` requires hedged
 *   "On balance, X seems warranted."; `open` requires a question or
 *   explicit acknowledgement that the chain leaves the matter open.
 */
export interface ToneStrategy {
  openingVerbs: string[];
  hedgeLevel: "none" | "low" | "med" | "high";
  person: "first" | "third";
  antithesisTreatment: "steelman" | "dismiss";
  conclusionStrength: "assertive" | "qualified" | "open";
}

/** Stable string keys for the registered tone strategies. */
export type ToneStrategyKey = "persuasive" | "deliberative" | "expository";

/**
 * Persuasive: meant to move a reader. Emphatic verbs, low hedging,
 * first-person permitted, steelman antithesis (a persuasive piece that
 * dismisses opposition loses credibility), and an assertive closer.
 */
export const PERSUASIVE_TONE: ToneStrategy = {
  openingVerbs: ["argues", "shows", "demonstrates", "contends"],
  hedgeLevel: "low",
  person: "first",
  antithesisTreatment: "steelman",
  conclusionStrength: "assertive",
};

/**
 * Deliberative: weighing reasons in public. Hedge density is the
 * defining feature — the prose should not commit further than the
 * graph licenses. Third person to keep the analyst out of the frame,
 * and the closer is at most `qualified` (M2/M3 conclusion rewrites
 * already enforce this at the generator level).
 */
export const DELIBERATIVE_TONE: ToneStrategy = {
  openingVerbs: ["considers", "weighs", "examines", "asks whether"],
  hedgeLevel: "med",
  person: "third",
  antithesisTreatment: "steelman",
  conclusionStrength: "qualified",
};

/**
 * Expository: structural explanation. Minimal hedging because the
 * register is descriptive rather than argumentative ("the chain holds
 * that …"), third person throughout, and `open` closer — expository
 * prose reports standings without endorsing them.
 */
export const EXPOSITORY_TONE: ToneStrategy = {
  openingVerbs: ["explains", "outlines", "describes", "traces"],
  hedgeLevel: "low",
  person: "third",
  antithesisTreatment: "steelman",
  conclusionStrength: "open",
};

/** Registry for keyed lookup; preserves stable insertion order. */
export const TONE_STRATEGIES: Record<ToneStrategyKey, ToneStrategy> = {
  persuasive: PERSUASIVE_TONE,
  deliberative: DELIBERATIVE_TONE,
  expository: EXPOSITORY_TONE,
};

/**
 * Resolve a tone key (with a deliberative default) into its strategy.
 * Accepts any string for forward compatibility with new tones from the
 * UI layer; unknown keys fall back to deliberative since it has the
 * safest hedge profile when the caller's intent is unclear.
 */
export function resolveToneStrategy(
  key: string | undefined | null,
): ToneStrategy {
  if (!key) return DELIBERATIVE_TONE;
  return (TONE_STRATEGIES as Record<string, ToneStrategy | undefined>)[key]
    ?? DELIBERATIVE_TONE;
}
