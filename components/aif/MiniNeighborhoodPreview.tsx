// components/aif/MiniNeighborhoodPreview.tsx
"use client";

import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";

/**
 * MiniNeighborhoodPreview
 * 
 * Compact AIF neighborhood visualization for hover cards.
 * Shows immediate neighbors (depth=1) with simplified layout.
 * 
 * Node colors:
 * - RA (Argument): blue
 * - I (Statement): yellow
 * - CA (Conflict): red
 * - PA (Preference): purple
 */

interface AifNode {
  id: string;
  kind: "RA" | "I" | "CA" | "PA" | "YA" | "MA" | "TA";
  label?: string | null;
  schemeKey?: string | null;
}

interface AifEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface NeighborhoodData {
  nodes: AifNode[];
  edges: AifEdge[];
}

interface MiniNeighborhoodPreviewProps {
  data: { ok: boolean; aif?: NeighborhoodData } | null;
  loading?: boolean;
  error?: any;
  maxWidth?: number;
  maxHeight?: number;
}

const NODE_COLORS = {
  RA: "#3b82f6", // blue-500
  I: "#eab308",  // yellow-500
  CA: "#ef4444", // red-500
  PA: "#a855f7", // purple-500
  YA: "#06b6d4", // cyan-500
  MA: "#ec4899", // pink-500
  TA: "#84cc16", // lime-500
};

const NODE_LABELS = {
  RA: "Arg",
  I: "Stmt",
  CA: "Conf",
  PA: "Pref",
  YA: "Yet",
  MA: "Maybe",
  TA: "Trans",
};

export function MiniNeighborhoodPreview({
  data,
  loading = false,
  error = null,
  maxWidth = 300,
  maxHeight = 200,
}: MiniNeighborhoodPreviewProps) {
  // Compute simple layout (circular around center)
  const layout = useMemo(() => {
    if (!data?.ok || !data.aif) return null;

    const { nodes, edges } = data.aif;
    if (!nodes.length) return null;

    // Find center node (first RA node, which is the queried argument)
    const centerNode = nodes.find((n: AifNode) => n.kind === 'RA');
    if (!centerNode) return null;

    const centerX = maxWidth / 2;
    const centerY = maxHeight / 2;
    const radius = Math.min(maxWidth, maxHeight) / 3;

    // Center node at center
    const positions = new Map<string, { x: number; y: number }>();
    positions.set(centerNode.id, { x: centerX, y: centerY });

    // Arrange other nodes in circle
    const otherNodes = nodes.filter((n: AifNode) => n.id !== centerNode.id);
    const angleStep = (2 * Math.PI) / Math.max(otherNodes.length, 1);

    otherNodes.forEach((node: AifNode, index: number) => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return { nodes, edges, positions, centerNodeId: centerNode.id };
  }, [data, maxWidth, maxHeight]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50/35 backdrop-blur-lg border border-gray-200 rounded-lg"
        style={{ width: maxWidth, height: maxHeight }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-3"
        style={{ width: maxWidth, height: maxHeight }}
      >
        <p className="text-xs text-red-600 text-center">{error}</p>
      </div>
    );
  }

  if (!layout || !data) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg"
        style={{ width: maxWidth, height: maxHeight }}
      >
        <p className="text-xs text-gray-500">No neighborhood data</p>
      </div>
    );
  }

  const { nodes, edges, positions, centerNodeId } = layout;

  return (
    <div className=" panel-edge rounded-xl overflow-hidden">
      <svg width={maxWidth} height={maxHeight} className="bg-white/45 rounded-t-lg border-none">
        {/* Draw edges first (behind nodes) */}
        {edges.map((edge: AifEdge) => {
          const fromPos = positions.get(edge.from);
          const toPos = positions.get(edge.to);
          if (!fromPos || !toPos) return null;

          return (
            <g key={edge.id}>
              <line
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray={edge.label ? "3,3" : undefined}
              />
              {/* Arrow head */}
              <polygon
                points={`${toPos.x},${toPos.y - 4} ${toPos.x - 3},${toPos.y + 2} ${toPos.x + 3},${toPos.y + 2}`}
                fill="#94a3b8"
              />
            </g>
          );
        })}

        {/* Draw nodes */}
        {nodes.map((node: AifNode) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const isCenter = node.id === centerNodeId;
          const color = NODE_COLORS[node.kind] || "#6b7280";
          const label = NODE_LABELS[node.kind] || node.kind;
          const radius = isCenter ? 18 : 14;

          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={color}
                stroke={isCenter ? "#1e293b" : "white"}
                strokeWidth={isCenter ? 2 : 1}
                opacity={0.9}
              />
              {/* Node label */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] font-semibold fill-white select-none"
              >
                {label}
              </text>
              {/* Tooltip text (truncated) */}
              {node.label && (
                <title>
                  {node.kind}: {node.label.slice(0, 100)}
                  {node.label.length > 100 ? "..." : ""}
                </title>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="relative  bottom-0 right-0 bg-white/90 px-4 py-1 text-xs text-gray-600">
        {nodes.length} nodes • {edges.length} edges
      </div>
    </div>
  );
}
