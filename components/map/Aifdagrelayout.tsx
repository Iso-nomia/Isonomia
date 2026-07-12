/**
 * Dagre Layout for AIF Diagrams
 * 
 * Hierarchical layout optimized for argument flow.
 * Replaces grid layout with intelligent positioning.
 */

'use client';

import { useMemo } from 'react';
import type { AifSubgraph, AifNode,AifEdgeRole } from '@/lib/arguments/diagram';

// Import dagre (install with: npm install dagre @types/dagre)
import dagre from 'dagre';

export interface LayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'; // Direction: Top-Bottom, Left-Right, etc.
  ranksep?: number; // Vertical spacing between ranks
  nodesep?: number; // Horizontal spacing between nodes
  edgesep?: number; // Spacing for edge routing
  marginx?: number; // Left/right margin
  marginy?: number; // Top/bottom margin
}

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate node positions using Dagre hierarchical layout
 */
export function calculateDagreLayout(
  graph: AifSubgraph,
  options: LayoutOptions = {}
): Map<string, NodePosition> {
  // Validate graph structure
  if (!graph || !graph.nodes || !graph.edges) {
    return new Map<string, NodePosition>();
  }

  const {
    rankdir = 'TB', // Top to bottom (premises -> conclusions)
    ranksep = 100,  // Vertical spacing
    nodesep = 80,   // Horizontal spacing
    edgesep = 10,
    marginx = 50,
    marginy = 50,
  } = options;

  // Create dagre graph
  const g = new dagre.graphlib.Graph();
  
  // Set graph configuration
  g.setGraph({
    rankdir,
    ranksep,
    nodesep,
    edgesep,
    marginx,
    marginy,
  });
  
  // Default to simple edge config
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with dimensions
  graph.nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, {
      label: node.label || node.id,
      width,
      height,
    });
  });

  // Add edges
  graph.edges.forEach((edge) => {
    g.setEdge(edge.from, edge.to);
  });

  // Run layout algorithm
  dagre.layout(g);

  // Extract positions
  const positions = new Map<string, NodePosition>();
  
  graph.nodes.forEach((node) => {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      positions.set(node.id, {
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      });
    }
  });

  return positions;
}

/**
 * Get node dimensions based on type and content
 */
function getNodeDimensions(node: AifNode): { width: number; height: number } {
  switch (node.kind) {
    case 'I':
      // Information nodes - wider for text
      const textLength = (node.label || '').length;
      return {
        width: Math.max(180, Math.min(300, textLength * 3)),
        height: Math.max(60, Math.min(120, Math.ceil(textLength / 30) * 20)),
      };
    
    case 'RA':
    case 'CA':
    case 'PA':
      // Argument nodes - compact circles
      return {
        width: 100,
        height: 50,
      };
    
    default:
      return { width: 120, height: 60 };
  }
}

/**
 * Calculate edge path with dagre
 */
export function calculateEdgePath(
  g: dagre.graphlib.Graph,
  from: string,
  to: string
): string | null {
  const edge = g.edge(from, to);
  if (!edge || !edge.points) return null;
  
  // Create SVG path from points
  const points = edge.points;
  if (points.length < 2) return null;
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  // Use quadratic bezier curves for smooth edges
  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const end = points[i + 1];
    path += ` Q ${cp.x} ${cp.y}, ${end.x} ${end.y}`;
  }
  
  // If only 2 points, use straight line
  if (points.length === 2) {
    path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  
  return path;
}

/**
 * Hook to use Dagre layout in components
 */
export function useDagreLayout(
  graph: AifSubgraph,
  options?: LayoutOptions
): {
  nodePositions: Map<string, NodePosition>;
  graphBounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  return useMemo(() => {
    const positions = calculateDagreLayout(graph, options);
    
    // Calculate bounds
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    positions.forEach((pos) => {
      minX = Math.min(minX, pos.x - pos.width / 2);
      minY = Math.min(minY, pos.y - pos.height / 2);
      maxX = Math.max(maxX, pos.x + pos.width / 2);
      maxY = Math.max(maxY, pos.y + pos.height / 2);
    });
    
    // Add padding
    const padding = 100;
    
    return {
      nodePositions: positions,
      graphBounds: {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
      },
    };
  }, [graph, options]);
}

/**
 * Smart layout direction based on graph structure
 */
export function getOptimalLayoutDirection(
  graph: AifSubgraph
): 'TB' | 'LR' | 'RL' {
  // Validate graph structure
  if (!graph || !graph.nodes || !graph.edges) {
    return 'TB';
  }

  // Count premise vs conclusion nodes
  const premises = graph.nodes.filter(n => 
    graph.edges.some(e => e.from === n.id && e.role === 'conclusion' as AifEdgeRole)
  );
  
  const conclusions = graph.nodes.filter(n =>
    graph.edges.some(e => e.to === n.id && e.role === 'conclusion' as AifEdgeRole)
  );
  
  // If more horizontal spread, use left-right
  if (premises.length > 5 && conclusions.length <= 2) {
    return 'LR'; // Many premises -> few conclusions
  }
  
  // Default to top-bottom (traditional argument flow)
  return 'TB';
}

/**
 * Get layout configuration presets
 */
export const LAYOUT_PRESETS = {
  compact: {
    rankdir: 'TB' as const,
    ranksep: 60,
    nodesep: 40,
    edgesep: 10,
    marginx: 30,
    marginy: 30,
  },
  
  standard: {
    rankdir: 'TB' as const,
    ranksep: 100,
    nodesep: 80,
    edgesep: 10,
    marginx: 50,
    marginy: 50,
  },
  
  spacious: {
    rankdir: 'TB' as const,
    ranksep: 150,
    nodesep: 120,
    edgesep: 20,
    marginx: 80,
    marginy: 80,
  },
  
  horizontal: {
    rankdir: 'LR' as const,
    ranksep: 120,
    nodesep: 60,
    edgesep: 10,
    marginx: 50,
    marginy: 50,
  },
};