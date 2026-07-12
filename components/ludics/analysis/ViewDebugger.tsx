"use client";

import * as React from "react";
import useSWR from "swr";
import type { View } from "@/packages/ludics-core/dds/types";
import type { ViewDebugMode } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function LegalityIndicator({ actions }: { actions: any[] }) {
  const isLegal = actions.length > 0;

  return (
    <div
      className={`legality-indicator border rounded p-2 text-xs ${
        isLegal
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-rose-50 border-rose-200 text-rose-700"
      }`}
    >
      <span className="font-bold">{isLegal ? "✓ Legal" : "✗ Illegal"}</span>{" "}
      position
    </div>
  );
}

// Step-by-step view debugger
function StepDebugger({ view }: { view: View }) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const sequence = view.sequence || [];

  const currentAction = sequence[currentStep];
  const prefix = sequence.slice(0, currentStep + 1);

  return (
    <div className="step-debugger space-y-4">
      <div className="text-xs font-semibold text-slate-800">
        Step-by-Step View Analysis
      </div>

      {/* Step controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-2 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-30"
        >
          ← Prev
        </button>
        <div className="flex-1 text-center text-xs font-mono text-slate-700">
          Step {currentStep + 1} / {sequence.length}
        </div>
        <button
          onClick={() =>
            setCurrentStep(Math.min(sequence.length - 1, currentStep + 1))
          }
          disabled={currentStep === sequence.length - 1}
          className="px-2 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Current action details */}
      {currentAction && (
        <div className="action-details border rounded p-3 bg-slate-50">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            Current Action
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Focus:</span>
              <span className="font-mono text-slate-800">
                {currentAction?.focus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Polarity:</span>
              <span
                className={`font-bold ${
                  currentAction?.polarity === "P"
                    ? "text-sky-600"
                    : "text-rose-600"
                }`}
              >
                {currentAction?.polarity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Ramification:</span>
              <span className="font-mono text-slate-800">
                [{currentAction?.ramification?.join(", ")}]
              </span>
            </div>
          </div>
        </div>
      )}

      {/* View prefix so far */}
      <div className="prefix-view border rounded p-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">
          View Prefix ({prefix.length} actions)
        </div>
        <pre className="text-[10px] bg-white p-2 rounded overflow-x-auto">
          {JSON.stringify(prefix, null, 2)}
        </pre>
      </div>

      {/* Legality check */}
      <LegalityIndicator actions={prefix} />
    </div>
  );
}

// Compute similarity between two views
function computeSimilarity(v1: View, v2: View): number {
  const seq1 = v1.sequence || [];
  const seq2 = v2.sequence || [];
  const len1 = seq1.length;
  const len2 = seq2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  let matches = 0;
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (JSON.stringify(seq1[i]) === JSON.stringify(seq2[i])) {
      matches++;
    }
  }

  return matches / maxLen;
}

function ViewCard({ title, view }: { title: string; view: View }) {
  return (
    <div className="view-card border rounded p-3 bg-slate-50">
      <div className="text-xs font-semibold text-slate-700 mb-2">{title}</div>
      <div className="text-xs space-y-1">
        <div>Length: {view.sequence?.length || 0}</div>
        <div>Player: {view.player}</div>
      </div>
      <pre className="mt-2 text-[10px] bg-white p-2 rounded overflow-x-auto max-h-32">
        {JSON.stringify(view.sequence, null, 2)}
      </pre>
    </div>
  );
}

// Compare view with others
function CompareDebugger({
  view,
  allViews,
}: {
  view: View;
  allViews: View[];
}) {
  const [compareWith, setCompareWith] = React.useState<View | null>(null);

  const similarViews = React.useMemo(() => {
    return allViews
      .filter((v) => v.id !== view.id)
      .map((v) => ({
        view: v,
        similarity: computeSimilarity(view, v),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }, [view, allViews]);

  return (
    <div className="compare-debugger space-y-4">
      <div className="text-xs font-semibold text-slate-800">View Comparison</div>

      {/* Similar views */}
      <div className="similar-views">
        <div className="text-xs font-semibold text-slate-700 mb-2">
          Most Similar Views
        </div>
        <div className="space-y-1">
          {similarViews.map(({ view: v, similarity }, idx) => (
            <button
              key={v.id || idx}
              onClick={() => setCompareWith(v)}
              className={`w-full text-left p-2 rounded border text-xs transition ${
                compareWith?.id === v.id
                  ? "bg-violet-50 border-violet-300"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono">View {idx + 1}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {Math.round(similarity * 100)}% similar
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-side comparison */}
      {compareWith && (
        <div className="comparison-grid grid grid-cols-2 gap-3">
          <ViewCard title="Selected View" view={view} />
          <ViewCard title="Comparing With" view={compareWith} />
        </div>
      )}
    </div>
  );
}

// Trace view through dispute
function TraceDebugger({
  view,
  designId,
}: {
  view: View;
  designId: string;
}) {
  const { data: disputesData } = useSWR(
    designId ? `/api/ludics/dds/correspondence/disp?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const disputes = disputesData?.disputes || [];
  const matchingDisputes = disputes.filter((d: any) =>
    disputeContainsView(d, view)
  );

  return (
    <div className="trace-debugger space-y-4">
      <div className="text-xs font-semibold text-slate-800">
        Trace View in Disputes
      </div>

      <div className="text-xs text-slate-600">
        This view appears in {matchingDisputes.length} dispute(s)
      </div>

      {matchingDisputes.map((dispute: any, idx: number) => (
        <DisputeTraceCard
          key={dispute.id || idx}
          dispute={dispute}
          view={view}
          index={idx}
        />
      ))}

      {matchingDisputes.length === 0 && (
        <div className="text-xs text-slate-500 italic text-center py-8">
          This view does not appear in any disputes
        </div>
      )}
    </div>
  );
}

function disputeContainsView(dispute: any, view: View): boolean {
  // Simplified check - would need more sophisticated matching
  return true;
}

function DisputeTraceCard({
  dispute,
  view,
  index,
}: {
  dispute: any;
  view: View;
  index: number;
}) {
  return (
    <div className="dispute-trace-card border rounded p-3 bg-white">
      <div className="text-xs font-mono font-semibold text-slate-700 mb-2">
        Dispute {index + 1}
      </div>
      <div className="text-[10px] text-slate-600">
        View appears at positions: [computation needed]
      </div>
    </div>
  );
}

export function ViewDebugger({
  designId,
  positionId,
}: {
  designId: string;
  positionId?: string;
}) {
  const [selectedView, setSelectedView] = React.useState<View | null>(null);
  const [debugMode, setDebugMode] = React.useState<ViewDebugMode>("step");

  // Fetch all views
  const { data: viewsData } = useSWR(
    designId ? `/api/ludics/dds/views?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const views = (viewsData?.views || []) as View[];

  return (
    <div className="view-debugger border rounded-lg bg-white">
      {/* Header */}
      <div className="debugger-header flex items-center justify-between p-3 border-b bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">View-Based Debugger</h3>

        <div className="debug-mode-selector flex gap-1">
          <ModeButton
            active={debugMode === "step"}
            onClick={() => setDebugMode("step")}
          >
            Step
          </ModeButton>
          <ModeButton
            active={debugMode === "compare"}
            onClick={() => setDebugMode("compare")}
          >
            Compare
          </ModeButton>
          <ModeButton
            active={debugMode === "trace"}
            onClick={() => setDebugMode("trace")}
          >
            Trace
          </ModeButton>
        </div>
      </div>

      <div className="debugger-content flex h-96">
        {/* Views sidebar */}
        <div className="views-sidebar w-64 border-r overflow-y-auto">
          <div className="p-2 border-b bg-slate-50">
            <div className="text-xs font-semibold text-slate-700">
              Views ({views.length})
            </div>
          </div>
          <div className="space-y-1 p-2">
            {views.map((view, idx) => (
              <button
                key={view.id || idx}
                onClick={() => setSelectedView(view)}
                className={`w-full text-left p-2 rounded text-xs transition ${
                  selectedView?.id === view.id
                    ? "bg-indigo-100 border border-indigo-300 text-indigo-800"
                    : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                }`}
              >
                <div className="font-mono font-semibold">View {idx + 1}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {view.sequence?.length || 0} actions
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main debug area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedView ? (
            <>
              {debugMode === "step" && <StepDebugger view={selectedView} />}
              {debugMode === "compare" && (
                <CompareDebugger view={selectedView} allViews={views} />
              )}
              {debugMode === "trace" && (
                <TraceDebugger view={selectedView} designId={designId} />
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 italic text-center py-16">
              Select a view to debug
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
