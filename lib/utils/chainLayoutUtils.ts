import dagre from "dagre";
import { Node, Edge, Position } from "@xyflow/react";

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 180;

/**
 * Auto-layout nodes using Dagre algorithm
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB" // Top-to-Bottom or Left-to-Right
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 150,
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: NODE_WIDTH, 
      height: NODE_HEIGHT 
    });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Calculate bounding box of all nodes
 */
export function getNodesBounds(nodes: Node[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Center viewport on nodes
 */
export function centerViewport(
  nodes: Node[],
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number; zoom: number } {
  const bounds = getNodesBounds(nodes);
  
  if (bounds.width === 0 || bounds.height === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Calculate zoom to fit all nodes with padding
  const padding = 50;
  const zoomX = (viewportWidth - padding * 2) / bounds.width;
  const zoomY = (viewportHeight - padding * 2) / bounds.height;
  const zoom = Math.min(zoomX, zoomY, 1); // Max zoom is 1

  // Calculate center position
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;

  const x = viewportWidth / 2 - centerX * zoom;
  const y = viewportHeight / 2 - centerY * zoom;

  return { x, y, zoom };
}

/**
 * Find optimal position for new node
 */
export function getNewNodePosition(
  existingNodes: Node[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // If no nodes, place in center
  if (existingNodes.length === 0) {
    return {
      x: canvasWidth / 2 - NODE_WIDTH / 2,
      y: canvasHeight / 2 - NODE_HEIGHT / 2,
    };
  }

  // Find bottom-most node and place below it
  const maxY = Math.max(...existingNodes.map((n) => n.position.y));
  return {
    x: canvasWidth / 2 - NODE_WIDTH / 2,
    y: maxY + NODE_HEIGHT + 100,
  };
}
