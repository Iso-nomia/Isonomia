// components/dialogue/deep-dive/DiagramViewer.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import type { AifSubgraph } from '@/lib/arguments/diagram';
import { useDagreLayout, LAYOUT_PRESETS } from '@/components/map/Aifdagrelayout';
import { ZoomAwareAifNode } from '@/components/map/Enhancedaifnodes';

interface DiagramViewerProps {
  graph: AifSubgraph;
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  height?: number;
  className?: string;
  dsMode?: boolean; // Phase 2.3: Enable Dempster-Shafer display
  deliberationId?: string; // For fetching DS data if needed
}

function getEdgeStyle(role: string): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  switch (role) {
    case 'premise':
      return { stroke: '#64748b', strokeWidth: 1.5 };
    case 'conclusion':
      return { stroke: '#059669', strokeWidth: 1.5 };
    case 'conflictingElement':
      return { stroke: '#ef4444', strokeWidth: 1.5 };
    case 'conflictedElement':
      return { stroke: '#dc2626', strokeWidth: 1.5 };
    case 'preferredElement':
      return { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '8,4' };
    case 'dispreferredElement':
      return { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '6,3' };
    default:
      return { stroke: '#94a3b8', strokeWidth: 1.5 };
  }
}

export function DiagramViewer({
  graph,
  selectedNodeId,
  onNodeClick,
  height = 400,
  className = '',
  dsMode = false,
  deliberationId,
}: DiagramViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodePositions, graphBounds } = useDagreLayout(
    graph,
    LAYOUT_PRESETS.compact
  );

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Auto-center on mount
  useEffect(() => {
    if (containerRef.current && nodePositions.size > 0) {
      const centerX = (graphBounds.minX + graphBounds.maxX) / 2;
      const centerY = (graphBounds.minY + graphBounds.maxY) / 2;

      setPan({
        x: -centerX * zoom + containerRef.current.clientWidth / 2,
        y: -centerY * zoom + containerRef.current.clientHeight / 2,
      });
    }
  }, [graphBounds, nodePositions.size, zoom]);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  }

  const uniqueEdgeRoles = Array.from(new Set(graph.edges.map(e => e.role)));

  if (graph.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-sm text-slate-500">No nodes to display</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-50 rounded-lg border border-slate-200 ${className}`}
      style={{ height }}
    >
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
        <button
          onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
          className="text-slate-600 hover:text-slate-900 p-1"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <span className="text-[10px] font-medium text-slate-700 min-w-[2.5rem] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.25))}
          className="text-slate-600 hover:text-slate-900 p-1"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <button
          onClick={() => {
            setZoom(1);
            if (containerRef.current && nodePositions.size > 0) {
              const centerX = (graphBounds.minX + graphBounds.maxX) / 2;
              const centerY = (graphBounds.minY + graphBounds.maxY) / 2;
              setPan({
                x: -centerX + containerRef.current.clientWidth / 2,
                y: -centerY + containerRef.current.clientHeight / 2,
              });
            }
          }}
          className="text-[10px] text-slate-600 hover:text-slate-900 px-1"
          title="Reset view"
        >
          Reset
        </button>
      </div>

      {/* Stats */}
      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600 shadow-sm">
        <span className="font-semibold">{graph.nodes.length}</span> nodes, {' '}
        <span className="font-semibold">{graph.edges.length}</span> edges
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          {uniqueEdgeRoles.map(role => {
            const style = getEdgeStyle(role);
            return (
              <marker
                key={role}
                id={`arrow-${role}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill={style.stroke} />
              </marker>
            );
          })}
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {graph.edges.map(edge => {
            const from = nodePositions.get(edge.from);
            const to = nodePositions.get(edge.to);
            if (!from || !to) return null;

            const style = getEdgeStyle(edge.role);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={midX}
                  y2={midY}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                  markerEnd={`url(#arrow-${edge.role})`}
                />
                <line
                  x1={midX}
                  y1={midY}
                  x2={to.x}
                  y2={to.y}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map(node => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - pos.width / 2}, ${pos.y - pos.height / 2})`}
                onClick={() => onNodeClick?.(node.id)}
                className="cursor-pointer transition-all"
              >
                {isSelected && (
                  <rect
                    x={-3}
                    y={-3}
                    width={pos.width + 6}
                    height={pos.height + 6}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    rx={node.kind === 'I' ? 6 : pos.width / 2}
                    className="animate-pulse"
                  />
                )}

                <ZoomAwareAifNode
                  node={node}
                  width={pos.width}
                  height={pos.height}
                  isHovered={isSelected}
                  zoomLevel={zoom}
                />

                {/* Phase 2.3: DS Mode Indicator */}
                {/* TODO: Extend AifNode type to include confidence/belief/plausibility data */}
                {/* For now, show DS mode indicator on RA nodes */}
                {node.kind === 'RA' && dsMode && zoom > 0.6 && (
                  <g transform={`translate(${pos.width / 2}, ${pos.height + 8})`}>
                    <rect
                      x={-25}
                      y={-8}
                      width={50}
                      height={16}
                      fill="white"
                      stroke="#6366f1"
                      strokeWidth={1}
                      rx={4}
                      opacity={0.95}
                    />
                    <text
                      x={0}
                      y={0}
                      className="text-[10px] font-medium fill-indigo-700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      DS Mode
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}