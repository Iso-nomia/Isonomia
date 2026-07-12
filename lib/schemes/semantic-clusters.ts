/**
 * Semantic Clusters for Argument Schemes
 * 
 * Organizes schemes by semantic domain (authority, causality, values, etc.)
 * to enable topic-based browsing and discovery.
 * 
 * Week 6, Task 6.1: Cluster Browser Foundation
 */

import type { ArgumentScheme } from "@prisma/client";

export interface SemanticCluster {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
  color: string; // Tailwind color name
  schemeKeys: string[]; // ArgumentScheme keys in this cluster
  relatedClusters: string[]; // Semantically related cluster IDs
  typicalUse: string; // When to use schemes in this cluster
  examples: string[]; // Example arguments
}

/**
 * Eight core semantic clusters covering the main domains of argumentation
 */
export const semanticClusters: Record<string, SemanticCluster> = {
  authority: {
    id: "authority",
    name: "Authority & Expertise",
    description: "Arguments based on expert testimony, institutional positions, or popular belief",
    icon: "§",
    color: "slate",
    schemeKeys: [
      "expert_opinion",
      "popular_opinion",
      "popular_practice",
      "position_to_know",
      "witness_testimony",
    ],
    relatedClusters: ["evidence", "values"],
    typicalUse: "When your claim relies on what others have said or what experts believe",
    examples: [
      "Scientists agree that climate change is real",
      "The majority of voters support this policy",
      "The court ruled that this is illegal",
      "Experts in this field recommend this approach",
    ],
  },

  causality: {
    id: "causality",
    name: "Cause & Effect",
    description: "Arguments about causal relationships, consequences, and predictive reasoning",
    icon: "⇒",
    color: "green",
    schemeKeys: [
      "cause_to_effect",
      "effect_to_cause",
      "causal",
      "sign",
      "correlation_to_cause",
      "good_consequences",
      "bad_consequences",
    ],
    relatedClusters: ["decision_making", "evidence"],
    typicalUse: "When arguing that X causes Y, or that Y is evidence of X",
    examples: [
      "Raising taxes will reduce economic growth",
      "The broken window indicates a burglary",
      "This policy will have negative side effects",
      "These symptoms suggest this diagnosis",
    ],
  },

  decision_making: {
    id: "decision_making",
    name: "Practical Decision Making",
    description: "Arguments about what actions to take, policies to adopt, or decisions to make",
    icon: "𐂷",
    color: "purple",
    schemeKeys: [
      "practical_reasoning",
      "value_based_pr",
      "negative_consequences",
      "positive_consequences",
      "fear_appeal",
      "waste",
    ],
    relatedClusters: ["causality", "values"],
    typicalUse: "When arguing for or against a course of action",
    examples: [
      "We should adopt this policy to achieve our goal",
      "This option is too risky",
      "We have already invested too much to quit now",
      "This is the most efficient way to reach our objective",
    ],
  },

  analogy: {
    id: "analogy",
    name: "Analogy & Comparison",
    description: "Arguments based on similarity, precedent, or parallel cases",
    icon: "∷",
    color: "orange",
    schemeKeys: [
      "analogy",
      "precedent",
      "example",
      "argument_from_example",
      "gradualism",
      "slippery_slope",
    ],
    relatedClusters: ["classification", "decision_making"],
    typicalUse: "When arguing that X is like Y, so what is true of Y is true of X",
    examples: [
      "Banning this is like Prohibition, which failed",
      "We handled the 2008 crisis this way, so we should do the same now",
      "If we allow this, we must allow that similar thing",
      "This case is analogous to the precedent set in Brown v. Board",
    ],
  },

  classification: {
    id: "classification",
    name: "Classification & Definition",
    description: "Arguments about what category something belongs to or what terms mean",
    icon: "ሗ",
    color: "yellow",
    schemeKeys: [
      "verbal_classification",
      "definition_to_verbal_classification",
      "definition_to_classification",
      "classification",
      "composition",
      "argument_from_composition",
      "division",
      "argument_from_division",
    ],
    relatedClusters: ["analogy", "values"],
    typicalUse: "When arguing about what something is or what category it belongs to",
    examples: [
      "This is a tax, not a fee",
      "By definition, murder is intentional",
      "Whales are mammals, not fish",
      "If each part is excellent, the whole must be excellent",
    ],
  },

  values: {
    id: "values",
    name: "Values & Ethics",
    description: "Arguments based on moral principles, ethical considerations, or value judgments",
    icon: "◎",
    color: "red",
    schemeKeys: [
      "value_based_pr",
      "commitment",
      "fairness",
      "two_wrongs",
    ],
    relatedClusters: ["decision_making", "authority"],
    typicalUse: "When arguing that something is right/wrong, fair/unfair, or aligns with values",
    examples: [
      "This violates human rights",
      "Fairness requires equal treatment",
      "We made a commitment, so we must follow through",
      "Two wrongs do not make a right",
    ],
  },

  evidence: {
    id: "evidence",
    name: "Evidence & Proof",
    description: "Arguments about what counts as evidence and how strong the proof is",
    icon: "∵",
    color: "indigo",
    schemeKeys: [
      "sign",
      "witness_testimony",
      "position_to_know",
      "ignorance",
      "correlation_to_cause",
    ],
    relatedClusters: ["authority", "causality"],
    typicalUse: "When arguing about the strength or relevance of evidence",
    examples: [
      "There is no evidence against it, so it must be true",
      "These symptoms indicate this disease",
      "The witness saw it happen",
      "The lack of proof suggests it did not occur",
    ],
  },

  opposition: {
    id: "opposition",
    name: "Opposition & Conflict",
    description: "Arguments based on inconsistency, hypocrisy, or conflicting commitments",
    icon: "⊥",
    color: "gray",
    schemeKeys: [
      "inconsistent_commitment",
      "circumstantial_ad_hominem",
      "bias",
      "two_wrongs",
    ],
    relatedClusters: ["values", "authority"],
    typicalUse: "When pointing out contradictions or conflicts in opponent's position",
    examples: [
      "You said X before, but now you are saying Y",
      "You are biased because you benefit from this",
      "You do the same thing you are criticizing",
      "Your actions contradict your stated principles",
    ],
  },

  // Special cluster for schemes that don't fit well in other categories
  // or are meta-level schemes about claims themselves
  meta: {
    id: "meta",
    name: "Meta-Claims & Testing",
    description: "Arguments about the quality, clarity, or relevance of claims themselves",
    icon: "⌖",
    color: "sky",
    schemeKeys: [
      "bare_assertion",
      "claim_relevance",
      "claim_clarity",
      "claim_truth",
      "test_scheme",
    ],
    relatedClusters: ["evidence", "opposition"],
    typicalUse: "When arguing about the quality or properties of a claim itself",
    examples: [
      "That's just an assertion without support",
      "That point is not relevant to the discussion",
      "The claim needs to be stated more clearly",
      "The truth of that claim is questionable",
    ],
  },
};

/**
 * Get all schemes that belong to a specific cluster
 */
export function getSchemesForCluster(
  clusterId: string,
  allSchemes: ArgumentScheme[]
): ArgumentScheme[] {
  const cluster = semanticClusters[clusterId];
  if (!cluster) return [];

  return allSchemes.filter((scheme) =>
    cluster.schemeKeys.includes(scheme.key)
  );
}

/**
 * Find which cluster a scheme belongs to
 */
export function getClusterForScheme(schemeKey: string): SemanticCluster | null {
  for (const cluster of Object.values(semanticClusters)) {
    if (cluster.schemeKeys.includes(schemeKey)) {
      return cluster;
    }
  }
  return null;
}

/**
 * Get schemes related to a given scheme (same cluster + related clusters)
 */
export function getRelatedSchemes(
  schemeKey: string,
  allSchemes: ArgumentScheme[],
  maxResults: number = 6
): ArgumentScheme[] {
  const cluster = getClusterForScheme(schemeKey);
  if (!cluster) return [];

  // Get schemes from same cluster (excluding the current scheme)
  const sameCluster = getSchemesForCluster(cluster.id, allSchemes).filter(
    (s) => s.key !== schemeKey
  );

  // Get schemes from related clusters
  const relatedClusterSchemes = cluster.relatedClusters.flatMap((cId) =>
    getSchemesForCluster(cId, allSchemes)
  );

  // Combine: prioritize same cluster, then related
  const combined = [...sameCluster, ...relatedClusterSchemes];

  // Remove duplicates and limit
  const unique = Array.from(new Map(combined.map((s) => [s.key, s])).values());
  return unique.slice(0, maxResults);
}

/**
 * Get cluster count (how many schemes in each cluster)
 */
export function getClusterCounts(
  allSchemes: ArgumentScheme[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const [id, cluster] of Object.entries(semanticClusters)) {
    counts[id] = getSchemesForCluster(id, allSchemes).length;
  }

  return counts;
}

/**
 * Search clusters by name or description
 */
export function searchClusters(query: string): SemanticCluster[] {
  const lowerQuery = query.toLowerCase();

  return Object.values(semanticClusters).filter(
    (cluster) =>
      cluster.name.toLowerCase().includes(lowerQuery) ||
      cluster.description.toLowerCase().includes(lowerQuery) ||
      cluster.typicalUse.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all cluster IDs in display order
 */
export function getClusterOrder(): string[] {
  return [
    "authority",
    "causality",
    "decision_making",
    "analogy",
    "classification",
    "values",
    "evidence",
    "opposition",
    "meta",
  ];
}
