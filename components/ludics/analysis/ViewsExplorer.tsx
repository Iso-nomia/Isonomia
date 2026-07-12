"use client";

import * as React from "react";
import useSWR from "swr";
import type { View } from "@/packages/ludics-core/dds/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ViewCard({
  view,
  index,
  selected,
  onSelect,
}: {
  view: View;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`view-card text-left p-2 rounded border transition ${
        selected
          ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
          : "bg-white hover:bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-semibold text-slate-700">
          View {index + 1}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            view.player === "P"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {view.player === "P" ? "Proponent" : "Opponent"}
        </span>
      </div>
      <div className="text-[10px] text-slate-500">
        {view.sequence?.length || 0} actions
      </div>
    </button>
  );
}

export function ViewsExplorer({
  deliberationId,
  designId,
  selectedView,
  onSelectView,
}: {
  deliberationId?: string;
  designId?: string; // For backward compatibility
  selectedView: View | null;
  onSelectView: (view: View) => void;
}) {
  const [pPage, setPPage] = React.useState(0);
  const [oPage, setOPage] = React.useState(0);
  const PAGE_SIZE = 20;

  // Build query params - prefer deliberationId for deliberation-wide views
  const queryParams = new URLSearchParams();
  if (deliberationId) queryParams.set("deliberationId", deliberationId);
  else if (designId) queryParams.set("designId", designId);
  
  const queryString = queryParams.toString();

  const { data, isLoading, mutate } = useSWR(
    queryString ? `/api/ludics/dds/views?${queryString}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const views = (data?.views || []) as View[];
  const stats = data?.stats;

  const computeViews = async () => {
    const body: Record<string, any> = deliberationId 
      ? { deliberationId, forceRecompute: true }
      : { designId, forceRecompute: true };
      
    await fetch(`/api/ludics/dds/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await mutate();
  };

  // Group views by player
  const pViews = views.filter((v) => v.player === "P");
  const oViews = views.filter((v) => v.player === "O");

  return (
    <div className="views-explorer space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Views Explorer</h3>
        <button
          onClick={computeViews}
          className="px-3 py-1 text-xs rounded bg-slate-700 text-white hover:bg-slate-800"
        >
          Recompute Views
        </button>
      </div>

      {/* Description */}
      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border">
        <strong>Views</strong> extract the player-visible subsequence from interaction positions.
        Definition 3.5 (Faggian &amp; Hyland): Multiple views emerge from branching dialogue paths.
      </div>

      {/* Stats */}
      {stats && (
        <div className="text-[10px] text-slate-500 flex gap-3 flex-wrap">
          <span>📊 {stats.sharedLociCount} shared loci</span>
          <span>🔀 {stats.positionCount} positions</span>
          <span className="text-emerald-600">P: {stats.pActCount} acts</span>
          <span className="text-rose-600">O: {stats.oActCount} acts</span>
        </div>
      )}

      {/* Views List */}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading views...</div>
      ) : (
        <div className="space-y-4">
          {/* Proponent Views */}
          {pViews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold text-emerald-700">
                  Proponent Views ({pViews.length})
                </div>
                {pViews.length > PAGE_SIZE && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => setPPage(Math.max(0, pPage - 1))}
                      disabled={pPage === 0}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    >
                      ←
                    </button>
                    <span className="text-slate-500">
                      {pPage * PAGE_SIZE + 1}-{Math.min((pPage + 1) * PAGE_SIZE, pViews.length)} of {pViews.length}
                    </span>
                    <button
                      onClick={() => setPPage(Math.min(Math.ceil(pViews.length / PAGE_SIZE) - 1, pPage + 1))}
                      disabled={(pPage + 1) * PAGE_SIZE >= pViews.length}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              <div className="views-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {pViews.slice(pPage * PAGE_SIZE, (pPage + 1) * PAGE_SIZE).map((view, idx) => (
                  <ViewCard
                    key={view.id || `p-${pPage * PAGE_SIZE + idx}`}
                    view={view}
                    index={pPage * PAGE_SIZE + idx}
                    selected={selectedView?.id === view.id}
                    onSelect={() => onSelectView(view)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Opponent Views */}
          {oViews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold text-rose-700">
                  Opponent Views ({oViews.length})
                </div>
                {oViews.length > PAGE_SIZE && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => setOPage(Math.max(0, oPage - 1))}
                      disabled={oPage === 0}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    >
                      ←
                    </button>
                    <span className="text-slate-500">
                      {oPage * PAGE_SIZE + 1}-{Math.min((oPage + 1) * PAGE_SIZE, oViews.length)} of {oViews.length}
                    </span>
                    <button
                      onClick={() => setOPage(Math.min(Math.ceil(oViews.length / PAGE_SIZE) - 1, oPage + 1))}
                      disabled={(oPage + 1) * PAGE_SIZE >= oViews.length}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              <div className="views-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {oViews.slice(oPage * PAGE_SIZE, (oPage + 1) * PAGE_SIZE).map((view, idx) => (
                  <ViewCard
                    key={view.id || `o-${oPage * PAGE_SIZE + idx}`}
                    view={view}
                    index={oPage * PAGE_SIZE + idx}
                    selected={selectedView?.id === view.id}
                    onSelect={() => onSelectView(view)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && views.length === 0 && (
        <div className="text-xs text-slate-500 italic text-center py-8">
          No views found. Click &quot;Recompute Views&quot; to extract from interaction positions.
        </div>
      )}

      {/* Selected View Details */}
      {selectedView && (
        <div className="selected-view-details border-t pt-3 mt-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">
            View Details
          </h4>
          <div className="bg-white border rounded p-3 space-y-2 text-xs">
            <div>
              <span className="font-semibold">Player:</span>{" "}
              <span className={selectedView.player === "P" ? "text-emerald-600" : "text-rose-600"}>
                {selectedView.player === "P" ? "Proponent" : "Opponent"}
              </span>
            </div>
            <div>
              <span className="font-semibold">Length:</span>{" "}
              {selectedView.sequence?.length || 0} actions
            </div>
            <div>
              <span className="font-semibold">Loci visited:</span>{" "}
              {[...new Set(selectedView.sequence?.map((a: any) => a.focus) || [])].join(" → ")}
            </div>
            <div>
              <span className="font-semibold">Sequence:</span>
              <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedView.sequence, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
