/**
 * lib/argumentation/cqGeneration.ts
 * 
 * Phase 3: Automatic Critical Question Generation from Macagno Taxonomy
 * 
 * This module generates baseline critical questions for argumentation schemes
 * based on their Macagno taxonomy fields. Templates are derived from:
 * - Walton's Critical Questioning framework
 * - Macagno's 6-dimensional taxonomy
 * - Standard argumentation theory (Pollock, Prakken)
 * 
 * CLIENT-SAFE: This file can be imported in both client and server code.
 * For server-only CQ inheritance logic, see lib/argumentation/cqInheritance.ts
 * 
 * Created: October 31, 2025
 * Updated: October 31, 2025 (Phase 6B - moved Prisma code to cqInheritance.ts)
 */

export type CriticalQuestion = {
  cqKey: string;
  text: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
  rationale?: string; // Why this CQ is relevant
};

export type TaxonomyFields = {
  purpose?: string | null; // 'action' | 'state_of_affairs'
  source?: string | null; // 'internal' | 'external'
  materialRelation?: string | null; // 'cause' | 'definition' | 'analogy' | 'authority' | 'practical' | 'correlation'
  reasoningType?: string | null; // 'deductive' | 'inductive' | 'abductive' | 'practical'
  ruleForm?: string | null; // 'MP' | 'MT' | 'defeasible_MP' | 'universal'
  conclusionType?: string | null; // 'ought' | 'is'
};

/**
 * Generates baseline critical questions for a scheme based on its taxonomy.
 * Returns an array of CQs that can be customized by the user.
 * 
 * @param taxonomy - Macagno taxonomy fields for the scheme
 * @param schemeKey - Unique key for the scheme (used to generate cqKeys)
 * @returns Array of generated critical questions
 */
export function generateCQsFromTaxonomy(
  taxonomy: TaxonomyFields,
  schemeKey: string
): CriticalQuestion[] {
  const cqs: CriticalQuestion[] = [];
  const keyPrefix = schemeKey.replace(/_/g, "");

  // === Material Relation Templates ===

  if (taxonomy.materialRelation === "authority") {
    cqs.push({
      cqKey: `${keyPrefix}_expert_qualified`,
      text: "Is the authority sufficiently qualified in the relevant domain?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Authority schemes require domain expertise verification",
    });
    cqs.push({
      cqKey: `${keyPrefix}_expert_credible`,
      text: "Is the authority credible (unbiased, reliable, consistent)?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Credibility is essential for authority-based arguments",
    });
    cqs.push({
      cqKey: `${keyPrefix}_expert_consensus`,
      text: "Do other experts in the field agree with this claim?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Consensus challenges the conclusion if experts disagree",
    });
  }

  if (taxonomy.materialRelation === "cause") {
    cqs.push({
      cqKey: `${keyPrefix}_causal_link`,
      text: "Is there a genuine causal connection between the premise and conclusion?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Causal schemes require verification of causal mechanism",
    });
    cqs.push({
      cqKey: `${keyPrefix}_confounders`,
      text: "Are there confounding factors or alternative explanations?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Confounders undermine the inference from cause to effect",
    });
    cqs.push({
      cqKey: `${keyPrefix}_necessary_sufficient`,
      text: "Is the cause necessary and/or sufficient for the effect?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Necessity/sufficiency determines strength of causal claim",
    });
  }

  if (taxonomy.materialRelation === "analogy") {
    cqs.push({
      cqKey: `${keyPrefix}_relevant_similarities`,
      text: "Are the similarities between the cases relevant to the conclusion?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Analogies require relevance of shared features",
    });
    cqs.push({
      cqKey: `${keyPrefix}_critical_differences`,
      text: "Are there critical differences that undermine the analogy?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Differences can break analogical reasoning",
    });
    cqs.push({
      cqKey: `${keyPrefix}_other_analogies`,
      text: "Are there better or conflicting analogies?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Alternative analogies may lead to opposite conclusions",
    });
  }

  if (taxonomy.materialRelation === "definition") {
    cqs.push({
      cqKey: `${keyPrefix}_definition_accepted`,
      text: "Is the definition widely accepted or stipulative?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Definitional arguments require accepted definitions",
    });
    cqs.push({
      cqKey: `${keyPrefix}_borderline_case`,
      text: "Is this a borderline case where the definition is unclear?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Borderline cases weaken classificatory inference",
    });
    cqs.push({
      cqKey: `${keyPrefix}_necessary_properties`,
      text: "Does the subject have all necessary properties of the category?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Missing necessary properties undermine classification",
    });
  }

  if (taxonomy.materialRelation === "practical") {
    cqs.push({
      cqKey: `${keyPrefix}_feasible`,
      text: "Is the proposed action feasible given available resources?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Practical reasoning requires feasibility",
    });
    cqs.push({
      cqKey: `${keyPrefix}_side_effects`,
      text: "Are there negative side effects or unintended consequences?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Side effects can outweigh intended benefits",
    });
    cqs.push({
      cqKey: `${keyPrefix}_alternative_means`,
      text: "Are there better alternative means to achieve the goal?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Alternative means may be more effective",
    });
  }

  if (taxonomy.materialRelation === "correlation") {
    cqs.push({
      cqKey: `${keyPrefix}_correlation_spurious`,
      text: "Is the correlation spurious or coincidental?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Correlation ≠ causation; must rule out spurious links",
    });
    cqs.push({
      cqKey: `${keyPrefix}_correlation_strength`,
      text: "Is the correlation strong and statistically significant?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Weak correlations don't support strong conclusions",
    });
    cqs.push({
      cqKey: `${keyPrefix}_other_indicators`,
      text: "Are there other indicators that contradict this sign?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Conflicting indicators weaken sign-based arguments",
    });
  }

  // === Source Templates ===

  if (taxonomy.source === "external") {
    cqs.push({
      cqKey: `${keyPrefix}_source_reliable`,
      text: "Is the external source reliable and authoritative?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "External sources must be vetted for reliability",
    });
    cqs.push({
      cqKey: `${keyPrefix}_source_cited_correctly`,
      text: "Has the source been cited accurately and in context?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Misquotation or context-dropping undermines evidence",
    });
  }

  if (taxonomy.source === "internal") {
    cqs.push({
      cqKey: `${keyPrefix}_internal_consistent`,
      text: "Is the claim consistent with the arguer's other stated beliefs?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Internal inconsistency undermines credibility",
    });
  }

  // === Reasoning Type Templates ===

  if (taxonomy.reasoningType === "deductive") {
    cqs.push({
      cqKey: `${keyPrefix}_premises_true`,
      text: "Are all premises true?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Deductive validity requires true premises",
    });
    cqs.push({
      cqKey: `${keyPrefix}_logically_valid`,
      text: "Is the inference logically valid (does the conclusion follow necessarily)?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Deductive arguments require logical validity",
    });
  }

  if (taxonomy.reasoningType === "inductive") {
    cqs.push({
      cqKey: `${keyPrefix}_sample_representative`,
      text: "Is the sample representative of the population?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Inductive generalizations require representative samples",
    });
    cqs.push({
      cqKey: `${keyPrefix}_sample_size`,
      text: "Is the sample size sufficient for the generalization?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Small samples weaken inductive strength",
    });
    cqs.push({
      cqKey: `${keyPrefix}_counterexamples`,
      text: "Are there counterexamples to the generalization?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Counterexamples challenge the conclusion",
    });
  }

  if (taxonomy.reasoningType === "abductive") {
    cqs.push({
      cqKey: `${keyPrefix}_best_explanation`,
      text: "Is this the best available explanation, or are there better alternatives?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Abduction requires ruling out alternative explanations",
    });
    cqs.push({
      cqKey: `${keyPrefix}_explains_all_data`,
      text: "Does the explanation account for all relevant evidence?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Partial explanations weaken abductive strength",
    });
  }

  if (taxonomy.reasoningType === "practical") {
    cqs.push({
      cqKey: `${keyPrefix}_goal_desirable`,
      text: "Is the stated goal genuinely desirable or beneficial?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Practical reasoning requires desirable goals",
    });
    cqs.push({
      cqKey: `${keyPrefix}_means_effective`,
      text: "Will the proposed means actually achieve the goal?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Ineffective means undermine practical arguments",
    });
  }

  // === Purpose Templates ===

  if (taxonomy.purpose === "action") {
    cqs.push({
      cqKey: `${keyPrefix}_action_timing`,
      text: "Is this the right time to take this action?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Action-oriented arguments depend on timing",
    });
    cqs.push({
      cqKey: `${keyPrefix}_action_proportionate`,
      text: "Is the proposed action proportionate to the problem?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Disproportionate actions weaken prescriptive force",
    });
  }

  if (taxonomy.purpose === "state_of_affairs") {
    cqs.push({
      cqKey: `${keyPrefix}_claim_verifiable`,
      text: "Is the claimed state of affairs verifiable?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Descriptive claims require verifiability",
    });
  }

  // === Conclusion Type Templates ===

  if (taxonomy.conclusionType === "ought") {
    cqs.push({
      cqKey: `${keyPrefix}_normative_basis`,
      text: "What is the normative basis (moral, legal, prudential) for the 'ought' claim?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Normative conclusions require normative premises",
    });
    cqs.push({
      cqKey: `${keyPrefix}_conflicting_obligations`,
      text: "Are there conflicting obligations or values?",
      attackType: "REBUTS",
      targetScope: "conclusion",
      rationale: "Value conflicts challenge prescriptive conclusions",
    });
  }

  if (taxonomy.conclusionType === "is") {
    cqs.push({
      cqKey: `${keyPrefix}_empirical_support`,
      text: "Is there sufficient empirical support for the descriptive claim?",
      attackType: "UNDERMINES",
      targetScope: "premise",
      rationale: "Descriptive conclusions require empirical grounding",
    });
  }

  // === Rule Form Templates ===

  if (taxonomy.ruleForm === "defeasible_MP") {
    cqs.push({
      cqKey: `${keyPrefix}_defeaters`,
      text: "Are there defeaters or exceptions to this inference rule?",
      attackType: "UNDERCUTS",
      targetScope: "inference",
      rationale: "Defeasible rules admit exceptions",
    });
  }

  // === Universal Templates (apply to all schemes) ===

  cqs.push({
    cqKey: `${keyPrefix}_relevance`,
    text: "Are the premises relevant to the conclusion?",
    attackType: "UNDERCUTS",
    targetScope: "inference",
    rationale: "Relevance is required for all argumentation",
  });

  cqs.push({
    cqKey: `${keyPrefix}_sufficient_grounds`,
    text: "Are the premises sufficient to support the conclusion?",
    attackType: "UNDERCUTS",
    targetScope: "inference",
    rationale: "Sufficiency is required for strong arguments",
  });

  return cqs;
}

/**
 * Filters generated CQs to avoid duplicates and prioritize by relevance.
 * Manual CQs always come first, followed by generated CQs sorted by attack type.
 * 
 * @param cqs - Array of generated CQs
 * @param maxCQs - Maximum number of CQs to return (default: 10)
 * @param manualCQs - Optional array of manual CQs to prioritize
 * @returns Filtered and prioritized array of CQs
 */
export function prioritizeCQs(
  cqs: CriticalQuestion[],
  maxCQs: number = 10,
  manualCQs: CriticalQuestion[] = []
): CriticalQuestion[] {
  // Remove duplicates by cqKey
  const seen = new Set<string>();
  const unique = cqs.filter((cq) => {
    if (seen.has(cq.cqKey)) return false;
    seen.add(cq.cqKey);
    return true;
  });

  // Separate manual and generated CQs
  const manualKeys = new Set(manualCQs.map((cq) => cq.cqKey));
  const manual = unique.filter((cq) => manualKeys.has(cq.cqKey));
  const generated = unique.filter((cq) => !manualKeys.has(cq.cqKey));

  // Prioritize generated CQs by attack type (UNDERMINES > UNDERCUTS > REBUTS)
  // Rationale: Premise attacks are most fundamental, inference next, conclusion last
  const priority = { UNDERMINES: 3, UNDERCUTS: 2, REBUTS: 1 };
  generated.sort((a, b) => {
    const diff = priority[b.attackType] - priority[a.attackType];
    if (diff !== 0) return diff;
    // Tie-breaker: alphabetical by cqKey
    return a.cqKey.localeCompare(b.cqKey);
  });

  // Manual CQs first, then generated, limited to maxCQs
  const combined = [...manual, ...generated];
  return combined.slice(0, maxCQs);
}

/**
 * Generates a complete set of CQs for a scheme, with optional user overrides.
 * Combines taxonomy-based generation with manual CQ additions.
 * Manual CQs always come first in the result.
 * 
 * @param taxonomy - Macagno taxonomy fields
 * @param schemeKey - Unique scheme key
 * @param manualCQs - Optional user-defined CQs to merge (will be prioritized first)
 * @param maxCQs - Maximum total CQs (default: 10)
 * @returns Combined and prioritized CQs (manual first, then generated)
 */
export function generateCompleteCQSet(
  taxonomy: TaxonomyFields,
  schemeKey: string,
  manualCQs: CriticalQuestion[] = [],
  maxCQs: number = 10
): CriticalQuestion[] {
  // Generate taxonomy-based CQs
  const generated = generateCQsFromTaxonomy(taxonomy, schemeKey);

  // Merge with manual CQs (manual takes precedence)
  const manualKeys = new Set(manualCQs.map((cq) => cq.cqKey));
  const combined = [
    ...manualCQs,
    ...generated.filter((cq) => !manualKeys.has(cq.cqKey)),
  ];

  // Prioritize and limit (manual CQs stay first)
  return prioritizeCQs(combined, maxCQs, manualCQs);
}

/**
 * Suggests CQ improvements based on taxonomy changes.
 * Useful for edit mode: when user changes taxonomy, suggest new CQs.
 * 
 * @param oldTaxonomy - Previous taxonomy fields
 * @param newTaxonomy - Updated taxonomy fields
 * @param schemeKey - Unique scheme key
 * @returns Array of suggested new CQs to add
 */
export function suggestCQUpdates(
  oldTaxonomy: TaxonomyFields,
  newTaxonomy: TaxonomyFields,
  schemeKey: string
): CriticalQuestion[] {
  const oldCQs = generateCQsFromTaxonomy(oldTaxonomy, schemeKey);
  const newCQs = generateCQsFromTaxonomy(newTaxonomy, schemeKey);

  const oldKeys = new Set(oldCQs.map((cq) => cq.cqKey));
  const suggestions = newCQs.filter((cq) => !oldKeys.has(cq.cqKey));

  return suggestions;
}
