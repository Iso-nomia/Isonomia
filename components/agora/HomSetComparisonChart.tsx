// components/agora/HomSetComparisonChart.tsx
"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";

interface HomSetComparisonChartProps {
  arguments: Array<{
    id: string;
    title: string;
    homSetConfidence: number;
    incomingCount: number;
    outgoingCount: number;
  }>;
  onArgumentClick?: (argumentId: string) => void;
}

/**
 * HomSetComparisonChart
 * 
 * Compares hom-set aggregate confidence across multiple arguments.
 * Shows relative confidence levels with bar chart visualization and edge counts.
 * 
 * Phase 3.5.3: Aggregate Confidence Comparison
 */
export function HomSetComparisonChart({
  arguments: args,
  onArgumentClick,
}: HomSetComparisonChartProps) {
  // Sort by confidence descending
  const sorted = React.useMemo(() => {
    return [...args].sort((a, b) => b.homSetConfidence - a.homSetConfidence);
  }, [args]);

  // Calculate average confidence for reference line
  const avgConfidence = React.useMemo(() => {
    if (args.length === 0) return 0;
    const sum = args.reduce((acc, arg) => acc + arg.homSetConfidence, 0);
    return sum / args.length;
  }, [args]);

  if (args.length === 0) {
    return (
      <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-600">
          No arguments to compare
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          Hom-Set Confidence Comparison
        </h4>
        <div className="text-xs text-slate-500">
          Avg: {(avgConfidence * 100).toFixed(1)}%
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-3">
        {sorted.map((arg, index) => {
          const barWidth = (arg.homSetConfidence * 100).toFixed(0);
          const isAboveAvg = arg.homSetConfidence >= avgConfidence;
          
          return (
            <div
              key={arg.id}
              className={`space-y-1.5 p-2 rounded-lg border transition-all ${
                onArgumentClick
                  ? "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30"
                  : "border-slate-200"
              }`}
              onClick={() => onArgumentClick?.(arg.id)}
              role={onArgumentClick ? "button" : undefined}
              tabIndex={onArgumentClick ? 0 : undefined}
              onKeyDown={
                onArgumentClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onArgumentClick(arg.id);
                      }
                    }
                  : undefined
              }
            >
              {/* Title and Confidence */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-slate-500 flex-shrink-0">
                    #{index + 1}
                  </span>
                  <span className="truncate text-slate-900 font-medium" title={arg.title}>
                    {arg.title}
                  </span>
                  {isAboveAvg && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Above avg
                    </span>
                  )}
                </div>
                <span className="font-semibold text-indigo-600 ml-2 flex-shrink-0">
                  {(arg.homSetConfidence * 100).toFixed(1)}%
                </span>
              </div>

              {/* Bar Chart */}
              <div className="relative w-full bg-slate-100 rounded-full h-8 overflow-hidden">
                {/* Average line indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-400 opacity-50 z-10"
                  style={{ left: `${(avgConfidence * 100).toFixed(1)}%` }}
                  title={`Average: ${(avgConfidence * 100).toFixed(1)}%`}
                />

                {/* Confidence bar */}
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-end px-3 transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                >
                  {parseFloat(barWidth) > 15 && (
                    <span className="text-white text-xs font-semibold">
                      {barWidth}%
                    </span>
                  )}
                </div>
              </div>

              {/* Edge counts */}
              <div className="flex items-center gap-4 text-[10px] text-slate-600">
                <div className="flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-blue-500" />
                  <span>{arg.incomingCount} incoming</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-green-500" />
                  <span>{arg.outgoingCount} outgoing</span>
                </div>
                <div className="ml-auto text-slate-500">
                  Total: {arg.incomingCount + arg.outgoingCount} edges
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="text-xs space-y-1">
          <div className="font-medium text-slate-700 mb-2">About Hom-Set Confidence:</div>
          <p className="text-slate-600">
            Hom-set confidence is the aggregate of all morphism (edge) confidences for an argument.
            It reflects the overall strength of the argument&apos;s connections in the deliberation graph.
          </p>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-300">
            <div className="w-0.5 h-4 bg-slate-400" />
            <span className="text-[10px] text-slate-500">
              Dashed line indicates average confidence across all arguments
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
