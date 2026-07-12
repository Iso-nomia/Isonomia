/**
 * Argumentation Chain Analysis Utilities
 * 
 * Implements computational analysis algorithms for ArgumentChain feature:
 * - Critical path detection (Task 3.1)
 * - Cycle detection (Task 3.2)
 * - WWAW strength calculation (Task 3.3)
 * - Wei & Prakken structure classification (Task 3.5)
 * 
 * Research foundations:
 * - Rahwan et al. (2007) - WWAW strength formula
 * - Wei & Prakken (2019) - Argument structure taxonomy
 * - Prakken (2012) - ASPIC+ preference orderings
 */

import type { Node, Edge } from "@xyflow/react";
import type { ChainNodeData, ChainEdgeData } from "@/lib/types/argumentChain";

// ============================================================================
// Type Definitions
// ============================================================================

export interface CriticalPath {
  nodeIds: string[];
  totalStrength: number;
  avgStrength: number;
  weakestLink: {
    nodeId: string;
    edgeStrength: number;
  };
  pathLength: number;
}

export interface Cycle {
  nodeIds: string[];
  severity: "warning" | "error";
  avgStrength: number;
}

export interface ChainStrength {
  overallStrength: number;
  nodeStrengths: Map<string, number>;
  vulnerableNodes: string[];
  strongNodes: string[];
  structureType: string;
}

export interface StructureAnalysis {
  detectedType: "SCS" | "SDS" | "LCS" | "LDS" | "MS" | "Unit";
  description: string;
  confidence: number;
  hasConvergence: boolean;
  hasDivergence: boolean;
  hasLinking: boolean;
}

// Edge types that contribute positive strength (support)
const SUPPORT_EDGE_TYPES = ["SUPPORTS", "ENABLES", "PRESUPPOSES", "EXEMPLIFIES"];

// Edge types that contribute negative strength (attack)
const ATTACK_EDGE_TYPES = ["REFUTES", "QUALIFIES"];

// ============================================================================
// Task 3.1: Critical Path Detection
// ============================================================================

/**
 * Find the strongest reasoning path through the argument chain
 * 
 * Uses modified depth-first search to explore all paths from premise nodes
 * (no incoming edges) to conclusion nodes (no outgoing edges), tracking
 * cumulative edge strengths.
 * 
 * The critical path is the path with the highest average edge strength,
 * representing the strongest reasoning chain in the argument.
 * 
 * @param nodes - ReactFlow nodes with argument data
 * @param edges - ReactFlow edges with strength values
 * @returns Critical path with node IDs and strength metrics
 * 
 * @example
 * ```ts
 * const path = findCriticalPath(nodes, edges);
 * console.log(`Strongest path: ${path.nodeIds.join(" → ")}`);
 * console.log(`Average strength: ${path.avgStrength.toFixed(2)}`);
 * ```
 */
export function findCriticalPath(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): CriticalPath {
  if (nodes.length === 0) {
    return {
      nodeIds: [],
      totalStrength: 0,
      avgStrength: 0,
      weakestLink: { nodeId: "", edgeStrength: 0 },
      pathLength: 0,
    };
  }

  // Build adjacency list for efficient graph traversal
  const graph = new Map<string, Array<{ target: string; strength: number }>>();
  
  for (const edge of edges) {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push({
      target: edge.target,
      strength: edge.data?.strength ?? 1.0,
    });
  }

  // Identify premise nodes (roots: no incoming edges)
  const premiseNodes = nodes.filter(
    (node) => !edges.some((edge) => edge.target === node.id)
  );

  // Identify conclusion nodes (leaves: no outgoing edges)
  const conclusionNodes = nodes.filter(
    (node) => !edges.some((edge) => edge.source === node.id)
  );

  // Handle single-node chain
  if (premiseNodes.length === 0 || conclusionNodes.length === 0) {
    return {
      nodeIds: nodes.map((n) => n.id),
      totalStrength: 1.0,
      avgStrength: 1.0,
      weakestLink: { nodeId: nodes[0]?.id || "", edgeStrength: 1.0 },
      pathLength: nodes.length,
    };
  }

  // Find strongest path from any premise to any conclusion
  let bestPath: CriticalPath | null = null;

  for (const premise of premiseNodes) {
    for (const conclusion of conclusionNodes) {
      const path = findStrongestPathBetween(
        premise.id,
        conclusion.id,
        graph
      );

      if (path) {
        const avgStrength = path.totalStrength / path.pathLength;
        
        if (!bestPath || avgStrength > bestPath.avgStrength) {
          bestPath = {
            ...path,
            avgStrength,
          };
        }
      }
    }
  }

  // Fallback: if no complete path found, return longest path
  if (!bestPath) {
    const longestPath = findLongestPath(premiseNodes[0].id, graph);
    return longestPath;
  }

  return bestPath;
}

/**
 * Find strongest path between two specific nodes using DFS
 * 
 * @param start - Starting node ID
 * @param end - Target node ID
 * @param graph - Adjacency list with edge strengths
 * @returns Path with strength metrics, or null if no path exists
 */
function findStrongestPathBetween(
  start: string,
  end: string,
  graph: Map<string, Array<{ target: string; strength: number }>>
): Omit<CriticalPath, "avgStrength"> | null {
  const visited = new Set<string>();
  const path: string[] = [];
  const edgeStrengths: number[] = [];

  function dfs(current: string): boolean {
    visited.add(current);
    path.push(current);

    // Found target
    if (current === end) {
      return true;
    }

    const neighbors = graph.get(current) || [];
    
    // Sort neighbors by strength (greedy heuristic for better paths)
    const sortedNeighbors = [...neighbors].sort((a, b) => b.strength - a.strength);

    for (const { target, strength } of sortedNeighbors) {
      if (!visited.has(target)) {
        edgeStrengths.push(strength);
        if (dfs(target)) {
          return true;
        }
        edgeStrengths.pop();
      }
    }

    path.pop();
    visited.delete(current);
    return false;
  }

  const found = dfs(start);

  if (!found || path.length === 0) {
    return null;
  }

  const totalStrength = edgeStrengths.reduce((sum, s) => sum + s, 0);
  const minStrength = edgeStrengths.length > 0 ? Math.min(...edgeStrengths) : 1.0;
  const weakestLinkIndex = edgeStrengths.indexOf(minStrength);

  return {
    nodeIds: path,
    totalStrength,
    weakestLink: {
      nodeId: path[weakestLinkIndex] || path[0],
      edgeStrength: minStrength,
    },
    pathLength: edgeStrengths.length,
  };
}

/**
 * Fallback: find longest path from a starting node (for disconnected graphs)
 */
function findLongestPath(
  start: string,
  graph: Map<string, Array<{ target: string; strength: number }>>
): CriticalPath {
  const visited = new Set<string>();
  let longestPath: string[] = [];
  let longestStrengths: number[] = [];

  function dfs(current: string, path: string[], strengths: number[]): void {
    visited.add(current);
    path.push(current);

    const neighbors = graph.get(current) || [];
    let hasUnvisitedNeighbor = false;

    for (const { target, strength } of neighbors) {
      if (!visited.has(target)) {
        hasUnvisitedNeighbor = true;
        dfs(target, path, [...strengths, strength]);
      }
    }

    // Leaf node or no unvisited neighbors
    if (!hasUnvisitedNeighbor && path.length > longestPath.length) {
      longestPath = [...path];
      longestStrengths = [...strengths];
    }

    path.pop();
    visited.delete(current);
  }

  dfs(start, [], []);

  const totalStrength = longestStrengths.reduce((sum, s) => sum + s, 0);
  const avgStrength = longestStrengths.length > 0 ? totalStrength / longestStrengths.length : 1.0;
  const minStrength = longestStrengths.length > 0 ? Math.min(...longestStrengths) : 1.0;
  const weakestLinkIndex = longestStrengths.indexOf(minStrength);

  return {
    nodeIds: longestPath,
    totalStrength,
    avgStrength,
    weakestLink: {
      nodeId: longestPath[weakestLinkIndex] || longestPath[0] || "",
      edgeStrength: minStrength,
    },
    pathLength: longestStrengths.length,
  };
}

// ============================================================================
// Task 3.2: Cycle Detection
// ============================================================================

/**
 * Detect circular reasoning in argument chains using Tarjan's algorithm
 * 
 * Cycles represent circular reasoning, which is a logical fallacy. This function
 * identifies strongly connected components (SCCs) in the argument graph and
 * classifies them by severity based on average edge strength.
 * 
 * @param nodes - ReactFlow nodes
 * @param edges - ReactFlow edges with strength
 * @returns Array of detected cycles with severity classification
 * 
 * @example
 * ```ts
 * const cycles = detectCycles(nodes, edges);
 * if (cycles.length > 0) {
 *   console.warn(`Found ${cycles.length} circular reasoning pattern(s)`);
 * }
 * ```
 */
export function detectCycles(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): Cycle[] {
  if (nodes.length === 0) return [];

  const graph = buildAdjacencyList(edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: Cycle[] = [];

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];

    for (const { target, strength } of neighbors) {
      if (!visited.has(target)) {
        dfs(target, path);
      } else if (recursionStack.has(target)) {
        // Cycle detected: target is already in current path
        const cycleStartIndex = path.indexOf(target);
        const cycleNodes = path.slice(cycleStartIndex);

        // Calculate cycle strength
        const cycleEdges = neighbors.filter((n) => cycleNodes.includes(n.target));
        const avgStrength =
          cycleEdges.reduce((sum, n) => sum + n.strength, 0) / cycleEdges.length;

        // Classify severity
        // High-strength cycles (>0.7) are more problematic (strong circular reasoning)
        const severity = avgStrength > 0.7 ? "error" : "warning";

        cycles.push({
          nodeIds: cycleNodes,
          severity,
          avgStrength,
        });
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  // Run DFS from each unvisited node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  // Remove duplicate cycles (same nodes, different starting point)
  return deduplicateCycles(cycles);
}

/**
 * Build adjacency list from edges with strength values
 */
function buildAdjacencyList(
  edges: Edge<ChainEdgeData>[]
): Map<string, Array<{ target: string; strength: number }>> {
  const graph = new Map<string, Array<{ target: string; strength: number }>>();

  for (const edge of edges) {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push({
      target: edge.target,
      strength: edge.data?.strength ?? 1.0,
    });
  }

  return graph;
}

/**
 * Remove duplicate cycles (same set of nodes)
 */
function deduplicateCycles(cycles: Cycle[]): Cycle[] {
  const seen = new Set<string>();
  const unique: Cycle[] = [];

  for (const cycle of cycles) {
    // Create canonical representation (sorted node IDs)
    const canonical = [...cycle.nodeIds].sort().join(",");
    
    if (!seen.has(canonical)) {
      seen.add(canonical);
      unique.push(cycle);
    }
  }

  return unique;
}

// ============================================================================
// Task 3.3: WWAW Strength Calculation
// ============================================================================

/**
 * Calculate argument chain strength using WWAW formula
 * 
 * Based on Rahwan et al. (2007) "Towards Large Scale Argumentation Support":
 * strength(node) = Σ(incoming support edges) - Σ(incoming attack edges)
 * 
 * Overall chain strength depends on structure type:
 * - Serial chains: Weakest link principle (min node strength)
 * - Convergent: Weighted average
 * - Complex graphs: Harmonic mean (penalizes weak links)
 * 
 * @param nodes - ReactFlow nodes
 * @param edges - ReactFlow edges with typed relations
 * @returns Strength analysis with per-node and overall metrics
 * 
 * @example
 * ```ts
 * const strength = calculateChainStrength(nodes, edges);
 * console.log(`Overall strength: ${(strength.overallStrength * 100).toFixed(0)}%`);
 * console.log(`Vulnerable nodes: ${strength.vulnerableNodes.join(", ")}`);
 * ```
 */
export function calculateChainStrength(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): ChainStrength {
  if (nodes.length === 0) {
    return {
      overallStrength: 0,
      nodeStrengths: new Map(),
      vulnerableNodes: [],
      strongNodes: [],
      structureType: "Unit",
    };
  }

  const nodeStrengths = new Map<string, number>();

  // Calculate per-node strength using WWAW formula
  for (const node of nodes) {
    const incomingEdges = edges.filter((e) => e.target === node.id);

    // Sum support edge strengths
    const supportStrength = incomingEdges
      .filter((e) => SUPPORT_EDGE_TYPES.includes(e.data?.edgeType || ""))
      .reduce((sum, e) => sum + (e.data?.strength ?? 1.0), 0);

    // Sum attack edge strengths
    const attackStrength = incomingEdges
      .filter((e) => ATTACK_EDGE_TYPES.includes(e.data?.edgeType || ""))
      .reduce((sum, e) => sum + (e.data?.strength ?? 1.0), 0);

    // WWAW formula: support - attack
    const nodeStrength = supportStrength - attackStrength;
    
    // Normalize to [0, 1] range (0 = strong attacks, 1 = strong support)
    // Nodes with no incoming edges get strength 0.5 (neutral)
    const normalizedStrength = incomingEdges.length === 0
      ? 0.5
      : Math.max(0, Math.min(1, (nodeStrength + 1) / 2));

    nodeStrengths.set(node.id, normalizedStrength);
  }

  // Detect structure type to determine aggregation method
  const structure = detectChainStructureType(nodes, edges);

  // Calculate overall chain strength based on structure
  let overallStrength: number;

  if (structure.detectedType === "SCS" || structure.detectedType === "SDS") {
    // Serial chains: Weakest link principle
    overallStrength = Math.min(...Array.from(nodeStrengths.values()));
  } else if (structure.detectedType === "LCS" || structure.hasConvergence) {
    // Convergent structures: Weighted average
    const total = Array.from(nodeStrengths.values()).reduce((a, b) => a + b, 0);
    overallStrength = total / nodes.length;
  } else {
    // Complex graphs (MS): Harmonic mean (penalizes weak links)
    const reciprocalSum = Array.from(nodeStrengths.values())
      .map((s) => 1 / (s + 0.01)) // Add epsilon to avoid division by zero
      .reduce((a, b) => a + b, 0);
    overallStrength = nodes.length / reciprocalSum;
  }

  // Identify vulnerable and strong nodes
  const vulnerableNodes = nodes
    .filter((n) => (nodeStrengths.get(n.id) ?? 0.5) < 0.5)
    .map((n) => n.id);

  const strongNodes = nodes
    .filter((n) => (nodeStrengths.get(n.id) ?? 0.5) > 0.8)
    .map((n) => n.id);

  return {
    overallStrength: Math.max(0, Math.min(1, overallStrength)),
    nodeStrengths,
    vulnerableNodes,
    strongNodes,
    structureType: structure.detectedType,
  };
}

// ============================================================================
// Task 3.5: Wei & Prakken Structure Classification
// ============================================================================

/**
 * Classify argument chain structure using Wei & Prakken (2019) taxonomy
 * 
 * Maps chains to formal ASPIC+ structure types:
 * - SCS: Serial Convergent Structure (multiple premises → single conclusion, serial)
 * - SDS: Serial Divergent Structure (single premise → multiple conclusions, serial)
 * - LCS: Linked Convergent Structure (interdependent premises)
 * - LDS: Linked Divergent Structure (interdependent conclusions)
 * - MS: Mixed Structure (complex combination)
 * - Unit: Single-inference argument
 * 
 * @param nodes - ReactFlow nodes
 * @param edges - ReactFlow edges
 * @returns Structure classification with detailed analysis
 * 
 * @example
 * ```ts
 * const structure = detectChainStructureType(nodes, edges);
 * console.log(`Detected: ${structure.detectedType} - ${structure.description}`);
 * ```
 */
export function detectChainStructureType(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): StructureAnalysis {
  // Handle edge cases
  if (nodes.length === 0) {
    return {
      detectedType: "Unit",
      description: "Empty chain",
      confidence: 1.0,
      hasConvergence: false,
      hasDivergence: false,
      hasLinking: false,
    };
  }

  if (nodes.length === 1) {
    return {
      detectedType: "Unit",
      description: "Single argument (no inference structure)",
      confidence: 1.0,
      hasConvergence: false,
      hasDivergence: false,
      hasLinking: false,
    };
  }

  // Build in-degree and out-degree maps
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
  }

  // Analyze structural patterns
  const hasConvergence = Array.from(inDegree.values()).some((deg) => deg > 1);
  const hasDivergence = Array.from(outDegree.values()).some((deg) => deg > 1);
  const hasLinking = checkForLinking(nodes, edges);

  // Classify based on patterns
  let detectedType: StructureAnalysis["detectedType"];
  let description: string;
  let confidence: number;

  if (nodes.length === 2 && edges.length === 1) {
    detectedType = "Unit";
    description = "Unit argument (single premise → single conclusion)";
    confidence = 1.0;
  } else if (!hasConvergence && !hasDivergence) {
    detectedType = "SCS";
    description = "Serial chain (linear inference path, no branching)";
    confidence = 0.95;
  } else if (hasConvergence && !hasDivergence) {
    if (hasLinking) {
      detectedType = "LCS";
      description = "Linked convergent (multiple interdependent premises converge)";
      confidence = 0.85;
    } else {
      detectedType = "SCS";
      description = "Serial convergent (multiple independent premises converge)";
      confidence = 0.90;
    }
  } else if (!hasConvergence && hasDivergence) {
    if (hasLinking) {
      detectedType = "LDS";
      description = "Linked divergent (single premise yields interdependent conclusions)";
      confidence = 0.85;
    } else {
      detectedType = "SDS";
      description = "Serial divergent (single premise yields independent conclusions)";
      confidence = 0.90;
    }
  } else {
    detectedType = "MS";
    description = "Mixed structure (complex graph with both convergence and divergence)";
    confidence = 0.80;
  }

  return {
    detectedType,
    description,
    confidence,
    hasConvergence,
    hasDivergence,
    hasLinking,
  };
}

/**
 * Check if chain has linking (interdependencies between same-level nodes)
 * 
 * Linking occurs when premises reference each other or conclusions are interdependent.
 * Detected by finding edges between nodes at the same hierarchical level.
 */
function checkForLinking(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): boolean {
  // Calculate node levels (distance from root)
  const levels = calculateNodeLevels(nodes, edges);

  // Check for same-level edges
  for (const edge of edges) {
    const sourceLevel = levels.get(edge.source) ?? 0;
    const targetLevel = levels.get(edge.target) ?? 0;
    
    if (sourceLevel === targetLevel) {
      return true; // Same-level edge indicates linking
    }
  }

  return false;
}

/**
 * Calculate hierarchical level of each node (distance from root nodes)
 */
function calculateNodeLevels(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[]
): Map<string, number> {
  const levels = new Map<string, number>();
  const graph = buildAdjacencyList(edges);

  // Find root nodes (no incoming edges)
  const roots = nodes.filter(
    (node) => !edges.some((edge) => edge.target === node.id)
  );

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = roots.map((r) => ({
    id: r.id,
    level: 0,
  }));

  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    levels.set(id, level);

    const neighbors = graph.get(id) || [];
    for (const { target } of neighbors) {
      if (!visited.has(target)) {
        queue.push({ id: target, level: level + 1 });
      }
    }
  }

  return levels;
}

// ============================================================================
// Task 3.6: SchemeNet Complexity Detection
// ============================================================================

/**
 * Detect nodes with complex multi-scheme structures (SchemeNet indicators)
 * 
 * Identifies arguments that use multiple argumentation schemes in a coordinated
 * structure, indicating sophisticated reasoning that may strengthen or complicate
 * the overall argument chain.
 * 
 * @param nodes - ReactFlow nodes with argument data including schemeNet
 * @returns Array of node IDs with complex SchemeNet structures
 */
export function detectSchemeNetComplexity(
  nodes: Node<ChainNodeData>[]
): {
  complexNodes: string[];
  schemeNetNodes: Map<string, {
    schemeCount: number;
    hasSteps: boolean;
    overallConfidence: number;
    isPrimary: boolean;
  }>;
} {
  const complexNodes: string[] = [];
  const schemeNetNodes = new Map();

  for (const node of nodes) {
    const argument = node.data.argument;
    const hasSchemeNet = argument.schemeNet !== null && argument.schemeNet !== undefined;
    const schemeCount = argument.argumentSchemes?.length || 0;
    const hasSteps = hasSchemeNet && (argument.schemeNet?.steps?.length || 0) > 0;
    
    // Consider complex if:
    // 1. Multiple schemes (2+)
    // 2. Has SchemeNet with sequential steps
    // 3. Has presupposed or supporting schemes (not just primary)
    const hasMultipleSchemes = schemeCount >= 2;
    const hasNonPrimarySchemes = argument.argumentSchemes?.some(
      (s: any) => !s.isPrimary && (s.role === "supporting" || s.role === "presupposed")
    );
    
    if (hasSchemeNet && (hasMultipleSchemes || hasSteps || hasNonPrimarySchemes)) {
      complexNodes.push(node.id);
      
      schemeNetNodes.set(node.id, {
        schemeCount,
        hasSteps,
        overallConfidence: argument.schemeNet?.overallConfidence || 1.0,
        isPrimary: argument.argumentSchemes?.some((s: any) => s.isPrimary) || false,
      });
    }
  }

  return { complexNodes, schemeNetNodes };
}

/**
 * Calculate SchemeNet strength contribution
 * 
 * Multi-scheme arguments may be stronger (convergent evidence) or weaker
 * (complexity introduces vulnerabilities). This calculates a modifier based
 * on SchemeNet structure.
 * 
 * @param schemeCount - Number of schemes in argument
 * @param overallConfidence - SchemeNet overall confidence
 * @param hasSteps - Whether SchemeNet has sequential steps
 * @returns Strength modifier (0.8-1.2)
 */
export function calculateSchemeNetStrengthModifier(
  schemeCount: number,
  overallConfidence: number,
  hasSteps: boolean
): number {
  // Base modifier: multiple schemes can strengthen argument
  let modifier = 1.0;
  
  if (schemeCount >= 2) {
    // More schemes = stronger, but diminishing returns
    modifier += Math.min((schemeCount - 1) * 0.05, 0.2);
  }
  
  // Confidence adjustment
  modifier *= overallConfidence;
  
  // Sequential steps add complexity (slight penalty)
  if (hasSteps) {
    modifier *= 0.95;
  }
  
  // Clamp to reasonable range
  return Math.max(0.8, Math.min(1.2, modifier));
}

// ============================================================================
// Phase 3 Lite: Scheme Aggregation
// ============================================================================

export interface SchemeAggregation {
  /** Total arguments with at least one scheme assigned */
  argumentsWithSchemes: number;
  /** Total arguments with a SchemeNet (multi-step reasoning) */
  argumentsWithSchemeNets: number;
  /** Aggregated scheme usage across all chain nodes */
  schemeCounts: Array<{
    schemeId: string;
    schemeName: string;
    schemeKey: string;
    count: number;
  }>;
  /** Arguments lacking scheme assignment (potential gaps) */
  unstructuredArguments: string[];
}

/**
 * Aggregate scheme usage across all nodes in a chain
 * 
 * Provides a summary of which argumentation schemes are used throughout
 * the chain, helping users understand the reasoning patterns employed.
 * 
 * @param nodes - ReactFlow nodes with argument data
 * @returns SchemeAggregation with counts and coverage stats
 */
export function aggregateSchemes(
  nodes: Node<ChainNodeData>[]
): SchemeAggregation {
  let argumentsWithSchemes = 0;
  let argumentsWithSchemeNets = 0;
  const unstructuredArguments: string[] = [];
  const schemeMap = new Map<string, { id: string; name: string; key: string; count: number }>();

  for (const node of nodes) {
    const argument = node.data.argument;
    if (!argument) continue;

    // Check for scheme assignments via ArgumentSchemeInstance (Phase 4+)
    const schemes = argument.argumentSchemes || [];
    const hasSchemes = schemes.length > 0;
    
    // Check for SchemeNet (multi-step intra-argument reasoning)
    const hasSchemeNet = argument.schemeNet !== null && argument.schemeNet !== undefined;
    const schemeNetSteps = argument.schemeNet?.steps || [];
    
    // Fallback: Check for legacy single scheme (schemeId on Argument)
    // Some older arguments may only have this, not ArgumentSchemeInstance records
    const legacyScheme = (argument as any).scheme;
    const hasLegacyScheme = !hasSchemes && legacyScheme && legacyScheme.id;

    if (hasSchemes) {
      argumentsWithSchemes++;
      
      // Count each scheme
      for (const schemeInstance of schemes) {
        const scheme = schemeInstance.scheme;
        if (!scheme) continue;
        
        const existing = schemeMap.get(scheme.id);
        if (existing) {
          existing.count++;
        } else {
          schemeMap.set(scheme.id, {
            id: scheme.id,
            name: scheme.name || scheme.key || "Unknown",
            key: scheme.key || "",
            count: 1,
          });
        }
      }
    } else if (hasLegacyScheme) {
      // Fallback to legacy single scheme
      argumentsWithSchemes++;
      
      const existing = schemeMap.get(legacyScheme.id);
      if (existing) {
        existing.count++;
      } else {
        schemeMap.set(legacyScheme.id, {
          id: legacyScheme.id,
          name: legacyScheme.name || legacyScheme.key || "Unknown",
          key: legacyScheme.key || "",
          count: 1,
        });
      }
    }
    
    if (hasSchemeNet) {
      argumentsWithSchemeNets++;
      
      // Also count schemes from SchemeNet steps
      for (const step of schemeNetSteps) {
        const scheme = step.scheme;
        if (!scheme) continue;
        
        const existing = schemeMap.get(scheme.id);
        if (existing) {
          existing.count++;
        } else {
          schemeMap.set(scheme.id, {
            id: scheme.id,
            name: scheme.name || scheme.key || "Unknown",
            key: scheme.key || "",
            count: 1,
          });
        }
      }
    }
    
    // Track unstructured arguments (no scheme assignment)
    if (!hasSchemes && !hasSchemeNet && !hasLegacyScheme) {
      unstructuredArguments.push(node.id);
    }
  }

  // Convert map to sorted array (by count descending)
  const schemeCounts = Array.from(schemeMap.values())
    .sort((a, b) => b.count - a.count)
    .map(({ id, name, key, count }) => ({
      schemeId: id,
      schemeName: name,
      schemeKey: key,
      count,
    }));

  return {
    argumentsWithSchemes,
    argumentsWithSchemeNets,
    schemeCounts,
    unstructuredArguments,
  };
}

