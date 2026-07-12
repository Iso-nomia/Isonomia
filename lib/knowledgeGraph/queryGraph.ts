/**
 * Phase 3.4.1: Knowledge Graph Query Functions
 * 
 * Provides BFS-based graph traversal and queries for the knowledge graph.
 */

import { prisma } from "@/lib/prismaclient";
import { ExplorerNodeType, ExplorerEdgeType } from "@prisma/client";

export interface GraphQueryOptions {
  centerNodeType?: ExplorerNodeType;
  centerNodeId?: string;
  depth?: number;
  maxNodes?: number;
  nodeTypes?: ExplorerNodeType[];
  edgeTypes?: ExplorerEdgeType[];
}

export interface GraphNode {
  id: string;
  type: ExplorerNodeType;
  label: string;
  weight: number;
  referenceId: string;
  description?: string | null;
  depth: number;
  connectionCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: ExplorerEdgeType;
  weight: number;
  label?: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
  };
}

/**
 * Query the knowledge graph using BFS from a center node or get top nodes
 */
export async function queryKnowledgeGraph(
  options: GraphQueryOptions
): Promise<GraphData> {
  const {
    centerNodeType,
    centerNodeId,
    depth = 2,
    maxNodes = 100,
    nodeTypes,
    edgeTypes,
  } = options;

  // If no center, get top nodes by weight
  if (!centerNodeType || !centerNodeId) {
    return getTopNodesGraph(maxNodes, nodeTypes);
  }

  // BFS from center node
  const centerNode = await prisma.explorerNode.findUnique({
    where: {
      nodeType_referenceId: {
        nodeType: centerNodeType,
        referenceId: centerNodeId,
      },
    },
  });

  if (!centerNode) {
    return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, maxDepth: 0 } };
  }

  const visitedNodes = new Map<string, number>(); // nodeId -> depth
  const collectedEdges: any[] = [];
  const queue: Array<{ nodeId: string; currentDepth: number }> = [
    { nodeId: centerNode.id, currentDepth: 0 },
  ];

  let maxReachedDepth = 0;

  while (queue.length > 0 && visitedNodes.size < maxNodes) {
    const { nodeId, currentDepth } = queue.shift()!;

    if (visitedNodes.has(nodeId)) continue;
    if (currentDepth > depth) continue;

    visitedNodes.set(nodeId, currentDepth);
    maxReachedDepth = Math.max(maxReachedDepth, currentDepth);

    // Get connected edges
    const edges = await prisma.explorerEdge.findMany({
      where: {
        OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
        ...(edgeTypes && { edgeType: { in: edgeTypes } }),
      },
      include: {
        sourceNode: true,
        targetNode: true,
      },
    });

    for (const edge of edges) {
      // Filter by node types if specified
      if (nodeTypes) {
        if (
          !nodeTypes.includes(edge.sourceNode.nodeType) ||
          !nodeTypes.includes(edge.targetNode.nodeType)
        ) {
          continue;
        }
      }

      collectedEdges.push(edge);

      const neighborId =
        edge.sourceNodeId === nodeId ? edge.targetNodeId : edge.sourceNodeId;

      if (!visitedNodes.has(neighborId)) {
        queue.push({ nodeId: neighborId, currentDepth: currentDepth + 1 });
      }
    }
  }

  // Fetch all visited nodes
  const nodeIds = Array.from(visitedNodes.keys());
  const nodes = await prisma.explorerNode.findMany({
    where: { id: { in: nodeIds } },
  });

  // Deduplicate edges
  const uniqueEdges = new Map<string, typeof collectedEdges[0]>();
  for (const edge of collectedEdges) {
    uniqueEdges.set(edge.id, edge);
  }

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.nodeType,
      label: n.label,
      weight: n.weight,
      referenceId: n.referenceId,
      description: n.description,
      depth: visitedNodes.get(n.id) || 0,
      connectionCount: n.connectionCount,
    })),
    edges: Array.from(uniqueEdges.values()).map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.edgeType,
      weight: e.weight,
      label: e.label,
    })),
    stats: {
      totalNodes: nodes.length,
      totalEdges: uniqueEdges.size,
      maxDepth: maxReachedDepth,
    },
  };
}

/**
 * Get top nodes by weight when no center is specified
 */
async function getTopNodesGraph(
  maxNodes: number,
  nodeTypes?: ExplorerNodeType[]
): Promise<GraphData> {
  const nodes = await prisma.explorerNode.findMany({
    where: nodeTypes ? { nodeType: { in: nodeTypes } } : undefined,
    orderBy: { weight: "desc" },
    take: maxNodes,
  });

  const nodeIds = nodes.map((n) => n.id);

  const edges = await prisma.explorerEdge.findMany({
    where: {
      sourceNodeId: { in: nodeIds },
      targetNodeId: { in: nodeIds },
    },
  });

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.nodeType,
      label: n.label,
      weight: n.weight,
      referenceId: n.referenceId,
      description: n.description,
      depth: 0,
      connectionCount: n.connectionCount,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.edgeType,
      weight: e.weight,
      label: e.label,
    })),
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxDepth: 0,
    },
  };
}

/**
 * Get neighbors of a specific node
 */
export async function getNodeNeighbors(
  nodeId: string,
  options?: {
    edgeTypes?: ExplorerEdgeType[];
    limit?: number;
  }
): Promise<{ node: GraphNode; edge: GraphEdge }[]> {
  const edges = await prisma.explorerEdge.findMany({
    where: {
      OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
      ...(options?.edgeTypes && { edgeType: { in: options.edgeTypes } }),
    },
    include: {
      sourceNode: true,
      targetNode: true,
    },
    take: options?.limit || 20,
  });

  return edges.map((e) => {
    const isSource = e.sourceNodeId === nodeId;
    const neighborNode = isSource ? e.targetNode : e.sourceNode;

    return {
      node: {
        id: neighborNode.id,
        type: neighborNode.nodeType,
        label: neighborNode.label,
        weight: neighborNode.weight,
        referenceId: neighborNode.referenceId,
        description: neighborNode.description,
        depth: 1,
        connectionCount: neighborNode.connectionCount,
      },
      edge: {
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        type: e.edgeType,
        weight: e.weight,
        label: e.label,
      },
    };
  });
}

/**
 * Search nodes by label
 */
export async function searchNodes(
  query: string,
  options?: {
    nodeTypes?: ExplorerNodeType[];
    limit?: number;
  }
): Promise<GraphNode[]> {
  const nodes = await prisma.explorerNode.findMany({
    where: {
      label: { contains: query, mode: "insensitive" },
      ...(options?.nodeTypes && { nodeType: { in: options.nodeTypes } }),
    },
    orderBy: { weight: "desc" },
    take: options?.limit || 20,
  });

  return nodes.map((n) => ({
    id: n.id,
    type: n.nodeType,
    label: n.label,
    weight: n.weight,
    referenceId: n.referenceId,
    description: n.description,
    depth: 0,
    connectionCount: n.connectionCount,
  }));
}

/**
 * Get graph statistics
 */
export async function getGraphStats(): Promise<{
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
}> {
  const [nodeCount, edgeCount, nodesByType, edgesByType] = await Promise.all([
    prisma.explorerNode.count(),
    prisma.explorerEdge.count(),
    prisma.explorerNode.groupBy({
      by: ["nodeType"],
      _count: { id: true },
    }),
    prisma.explorerEdge.groupBy({
      by: ["edgeType"],
      _count: { id: true },
    }),
  ]);

  return {
    nodeCount,
    edgeCount,
    nodesByType: Object.fromEntries(
      nodesByType.map((g) => [g.nodeType, g._count.id])
    ),
    edgesByType: Object.fromEntries(
      edgesByType.map((g) => [g.edgeType, g._count.id])
    ),
  };
}
