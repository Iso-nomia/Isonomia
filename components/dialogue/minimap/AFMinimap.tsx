// components/dialogue/minimap/AFMinimap.tsx
'use client';

import * as React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import type { MinimapProps, MinimapNode, MinimapEdge } from './types';

// Simple force-directed simulation (lightweight alternative to D3)
interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data: MinimapNode;
}

function useForceLayout(
  nodes: MinimapNode[],
  edges: MinimapEdge[],
  width: number,
  height: number,
  iterations = 300
) {
  return useMemo(() => {
    if (nodes.length === 0) return { nodePositions: new Map<string, { x: number; y: number }>() };

    // Initialize nodes with random positions
    const forceNodes: ForceNode[] = nodes.map(n => ({
      id: n.id,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0,
      vy: 0,
      data: n,
    }));

    const nodeMap = new Map(forceNodes.map(n => [n.id, n]));

    // Force parameters
    const centerForce = 0.01;
    const repulsionStrength = 800;
    const attractionStrength = 0.02;
    const damping = 0.85;
    const minDistance = 20;

    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations; // Cooling schedule

      // Apply forces
      forceNodes.forEach(node => {
        // Center gravity
        const dcx = width / 2 - node.x;
        const dcy = height / 2 - node.y;
        node.vx += dcx * centerForce * alpha;
        node.vy += dcy * centerForce * alpha;

        // Repulsion from other nodes
        forceNodes.forEach(other => {
          if (node === other) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 0.01) return;
          
          const force = (repulsionStrength * alpha) / distSq;
          const dist = Math.sqrt(distSq);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        });
      });

      // Edge attraction
      edges.forEach(edge => {
        const source = nodeMap.get(edge.from);
        const target = nodeMap.get(edge.to);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) return;

        const force = (dist - 50) * attractionStrength * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      // Update positions with damping
      forceNodes.forEach(node => {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;

        // Keep within bounds with padding
        const padding = 15;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      });
    }

    return {
      nodePositions: new Map(forceNodes.map(n => [n.id, { x: n.x, y: n.y }])),
    };
  }, [nodes, edges, width, height, iterations]);
}

function getNodeColor(node: MinimapNode): string {
  if (node.fogged) return '#C7CED6';
  switch (node.status) {
    case 'IN': return '#16a34a';
    case 'OUT': return '#dc2626';
    default: return '#64748b';
  }
}

function getEdgeStyle(kind: MinimapEdge['kind']): { stroke: string; dash: string } {
  switch (kind) {
    case 'support': return { stroke: '#64748b', dash: '0' };
    case 'rebut': return { stroke: '#dc2626', dash: '0' };
    case 'undercut': return { stroke: '#a16207', dash: '4 3' };
    default: return { stroke: '#94a3b8', dash: '0' };
  }
}

export function AFMinimap({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  onHoverNode,
  width = 240,
  height = 160,
  showLegend = true,
}: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [tooltipData, setTooltipData] = React.useState<{
    node: MinimapNode;
    x: number;
    y: number;
  } | null>(null);

  const { nodePositions } = useForceLayout(nodes, edges, width, height);

  const handleNodeClick = (node: MinimapNode) => {
    onSelectNode?.(node.id, node.locusPath ?? null);
  };

  const handleNodeMouseEnter = (node: MinimapNode, x: number, y: number) => {
    setHoveredId(node.id);
    setTooltipData({ node, x, y });
    onHoverNode?.(node.id);
  };

  const handleNodeMouseLeave = () => {
    setHoveredId(null);
    setTooltipData(null);
    onHoverNode?.(null);
  };

  // Calculate connected nodes for hover highlighting
  const getConnectedNodes = (nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId]);
    edges.forEach(e => {
      if (e.from === nodeId) connected.add(e.to);
      if (e.to === nodeId) connected.add(e.from);
    });
    return connected;
  };

  const connectedNodes = hoveredId ? getConnectedNodes(hoveredId) : new Set<string>();

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm p-3">
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>Argument Map</span>
          <span className="text-[10px] font-normal text-slate-500">
            {nodes.length} nodes
          </span>
        </h3>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="bg-slate-50/50 rounded-lg"
        >
          <defs>
            {/* Arrow markers for different edge types */}
            <marker
              id="arrow-support"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#64748b" />
            </marker>
            <marker
              id="arrow-rebut"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#dc2626" />
            </marker>
            <marker
              id="arrow-undercut"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#a16207" />
            </marker>
          </defs>

          {/* Edges */}
          <g className="edges">
            {edges.map(edge => {
              const from = nodePositions.get(edge.from);
              const to = nodePositions.get(edge.to);
              if (!from || !to) return null;

              const style = getEdgeStyle(edge.kind);
              const isHighlighted = hoveredId && (
                connectedNodes.has(edge.from) && connectedNodes.has(edge.to)
              );

              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={style.stroke}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={style.dash}
                  strokeOpacity={isHighlighted ? 0.9 : 0.5}
                  markerEnd={`url(#arrow-${edge.kind})`}
                  className="transition-all duration-200"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {nodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = node.id === selectedId;
              const isHovered = node.id === hoveredId;
              const isConnected = connectedNodes.has(node.id);
              const radius = isSelected ? 9 : isHovered ? 8 : 6;
              const opacity = hoveredId && !isConnected ? 0.3 : 1;

              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => handleNodeMouseEnter(node, pos.x, pos.y)}
                  onMouseLeave={handleNodeMouseLeave}
                  className="transition-all duration-200"
                  opacity={opacity}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius + 3}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={getNodeColor(node)}
                    stroke={node.closable ? '#4f46e5' : '#0f172a'}
                    strokeWidth={isHovered ? 2 : 1}
                    strokeDasharray={node.closable ? '2 2' : '0'}
                    className="transition-all duration-200"
                  />

                  {/* Open CQ indicator */}
                  {node.hasOpenCq && node.hasOpenCq > 0 && (
                    <g>
                      <circle
                        cx={pos.x + radius}
                        cy={pos.y - radius}
                        r={4}
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth={1}
                      />
                      <text
                        x={pos.x + radius}
                        y={pos.y - radius}
                        fontSize="6"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontWeight="bold"
                      >
                        {node.hasOpenCq}
                      </text>
                    </g>
                  )}

                  {/* Endorsements indicator */}
                  {node.endorsements && node.endorsements > 0 && (
                    <text
                      x={pos.x}
                      y={pos.y + radius + 8}
                      fontSize="7"
                      fill="#64748b"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      +{node.endorsements}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltipData && (
          <div
            className="absolute z-50 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none max-w-[180px]"
            style={{
              left: tooltipData.x + 10,
              top: tooltipData.y - 10,
              transform: 'translate(0, -100%)',
            }}
          >
            <div className="font-semibold">{tooltipData.node.kind}</div>
            {tooltipData.node.label && (
              <div className="mt-0.5 opacity-90 line-clamp-2">
                {tooltipData.node.label}
              </div>
            )}
            <div className="mt-1 text-slate-300">
              Status: {tooltipData.node.status}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#16a34a]" />
            IN
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#dc2626]" />
            OUT
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#64748b]" />
            UNDEC
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#C7CED6]" />
            fog
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded border-2 border-dashed border-[#4f46e5]" />
            † closable
          </span>
        </div>
      )}
    </div>
  );
}