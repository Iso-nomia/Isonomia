import { prisma } from "@/lib/prismaclient";
import { SchemeInstance, NetCandidate } from "./NetIdentificationService";

// ============================================================================
// Types
// ============================================================================

export interface Dependency {
  id: string;
  sourceSchemeId: string;
  targetSchemeId: string;
  type: "prerequisite" | "supporting" | "enabling" | "background";
  strength: number; // 0-1
  bidirectional: boolean;
  evidence: {
    premiseOverlap: number;
    semanticSimilarity: number;
    structuralPattern: string;
    logicalFlow: boolean;
  };
  criticality: "critical" | "important" | "optional";
  explanation: string;
}

export interface DependencyGraph {
  netId: string;
  nodes: Array<{
    schemeId: string;
    schemeName: string;
    role: string;
    depth: number; // Distance from root
  }>;
  edges: Dependency[];
  cycles: Array<string[]>; // Circular dependencies
  roots: string[]; // Schemes with no dependencies
  leaves: string[]; // Schemes nothing depends on
  criticalPath: string[]; // Most important dependency chain
}

// ============================================================================
// Main Engine
// ============================================================================

export class DependencyInferenceEngine {
  /**
   * Infer all dependencies within a net candidate
   */
  public async inferDependencies(net: NetCandidate): Promise<DependencyGraph> {
    const dependencies: Dependency[] = [];

    // Step 1: Analyze all pairwise scheme relationships
    for (let i = 0; i < net.schemes.length; i++) {
      for (let j = 0; j < net.schemes.length; j++) {
        if (i === j) continue;

        const dependency = await this.analyzeDependency(
          net.schemes[i],
          net.schemes[j],
          net
        );

        if (dependency) {
          dependencies.push(dependency);
        }
      }
    }

    // Step 2: Build dependency graph
    const graph = this.buildDependencyGraph(net, dependencies);

    // Step 3: Detect circular dependencies
    graph.cycles = this.detectCycles(graph);

    // Step 4: Identify critical path
    graph.criticalPath = this.findCriticalPath(graph);

    return graph;
  }

  // ============================================================================
  // Private Methods: Dependency Analysis
  // ============================================================================

  private async analyzeDependency(
    source: SchemeInstance,
    target: SchemeInstance,
    net: NetCandidate
  ): Promise<Dependency | null> {
    // Check if target depends on source
    const evidence = await this.gatherDependencyEvidence(source, target, net);

    // Calculate dependency strength
    const strength = this.calculateDependencyStrength(evidence);

    // Must meet minimum threshold
    if (strength < 0.3) {
      return null;
    }

    // Determine dependency type
    const type = this.classifyDependencyType(source, target, evidence);

    // Check if bidirectional
    const bidirectional = await this.isBidirectional(source, target, net);

    // Determine criticality
    const criticality = this.assessCriticality(strength, type, target.role);

    return {
      id: `dep-${source.schemeId}-${target.schemeId}`,
      sourceSchemeId: source.schemeId,
      targetSchemeId: target.schemeId,
      type,
      strength,
      bidirectional,
      evidence,
      criticality,
      explanation: this.generateExplanation(source, target, type, evidence),
    };
  }

  private async gatherDependencyEvidence(
    source: SchemeInstance,
    target: SchemeInstance,
    net: NetCandidate
  ): Promise<any> {
    // 1. Premise overlap analysis
    const sourcePremises = new Set(source.premises.map((p) => p.key));
    const targetPremises = new Set(target.premises.map((p) => p.key));
    const overlap = [...sourcePremises].filter((k) => targetPremises.has(k));
    const premiseOverlap =
      overlap.length / Math.max(sourcePremises.size, targetPremises.size);

    // 2. Semantic similarity
    const sourceText = source.premises.map((p) => p.text).join(" ");
    const targetText = target.premises.map((p) => p.text).join(" ");
    const semanticSimilarity = this.calculateSemanticSimilarity(
      sourceText,
      targetText
    );

    // 3. Structural pattern detection
    const structuralPattern = this.detectStructuralPattern(source, target);

    // 4. Logical flow analysis
    const logicalFlow = this.hasLogicalFlow(source, target);

    return {
      premiseOverlap,
      semanticSimilarity,
      structuralPattern,
      logicalFlow,
    };
  }

  private calculateDependencyStrength(evidence: any): number {
    // Weighted combination of evidence factors
    return (
      evidence.premiseOverlap * 0.4 +
      evidence.semanticSimilarity * 0.3 +
      (evidence.structuralPattern !== "none" ? 0.15 : 0) +
      (evidence.logicalFlow ? 0.15 : 0)
    );
  }

  private classifyDependencyType(
    source: SchemeInstance,
    target: SchemeInstance,
    evidence: any
  ): "prerequisite" | "supporting" | "enabling" | "background" {
    // Prerequisite: target cannot exist without source
    if (
      evidence.premiseOverlap > 0.7 &&
      evidence.structuralPattern === "sequential"
    ) {
      return "prerequisite";
    }

    // Supporting: source strengthens target
    if (source.role === "supporting" && target.role === "primary") {
      return "supporting";
    }

    // Enabling: source makes target possible
    if (evidence.logicalFlow && evidence.premiseOverlap > 0.4) {
      return "enabling";
    }

    // Background: provides context
    return "background";
  }

  private async isBidirectional(
    source: SchemeInstance,
    target: SchemeInstance,
    net: NetCandidate
  ): Promise<boolean> {
    // Check if both schemes depend on each other
    const reverseEvidence = await this.gatherDependencyEvidence(
      target,
      source,
      net
    );
    const reverseStrength = this.calculateDependencyStrength(reverseEvidence);

    return reverseStrength >= 0.3;
  }

  private assessCriticality(
    strength: number,
    type: string,
    targetRole: string
  ): "critical" | "important" | "optional" {
    // Critical: prerequisite for primary scheme
    if (type === "prerequisite" && targetRole === "primary") {
      return "critical";
    }

    // Important: high strength or enabling
    if (strength > 0.7 || type === "enabling") {
      return "important";
    }

    // Optional: background or low strength
    return "optional";
  }

  // ============================================================================
  // Private Methods: Graph Construction
  // ============================================================================

  private buildDependencyGraph(
    net: NetCandidate,
    dependencies: Dependency[]
  ): DependencyGraph {
    // Create nodes for each scheme
    const nodes = net.schemes.map((scheme) => ({
      schemeId: scheme.schemeId,
      schemeName: scheme.schemeName,
      role: scheme.role,
      depth: 0, // Will be calculated
    }));

    // Calculate depth (distance from roots)
    this.calculateDepths(nodes, dependencies);

    // Identify roots (no incoming edges)
    const incomingEdges = new Set(dependencies.map((d) => d.targetSchemeId));
    const roots = nodes
      .filter((n) => !incomingEdges.has(n.schemeId))
      .map((n) => n.schemeId);

    // Identify leaves (no outgoing edges)
    const outgoingEdges = new Set(dependencies.map((d) => d.sourceSchemeId));
    const leaves = nodes
      .filter((n) => !outgoingEdges.has(n.schemeId))
      .map((n) => n.schemeId);

    return {
      netId: net.id,
      nodes,
      edges: dependencies,
      cycles: [], // Will be filled later
      roots,
      leaves,
      criticalPath: [], // Will be filled later
    };
  }

  private calculateDepths(nodes: Array<any>, dependencies: Dependency[]): void {
    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!graph.has(dep.sourceSchemeId)) {
        graph.set(dep.sourceSchemeId, []);
      }
      graph.get(dep.sourceSchemeId)!.push(dep.targetSchemeId);
    }

    // BFS from roots to calculate depth
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];

    // Start with roots
    const roots = nodes.filter(
      (n) => !dependencies.some((d) => d.targetSchemeId === n.schemeId)
    );

    for (const root of roots) {
      queue.push({ id: root.schemeId, depth: 0 });
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      // Update node depth
      const node = nodes.find((n) => n.schemeId === id);
      if (node) {
        node.depth = depth;
      }

      // Add children to queue
      const children = graph.get(id) || [];
      for (const child of children) {
        if (!visited.has(child)) {
          queue.push({ id: child, depth: depth + 1 });
        }
      }
    }
  }

  private detectCycles(graph: DependencyGraph): Array<string[]> {
    const cycles: Array<string[]> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoing = graph.edges.filter((e) => e.sourceSchemeId === nodeId);

      for (const edge of outgoing) {
        const targetId = edge.targetSchemeId;

        if (!visited.has(targetId)) {
          dfs(targetId, [...path]);
        } else if (recursionStack.has(targetId)) {
          // Found a cycle
          const cycleStart = path.indexOf(targetId);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, targetId]);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.schemeId)) {
        dfs(node.schemeId, []);
      }
    }

    return cycles;
  }

  private findCriticalPath(graph: DependencyGraph): string[] {
    // Find path with highest total dependency strength
    let maxPath: string[] = [];
    let maxStrength = 0;

    const findPaths = (
      current: string,
      path: string[],
      totalStrength: number
    ): void => {
      const outgoing = graph.edges.filter((e) => e.sourceSchemeId === current);

      if (outgoing.length === 0) {
        // Reached a leaf
        if (totalStrength > maxStrength) {
          maxStrength = totalStrength;
          maxPath = [...path];
        }
        return;
      }

      for (const edge of outgoing) {
        if (!path.includes(edge.targetSchemeId)) {
          findPaths(
            edge.targetSchemeId,
            [...path, edge.targetSchemeId],
            totalStrength + edge.strength
          );
        }
      }
    };

    for (const root of graph.roots) {
      findPaths(root, [root], 0);
    }

    return maxPath;
  }

  // ============================================================================
  // Private Methods: Utility
  // ============================================================================

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simplified Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private detectStructuralPattern(
    source: SchemeInstance,
    target: SchemeInstance
  ): string {
    // Detect common structural patterns

    // Sequential: source conclusion feeds target premise
    if (
      source.conclusion &&
      target.premises.some((p) => p.text.includes(source.conclusion))
    ) {
      return "sequential";
    }

    // Parallel: similar structure, different content
    if (
      source.premises.length === target.premises.length &&
      source.schemeCategory === target.schemeCategory
    ) {
      return "parallel";
    }

    // Hierarchical: target generalizes source
    if (source.role === "subordinate" && target.role === "primary") {
      return "hierarchical";
    }

    return "none";
  }

  private hasLogicalFlow(
    source: SchemeInstance,
    target: SchemeInstance
  ): boolean {
    // Check if there's a logical connection
    // Simplified: check if source conclusion relates to target premises
    if (!source.conclusion) return false;

    const conclusionWords = new Set(
      source.conclusion.toLowerCase().split(/\s+/)
    );

    for (const premise of target.premises) {
      const premiseWords = new Set(premise.text.toLowerCase().split(/\s+/));
      const overlap = [...conclusionWords].filter((w) => premiseWords.has(w));

      if (overlap.length >= 2) {
        return true;
      }
    }

    return false;
  }

  private generateExplanation(
    source: SchemeInstance,
    target: SchemeInstance,
    type: string,
    evidence: any
  ): string {
    const explanations = {
      prerequisite: `${target.schemeName} requires ${source.schemeName} to be established first.`,
      supporting: `${source.schemeName} provides supporting evidence for ${target.schemeName}.`,
      enabling: `${source.schemeName} enables the reasoning in ${target.schemeName}.`,
      background: `${source.schemeName} provides background context for ${target.schemeName}.`,
    };

    let explanation = explanations[type as keyof typeof explanations];

    if (evidence.premiseOverlap > 0.5) {
      explanation += ` They share ${Math.round(evidence.premiseOverlap * 100)}% of premises.`;
    }

    if (evidence.logicalFlow) {
      explanation += " There is a clear logical flow between them.";
    }

    return explanation;
  }
}
