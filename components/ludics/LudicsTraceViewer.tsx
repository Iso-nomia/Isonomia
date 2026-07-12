"use client";

import * as React from "react";
import { TraceRibbon } from "@/packages/ludics-react/TraceRibbon";
import { CommitmentDelta } from "@/components/dialogue/CommitmentDelta";
import type { StepResult } from "@/packages/ludics-core/types";

/**
 * LudicsTraceViewer — Displays interaction trace ribbon with decisive steps
 * 
 * Phase 2: Task 2.1
 * Extracted from LudicsPanel.tsx (lines ~920-950)
 */

interface LudicsTraceViewerProps {
  trace: StepResult | null;
  deliberationId: string;
  badges?: Record<string, string>;
  revFailIndices?: number[];
}

type TraceLike = {
  steps: {
    posActId: string;
    negActId: string;
    locusPath: string;
    ts: number;
  }[];
  status: "ONGOING" | "CONVERGENT" | "DIVERGENT";
  decisiveIndices?: number[];
};

function asTraceLike(t?: StepResult | null): TraceLike | null {
  if (!t) return null;
  return {
    steps: (t.pairs ?? [])
      .map((p) => {
        if (typeof p.posActId === "string" && typeof p.negActId === "string") {
          return {
            posActId: p.posActId,
            negActId: p.negActId,
            locusPath: p.locusPath ?? "",
            ts: p.ts ?? 0,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    status: t.status === "STUCK" ? "ONGOING" : t.status,
    decisiveIndices: t.decisiveIndices,
  };
}

export function LudicsTraceViewer({
  trace,
  deliberationId,
  badges = {},
  revFailIndices = [],
}: LudicsTraceViewerProps) {
  const traceLike = asTraceLike(trace);

  return (
    <div className="rounded-md border border-slate-200 bg-white/60 p-2">
      {traceLike ? (
        <TraceRibbon
          steps={traceLike.steps}
          status={traceLike.status}
          badges={badges}
          decisiveIndices={trace?.decisiveIndices}
          revFailIndices={revFailIndices}
        />
      ) : (
        <div className="text-xs text-neutral-500">No traversal yet.</div>
      )}
      
      {/* Decisive steps indicator */}
      {trace?.decisiveIndices?.length ? (
        <div className="mt-1 text-[11px] text-indigo-700">
          decisive: {trace.decisiveIndices.map((i) => i + 1).join(", ")}
        </div>
      ) : null}
      
      {/* Commitment delta overlay */}
      <CommitmentDelta
        dialogueId={deliberationId}
        refreshKey={`${trace?.status}:${trace?.pairs?.length ?? 0}`}
      />
    </div>
  );
}
