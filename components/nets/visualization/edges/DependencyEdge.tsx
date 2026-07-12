"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const DependencyEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) => {
  const { dependency, explicitness, isOnCriticalPath } = (data || {}) as {
    dependency?: { type?: string; strength?: number };
    explicitness?: string;
    isOnCriticalPath?: boolean;
  };

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });

  // Edge styling based on properties
  const getEdgeStyle = () => {
    let strokeColor = "#94a3b8"; // gray-400
    let strokeWidth = 2;
    let strokeDasharray = "0";

    // Type-based color
    if (dependency?.type === "prerequisite") {
      strokeColor = "#ef4444"; // red-500
      strokeWidth = 3;
    } else if (dependency?.type === "supporting") {
      strokeColor = "#22c55e"; // green-500
    } else if (dependency?.type === "enabling") {
      strokeColor = "#3b82f6"; // sky-500
    } else if (dependency?.type === "background") {
      strokeColor = "#9ca3af"; // gray-400
      strokeDasharray = "5,5";
    }

    // Explicitness affects opacity
    let opacity = 1;
    if (explicitness === "semi-explicit") {
      opacity = 0.7;
    } else if (explicitness === "implicit") {
      opacity = 0.5;
      strokeDasharray = "3,3";
    }

    // Critical path highlighting
    if (isOnCriticalPath) {
      strokeColor = "#f59e0b"; // amber-500
      strokeWidth = 4;
    }

    // Strength affects width
    if (dependency?.strength) {
      strokeWidth = Math.max(2, Math.min(5, dependency.strength * 5));
    }

    return { strokeColor, strokeWidth, strokeDasharray, opacity };
  };

  const { strokeColor, strokeWidth, strokeDasharray, opacity } = getEdgeStyle();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity,
        }}
      />
      
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <Badge
            className={cn(
              "text-xs px-1.5 py-0.5 shadow-sm",
              dependency?.type === "prerequisite" &&
                "bg-red-100 text-red-800 border-red-300",
              dependency?.type === "supporting" &&
                "bg-green-100 text-green-800 border-green-300",
              dependency?.type === "enabling" &&
                "bg-sky-100 text-sky-800 border-sky-300",
              dependency?.type === "background" &&
                "bg-gray-100 text-gray-800 border-gray-300",
              isOnCriticalPath && "ring-2 ring-yellow-400"
            )}
          >
            {dependency?.type || "depends"}
          </Badge>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

DependencyEdge.displayName = "DependencyEdge";
