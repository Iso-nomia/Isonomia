"use client";

import * as React from "react";
import type { Chronicle } from "@/packages/ludics-core/dds";

interface ChroniclesListProps {
  strategyId: string;
  chronicles?: Chronicle[];
  isLoading?: boolean;
  cached?: boolean;
  onSelectChronicle?: (chronicle: Chronicle) => void;
  onRefresh?: () => void;
}

export function ChroniclesList({
  strategyId,
  chronicles = [],
  isLoading = false,
  cached = false,
  onSelectChronicle,
  onRefresh,
}: ChroniclesListProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "positive" | "negative">(
    "all"
  );

  const handleSelect = (chronicle: Chronicle) => {
    setSelectedId(chronicle.id);
    onSelectChronicle?.(chronicle);
  };

  const filteredChronicles = React.useMemo(() => {
    if (filter === "all") return chronicles;
    if (filter === "positive")
      return chronicles.filter((c) => c.isPositive);
    return chronicles.filter((c) => !c.isPositive);
  }, [chronicles, filter]);

  return (
    <div className="chronicles-list border rounded-lg p-4 bg-white/70 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Ch(S)</h3>
          {cached && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
              cached
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "positive" | "negative")
            }
            className="text-[10px] border rounded px-1.5 py-0.5 bg-white"
          >
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="text-xs text-slate-500 py-4 text-center">
          Extracting chronicles...
        </div>
      ) : chronicles.length === 0 ? (
        <div className="text-xs text-slate-500 italic py-4 text-center">
          No chronicles found
          <div className="text-[10px] mt-1">Strategy may be empty</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>
              {filteredChronicles.length} chronicle
              {filteredChronicles.length !== 1 ? "s" : ""}
            </span>
            {filter !== "all" && (
              <span className="text-slate-400">
                (of {chronicles.length} total)
              </span>
            )}
          </div>

          {/* Chronicles list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredChronicles.map((chronicle, idx) => (
              <button
                key={chronicle.id}
                onClick={() => handleSelect(chronicle)}
                className={`w-full text-left p-2 rounded border transition text-xs ${
                  selectedId === chronicle.id
                    ? "bg-violet-50 border-violet-200"
                    : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-slate-700">
                    Chronicle {idx + 1}
                  </span>
                  <PolarityBadge
                    polarity={chronicle.polarity}
                    isPositive={chronicle.isPositive}
                  />
                </div>
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <div>Length: {chronicle.actions.length} actions</div>
                  {chronicle.actions.length > 0 && (
                    <div className="font-mono truncate">
                      Path:{" "}
                      {chronicle.actions
                        .map((a) => a.focus)
                        .join(" → ")}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Strategy ID reference */}
      <div className="text-[10px] text-slate-400 border-t pt-2">
        Strategy:{" "}
        <code className="bg-slate-100 px-1 rounded">{strategyId}</code>
      </div>
    </div>
  );
}

interface PolarityBadgeProps {
  polarity: "P" | "O";
  isPositive: boolean;
}

function PolarityBadge({ polarity, isPositive }: PolarityBadgeProps) {
  return (
    <div className="flex items-center gap-1">
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          polarity === "P"
            ? "bg-sky-100 text-sky-700"
            : "bg-rose-100 text-rose-700"
        }`}
      >
        {polarity}
      </span>
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          isPositive
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {isPositive ? "+" : "−"}
      </span>
    </div>
  );
}

export default ChroniclesList;
