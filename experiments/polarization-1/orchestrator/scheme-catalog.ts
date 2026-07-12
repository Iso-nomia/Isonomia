/**
 * Allowed argumentation-scheme catalog for the polarization-1 experiment.
 *
 * Phase 2/3 advocates and the challenger MUST select a `schemeKey` from
 * this list. The orchestrator's hard validators reject any output that
 * cites a scheme key outside it. The preflight check requires every key
 * in this list to exist as an `ArgumentScheme` row before phase 2 may
 * start.
 *
 * Composition:
 *   - Causal / explanatory (4): cause_to_effect, sign,
 *     inference_to_best_explanation, statistical_generalization
 *   - Authority / source (1):   expert_opinion
 *   - Practical / consequences (3): practical_reasoning,
 *     positive_consequences, negative_consequences
 *   - Comparison / generalization (2): analogy, argument_from_example
 *   - Evidence-quality / skeptical (2): argument_from_lack_of_evidence,
 *     methodological_critique
 *
 * The 4 not in the global Walton seed (the last in each row) come in via
 * `experiments/polarization-1/scripts/seed-experiment-schemes.ts`.
 */

export const EXPERIMENT_SCHEME_KEYS = [
  // Causal / explanatory
  "cause_to_effect",
  "sign",
  "inference_to_best_explanation",
  "statistical_generalization",
  // Authority
  "expert_opinion",
  // Practical / consequences
  "practical_reasoning",
  "positive_consequences",
  "negative_consequences",
  // Comparison / generalization
  "analogy",
  "argument_from_example",
  // Evidence-quality / skeptical
  "argument_from_lack_of_evidence",
  "methodological_critique",
] as const;

export type ExperimentSchemeKey = (typeof EXPERIMENT_SCHEME_KEYS)[number];

const ALLOWED = new Set<string>(EXPERIMENT_SCHEME_KEYS);

export function isAllowedSchemeKey(k: string): k is ExperimentSchemeKey {
  return ALLOWED.has(k);
}

/**
 * Returns the list of expected scheme keys that are NOT present in the
 * given catalog (typically the result of `GET /api/schemes`).
 */
export function missingExperimentSchemes(
  catalog: ReadonlyArray<{ key: string }>,
): ExperimentSchemeKey[] {
  const have = new Set(catalog.map((s) => s.key));
  return EXPERIMENT_SCHEME_KEYS.filter((k) => !have.has(k));
}
