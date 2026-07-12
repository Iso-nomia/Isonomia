// lib/agora/homSetConfidence.ts

/**
 * Hom-Set Confidence Computation for Categorical Argumentation Framework
 * 
 * In category theory, a hom-set Hom(A, B) represents all morphisms from object A to B.
 * In Mesh's argumentation framework:
 * - Objects: Arguments
 * - Morphisms: ArgumentEdges (support, attack, undercut, etc.)
 * - Hom(A, B): All edges from argument A to argument B
 * 
 * This module computes aggregate confidence across morphisms in a hom-set,
 * considering:
 * 1. Individual edge confidences (NLI scores, user ratings)
 * 2. Compositional paths (morphism composition: A → B → C)
 * 3. Uncertainty propagation (how confidence degrades through composition)
 * 4. Weighted averaging (different edge types have different impact)
 */

import { EdgeType } from "@prisma/client";

/**
 * Morphism (edge) in the argumentation category.
 */
export interface Morphism {
  id: string;
  fromArgumentId: string;
  toArgumentId: string;
  type: EdgeType;
  confidence?: number | null;
  weight?: number; // Importance/strength of this edge
  createdAt?: Date | string;
}

/**
 * Compositional path: sequence of morphisms A → B → C → ...
 */
export interface CompositionalPath {
  morphisms: Morphism[];
  totalConfidence: number;
  uncertainty: number;
  length: number; // Number of edges in path
}

/**
 * Result of hom-set confidence computation.
 */
export interface HomSetConfidenceResult {
  homSetSize: number; // |Hom(A, B)| - number of morphisms
  aggregateConfidence: number; // Weighted average confidence
  minConfidence: number; // Least confident morphism
  maxConfidence: number; // Most confident morphism
  uncertainty: number; // Propagated uncertainty
  weightedConfidence: number; // Confidence weighted by edge importance
  compositionalPaths?: CompositionalPath[]; // Optional: paths through category
  edgeTypeDistribution: Record<string, number>; // Count by edge type
}

/**
 * Weights for different edge types in confidence aggregation.
 * Higher weight = more impact on aggregate confidence.
 */
export const EDGE_TYPE_WEIGHTS: Partial<Record<EdgeType, number>> = {
  support: 1.0,
  rebut: 0.9,
  undercut: 0.85,
  concede: 0.7,
};

/**
 * Compute aggregate confidence for a hom-set Hom(A, B).
 * 
 * Algorithm:
 * 1. Filter morphisms with valid confidence scores
 * 2. Apply edge-type weighting
 * 3. Compute weighted average
 * 4. Calculate uncertainty (variance-based)
 * 5. Return aggregate metrics
 * 
 * @param morphisms - Array of edges in Hom(A, B)
 * @param options - Configuration options
 * @returns Aggregate confidence metrics
 */
export function computeHomSetConfidence(
  morphisms: Morphism[],
  options?: {
    includeCompositionalPaths?: boolean;
    uncertaintyFactor?: number; // 0-1, how much uncertainty to propagate
  }
): HomSetConfidenceResult {
  const { includeCompositionalPaths = false, uncertaintyFactor = 0.1 } = options || {};

  // Edge case: empty hom-set
  if (morphisms.length === 0) {
    return {
      homSetSize: 0,
      aggregateConfidence: 0,
      minConfidence: 0,
      maxConfidence: 0,
      uncertainty: 1.0, // Maximum uncertainty
      weightedConfidence: 0,
      edgeTypeDistribution: {},
    };
  }

  // Filter morphisms with valid confidence
  const validMorphisms = morphisms.filter(
    (m) => m.confidence !== null && m.confidence !== undefined && !isNaN(m.confidence)
  );

  // Edge case: no valid confidences
  if (validMorphisms.length === 0) {
    return {
      homSetSize: morphisms.length,
      aggregateConfidence: 0.5, // Default to neutral
      minConfidence: 0,
      maxConfidence: 1,
      uncertainty: 1.0,
      weightedConfidence: 0.5,
      edgeTypeDistribution: computeEdgeTypeDistribution(morphisms),
    };
  }

  // Extract confidences
  const confidences = validMorphisms.map((m) => m.confidence as number);
  const minConfidence = Math.min(...confidences);
  const maxConfidence = Math.max(...confidences);

  // Compute simple average
  const simpleAverage = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

  // Compute weighted average (by edge type)
  let weightedSum = 0;
  let totalWeight = 0;

  for (const morphism of validMorphisms) {
    const confidence = morphism.confidence as number;
    const edgeWeight = EDGE_TYPE_WEIGHTS[morphism.type] ?? 0.5;
    const morphismWeight = morphism.weight ?? 1.0;

    const combinedWeight = edgeWeight * morphismWeight;
    weightedSum += confidence * combinedWeight;
    totalWeight += combinedWeight;
  }

  const weightedConfidence = totalWeight > 0 ? weightedSum / totalWeight : simpleAverage;

  // Compute uncertainty (variance-based)
  const variance = confidences.reduce((sum, c) => {
    const diff = c - simpleAverage;
    return sum + diff * diff;
  }, 0) / confidences.length;

  const standardDeviation = Math.sqrt(variance);

  // Uncertainty increases with:
  // 1. High variance (disagreement among edges)
  // 2. Number of edges (more edges = more potential for conflict)
  // 3. Uncertainty factor (user-configurable)
  const baseUncertainty = Math.min(1.0, standardDeviation);
  const sizeUncertainty = Math.min(0.5, morphisms.length / 20); // Caps at 0.5 for 20+ edges
  const uncertainty = Math.min(
    1.0,
    baseUncertainty + sizeUncertainty * uncertaintyFactor
  );

  // Compute compositional paths (if requested)
  let compositionalPaths: CompositionalPath[] | undefined;
  if (includeCompositionalPaths) {
    compositionalPaths = computeCompositionalPaths(morphisms);
  }

  return {
    homSetSize: morphisms.length,
    aggregateConfidence: weightedConfidence,
    minConfidence,
    maxConfidence,
    uncertainty,
    weightedConfidence,
    compositionalPaths,
    edgeTypeDistribution: computeEdgeTypeDistribution(morphisms),
  };
}

/**
 * Compute edge type distribution for a set of morphisms.
 * 
 * @param morphisms - Array of morphisms
 * @returns Record of edge type counts
 */
function computeEdgeTypeDistribution(
  morphisms: Morphism[]
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const morphism of morphisms) {
    const type = morphism.type;
    distribution[type] = (distribution[type] || 0) + 1;
  }

  return distribution;
}

/**
 * Compute compositional paths through the category.
 * 
 * A compositional path is a sequence of morphisms:
 * A → B → C → ... → Z
 * 
 * Confidence degrades through composition:
 * conf(g ∘ f) ≈ conf(f) × conf(g) × compositionFactor
 * 
 * @param morphisms - Array of morphisms
 * @returns Array of compositional paths
 */
function computeCompositionalPaths(
  morphisms: Morphism[]
): CompositionalPath[] {
  // Build adjacency map: argumentId → outgoing edges
  const adjacencyMap = new Map<string, Morphism[]>();

  for (const morphism of morphisms) {
    const outgoing = adjacencyMap.get(morphism.fromArgumentId) || [];
    outgoing.push(morphism);
    adjacencyMap.set(morphism.fromArgumentId, outgoing);
  }

  const paths: CompositionalPath[] = [];
  const visited = new Set<string>();

  // DFS to find paths (limit depth to 5 to avoid combinatorial explosion)
  const MAX_DEPTH = 5;

  function dfs(
    currentArgumentId: string,
    currentPath: Morphism[],
    currentConfidence: number,
    depth: number
  ) {
    if (depth >= MAX_DEPTH) return;

    // Mark as visited (for this path)
    visited.add(currentArgumentId);

    const outgoing = adjacencyMap.get(currentArgumentId) || [];

    for (const edge of outgoing) {
      // Skip if target already in path (avoid cycles)
      if (visited.has(edge.toArgumentId)) continue;

      // Compute compositional confidence
      const edgeConfidence = edge.confidence ?? 0.5;
      const compositionFactor = 0.9; // Confidence decays through composition
      const newConfidence = currentConfidence * edgeConfidence * compositionFactor;

      // Add to path
      const newPath = [...currentPath, edge];

      // Record path if length > 1 (actual composition)
      if (newPath.length > 1) {
        paths.push({
          morphisms: newPath,
          totalConfidence: newConfidence,
          uncertainty: 1 - newConfidence,
          length: newPath.length,
        });
      }

      // Recurse
      dfs(edge.toArgumentId, newPath, newConfidence, depth + 1);
    }

    // Unmark (backtrack)
    visited.delete(currentArgumentId);
  }

  // Start DFS from each morphism source
  const startingNodes = new Set(morphisms.map((m) => m.fromArgumentId));
  for (const nodeId of startingNodes) {
    dfs(nodeId, [], 1.0, 0);
  }

  // Sort paths by confidence (descending)
  paths.sort((a, b) => b.totalConfidence - a.totalConfidence);

  // Return top 10 paths (avoid overwhelming output)
  return paths.slice(0, 10);
}

/**
 * Compute confidence of a compositional path (morphism composition).
 * 
 * For path A → B → C:
 * conf(g ∘ f) = conf(f) × conf(g) × decay^(length-1)
 * 
 * Where decay factor accounts for confidence degradation through composition.
 * 
 * @param path - Compositional path
 * @param decayFactor - Confidence decay per composition step (default 0.9)
 * @returns Total confidence of the composed morphism
 */
export function computeCompositionalConfidence(
  path: Morphism[],
  decayFactor: number = 0.9
): number {
  if (path.length === 0) return 0;
  if (path.length === 1) return path[0].confidence ?? 0.5;

  let confidence = 1.0;

  for (let i = 0; i < path.length; i++) {
    const morphismConfidence = path[i].confidence ?? 0.5;
    confidence *= morphismConfidence;

    // Apply decay for each composition step (except the first)
    if (i > 0) {
      confidence *= decayFactor;
    }
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Aggregate confidence across multiple hom-sets.
 * 
 * Use case: Compute overall confidence for an argument considering
 * all hom-sets involving it (incoming + outgoing edges).
 * 
 * @param homSets - Array of hom-set results
 * @returns Global aggregate confidence
 */
export function aggregateMultipleHomSets(
  homSets: HomSetConfidenceResult[]
): HomSetConfidenceResult {
  if (homSets.length === 0) {
    return {
      homSetSize: 0,
      aggregateConfidence: 0,
      minConfidence: 0,
      maxConfidence: 0,
      uncertainty: 1.0,
      weightedConfidence: 0,
      edgeTypeDistribution: {},
    };
  }

  const totalSize = homSets.reduce((sum, hs) => sum + hs.homSetSize, 0);
  const allConfidences = homSets.map((hs) => hs.aggregateConfidence);
  const allWeights = homSets.map((hs) => hs.homSetSize); // Weight by size

  // Weighted average
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < homSets.length; i++) {
    weightedSum += allConfidences[i] * allWeights[i];
    totalWeight += allWeights[i];
  }

  const aggregateConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Min/max across all hom-sets
  const minConfidence = Math.min(...homSets.map((hs) => hs.minConfidence));
  const maxConfidence = Math.max(...homSets.map((hs) => hs.maxConfidence));

  // Average uncertainty
  const avgUncertainty =
    homSets.reduce((sum, hs) => sum + hs.uncertainty, 0) / homSets.length;

  // Merge edge type distributions
  const edgeTypeDistribution: Record<string, number> = {};
  for (const hs of homSets) {
    for (const [type, count] of Object.entries(hs.edgeTypeDistribution)) {
      edgeTypeDistribution[type] = (edgeTypeDistribution[type] || 0) + count;
    }
  }

  return {
    homSetSize: totalSize,
    aggregateConfidence,
    minConfidence,
    maxConfidence,
    uncertainty: avgUncertainty,
    weightedConfidence: aggregateConfidence,
    edgeTypeDistribution,
  };
}

/**
 * Filter morphisms by confidence threshold.
 * 
 * @param morphisms - Array of morphisms
 * @param threshold - Minimum confidence (0-1)
 * @returns Filtered morphisms
 */
export function filterByConfidence(
  morphisms: Morphism[],
  threshold: number
): Morphism[] {
  return morphisms.filter(
    (m) =>
      m.confidence !== null &&
      m.confidence !== undefined &&
      m.confidence >= threshold
  );
}

/**
 * Group morphisms by edge type.
 * 
 * @param morphisms - Array of morphisms
 * @returns Map of edge type to morphisms
 */
export function groupByEdgeType(
  morphisms: Morphism[]
): Map<EdgeType, Morphism[]> {
  const groups = new Map<EdgeType, Morphism[]>();

  for (const morphism of morphisms) {
    const group = groups.get(morphism.type) || [];
    group.push(morphism);
    groups.set(morphism.type, group);
  }

  return groups;
}
