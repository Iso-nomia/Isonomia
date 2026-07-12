/**
 * Scheme-typical-move catalog — Track AI-EPI Pt. 4 §3.
 *
 * For each argumentation scheme, enumerates the critical questions and
 * undercut types the protocol *expects* to see if the move is being
 * properly tested. Drives `MissingMoveReport`: the diff between catalog
 * and present is the productive form of the anti-strawman discipline.
 *
 * Coverage is intentionally narrow at first — the schemes most commonly
 * used in current deliberations (`cause-to-effect`, `expert-opinion`,
 * `sign`, `practical-reasoning`, `negative-consequences`, `analogy`).
 * Schemes not in this catalog degrade gracefully (no expected-undercuts
 * to compare against, but `MissingMoveReport.perArgument.missingCqs`
 * still works because the CQ catalog is read live from the scheme's
 * `cqs` relation).
 */

export interface SchemeMoveCatalogEntry {
  /**
   * CQ keys this scheme is expected to engage. Read live from the
   * scheme's `cqs` relation when computing — this catalog field is
   * informational only; do not duplicate the CQ keys here.
   */
  expectedCqsHint: string[];
  /**
   * Undercut types the protocol expects to see raised against this
   * scheme. `severity: scheme-required` means absence is a hard signal
   * the move is under-developed; `scheme-recommended` means absence is
   * worth flagging but not load-bearing.
   */
  expectedUndercutTypes: Array<{
    key: string;
    label: string;
    severity: "scheme-required" | "scheme-recommended";
  }>;
  /**
   * Other scheme keys this scheme typically appears alongside. Used to
   * detect `crossSchemeMediatorsAbsent` at the deliberation scope.
   */
  expectedSchemeFamilies: string[];
}

export const SCHEME_MOVE_CATALOG: Record<string, SchemeMoveCatalogEntry> = {
  "cause-to-effect": {
    expectedCqsHint: ["causal-strength", "alternative-causes", "intervening-events"],
    expectedUndercutTypes: [
      { key: "false-cause", label: "False cause / spurious correlation", severity: "scheme-required" },
      { key: "reverse-causation", label: "Reverse causation", severity: "scheme-recommended" },
      { key: "common-cause", label: "Confounding / common cause", severity: "scheme-required" },
    ],
    expectedSchemeFamilies: ["expert-opinion", "sign"],
  },
  "expert-opinion": {
    expectedCqsHint: [
      "expertise-relevance",
      "expert-consensus",
      "expert-bias",
      "field-reliability",
    ],
    expectedUndercutTypes: [
      { key: "expertise-mismatch", label: "Expertise outside the relevant field", severity: "scheme-required" },
      { key: "expert-disagreement", label: "Disagreement among experts", severity: "scheme-recommended" },
      { key: "ad-hominem-bypass", label: "Source bias not addressed", severity: "scheme-recommended" },
    ],
    expectedSchemeFamilies: ["cause-to-effect", "sign"],
  },
  sign: {
    expectedCqsHint: ["sign-reliability", "alternative-explanations"],
    expectedUndercutTypes: [
      { key: "sign-ambiguity", label: "Sign admits alternative explanations", severity: "scheme-required" },
      { key: "sign-base-rate", label: "Base rate of the sign not addressed", severity: "scheme-recommended" },
    ],
    expectedSchemeFamilies: ["cause-to-effect", "expert-opinion"],
  },
  "practical-reasoning": {
    expectedCqsHint: [
      "alternative-actions",
      "side-effects",
      "feasibility",
      "goal-priority",
    ],
    expectedUndercutTypes: [
      { key: "side-effects-ignored", label: "Negative side-effects not addressed", severity: "scheme-required" },
      { key: "alternative-means", label: "Alternative means not considered", severity: "scheme-required" },
      { key: "goal-contested", label: "The goal itself is contested", severity: "scheme-recommended" },
    ],
    expectedSchemeFamilies: ["negative-consequences", "cause-to-effect"],
  },
  "negative-consequences": {
    expectedCqsHint: [
      "consequence-likelihood",
      "consequence-severity",
      "mitigation-options",
    ],
    expectedUndercutTypes: [
      { key: "slippery-slope", label: "Slippery-slope reasoning unjustified", severity: "scheme-required" },
      { key: "consequence-magnitude", label: "Consequence magnitude overstated", severity: "scheme-recommended" },
      { key: "mitigation-ignored", label: "Mitigation options not considered", severity: "scheme-recommended" },
    ],
    expectedSchemeFamilies: ["practical-reasoning", "cause-to-effect"],
  },
  analogy: {
    expectedCqsHint: ["similarity-relevance", "disanalogy"],
    expectedUndercutTypes: [
      { key: "weak-analogy", label: "Disanalogous on the relevant dimension", severity: "scheme-required" },
      { key: "selective-analogy", label: "Analogy cherry-picked", severity: "scheme-recommended" },
    ],
    expectedSchemeFamilies: ["cause-to-effect", "expert-opinion"],
  },
};

/** Schemes that, in combination, typically signal "topic is being properly canvassed." */
export const TYPICAL_DELIBERATION_SCHEME_PAIRS: Array<[string, string]> = [
  ["cause-to-effect", "expert-opinion"],
  ["cause-to-effect", "negative-consequences"],
  ["practical-reasoning", "negative-consequences"],
  ["sign", "cause-to-effect"],
];

/** Schemes considered "cross-scheme mediators" for §3.3 detection. */
export const CROSS_SCHEME_MEDIATORS = new Set<string>([
  "practical-reasoning",
]);
