/**
 * Identification Conditions for Argument Schemes
 * 
 * Observable features that help identify which argument scheme is being used.
 * Expert users can recognize these patterns and filter schemes accordingly.
 * 
 * Week 7, Task 7.1: Identification Condition Definitions
 */

import type { ArgumentScheme } from "@prisma/client";

/**
 * Categories of identification conditions
 */
export type ConditionCategory =
  | "source_type"        // Where evidence comes from
  | "reasoning_type"     // Type of logical inference
  | "argument_structure" // Structural features
  | "content_type"       // What the argument is about
  | "appeal_type"        // What the argument appeals to
  | "relationship";      // How elements relate

/**
 * An identification condition that can be observed in an argument
 */
export interface IdentificationCondition {
  id: string;
  category: ConditionCategory;
  label: string;
  description: string;
  examples: string[];
  schemeKeys: string[]; // Schemes that exhibit this condition
  weight: number; // How strongly this indicates the scheme (0-1)
  keywords: string[]; // For future text analysis
}

/**
 * 25+ identification conditions covering common patterns
 */
export const identificationConditions: Record<string, IdentificationCondition> = {
  // SOURCE TYPE CONDITIONS
  appeals_to_expert: {
    id: "appeals_to_expert",
    category: "source_type",
    label: "Appeals to expert testimony",
    description: "The argument cites an expert, authority, or specialist as evidence",
    examples: [
      "Dr. Smith, a climate scientist, says...",
      "According to legal experts...",
      "The surgeon general recommends...",
    ],
    schemeKeys: ["expert_opinion", "position_to_know"],
    weight: 0.9,
    keywords: ["expert", "authority", "specialist", "professional", "according to"],
  },

  appeals_to_popularity: {
    id: "appeals_to_popularity",
    category: "source_type",
    label: "Appeals to popular opinion or practice",
    description: "The argument cites what most people believe or do as evidence",
    examples: [
      "Everyone is doing it this way",
      "Most people believe that...",
      "The majority agrees...",
    ],
    schemeKeys: ["popular_opinion", "popular_practice"],
    weight: 0.85,
    keywords: ["everyone", "most people", "majority", "common", "popular"],
  },

  cites_witness: {
    id: "cites_witness",
    category: "source_type",
    label: "Cites eyewitness testimony",
    description: "The argument relies on what someone directly observed or experienced",
    examples: [
      "I saw it happen with my own eyes",
      "Witnesses reported that...",
      "According to those who were there...",
    ],
    schemeKeys: ["witness_testimony", "position_to_know"],
    weight: 0.85,
    keywords: ["witness", "saw", "observed", "experienced", "present"],
  },

  // REASONING TYPE CONDITIONS
  argues_consequences: {
    id: "argues_consequences",
    category: "reasoning_type",
    label: "Argues from consequences or effects",
    description: "The argument reasons that an action will lead to certain outcomes",
    examples: [
      "If we do X, then Y will happen",
      "This will lead to negative consequences",
      "The result will be...",
    ],
    schemeKeys: [
      "positive_consequences",
      "negative_consequences",
      "good_consequences",
      "bad_consequences",
      "practical_reasoning",
    ],
    weight: 0.85,
    keywords: ["consequence", "result", "effect", "lead to", "cause", "will"],
  },

  argues_causation: {
    id: "argues_causation",
    category: "reasoning_type",
    label: "Argues causal relationship",
    description: "The argument claims one thing causes or is caused by another",
    examples: [
      "X causes Y",
      "This is the result of...",
      "Because of X, we have Y",
    ],
    schemeKeys: ["cause_to_effect", "effect_to_cause", "causal", "sign"],
    weight: 0.9,
    keywords: ["cause", "because", "result", "due to", "leads to"],
  },

  uses_analogy: {
    id: "uses_analogy",
    category: "reasoning_type",
    label: "Draws analogy or comparison",
    description: "The argument compares two situations or cases as being similar",
    examples: [
      "This is like...",
      "Just as X is true, so is Y",
      "By analogy with...",
    ],
    schemeKeys: ["analogy", "precedent", "argument_from_example"],
    weight: 0.9,
    keywords: ["like", "similar", "analogy", "compare", "just as", "parallel"],
  },

  uses_classification: {
    id: "uses_classification",
    category: "reasoning_type",
    label: "Classifies or categorizes",
    description: "The argument assigns something to a category or defines a term",
    examples: [
      "This is a type of X",
      "By definition, this is...",
      "This fits the category of...",
    ],
    schemeKeys: [
      "verbal_classification",
      "definition_to_classification",
      "classification",
    ],
    weight: 0.85,
    keywords: ["classify", "category", "type", "definition", "is a", "kind of"],
  },

  // ARGUMENT STRUCTURE CONDITIONS
  conditional_structure: {
    id: "conditional_structure",
    category: "argument_structure",
    label: "Has if-then conditional structure",
    description: "The argument follows an if-then logical form",
    examples: [
      "If X, then Y",
      "Whenever X happens, Y follows",
      "X implies Y",
    ],
    schemeKeys: [
      "practical_reasoning",
      "cause_to_effect",
      "positive_consequences",
      "negative_consequences",
    ],
    weight: 0.7,
    keywords: ["if", "then", "implies", "whenever", "follows"],
  },

  progressive_steps: {
    id: "progressive_steps",
    category: "argument_structure",
    label: "Shows progressive steps or slippery slope",
    description: "The argument claims one step will lead to a series of steps",
    examples: [
      "If we allow X, then Y will follow, then Z",
      "This is the first step down a slippery slope",
      "One thing leads to another",
    ],
    schemeKeys: ["slippery_slope"],
    weight: 0.95,
    keywords: ["slippery slope", "lead to", "first step", "series", "chain"],
  },

  part_whole_reasoning: {
    id: "part_whole_reasoning",
    category: "argument_structure",
    label: "Reasons from parts to whole or vice versa",
    description: "The argument infers properties of the whole from parts or vice versa",
    examples: [
      "Each part is good, so the whole is good",
      "The team is excellent, so each player is excellent",
    ],
    schemeKeys: ["argument_from_composition", "argument_from_division"],
    weight: 0.9,
    keywords: ["part", "whole", "component", "each", "all", "every"],
  },

  // CONTENT TYPE CONDITIONS
  about_action: {
    id: "about_action",
    category: "content_type",
    label: "Addresses what action to take",
    description: "The argument recommends, justifies, or criticizes an action or policy",
    examples: [
      "We should do X",
      "The right course of action is...",
      "We must not do Y",
    ],
    schemeKeys: [
      "practical_reasoning",
      "value_based_pr",
    ],
    weight: 0.75,
    keywords: ["should", "must", "ought", "action", "do", "policy"],
  },

  about_state: {
    id: "about_state",
    category: "content_type",
    label: "Describes a state of affairs",
    description: "The argument explains how things are or what is true",
    examples: [
      "X is the case",
      "This is true because...",
      "The situation is...",
    ],
    schemeKeys: ["causal", "classification", "sign"],
    weight: 0.7,
    keywords: ["is", "are", "exists", "true", "fact", "case"],
  },

  about_future: {
    id: "about_future",
    category: "content_type",
    label: "Makes prediction about the future",
    description: "The argument claims something will happen or result in the future",
    examples: [
      "This will happen",
      "The future will bring...",
      "We can expect...",
    ],
    schemeKeys: [
      "positive_consequences",
      "negative_consequences",
      "good_consequences",
      "bad_consequences",
    ],
    weight: 0.75,
    keywords: ["will", "future", "predict", "expect", "likely", "probably"],
  },

  // APPEAL TYPE CONDITIONS
  appeals_to_values: {
    id: "appeals_to_values",
    category: "appeal_type",
    label: "Appeals to values or ethics",
    description: "The argument invokes moral principles, rights, or ethical considerations",
    examples: [
      "This is the right thing to do",
      "Fairness requires...",
      "This violates human rights",
    ],
    schemeKeys: ["value_based_pr"],
    weight: 0.85,
    keywords: ["right", "wrong", "fair", "moral", "ethical", "justice", "rights"],
  },

  appeals_to_fear: {
    id: "appeals_to_fear",
    category: "appeal_type",
    label: "Appeals to fear or negative emotions",
    description: "The argument emphasizes dangers, risks, or negative outcomes",
    examples: [
      "This is dangerous and should be avoided",
      "We risk disaster if...",
      "The threats are real",
    ],
    schemeKeys: ["negative_consequences", "bad_consequences"],
    weight: 0.8,
    keywords: ["danger", "risk", "threat", "fear", "disaster", "catastrophe"],
  },

  // RELATIONSHIP CONDITIONS
  shows_similarity: {
    id: "shows_similarity",
    category: "relationship",
    label: "Shows similarity or parallel",
    description: "The argument identifies common features between two cases",
    examples: [
      "These cases are similar in that...",
      "Both share the feature of...",
      "There's a parallel between...",
    ],
    schemeKeys: ["analogy", "precedent", "argument_from_example"],
    weight: 0.85,
    keywords: ["similar", "parallel", "alike", "same", "common", "both"],
  },

  cites_precedent: {
    id: "cites_precedent",
    category: "relationship",
    label: "Cites precedent or past case",
    description: "The argument references a previous case or established practice",
    examples: [
      "We handled this situation before by...",
      "The precedent shows...",
      "Historically, we have...",
    ],
    schemeKeys: ["precedent", "argument_from_example", "popular_practice"],
    weight: 0.9,
    keywords: ["precedent", "previous", "before", "historically", "past", "established"],
  },

  shows_inconsistency: {
    id: "shows_inconsistency",
    category: "relationship",
    label: "Points out inconsistency or hypocrisy",
    description: "The argument identifies contradictions in position or actions",
    examples: [
      "You said X but now you're saying Y",
      "Your actions contradict your words",
      "You do the same thing you criticize",
    ],
    schemeKeys: ["two_wrongs"],
    weight: 0.9,
    keywords: ["inconsistent", "contradict", "hypocrite", "but", "however", "yet"],
  },

  addresses_relevance: {
    id: "addresses_relevance",
    category: "relationship",
    label: "Addresses relevance or connection",
    description: "The argument questions or establishes relevance of a claim",
    examples: [
      "That point is not relevant to the discussion",
      "This connects to the issue because...",
      "How is that relevant?",
    ],
    schemeKeys: ["claim_relevance"],
    weight: 0.85,
    keywords: ["relevant", "related", "connected", "pertinent", "applies"],
  },

  addresses_clarity: {
    id: "addresses_clarity",
    category: "relationship",
    label: "Addresses clarity or precision",
    description: "The argument questions or clarifies the meaning of terms",
    examples: [
      "What do you mean by that?",
      "That needs to be stated more clearly",
      "To be precise...",
    ],
    schemeKeys: ["claim_clarity"],
    weight: 0.85,
    keywords: ["clear", "unclear", "precise", "mean", "define", "clarify"],
  },

  cites_credentials: {
    id: "cites_credentials",
    category: "source_type",
    label: "Cites credentials or qualifications",
    description: "The argument emphasizes the expertise or qualifications of a source",
    examples: [
      "She has a PhD in...",
      "With 20 years of experience...",
      "As a certified expert...",
    ],
    schemeKeys: ["expert_opinion", "position_to_know"],
    weight: 0.85,
    keywords: ["credential", "qualification", "degree", "certified", "experience", "expert"],
  },

  uses_evidence: {
    id: "uses_evidence",
    category: "source_type",
    label: "Cites empirical evidence or data",
    description: "The argument references studies, statistics, or observable facts",
    examples: [
      "Studies show that...",
      "The data indicates...",
      "Research demonstrates...",
    ],
    schemeKeys: ["sign", "witness_testimony"],
    weight: 0.75,
    keywords: ["study", "data", "research", "evidence", "statistics", "shows"],
  },

  argues_from_goals: {
    id: "argues_from_goals",
    category: "reasoning_type",
    label: "Argues from goals or objectives",
    description: "The argument reasons that an action achieves a desired goal",
    examples: [
      "To achieve X, we must do Y",
      "This will help us reach our goal",
      "If we want X, then we need Y",
    ],
    schemeKeys: ["practical_reasoning", "value_based_pr"],
    weight: 0.85,
    keywords: ["goal", "objective", "achieve", "reach", "attain", "purpose"],
  },
};

/**
 * Get all conditions in a category
 */
export function getConditionsByCategory(
  category: ConditionCategory
): IdentificationCondition[] {
  return Object.values(identificationConditions).filter(
    (c) => c.category === category
  );
}

/**
 * Result of matching schemes to selected conditions
 */
export interface SchemeMatch {
  scheme: ArgumentScheme;
  score: number; // 0-1 score based on matched conditions
  matchedConditions: string[]; // IDs of conditions that matched
  percentage: number; // Score as percentage
  quality: "perfect" | "strong" | "moderate" | "weak";
}

/**
 * Get schemes that match the selected conditions
 */
export function getSchemesForConditions(
  selectedConditions: string[],
  allSchemes: ArgumentScheme[]
): SchemeMatch[] {
  if (selectedConditions.length === 0) {
    return [];
  }

  const matches: SchemeMatch[] = [];

  for (const scheme of allSchemes) {
    const matchedConditions: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const conditionId of selectedConditions) {
      const condition = identificationConditions[conditionId];
      if (!condition) continue;

      totalWeight += condition.weight;

      if (condition.schemeKeys.includes(scheme.key)) {
        matchedConditions.push(conditionId);
        matchedWeight += condition.weight;
      }
    }

    if (matchedConditions.length > 0) {
      const score = matchedWeight / totalWeight;
      const percentage = Math.round(score * 100);

      let quality: "perfect" | "strong" | "moderate" | "weak";
      if (percentage >= 85) quality = "perfect";
      else if (percentage >= 70) quality = "strong";
      else if (percentage >= 50) quality = "moderate";
      else quality = "weak";

      matches.push({
        scheme,
        score,
        matchedConditions,
        percentage,
        quality,
      });
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Get all category labels
 */
export const categoryLabels: Record<ConditionCategory, string> = {
  source_type: "Evidence Source",
  reasoning_type: "Type of Reasoning",
  argument_structure: "Argument Structure",
  content_type: "Content Focus",
  appeal_type: "Type of Appeal",
  relationship: "Relationships",
};

/**
 * Get category order for display
 */
export function getCategoryOrder(): ConditionCategory[] {
  return [
    "source_type",
    "reasoning_type",
    "content_type",
    "appeal_type",
    "argument_structure",
    "relationship",
  ];
}

/**
 * Get total number of conditions
 */
export function getTotalConditions(): number {
  return Object.keys(identificationConditions).length;
}

/**
 * Search conditions by text
 */
export function searchConditions(query: string): IdentificationCondition[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(identificationConditions).filter(
    (condition) =>
      condition.label.toLowerCase().includes(lowerQuery) ||
      condition.description.toLowerCase().includes(lowerQuery) ||
      condition.keywords.some((k) => k.includes(lowerQuery))
  );
}
