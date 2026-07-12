/**
 * Service for building and querying citation graphs
 * Phase 3.2: Argument-Level Citations (Chunk 5)
 */

import { prisma } from "@/lib/prismaclient";
import {
  ArgCitationType,
  CitationGraph,
  CitationGraphNode,
  CitationGraphEdge,
} from "./argumentCitationTypes";

// ============================================================
// GRAPH BUILDING
// ============================================================

/**
 * Build citation graph for an argument (ego-centric)
 * @param argumentId - The center argument
 * @param depth - How many levels of citations to include (default 2)
 * @param includeIndirect - Whether to include indirect citations at each level
 */
export async function buildArgumentCitationGraph(
  argumentId: string,
  depth: number = 2,
  includeIndirect: boolean = true
): Promise<CitationGraph> {
  const nodes: Map<string, CitationGraphNode> = new Map();
  const edges: CitationGraphEdge[] = [];
  const visited = new Set<string>();

  // BFS to collect citations up to depth
  const queue: Array<{ id: string; currentDepth: number }> = [
    { id: argumentId, currentDepth: 0 },
  ];

  while (queue.length > 0) {
    const { id, currentDepth } = queue.shift()!;

    if (visited.has(id) || currentDepth > depth) continue;
    visited.add(id);

    // Get argument details with citations
    const argument = await prisma.argument.findUnique({
      where: { id },
      include: {
        conclusion: { select: { text: true } },
        citationsMade: {
          include: {
            citedArgument: {
              select: { id: true },
            },
          },
        },
        citationsReceived: {
          include: {
            citingArgument: {
              select: { id: true },
            },
          },
        },
        citationMetrics: {
          select: { totalCitations: true },
        },
        deliberation: {
          select: { id: true },
        },
      },
    });

    if (!argument) continue;

    // Add node
    nodes.set(id, {
      id,
      type: "argument",
      label: argument.conclusion?.text?.slice(0, 80) || argument.text?.slice(0, 80) || "Argument",
      deliberationId: argument.deliberation?.id,
      authorId: argument.authorId,
      citationCount: argument.citationMetrics?.totalCitations || 0,
      depth: currentDepth,
    });

    // Add edges and queue next level
    if (includeIndirect || currentDepth < depth) {
      // Outgoing citations (this argument cites)
      for (const citation of argument.citationsMade) {
        edges.push({
          source: id,
          target: citation.citedArgument.id,
          citationType: citation.citationType as ArgCitationType,
          weight: 1,
        });

        if (!visited.has(citation.citedArgument.id) && currentDepth + 1 <= depth) {
          queue.push({
            id: citation.citedArgument.id,
            currentDepth: currentDepth + 1,
          });
        }
      }

      // Incoming citations (this argument is cited by)
      for (const citation of argument.citationsReceived) {
        edges.push({
          source: citation.citingArgument.id,
          target: id,
          citationType: citation.citationType as ArgCitationType,
          weight: 1,
        });

        if (!visited.has(citation.citingArgument.id) && currentDepth + 1 <= depth) {
          queue.push({
            id: citation.citingArgument.id,
            currentDepth: currentDepth + 1,
          });
        }
      }
    }
  }

  const nodeArray = Array.from(nodes.values());
  const dedupedEdges = deduplicateEdges(edges);

  return {
    nodes: nodeArray,
    edges: dedupedEdges,
    centerNodeId: argumentId,
    maxDepth: depth,
    totalNodes: nodeArray.length,
    totalEdges: dedupedEdges.length,
  };
}

/**
 * Build citation graph for an entire deliberation
 * @param deliberationId - The deliberation to analyze
 * @param includeExternalCitations - Whether to include citations from/to other deliberations
 */
export async function buildDeliberationCitationGraph(
  deliberationId: string,
  includeExternalCitations: boolean = true
): Promise<CitationGraph> {
  const nodes: Map<string, CitationGraphNode> = new Map();
  const edges: CitationGraphEdge[] = [];

  // Get all arguments in deliberation
  const arguments_ = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      conclusion: { select: { text: true } },
      citationsMade: {
        include: {
          citedArgument: {
            include: {
              deliberation: { select: { id: true, title: true } },
              conclusion: { select: { text: true } },
            },
          },
        },
      },
      citationsReceived: {
        include: {
          citingArgument: {
            include: {
              deliberation: { select: { id: true, title: true } },
              conclusion: { select: { text: true } },
            },
          },
        },
      },
      citationMetrics: {
        select: { totalCitations: true },
      },
    },
  });

  // Add argument nodes for this deliberation
  for (const arg of arguments_) {
    nodes.set(arg.id, {
      id: arg.id,
      type: "argument",
      label: arg.conclusion?.text?.slice(0, 80) || arg.text?.slice(0, 80) || "Argument",
      deliberationId,
      authorId: arg.authorId,
      citationCount: arg.citationMetrics?.totalCitations || 0,
    });

    // Add citations made
    for (const citation of arg.citationsMade) {
      const isExternal = citation.citedArgument.deliberation?.id !== deliberationId;

      if (!isExternal || includeExternalCitations) {
        // Add cited argument node if external
        if (isExternal) {
          const cited = citation.citedArgument;
          if (!nodes.has(cited.id)) {
            nodes.set(cited.id, {
              id: cited.id,
              type: "external",
              label: `[${cited.deliberation?.title || "External"}] ${cited.conclusion?.text?.slice(0, 50) || cited.text?.slice(0, 50) || ""}`,
              deliberationId: cited.deliberation?.id,
              authorId: cited.authorId,
              citationCount: 0,
            });
          }
        }

        edges.push({
          source: arg.id,
          target: citation.citedArgument.id,
          citationType: citation.citationType as ArgCitationType,
          weight: 1,
        });
      }
    }

    // Add citations received from external arguments
    if (includeExternalCitations) {
      for (const citation of arg.citationsReceived) {
        const isExternal = citation.citingArgument.deliberation?.id !== deliberationId;

        if (isExternal) {
          const citing = citation.citingArgument;
          if (!nodes.has(citing.id)) {
            nodes.set(citing.id, {
              id: citing.id,
              type: "external",
              label: `[${citing.deliberation?.title || "External"}] ${citing.conclusion?.text?.slice(0, 50) || citing.text?.slice(0, 50) || ""}`,
              deliberationId: citing.deliberation?.id,
              authorId: citing.authorId,
              citationCount: 0,
            });
          }

          edges.push({
            source: citing.id,
            target: arg.id,
            citationType: citation.citationType as ArgCitationType,
            weight: 1,
          });
        }
      }
    }
  }

  const nodeArray = Array.from(nodes.values());
  const dedupedEdges = deduplicateEdges(edges);

  return {
    nodes: nodeArray,
    edges: dedupedEdges,
    totalNodes: nodeArray.length,
    totalEdges: dedupedEdges.length,
  };
}

// ============================================================
// PATH FINDING
// ============================================================

/**
 * Find citation paths between two arguments
 * @param fromArgumentId - Starting argument
 * @param toArgumentId - Target argument
 * @param maxDepth - Maximum path length to search
 * @returns Array of paths (each path is array of argument IDs), or null if no path found
 */
export async function findCitationPath(
  fromArgumentId: string,
  toArgumentId: string,
  maxDepth: number = 5
): Promise<string[][] | null> {
  const paths: string[][] = [];
  const visited = new Set<string>();

  async function dfs(currentId: string, path: string[]): Promise<void> {
    if (currentId === toArgumentId) {
      paths.push([...path]);
      return;
    }

    if (path.length >= maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const citations = await prisma.argumentCitation.findMany({
      where: { citingArgumentId: currentId },
      select: { citedArgumentId: true },
    });

    for (const citation of citations) {
      await dfs(citation.citedArgumentId, [...path, citation.citedArgumentId]);
    }

    visited.delete(currentId);
  }

  await dfs(fromArgumentId, [fromArgumentId]);

  return paths.length > 0 ? paths : null;
}

/**
 * Find shortest citation path between two arguments using BFS
 */
export async function findShortestCitationPath(
  fromArgumentId: string,
  toArgumentId: string,
  maxDepth: number = 10
): Promise<string[] | null> {
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [
    { id: fromArgumentId, path: [fromArgumentId] },
  ];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id === toArgumentId) {
      return path;
    }

    if (path.length >= maxDepth || visited.has(id)) continue;
    visited.add(id);

    const citations = await prisma.argumentCitation.findMany({
      where: { citingArgumentId: id },
      select: { citedArgumentId: true },
    });

    for (const citation of citations) {
      if (!visited.has(citation.citedArgumentId)) {
        queue.push({
          id: citation.citedArgumentId,
          path: [...path, citation.citedArgumentId],
        });
      }
    }
  }

  return null;
}

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get most cited arguments across platform
 */
export async function getMostCitedArguments(
  limit: number = 20,
  options?: {
    deliberationId?: string;
    minCitations?: number;
  }
) {
  const where: any = {
    totalCitations: { gt: options?.minCitations ?? 0 },
  };

  if (options?.deliberationId) {
    where.argument = { deliberationId: options.deliberationId };
  }

  return prisma.argumentCitationMetrics.findMany({
    where,
    include: {
      argument: {
        include: {
          conclusion: { select: { text: true } },
          deliberation: { select: { id: true, title: true } },
          permalink: { select: { shortCode: true, permalinkUrl: true } },
        },
      },
    },
    orderBy: { totalCitations: "desc" },
    take: limit,
  });
}

/**
 * Get citation statistics for a deliberation
 */
export async function getDeliberationCitationStats(deliberationId: string) {
  const arguments_ = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      citationMetrics: true,
      citationsMade: { select: { id: true } },
      citationsReceived: { select: { id: true } },
    },
  });

  const totalArguments = arguments_.length;
  const totalCitationsMade = arguments_.reduce(
    (sum, arg) => sum + arg.citationsMade.length,
    0
  );
  const totalCitationsReceived = arguments_.reduce(
    (sum, arg) => sum + arg.citationsReceived.length,
    0
  );

  const argumentsWithCitations = arguments_.filter(
    (arg) => arg.citationsReceived.length > 0
  ).length;

  const mostCitedArgs = arguments_
    .filter((arg) => arg.citationMetrics?.totalCitations)
    .sort((a, b) => 
      (b.citationMetrics?.totalCitations || 0) - (a.citationMetrics?.totalCitations || 0)
    )
    .slice(0, 5);

  return {
    totalArguments,
    totalCitationsMade,
    totalCitationsReceived,
    argumentsWithCitations,
    citationDensity: totalArguments > 0 
      ? totalCitationsReceived / totalArguments 
      : 0,
    mostCitedArguments: mostCitedArgs.map((arg) => ({
      id: arg.id,
      text: arg.text,
      citationCount: arg.citationMetrics?.totalCitations || 0,
    })),
  };
}

/**
 * Get arguments that form citation clusters (highly interconnected)
 */
export async function findCitationClusters(
  deliberationId: string,
  minClusterSize: number = 3
): Promise<Array<{ argumentIds: string[]; citationCount: number }>> {
  // Get citation graph for deliberation
  const graph = await buildDeliberationCitationGraph(deliberationId, false);
  
  // Build adjacency list (undirected for clustering)
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  // Find connected components
  const visited = new Set<string>();
  const clusters: Array<{ argumentIds: string[]; citationCount: number }> = [];

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const cluster: string[] = [];
    const stack = [node.id];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);

      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (cluster.length >= minClusterSize) {
      // Count internal citations
      let citationCount = 0;
      const clusterSet = new Set(cluster);
      for (const edge of graph.edges) {
        if (clusterSet.has(edge.source) && clusterSet.has(edge.target)) {
          citationCount++;
        }
      }

      clusters.push({ argumentIds: cluster, citationCount });
    }
  }

  return clusters.sort((a, b) => b.argumentIds.length - a.argumentIds.length);
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Remove duplicate edges (keep highest weight)
 */
function deduplicateEdges(edges: CitationGraphEdge[]): CitationGraphEdge[] {
  const edgeMap = new Map<string, CitationGraphEdge>();

  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`;
    const existing = edgeMap.get(key);

    if (!existing || edge.weight > existing.weight) {
      edgeMap.set(key, edge);
    }
  }

  return Array.from(edgeMap.values());
}

/**
 * Calculate graph density (edges / possible edges)
 */
export function calculateGraphDensity(graph: CitationGraph): number {
  const n = graph.nodes.length;
  if (n < 2) return 0;
  
  const possibleEdges = n * (n - 1); // Directed graph
  return graph.edges.length / possibleEdges;
}

/**
 * Get node degrees (in/out/total)
 */
export function getNodeDegrees(
  graph: CitationGraph
): Map<string, { in: number; out: number; total: number }> {
  const degrees = new Map<string, { in: number; out: number; total: number }>();

  // Initialize all nodes
  for (const node of graph.nodes) {
    degrees.set(node.id, { in: 0, out: 0, total: 0 });
  }

  // Count edges
  for (const edge of graph.edges) {
    const sourceDeg = degrees.get(edge.source);
    const targetDeg = degrees.get(edge.target);

    if (sourceDeg) {
      sourceDeg.out++;
      sourceDeg.total++;
    }
    if (targetDeg) {
      targetDeg.in++;
      targetDeg.total++;
    }
  }

  return degrees;
}
