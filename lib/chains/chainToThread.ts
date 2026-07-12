/**
 * Chain to Thread Utility
 * Converts ArgumentChain graph structure to linear thread representation
 * 
 * Task 1.4: Create chainToThread() utility (topological sort → linear)
 */

import { ArgumentChainWithRelations, ArgumentChainNodeWithArgument, ArgumentChainEdgeWithNodes, ScopeType, EpistemicStatus } from "@/lib/types/argumentChain";

// ===== Types =====

export interface ThreadItem {
  nodeId: string;
  argumentId: string;
  position: number;
  depth: number;
  
  // Argument content
  argumentText: string;
  argumentTitle?: string;
  
  // Scheme info
  schemeKey?: string;
  schemeName?: string | null;
  schemeCount: number;
  hasSchemeNet: boolean;
  
  // Role & metadata
  role: string;
  nodeOrder: number;
  
  // Phase 4: Epistemic Status & Scopes
  epistemicStatus?: EpistemicStatus;
  dialecticalRole?: string;
  scope?: {
    id: string;
    scopeType: ScopeType;
    assumption: string;
    color?: string | null;
  } | null;
  
  // Contributor
  contributor: {
    id: string | bigint;
    name: string | null;
    image: string | null;
  } | null;
  
  // Connection info
  incomingEdges: ThreadEdge[];
  outgoingEdges: ThreadEdge[];
  
  // Flags
  isRoot: boolean;
  isLeaf: boolean;
  isCurrent: boolean;
  
  // Attack info (edges targeting this node)
  attackingNodes: string[];
}

export interface ThreadEdge {
  edgeId: string;
  edgeType: string;
  strength: number;
  description?: string | null;
  
  // Connected node info
  connectedNodeId: string;
  connectedArgumentId: string;
  connectedArgumentSnippet: string;
}

export interface ChainThread {
  chainId: string;
  chainName: string;
  chainDescription?: string | null;
  chainType: string;
  
  // Stats
  nodeCount: number;
  edgeCount: number;
  maxDepth: number;
  
  // Creator
  creator: {
    id: string | bigint;
    name: string | null;
    image: string | null;
  } | null;
  
  // Thread items in order
  items: ThreadItem[];
  
  // Orphan nodes (disconnected from main chain)
  orphans: ThreadItem[];
  
  // Analysis hints
  hasCircularDependency: boolean;
  rootNodeIds: string[];
  leafNodeIds: string[];
}

// ===== Helper Functions =====

/**
 * Perform topological sort with depth tracking
 * Returns nodes ordered by dependency (roots first, then dependents)
 */
function topologicalSortWithDepth(
  nodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[]
): { sorted: Array<{ node: ArgumentChainNodeWithArgument; depth: number; position: number }>; hasCircle: boolean } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  const visited = new Set<string>();
  const sorted: Array<{ node: ArgumentChainNodeWithArgument; depth: number; position: number }> = [];

  // Initialize
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });

  // Build graph (source → target means source supports/enables target)
  edges.forEach(edge => {
    const from = edge.sourceNodeId;
    const to = edge.targetNodeId;
    adjacencyList.get(from)?.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  });

  // Find root nodes (no incoming edges)
  const queue: Array<{ id: string; depth: number }> = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push({ id: nodeId, depth: 0 });
    }
  });

  // Track if we have a cycle
  let hasCircle = false;

  // If no roots found but we have nodes, there's a cycle
  if (queue.length === 0 && nodes.length > 0) {
    hasCircle = true;
    // Start with first node to at least show something
    queue.push({ id: nodes[0].id, depth: 0 });
  }

  let position = 0;
  let maxIterations = nodes.length * 2; // Safety limit

  // BFS traversal
  while (queue.length > 0 && maxIterations > 0) {
    maxIterations--;
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) {
      sorted.push({ node, depth, position: position++ });
    }

    const neighbors = adjacencyList.get(id) || [];
    neighbors.forEach(neighborId => {
      const newDegree = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, newDegree);
      
      if (newDegree === 0 && !visited.has(neighborId)) {
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    });
  }

  // Check for unvisited nodes (indicates cycle)
  if (visited.size < nodes.length) {
    hasCircle = true;
  }

  return { sorted, hasCircle };
}

/**
 * Get snippet from argument text
 */
function getSnippet(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return "Untitled";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Build edge lookup maps for fast access
 */
function buildEdgeMaps(edges: ArgumentChainEdgeWithNodes[]) {
  const incomingMap = new Map<string, ThreadEdge[]>();
  const outgoingMap = new Map<string, ThreadEdge[]>();

  edges.forEach(edge => {
    // Outgoing edge from source
    const outgoing: ThreadEdge = {
      edgeId: edge.id,
      edgeType: edge.edgeType,
      strength: edge.strength,
      description: edge.description,
      connectedNodeId: edge.targetNodeId,
      connectedArgumentId: edge.targetNode?.argument?.id || "",
      connectedArgumentSnippet: getSnippet((edge.targetNode?.argument as any)?.conclusion?.text || edge.targetNode?.argument?.text),
    };
    
    if (!outgoingMap.has(edge.sourceNodeId)) {
      outgoingMap.set(edge.sourceNodeId, []);
    }
    outgoingMap.get(edge.sourceNodeId)!.push(outgoing);

    // Incoming edge to target
    const incoming: ThreadEdge = {
      edgeId: edge.id,
      edgeType: edge.edgeType,
      strength: edge.strength,
      description: edge.description,
      connectedNodeId: edge.sourceNodeId,
      connectedArgumentId: edge.sourceNode?.argument?.id || "",
      connectedArgumentSnippet: getSnippet((edge.sourceNode?.argument as any)?.conclusion?.text || edge.sourceNode?.argument?.text),
    };
    
    if (!incomingMap.has(edge.targetNodeId)) {
      incomingMap.set(edge.targetNodeId, []);
    }
    incomingMap.get(edge.targetNodeId)!.push(incoming);
  });

  return { incomingMap, outgoingMap };
}

// ===== Main Export Function =====

/**
 * Convert an ArgumentChain to a linear thread representation
 * 
 * @param chain - Full chain with all relations
 * @param currentArgumentId - Optional: highlight this argument as "current"
 * @returns ChainThread with ordered items
 */
export function chainToThread(
  chain: ArgumentChainWithRelations,
  currentArgumentId?: string
): ChainThread {
  const nodes = chain.nodes || [];
  const edges = chain.edges || [];

  // Handle empty chain
  if (nodes.length === 0) {
    return {
      chainId: chain.id,
      chainName: chain.name || "Untitled Chain",
      chainDescription: chain.description,
      chainType: chain.chainType,
      nodeCount: 0,
      edgeCount: 0,
      maxDepth: 0,
      creator: chain.creator ? { ...chain.creator, id: String(chain.creator.id) } : null,
      items: [],
      orphans: [],
      hasCircularDependency: false,
      rootNodeIds: [],
      leafNodeIds: [],
    };
  }

  // Build edge maps
  const { incomingMap, outgoingMap } = buildEdgeMaps(edges);

  // Topological sort
  const { sorted, hasCircle } = topologicalSortWithDepth(nodes, edges);

  // Build visited set for orphan detection
  const sortedNodeIds = new Set(sorted.map(s => s.node.id));
  
  // Find orphan nodes
  const orphanNodes = nodes.filter(n => !sortedNodeIds.has(n.id));

  // Identify roots and leaves
  const rootNodeIds: string[] = [];
  const leafNodeIds: string[] = [];
  
  nodes.forEach(node => {
    const hasIncoming = incomingMap.has(node.id) && incomingMap.get(node.id)!.length > 0;
    const hasOutgoing = outgoingMap.has(node.id) && outgoingMap.get(node.id)!.length > 0;
    
    if (!hasIncoming) rootNodeIds.push(node.id);
    if (!hasOutgoing) leafNodeIds.push(node.id);
  });

  // Calculate max depth
  const maxDepth = sorted.length > 0 ? Math.max(...sorted.map(s => s.depth)) : 0;

  // Transform sorted nodes to ThreadItems
  const items: ThreadItem[] = sorted.map(({ node, depth, position }) => {
    const argument = node.argument;
    const primaryScheme = argument?.argumentSchemes?.[0];
    const schemeCount = argument?.argumentSchemes?.length || 0;
    const hasSchemeNet = argument?.schemeNet !== null && argument?.schemeNet !== undefined;

    // Get attacking nodes (nodes with targetType = NODE targeting this node)
    const attackingNodes = nodes
      .filter(n => n.targetType === "NODE" && n.targetEdgeId === node.id)
      .map(n => n.id);

    return {
      nodeId: node.id,
      argumentId: argument?.id || "",
      position,
      depth,
      
      // Prefer conclusion.text (canonical), fallback to argument.text (may be composite)
      argumentText: (argument as any)?.conclusion?.text || argument?.text || "No content",
      argumentTitle: undefined, // Arguments don't have titles in current schema
      
      schemeKey: primaryScheme?.scheme?.key,
      schemeName: primaryScheme?.scheme?.name,
      schemeCount,
      hasSchemeNet,
      
      role: node.role || "PREMISE",
      nodeOrder: node.nodeOrder,
      
      // Phase 4: Epistemic Status & Scope
      epistemicStatus: (node as any).epistemicStatus || "ASSERTED",
      dialecticalRole: (node as any).dialecticalRole,
      scope: (node as any).scope ? {
        id: (node as any).scope.id,
        scopeType: (node as any).scope.scopeType,
        assumption: (node as any).scope.assumption,
        color: (node as any).scope.color,
      } : null,
      
      contributor: node.contributor,
      
      incomingEdges: incomingMap.get(node.id) || [],
      outgoingEdges: outgoingMap.get(node.id) || [],
      
      isRoot: rootNodeIds.includes(node.id),
      isLeaf: leafNodeIds.includes(node.id),
      isCurrent: argument?.id === currentArgumentId,
      
      attackingNodes,
    };
  });

  // Transform orphan nodes
  const orphans: ThreadItem[] = orphanNodes.map((node, idx) => {
    const argument = node.argument;
    const primaryScheme = argument?.argumentSchemes?.[0];
    const schemeCount = argument?.argumentSchemes?.length || 0;
    const hasSchemeNet = argument?.schemeNet !== null && argument?.schemeNet !== undefined;

    return {
      nodeId: node.id,
      argumentId: argument?.id || "",
      position: -1, // Orphan indicator
      depth: -1,
      
      // Prefer conclusion.text (canonical), fallback to argument.text (may be composite)
      argumentText: argument?.conclusion?.text || argument?.text || "No content",
      argumentTitle: undefined,
      
      schemeKey: primaryScheme?.scheme?.key,
      schemeName: primaryScheme?.scheme?.name,
      schemeCount,
      hasSchemeNet,
      
      role: node.role || "COMMENT",
      nodeOrder: node.nodeOrder,
      
      // Phase 4: Epistemic Status & Scope
      epistemicStatus: (node as any).epistemicStatus || "ASSERTED",
      dialecticalRole: (node as any).dialecticalRole,
      scope: (node as any).scope ? {
        id: (node as any).scope.id,
        scopeType: (node as any).scope.scopeType,
        assumption: (node as any).scope.assumption,
        color: (node as any).scope.color,
      } : null,
      
      contributor: node.contributor,
      
      incomingEdges: [],
      outgoingEdges: [],
      
      isRoot: false,
      isLeaf: false,
      isCurrent: argument?.id === currentArgumentId,
      
      attackingNodes: [],
    };
  });

  return {
    chainId: chain.id,
    chainName: chain.name || "Untitled Chain",
    chainDescription: chain.description,
    chainType: chain.chainType,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    maxDepth,
    creator: chain.creator ? { ...chain.creator, id: String(chain.creator.id) } : null,
    items,
    orphans,
    hasCircularDependency: hasCircle,
    rootNodeIds,
    leafNodeIds,
  };
}

/**
 * Get the primary edge type connecting two consecutive items
 */
export function getEdgeTypeBetween(
  thread: ChainThread,
  fromPosition: number,
  toPosition: number
): ThreadEdge | null {
  const fromItem = thread.items.find(i => i.position === fromPosition);
  const toItem = thread.items.find(i => i.position === toPosition);
  
  if (!fromItem || !toItem) return null;
  
  // Find edge from source to target
  const edge = fromItem.outgoingEdges.find(e => e.connectedNodeId === toItem.nodeId);
  return edge || null;
}

/**
 * Get human-readable edge type label
 */
export function getEdgeTypeLabel(edgeType: string): string {
  const labels: Record<string, string> = {
    SUPPORTS: "Supports",
    ENABLES_PREMISE: "Enables Premise",
    LEADS_TO: "Leads To",
    PRESUPPOSES: "Presupposes",
    CONTRADICTS: "Contradicts",
    ATTACKS: "Attacks",
    REBUTS: "Rebuts",
  };
  return labels[edgeType] || edgeType.replace(/_/g, " ");
}

/**
 * Get color class for edge type
 */
export function getEdgeTypeColor(edgeType: string): string {
  const colors: Record<string, string> = {
    SUPPORTS: "text-green-600 bg-green-50 border-green-200",
    ENABLES_PREMISE: "text-blue-600 bg-blue-50 border-blue-200",
    LEADS_TO: "text-indigo-600 bg-indigo-50 border-indigo-200",
    PRESUPPOSES: "text-purple-600 bg-purple-50 border-purple-200",
    CONTRADICTS: "text-red-600 bg-red-50 border-red-200",
    ATTACKS: "text-orange-600 bg-orange-50 border-orange-200",
    REBUTS: "text-rose-600 bg-rose-50 border-rose-200",
  };
  return colors[edgeType] || "text-gray-600 bg-gray-50 border-gray-200";
}
