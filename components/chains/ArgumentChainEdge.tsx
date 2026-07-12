"use client";

import React, { memo, useState } from "react";
import { BaseEdge, EdgeProps, Edge, getBezierPath, EdgeLabelRenderer } from "@xyflow/react";
import { ChainEdgeData } from "@/lib/types/argumentChain";
import { getEdgeTypeConfig, getEdgeStrokeWidth } from "@/lib/constants/chainEdgeTypes";
import { Swords } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExtendedChainEdgeData extends ChainEdgeData {
  isTargeted?: boolean;
  attackCount?: number;
  isEditable?: boolean;
  onAttackEdge?: (edgeId: string, sourceNodeId: string, targetNodeId: string) => void;
}

type ExtendedChainEdge = Edge<ExtendedChainEdgeData>;

interface ArgumentChainEdgeProps extends EdgeProps<ExtendedChainEdge> {}

const ArgumentChainEdge: React.FC<ArgumentChainEdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}) => {
  const edgeConfig = getEdgeTypeConfig(data?.edgeType || "SUPPORTS");
  const strokeWidth = getEdgeStrokeWidth(data?.strength || 0.5);
  const isTargeted = data?.isTargeted || false;
  const attackCount = data?.attackCount || 0;
  const isEditable = data?.isEditable ?? true;
  const [showAttackButton, setShowAttackButton] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleAttackEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onAttackEdge) {
      data.onAttackEdge(id, source, target);
    }
  };

  return (
    <>
      {/* Base Edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isTargeted ? "#ef4444" : selected ? "#3b82f6" : edgeConfig.color,
          strokeWidth: isTargeted ? strokeWidth + 2 : selected ? strokeWidth + 1 : strokeWidth,
          strokeDasharray: edgeConfig.strokeDasharray,
        }}
        markerEnd={markerEnd}
      />

      {/* Edge Label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          onMouseEnter={() => setShowAttackButton(true)}
          onMouseLeave={() => setShowAttackButton(false)}
        >
          <div
            className={`
              px-2 py-1 text-xs font-medium rounded shadow-sm
              ${isTargeted ? "bg-red-100 text-red-800 border border-red-300 animate-pulse" : selected ? "bg-sky-100 text-sky-800 border border-sky-300" : "bg-white text-gray-700 border border-gray-200"}
              transition-colors duration-200
            `}
            style={{
              borderLeftWidth: "3px",
              borderLeftColor: isTargeted ? "#ef4444" : edgeConfig.color,
            }}
          >
            <div className="flex items-center gap-1.5">
              {isTargeted && <span className="text-xs">🎯</span>}
              <span>{edgeConfig.label}</span>
              {data?.strength !== undefined && (
                <span className="text-[10px] opacity-70">
                  {Math.round(data.strength * 100)}%
                </span>
              )}
              {attackCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-red-200 text-red-800 rounded-full">
                  ⚔️ {attackCount}
                </span>
              )}
              {/* Attack Edge Button */}
              {isEditable && data?.onAttackEdge && showAttackButton && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleAttackEdge}
                        className="ml-1 p-1 rounded hover:bg-purple-100 transition-colors"
                      >
                        <Swords className="w-3 h-3 text-purple-600" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>Challenge this inference (Undercut)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {data?.description && (
              <div className="text-[10px] text-gray-500 mt-0.5 max-w-[120px] truncate">
                {data.description}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(ArgumentChainEdge);
