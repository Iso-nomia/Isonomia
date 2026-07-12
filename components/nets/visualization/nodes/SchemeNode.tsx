"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SchemeNodeData {
  scheme: {
    schemeName: string;
    schemeCategory: string;
    conclusion: string;
    premises: unknown[];
  };
  depth?: number;
  role?: string;
  explicitness?: string;
  confidence?: number;
  isOnCriticalPath?: boolean;
  isInCycle?: boolean;
}

export const SchemeNode = memo(({ data }: NodeProps) => {
  const { scheme, depth, role, explicitness, confidence, isOnCriticalPath, isInCycle } =
    data as unknown as SchemeNodeData;

  // Determine node styling based on properties
  const getNodeStyle = () => {
    let borderColor = "border-gray-300";
    let bgColor = "bg-white";
    let shadowClass = "shadow-md";

    // Role-based styling
    if (role === "primary") {
      borderColor = "border-sky-500";
      bgColor = "bg-sky-50";
    } else if (role === "supporting") {
      borderColor = "border-green-500";
      bgColor = "bg-green-50";
    } else if (role === "subordinate") {
      borderColor = "border-purple-500";
      bgColor = "bg-purple-50";
    }

    // Explicitness opacity
    let opacityClass = "opacity-100";
    if (explicitness === "semi-explicit") {
      opacityClass = "opacity-80";
    } else if (explicitness === "implicit") {
      opacityClass = "opacity-60";
    }

    // Critical path highlighting
    if (isOnCriticalPath) {
      shadowClass = "shadow-xl ring-2 ring-yellow-400";
    }

    // Cycle warning
    if (isInCycle) {
      borderColor = "border-red-500";
      shadowClass = "shadow-xl ring-2 ring-red-400";
    }

    return { borderColor, bgColor, opacityClass, shadowClass };
  };

  const { borderColor, bgColor, opacityClass, shadowClass } = getNodeStyle();

  return (
    <div className={cn("relative", opacityClass)}>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-sky-500"
      />

      {/* Node Card */}
      <Card
        className={cn(
          "min-w-[200px] max-w-[280px] border-2 transition-all hover:shadow-lg",
          borderColor,
          bgColor,
          shadowClass
        )}
      >
        <div className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm leading-tight">
                {scheme.schemeName}
              </h4>
              <p className="text-xs text-gray-500">{scheme.schemeCategory}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                role === "primary" && "bg-sky-100 text-sky-800 border-sky-300",
                role === "supporting" && "bg-green-100 text-green-800 border-green-300",
                role === "subordinate" && "bg-purple-100 text-purple-800 border-purple-300"
              )}
            >
              {role}
            </Badge>
          </div>

          {/* Conclusion */}
          <div className="text-xs">
            <span className="font-medium text-gray-700">Conclusion:</span>
            <p className="text-gray-600 mt-0.5 line-clamp-2">{scheme.conclusion}</p>
          </div>

          {/* Premises Count */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{scheme.premises.length} premises</span>
            <span>•</span>
            <span>{confidence}% confidence</span>
          </div>

          {/* Explicitness Indicator */}
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                explicitness === "explicit" && "bg-green-500",
                explicitness === "semi-explicit" && "bg-yellow-500",
                explicitness === "implicit" && "bg-red-500"
              )}
            />
            <span className="text-xs text-gray-500 capitalize">{explicitness}</span>
          </div>

          {/* Warnings */}
          {isInCycle && (
            <div className="text-xs text-red-600 font-medium">⚠️ In circular dependency</div>
          )}
          {isOnCriticalPath && (
            <div className="text-xs text-yellow-700 font-medium">⭐ Critical path</div>
          )}
        </div>
      </Card>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-sky-500"
      />
    </div>
  );
});

SchemeNode.displayName = "SchemeNode";
