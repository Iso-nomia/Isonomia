"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SchemeNodeData {
  scheme: {
    schemeId?: string;
    schemeName?: string;
    conclusion?: string;
  };
  role?: string;
  explicitness?: string;
  confidence?: number;
  _highlighted?: boolean;
  _dimmed?: boolean;
  isCriticalPath?: boolean;
  hasCircularDependency?: boolean;
}

export const HighlightableSchemeNode = memo(({ data, selected }: NodeProps) => {
  const {
    scheme,
    role,
    explicitness,
    confidence,
    _highlighted,
    _dimmed,
    isCriticalPath,
    hasCircularDependency,
  } = data as unknown as SchemeNodeData;

  return (
    <div
      id={`scheme-${scheme.schemeId}`}
      className={cn(
        "transition-all duration-300",
        _dimmed && "opacity-30 scale-95",
        _highlighted && "ring-4 ring-sky-400 scale-105 z-10"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-sky-500"
      />

      <Card
        className={cn(
          "min-w-[220px] max-w-[300px] transition-all",
          selected && "ring-2 ring-sky-400",
          role === "primary" && "border-sky-500 bg-sky-50",
          role === "supporting" && "border-green-500 bg-green-50",
          role === "subordinate" && "border-purple-500 bg-purple-50",
          isCriticalPath && "shadow-xl ring-2 ring-yellow-400",
          hasCircularDependency && "border-red-500 ring-2 ring-red-400"
        )}
      >
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {role}
                </Badge>
                {isCriticalPath && (
                  <span className="text-yellow-600" title="Critical Path">
                    ⭐
                  </span>
                )}
                {hasCircularDependency && (
                  <span className="text-red-600" title="Circular Dependency">
                    ⚠️
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold">{scheme.schemeName}</p>
            </div>
          </div>

          {scheme.conclusion && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {scheme.conclusion}
            </p>
          )}

          <div className="flex items-center justify-between text-xs">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                explicitness === "explicit" && "opacity-100",
                explicitness === "semi-explicit" && "opacity-80",
                explicitness === "implicit" && "opacity-60"
              )}
            >
              {explicitness}
            </Badge>
            <span className="text-gray-500">{confidence}%</span>
          </div>
        </div>
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-sky-500"
      />
    </div>
  );
});

HighlightableSchemeNode.displayName = "HighlightableSchemeNode";
