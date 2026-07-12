// components/map/Aifpathhighlighter.tsx
/**
 * AIF Diagram Path Highlighter
 * 
 * Traces and highlights argument paths through the graph.
 * Shows the logical flow from premises to conclusions.
 */

'use client';

import { useMemo, useState } from 'react';
import type { AifSubgraph, AifNode, AifEdge } from '@/lib/arguments/diagram';

export interface ArgumentPath {
  id: string;
  nodes: string[];
  edges: string[];
  type: 'support' | 'attack' | 'preference';
  strength?: number;
}

/**
 * Find all paths from a source node to a target node
 */
export function findPaths(
  graph: AifSubgraph,
  fromNodeId: string,
  toNodeId: string,
  maxDepth = 5
): ArgumentPath[] {
  const paths: ArgumentPath[] = [];
  const visited = new Set<string>();
  
  function dfs(
    currentId: string,
    targetId: string,
    path: string[],
    edgePath: string[],
    depth: number
  ) {
    if (depth > maxDepth) return;
    if (currentId === targetId) {
      // Found a path!
      paths.push({
        id: `path-${paths.length}`,
        nodes: [...path, currentId],
        edges: edgePath,
        type: inferPathType(edgePath, graph),
      });
      return;
    }
    
    if (visited.has(currentId)) return;
    visited.add(currentId);
    
    // Find outgoing edges from current node
    const outgoingEdges = graph.edges.filter(e => e.from === currentId);
    
    for (const edge of outgoingEdges) {
      dfs(
        edge.to,
        targetId,
        [...path, currentId],
        [...edgePath, edge.id],
        depth + 1
      );
    }
    
    visited.delete(currentId);
  }
  
  dfs(fromNodeId, toNodeId, [], [], 0);
  return paths;
}

/**
 * Find all paths that lead to a conclusion (I-node)
 */
export function findPathsToConclusion(
  graph: AifSubgraph,
  conclusionNodeId: string
): ArgumentPath[] {
  const allPaths: ArgumentPath[] = [];
  
  // Find all I-nodes (premises)
  const premiseNodes = graph.nodes.filter(
    n => n.kind === 'I' && n.id !== conclusionNodeId
  );
  
  for (const premise of premiseNodes) {
    const paths = findPaths(graph, premise.id, conclusionNodeId);
    allPaths.push(...paths);
  }
  
  return allPaths;
}

/**
 * Infer the type of path based on edges
 */
function inferPathType(
  edgeIds: string[],
  graph: AifSubgraph
): 'support' | 'attack' | 'preference' {
  const edges = edgeIds.map(id => graph.edges.find(e => e.id === id)!);
  
  // Check if path contains CA nodes (attack)
  if (edges.some(e => e.role === 'conflictedElement')) return 'attack';
  
  // Check if path contains PA nodes (preference)
  if (edges.some(e => e.role === 'preferredElement')) return 'preference';
  
  // Default to support
  return 'support';
}

/**
 * Path Highlighter Component
 */
export function AifPathHighlighter({
  graph,
  selectedNodeId,
  onPathSelect,
  className = '',
}: {
  graph: AifSubgraph;
  selectedNodeId?: string;
  onPathSelect?: (path: ArgumentPath | null) => void;
  className?: string;
}) {
  const [activePath, setActivePath] = useState<ArgumentPath | null>(null);
  
  // Find paths from/to selected node
  const availablePaths = useMemo(() => {
    if (!selectedNodeId) return [];
    
    const node = graph.nodes.find(n => n.id === selectedNodeId);
    if (!node) return [];
    
    // If it's a conclusion, find paths TO it
    if (node.kind === 'I') {
      return findPathsToConclusion(graph, selectedNodeId);
    }
    
    // If it's an argument node, find paths FROM it
    const conclusionNodes = graph.nodes.filter(n => n.kind === 'I');
    const paths: ArgumentPath[] = [];
    
    for (const conclusion of conclusionNodes) {
      paths.push(...findPaths(graph, selectedNodeId, conclusion.id));
    }
    
    return paths;
  }, [graph, selectedNodeId]);

  function handlePathSelect(path: ArgumentPath) {
    setActivePath(path);
    onPathSelect?.(path);
  }

  function handleClearPath() {
    setActivePath(null);
    onPathSelect?.(null);
  }

  if (!selectedNodeId || availablePaths.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs ${className}`}>
      <div className="flex items-center justify-between mb-2 gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Argument Paths</h3>
        {activePath && (
          <button
            onClick={handleClearPath}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {availablePaths.map((path) => (
          <button
            key={path.id}
            onClick={() => handlePathSelect(path)}
            className={`w-full text-left px-3 py-2 rounded-md text-xs border transition-colors ${
              activePath?.id === path.id
                ? 'bg-sky-50 border-sky-300 text-sky-900'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2 justify-between">
              <span className="font-medium">
                {path.type === 'support' && '✓ Support'}
                {path.type === 'attack' && '⚔ Attack'}
                {path.type === 'preference' && '⭐ Preference'}
              </span>
              <span className="text-gray-500">
                {path.nodes.length} nodes
              </span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {path.nodes.length} steps through graph
            </div>
          </button>
        ))}
      </div>
      
      {availablePaths.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-4">
          No paths found from this node
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get highlighted elements for active path
 */
export function usePathHighlight(activePath: ArgumentPath | null) {
  return useMemo(() => {
    if (!activePath) {
      return { highlightedNodes: new Set<string>(), highlightedEdges: new Set<string>() };
    }
    
    return {
      highlightedNodes: new Set(activePath.nodes),
      highlightedEdges: new Set(activePath.edges),
    };
  }, [activePath]);
}

/**
 * Get CSS classes for highlighted elements
 */
export function getPathHighlightStyle(
  elementId: string,
  highlightedNodes: Set<string>,
  highlightedEdges: Set<string>,
  pathType?: 'support' | 'attack' | 'preference'
) {
  const isHighlighted = highlightedNodes.has(elementId) || highlightedEdges.has(elementId);
  
  if (!isHighlighted) {
    return {
      opacity: 0.3,
      filter: 'grayscale(50%)',
    };
  }
  
  // Highlight color based on path type
  let highlightColor = '#3b82f6'; // sky for support
  if (pathType === 'attack') highlightColor = '#ef4444'; // red
  if (pathType === 'preference') highlightColor = '#22c55e'; // green
  
  return {
    opacity: 1,
    filter: 'none',
    stroke: highlightColor,
    strokeWidth: 3,
    animation: 'pulse 2s ease-in-out infinite',
  };
}