// components/dialogue/command-card/CQContextPanel.tsx
"use client";

import * as React from "react";
import { useMemo } from "react";
import useSWR from "swr";
import { CheckCircle } from "lucide-react";
import type { CommandCardAction } from "./types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface CQContextPanelProps {
  deliberationId: string;
  targetType: "claim" | "argument";
  targetId: string;
  actions: CommandCardAction[];
}

export function CQContextPanel({
  deliberationId,
  targetType,
  targetId,
  actions,
}: CQContextPanelProps) {
  // 1. Extract cqIds from WHY/GROUNDS moves
  const cqIds = useMemo(() => {
    return actions
      .filter(a => a.kind === "WHY" || a.kind === "GROUNDS")
      .map(a => a.move?.payload?.cqId)
      .filter(Boolean);
  }, [actions]);

  // 2. Fetch CQ data
  const { data: cqData } = useSWR(
    cqIds.length > 0 
      ? `/api/cqs?targetType=${targetType}&targetId=${targetId}` 
      : null,
    fetcher
  );

  // 3. Filter to relevant CQs
  const relevantCQs = useMemo(() => {
    if (!cqData || cqIds.length === 0) return [];
    
    // Flatten schemes -> cqs structure into a single array
    const allCQs: any[] = [];
    if (cqData.schemes) {
      for (const scheme of cqData.schemes) {
        if (scheme.cqs) {
          for (const cq of scheme.cqs) {
            allCQs.push({
              ...cq,
              schemeKey: scheme.key,
              schemeTitle: scheme.title,
            });
          }
        }
      }
    }
    
    return allCQs.filter((cq: any) => cqIds.includes(cq.key));
  }, [cqData, cqIds]);

  if (relevantCQs.length === 0) return null;

  return (
    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <h4 className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Critical Questions Context
      </h4>
      <div className="space-y-2">
        {relevantCQs.map((cq: any) => (
          <div key={cq.key} className="text-xs">
            <div className="flex items-start gap-2">
              <span className="font-mono text-amber-700 font-bold shrink-0">{cq.key}:</span>
              <span className="text-slate-700 flex-1">{cq.text}</span>
              {cq.satisfied && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
            </div>
            <div className="text-[10px] text-slate-500 ml-8 mt-0.5">
              Scheme: <span className="font-medium">{cq.schemeTitle || cq.schemeKey}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-amber-300 text-[10px] text-amber-800 italic">
        💡 Use the action buttons below to answer these critical questions
      </div>
    </div>
  );
}
