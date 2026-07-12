/**
 * AIF Diagram Minimap
 * 
 * Small overview map showing the entire graph with a viewport indicator.
 * Users can click to pan to different areas.
 */

'use client';

import { useMemo } from 'react';
import type { AifSubgraph } from '@/lib/arguments/diagram';

interface MinimapProps {
  graph: AifSubgraph;
  viewBox: { x: number; y: number; width: number; height: number };
  graphBounds: { minX: number; minY: number; maxX: number; maxY: number };
  onNavigate: (x: number, y: number) => void;
  className?: string;
}

export function AifDiagramMinimap({
  graph,
  viewBox,
  graphBounds,
  onNavigate,
  className = '',
}: MinimapProps) {
  // Calculate minimap dimensions
  const MINIMAP_WIDTH = 200;
  const MINIMAP_HEIGHT = 150;
  const PADDING = 10;

  // Calculate scale to fit entire graph in minimap
  const graphWidth = graphBounds.maxX - graphBounds.minX;
  const graphHeight = graphBounds.maxY - graphBounds.minY;
  
  const scaleX = (MINIMAP_WIDTH - 2 * PADDING) / graphWidth;
  const scaleY = (MINIMAP_HEIGHT - 2 * PADDING) / graphHeight;
  const scale = Math.min(scaleX, scaleY);

  // Transform coordinates from graph space to minimap space
  function toMinimapCoords(x: number, y: number) {
    return {
      x: (x - graphBounds.minX) * scale + PADDING,
      y: (y - graphBounds.minY) * scale + PADDING,
    };
  }

  // Simplified node positions (assuming some layout)
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    
    // Simple layout: arrange nodes in a grid for minimap
    // In production, use the actual layout positions
    let x = graphBounds.minX;
    let y = graphBounds.minY;
    const spacing = Math.max(graphWidth / 10, 50);
    
    graph.nodes.forEach((node, i) => {
      positions.set(node.id, { x, y });
      x += spacing;
      if (x > graphBounds.maxX) {
        x = graphBounds.minX;
        y += spacing;
      }
    });
    
    return positions;
  }, [graph.nodes, graphBounds, graphWidth]);

  // Calculate viewport rectangle in minimap space
  const viewportRect = useMemo(() => {
    const topLeft = toMinimapCoords(viewBox.x, viewBox.y);
    const bottomRight = toMinimapCoords(
      viewBox.x + viewBox.width,
      viewBox.y + viewBox.height
    );
    
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [viewBox, graphBounds, scale]);

  // Handle click to navigate
  function handleMinimapClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minimapX = e.clientX - rect.left;
    const minimapY = e.clientY - rect.top;
    
    // Convert minimap coords back to graph coords
    const graphX = (minimapX - PADDING) / scale + graphBounds.minX;
    const graphY = (minimapY - PADDING) / scale + graphBounds.minY;
    
    onNavigate(graphX, graphY);
  }

  return (
    <div
      className={`absolute bottom-4 right-4 bg-white border-2 border-gray-300 rounded-lg shadow-lg ${className}`}
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="cursor-pointer"
        onClick={handleMinimapClick}
      >
        {/* Background */}
        <rect
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          fill="#f9fafb"
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Edges (simplified) */}
        {graph.edges.map((edge) => {
          const from = nodePositions.get(edge.from);
          const to = nodePositions.get(edge.to);
          if (!from || !to) return null;
          
          const fromMini = toMinimapCoords(from.x, from.y);
          const toMini = toMinimapCoords(to.x, to.y);
          
          return (
            <line
              key={edge.id}
              x1={fromMini.x}
              y1={fromMini.y}
              x2={toMini.x}
              y2={toMini.y}
              stroke="#d1d5db"
              strokeWidth={1}
            />
          );
        })}

        {/* Nodes (simplified dots) */}
        {graph.nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          
          const miniPos = toMinimapCoords(pos.x, pos.y);
          
          // Color by node type
          let fill = '#94a3b8'; // default gray
          if (node.kind === 'I') fill = '#eab308'; // yellow
          if (node.kind === 'RA') fill = '#3b82f6'; // blue
          if (node.kind === 'CA') fill = '#ef4444'; // red
          if (node.kind === 'PA') fill = '#22c55e'; // green
          
          return (
            <circle
              key={node.id}
              cx={miniPos.x}
              cy={miniPos.y}
              r={3}
              fill={fill}
              stroke="white"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="4,2"
          className="pointer-events-none"
        />

        {/* Label */}
        <text
          x={PADDING}
          y={MINIMAP_HEIGHT - 5}
          className="text-[10px] fill-gray-500 font-medium"
        >
          {graph.nodes.length} nodes
        </text>
      </svg>
    </div>
  );
}

/**
 * Hook to calculate graph bounds
 */
export function useGraphBounds(
  graph: AifSubgraph,
  nodePositions: Map<string, { x: number; y: number }>
) {
  return useMemo(() => {
    if (nodePositions.size === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    nodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    });
    
    // Add padding
    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }, [nodePositions]);
}