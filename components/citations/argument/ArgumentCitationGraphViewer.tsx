"use client";

/**
 * ArgumentCitationGraph Component
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Interactive visualization of citation relationships:
 * - Node-based graph rendering
 * - Color-coded by citation type
 * - Zoom/pan controls
 * - Click to navigate to argument
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Download,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArgumentCitationBadge } from "./ArgumentCitationBadge";
import type {
  ArgCitationType,
  CitationGraph,
  CitationGraphNode,
  CitationGraphEdge,
} from "@/lib/citations/argumentCitationTypes";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ArgumentCitationGraphViewerProps {
  graph: CitationGraph | null;
  isLoading?: boolean;
  highlightedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edge: CitationGraphEdge) => void;
  className?: string;
}

interface PositionedNode extends CitationGraphNode {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const NODE_RADIUS = 24;
const EDGE_COLORS: Record<ArgCitationType, string> = {
  SUPPORT: "#22c55e",      // green-500
  EXTENSION: "#3b82f6",    // blue-500
  APPLICATION: "#8b5cf6",  // purple-500
  CONTRAST: "#f59e0b",     // amber-500
  REBUTTAL: "#ef4444",     // red-500
  REFINEMENT: "#06b6d4",   // cyan-500
  METHODOLOGY: "#6366f1",  // indigo-500
  CRITIQUE: "#f97316",     // orange-500
};

// ─────────────────────────────────────────────────────────
// Layout Algorithm (Simple Force-Directed Placement)
// ─────────────────────────────────────────────────────────

function calculateNodePositions(
  nodes: CitationGraphNode[],
  edges: CitationGraphEdge[],
  width: number,
  height: number
): PositionedNode[] {
  if (nodes.length === 0) return [];

  // Simple radial layout for now
  // TODO: Implement proper force-directed layout or use react-flow
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Find root nodes (nodes with no incoming edges)
  const targetIds = new Set(edges.map((e) => e.target));
  const sourceIds = new Set(edges.map((e) => e.source));
  const rootIds = nodes
    .filter((n) => !targetIds.has(n.id) || sourceIds.has(n.id))
    .map((n) => n.id);

  // Simple circular layout
  return nodes.map((node, i): PositionedNode => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const isRoot = rootIds.includes(node.id);
    const nodeRadius = isRoot ? radius * 0.6 : radius;

    return {
      ...node,
      x: centerX + nodeRadius * Math.cos(angle),
      y: centerY + nodeRadius * Math.sin(angle),
    };
  });
}

// ─────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────

interface GraphNodeProps {
  node: PositionedNode;
  isHighlighted: boolean;
  onClick: () => void;
}

function GraphNode({ node, isHighlighted, onClick }: GraphNodeProps) {
  return (
    <g
      onClick={onClick}
      className="cursor-pointer"
      style={{ transition: "transform 0.2s" }}
    >
      <circle
        cx={node.x}
        cy={node.y}
        r={NODE_RADIUS}
        className={cn(
          "transition-all duration-200",
          isHighlighted
            ? "fill-blue-500 stroke-blue-600 stroke-2"
            : "fill-white stroke-gray-300 stroke-1 dark:fill-gray-800 dark:stroke-gray-600"
        )}
      />
      <circle
        cx={node.x}
        cy={node.y}
        r={NODE_RADIUS - 4}
        className={cn(
          "fill-transparent transition-colors",
          isHighlighted ? "stroke-blue-300" : "stroke-gray-200 dark:stroke-gray-700"
        )}
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn(
          "text-xs font-medium pointer-events-none select-none",
          isHighlighted ? "fill-white" : "fill-gray-700 dark:fill-gray-300"
        )}
      >
        {node.label.length > 10
          ? `${node.label.substring(0, 8)}...`
          : node.label}
      </text>
    </g>
  );
}

interface GraphEdgeProps {
  edge: CitationGraphEdge;
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  onClick: () => void;
}

function GraphEdge({ edge, sourceNode, targetNode, onClick }: GraphEdgeProps) {
  const color = EDGE_COLORS[edge.citationType] || "#9ca3af";

  // Calculate edge path with offset for arrow
  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const offsetX = (dx / distance) * NODE_RADIUS;
  const offsetY = (dy / distance) * NODE_RADIUS;

  const x1 = sourceNode.x + offsetX;
  const y1 = sourceNode.y + offsetY;
  const x2 = targetNode.x - offsetX;
  const y2 = targetNode.y - offsetY;

  // Arrow marker id
  const markerId = `arrow-${edge.citationType}`;

  return (
    <g onClick={onClick} className="cursor-pointer">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2"
        markerEnd={`url(#${markerId})`}
        className="transition-opacity hover:opacity-70"
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function ArgumentCitationGraphViewer({
  graph,
  isLoading = false,
  highlightedNodeId,
  onNodeClick,
  onEdgeClick,
  className,
}: ArgumentCitationGraphViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 600, height: 400 });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Measure container
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate positioned nodes
  const positionedNodes = React.useMemo(() => {
    if (!graph?.nodes) return [];
    return calculateNodePositions(
      graph.nodes,
      graph.edges,
      dimensions.width,
      dimensions.height
    );
  }, [graph, dimensions]);

  // Create node lookup
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positionedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [positionedNodes]);

  // Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700",
          className
        )}
        style={{ minHeight: 300 }}
      >
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading citation graph...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!graph || graph.nodes.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700",
          className
        )}
        style={{ minHeight: 300 }}
      >
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Layers className="w-8 h-8" />
          <span className="text-sm">No citation relationships to display</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/90 dark:bg-gray-800/90 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-7 w-7 p-0">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-7 w-7 p-0">
              <ZoomOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 w-7 p-0">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view</TooltipContent>
        </Tooltip>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Citation Types
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(EDGE_COLORS).slice(0, 4).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-gray-500">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 rounded-lg px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {graph.nodes.length} nodes • {graph.edges.length} citations
        </span>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ height: 400 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: "center" }}
          >
            {/* Edges */}
            {graph.edges.map((edge: CitationGraphEdge) => {
              const sourceNode = nodeMap.get(edge.source);
              const targetNode = nodeMap.get(edge.target);
              if (!sourceNode || !targetNode) return null;

              return (
                <GraphEdge
                  key={`${edge.source}-${edge.target}`}
                  edge={edge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  onClick={() => onEdgeClick?.(edge)}
                />
              );
            })}

            {/* Nodes */}
            {positionedNodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                isHighlighted={node.id === highlightedNodeId}
                onClick={() => onNodeClick?.(node.id)}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Simple Stats Component
// ─────────────────────────────────────────────────────────

export interface CitationGraphStatsProps {
  graph: CitationGraph | null;
  className?: string;
}

export function CitationGraphStats({ graph, className }: CitationGraphStatsProps) {
  if (!graph) return null;

  // Count by type
  const typeCounts = graph.edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.citationType] = (acc[edge.citationType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cn("p-3 rounded-lg bg-gray-50 dark:bg-gray-800", className)}>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Citation Statistics
      </h4>
      <div className="space-y-1.5">
        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} className="flex items-center justify-between gap-2">
            <ArgumentCitationBadge
              type={type as ArgCitationType}
              size="xs"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {count} {count === 1 ? "citation" : "citations"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Total arguments</span>
          <span className="font-medium">{graph.nodes.length}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Total citations</span>
          <span className="font-medium">{graph.edges.length}</span>
        </div>
      </div>
    </div>
  );
}

export default ArgumentCitationGraphViewer;
