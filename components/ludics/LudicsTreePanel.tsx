"use client";

import * as React from "react";
import { LociTree } from "@/packages/ludics-react/LociTree";
import LociTreeWithControls from "@/components/ludics/LociTreeWithControls";
import { NLCommitPopover } from "@/components/dialogue/NLCommitPopover";
import { mergeDesignsToTree } from "@/packages/ludics-react/mergeDesignsToTree";
import type { StepResult } from "@/packages/ludics-core/types";

/**
 * LudicsTreePanel — Displays loci trees (unified or split view)
 * 
 * Phase 2: Task 2.2
 * Extracted from LudicsPanel.tsx (lines ~1090-1190)
 */

interface LudicsTreePanelProps {
  designs: any[];
  viewMode: "unified" | "split";
  trace: StepResult | null;
  deliberationId: string;
  proDesignId?: string;
  oppDesignId?: string;
  actsCount: number;
  focusPath?: string | null;
  onFocusPathChange?: (path: string | null) => void;
  pickAdditive?: (path: string, branch: number) => void;
  commitAtPath?: (label: string, path: string) => Promise<void>;
  suggestClose?: (path: string) => void;
  heatmap?: Record<string, number>;
  stepIndexByActId?: Record<string, number>;
  isDesignsLoading?: boolean;
  designsError?: any;
}

function shapeToTree(d: any) {
  if (!d) return null;
  if (d.root) return d;
  return {
    actId: d.acts?.[0]?.id,
    locus: { path: "ε", ramification: 1, rolePattern: "" },
    children: d.acts?.[0]?.children ?? [],
  };
}

export function LudicsTreePanel({
  designs,
  viewMode,
  trace,
  deliberationId,
  proDesignId,
  oppDesignId,
  actsCount,
  focusPath,
  onFocusPathChange,
  pickAdditive,
  commitAtPath,
  suggestClose,
  heatmap = {},
  stepIndexByActId = {},
  isDesignsLoading = false,
  designsError = null,
}: LudicsTreePanelProps) {
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitPath, setCommitPath] = React.useState<string | null>(null);
  
  // For NLCommitPopover target context (simplified - may need actual context)
  const targetIdFromContext = deliberationId;
  const targetTypeFromContext: "argument" | "claim" | "card" = "claim";

  return (
    <div className="grid gap-4">
      {viewMode === "unified" ? (
        <div className="border rounded-lg p-2 bg-white/60">
          <div className="text-xs mb-1 flex items-center gap-2">
            <b>Unified loci</b>
            <span className="px-1.5 py-0.5 rounded border bg-slate-50">
              acts {actsCount}
            </span>
          </div>
          
          <LociTreeWithControls
            dialogueId={deliberationId}
            posDesignId={proDesignId ?? ""}
            negDesignId={oppDesignId ?? ""}
            defaultMode="assoc"
            suggestCloseDaimonAt={
              suggestClose
                ? (path: string) => {
                    suggestClose(path);
                    return true;
                  }
                : undefined
            }
          />

          {commitOpen && commitPath && targetIdFromContext && (
            <NLCommitPopover
              open={commitOpen}
              onOpenChange={setCommitOpen}
              deliberationId={deliberationId}
              targetType={targetTypeFromContext}
              targetId={targetIdFromContext}
              locusPath={commitPath}
              defaultOwner="Proponent"
              onDone={() => {
                /* refresh */
              }}
            />
          )}
        </div>
      ) : (
        // Split view: one per design (kept for debugging/teaching)
        <div className="grid md:grid-cols-2 gap-4">
          {isDesignsLoading && (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={4} />
            </>
          )}
          {designsError && (
            <div className="col-span-2 text-xs text-rose-600 border rounded p-2">
              Failed to load designs.
            </div>
          )}
          {designs?.map((d: any) => (
            <div key={d.id} className="border rounded-lg p-2 bg-white/60">
              <div className="text-xs mb-1 flex items-center gap-2">
                <b>{d.participantId}</b> · {d.id.slice(0, 6)}
                {(() => {
                  const first = (d.acts ?? [])[0];
                  const start =
                    first?.polarity === "O"
                      ? "Start: Negative"
                      : first?.polarity === "P"
                      ? "Start: Positive"
                      : "Start: —";
                  return (
                    <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                      {start}
                    </span>
                  );
                })()}
                <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                  acts {d.acts?.length ?? 0}
                </span>
              </div>
              <LociTree
                root={shapeToTree(d)}
                onPickBranch={
                  pickAdditive
                    ? (parentPath: string, childSuffix: string) =>
                        pickAdditive(parentPath, Number(childSuffix))
                    : undefined
                }
                usedAdditive={trace?.usedAdditive}
                focusPath={focusPath}
                onFocusPathChange={onFocusPathChange}
                defaultCollapsedDepth={1}
                showExpressions
                heatmap={heatmap}
                stepIndexByActId={stepIndexByActId}
                autoScrollOnFocus
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Skeleton loading component
function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border rounded-lg p-2 bg-white/60 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-100 rounded w-full mb-1"></div>
      ))}
    </div>
  );
}
