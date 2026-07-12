"use client";

import * as React from "react";
import type { Chronicle } from "@/packages/ludics-core/dds/types";

interface ChronicleViewerProps {
  chronicles: Chronicle[];
  player?: "P" | "O";
  onSelectChronicle?: (chronicle: Chronicle) => void;
  selectedId?: string;
  showStats?: boolean;
  className?: string;
}

/**
 * ChronicleViewer - Displays chronicles (branches) extracted from a design
 * 
 * Chronicles represent complete interaction paths. Positive-ended chronicles
 * are key to understanding the design's "material" (what it asserts).
 */
export function ChronicleViewer({
  chronicles,
  player,
  onSelectChronicle,
  selectedId,
  showStats = true,
  className = "",
}: ChronicleViewerProps) {
  const [filter, setFilter] = React.useState<"all" | "positive" | "negative">(
    "all"
  );

  const filteredChronicles = React.useMemo(() => {
    if (filter === "all") return chronicles;
    return chronicles.filter((c) =>
      filter === "positive" ? c.isPositive : !c.isPositive
    );
  }, [chronicles, filter]);

  const positiveCount = chronicles.filter((c) => c.isPositive).length;
  const negativeCount = chronicles.length - positiveCount;

  return (
    <div className={`chronicle-viewer ${className}`}>
      {/* Header with stats */}
      {showStats && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Chronicles
            </span>
            <span className="text-xs text-slate-500">
              {chronicles.length} total
            </span>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">
              {positiveCount} positive
            </span>
            <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
              {negativeCount} negative
            </span>
          </div>
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex gap-1 mb-3">
        {(["all", "positive", "negative"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter === f
                ? "bg-slate-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Chronicle list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredChronicles.length === 0 ? (
          <div className="text-xs text-slate-500 italic text-center py-4">
            No chronicles to display
          </div>
        ) : (
          filteredChronicles.map((chronicle, idx) => (
            <ChronicleItem
              key={chronicle.id}
              chronicle={chronicle}
              index={idx}
              isSelected={chronicle.id === selectedId}
              onClick={() => onSelectChronicle?.(chronicle)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ChronicleItemProps {
  chronicle: Chronicle;
  index: number;
  isSelected?: boolean;
  onClick?: () => void;
}

function ChronicleItem({
  chronicle,
  index,
  isSelected,
  onClick,
}: ChronicleItemProps) {
  const tipAction =
    chronicle.actions.length > 0
      ? chronicle.actions[chronicle.actions.length - 1]
      : null;

  return (
    <button
      className={`w-full text-left p-3 rounded border transition-colors ${
        isSelected
          ? "bg-slate-100 border-slate-300"
          : "bg-white border-slate-200 hover:bg-slate-50"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              chronicle.polarity === "P"
                ? "bg-sky-100 text-sky-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {chronicle.polarity}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              chronicle.isPositive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {chronicle.isPositive ? "+" : "−"}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          {chronicle.actions.length} actions
        </span>
      </div>

      {/* Path visualization */}
      <div className="text-xs font-mono text-slate-600 truncate">
        {chronicle.actions.map((a, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-400 mx-1">→</span>}
            <span
              className={
                a.polarity === "P" ? "text-sky-600" : "text-rose-600"
              }
            >
              {a.focus}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Tip expression if available */}
      {tipAction?.expression && (
        <div className="mt-1 text-[10px] text-slate-500 truncate">
          "{tipAction.expression}"
        </div>
      )}
    </button>
  );
}

/**
 * ChronicleStats - Summary statistics for chronicles
 */
interface ChronicleStatsProps {
  chronicles: Chronicle[];
  className?: string;
}

export function ChronicleStats({ chronicles, className = "" }: ChronicleStatsProps) {
  const positiveCount = chronicles.filter((c) => c.isPositive).length;
  const negativeCount = chronicles.length - positiveCount;
  const avgDepth =
    chronicles.length > 0
      ? (
          chronicles.reduce((sum, c) => sum + c.actions.length, 0) /
          chronicles.length
        ).toFixed(1)
      : 0;

  const uniqueLoci = new Set(
    chronicles.flatMap((c) => c.actions.map((a) => a.focus))
  ).size;

  return (
    <div
      className={`grid grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg ${className}`}
    >
      <div className="text-center">
        <div className="text-lg font-bold text-slate-700">
          {chronicles.length}
        </div>
        <div className="text-xs text-slate-500">Total</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-emerald-600">{positiveCount}</div>
        <div className="text-xs text-slate-500">Positive</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-amber-600">{negativeCount}</div>
        <div className="text-xs text-slate-500">Negative</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-slate-700">{avgDepth}</div>
        <div className="text-xs text-slate-500">Avg Depth</div>
      </div>
    </div>
  );
}

export default ChronicleViewer;
