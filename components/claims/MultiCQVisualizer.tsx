"use client";

import * as React from "react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";

type CQ = {
  key: string;
  text: string;
  satisfied: boolean;
  suggestion?: any;
};

type Scheme = {
  key: string;
  title: string;
  cqs: CQ[];
};

interface MultiCQVisualizerProps {
  scheme: Scheme;
  onToggleCQ: (schemeKey: string, cqKey: string, value: boolean) => void;
  canMarkAddressed: (sig: string, satisfied: boolean) => boolean;
  sigOf: (schemeKey: string, cqKey: string) => string;
  postingKey: string | null;
  okKey: string | null;
  children?: (cq: CQ) => React.ReactNode; // Render additional actions per CQ
}

/**
 * Enhanced CQ visualization for schemes with many critical questions (5+).
 * Features:
 * - Progress indicator showing satisfaction ratio
 * - Compact grid layout for better space utilization
 * - Collapsible sections for large CQ lists
 * - Visual grouping and status indicators
 */
export function MultiCQVisualizer({
  scheme,
  onToggleCQ,
  canMarkAddressed,
  sigOf,
  postingKey,
  okKey,
  children,
}: MultiCQVisualizerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const cqCount = scheme.cqs.length;
  const satisfiedCount = scheme.cqs.filter(cq => cq.satisfied).length;
  const progressPercent = cqCount > 0 ? (satisfiedCount / cqCount) * 100 : 0;

  // Use compact layout for 5+ CQs
  const useCompactLayout = cqCount >= 5;

  return (
    <div className="rounded border bg-white shadow-sm">
      {/* Header with progress */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{scheme.title}</span>
            <span className="text-[11px] text-slate-500">
              {satisfiedCount}/{cqCount} satisfied
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100
                  ? 'bg-emerald-500'
                  : progressPercent > 50
                  ? 'bg-sky-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Expand/collapse icon */}
        <button className="p-1 hover:bg-slate-200 rounded transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* CQ List */}
      {isExpanded && (
        <div className={`p-3 pt-0 border-t ${useCompactLayout ? '' : ''}`}>
          {useCompactLayout ? (
            // Compact grid layout for 5+ CQs
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              {scheme.cqs.map((cq) => {
                const sig = sigOf(scheme.key, cq.key);
                const canAddress = canMarkAddressed(sig, cq.satisfied);
                const posting = postingKey === sig;
                const ok = okKey === sig;

                return (
                  <div
                    key={cq.key}
                    className="group relative p-2 border border-slate-200 rounded-md hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        className="mt-0.5 flex-shrink-0"
                        checked={cq.satisfied}
                        onCheckedChange={(val) =>
                          onToggleCQ(scheme.key, cq.key, Boolean(val))
                        }
                        disabled={!canAddress || posting}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs ${
                              cq.satisfied ? "opacity-70 line-through" : ""
                            }`}
                          >
                            {cq.text}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {ok && (
                              <span className="text-[10px] text-emerald-700">✓</span>
                            )}
                            {!cq.satisfied && !canAddress && (
                              <span className="text-[9px] text-slate-400">(add)</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons rendered by parent */}
                        {children && (
                          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {children(cq)}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (
            // Standard list layout for <5 CQs
            <ul className="mt-3 space-y-2">
              {scheme.cqs.map((cq) => {
                const sig = sigOf(scheme.key, cq.key);
                const canAddress = canMarkAddressed(sig, cq.satisfied);
                const posting = postingKey === sig;
                const ok = okKey === sig;

                return (
                  <li
                    key={cq.key}
                    className="text-sm p-2 border border-slate-200 rounded-md hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        className="mt-1 flex-shrink-0"
                        checked={cq.satisfied}
                        onCheckedChange={(val) =>
                          onToggleCQ(scheme.key, cq.key, Boolean(val))
                        }
                        disabled={!canAddress || posting}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`${
                              cq.satisfied ? "opacity-70 line-through" : ""
                            }`}
                          >
                            {cq.text}
                          </span>
                          <div className="flex items-center gap-1">
                            {ok && (
                              <span className="text-[10px] text-emerald-700">✓</span>
                            )}
                            {!cq.satisfied && !canAddress && (
                              <span className="text-[10px] text-neutral-500">(add)</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons rendered by parent */}
                        {children && (
                          <div className="mt-2">
                            {children(cq)}
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Summary footer for large CQ lists */}
          {useCompactLayout && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  {satisfiedCount === cqCount ? (
                    <span className="text-emerald-600 font-medium">
                      ✓ All critical questions satisfied
                    </span>
                  ) : (
                    <span>
                      {cqCount - satisfiedCount} question{cqCount - satisfiedCount !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                </span>
                <span className="text-slate-400">
                  {scheme.key}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
