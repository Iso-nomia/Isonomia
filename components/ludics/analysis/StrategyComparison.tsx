"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StrategyComparisonCard({ designId }: { designId: string }) {
  const { data: innocenceData } = useSWR(
    designId ? `/api/ludics/dds/strategy/innocence?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: propagationData } = useSWR(
    designId ? `/api/ludics/dds/strategy/propagation?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: viewsData } = useSWR(
    designId ? `/api/ludics/dds/views?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="comparison-card border rounded-lg p-3 bg-white">
      <div className="text-xs font-mono font-semibold text-slate-700 mb-2">
        Design {designId.slice(0, 8)}...
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600">Innocent:</span>
          <span
            className={
              innocenceData?.isInnocent
                ? "text-emerald-600 font-semibold"
                : "text-amber-600"
            }
          >
            {innocenceData?.isInnocent ? "✓ Yes" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600">Propagation:</span>
          <span
            className={
              propagationData?.satisfiesPropagation
                ? "text-sky-600 font-semibold"
                : "text-rose-600"
            }
          >
            {propagationData?.satisfiesPropagation ? "✓ Yes" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600">Views:</span>
          <span className="text-slate-800 font-semibold">
            {viewsData?.views?.length || viewsData?.count || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function ComparisonMatrix({ designIds }: { designIds: string[] }) {
  return (
    <div className="comparison-matrix border rounded-lg p-3 bg-slate-50">
      <div className="text-xs font-semibold text-slate-700 mb-2">
        Similarity Matrix
      </div>
      <div className="text-[10px] text-slate-600">
        Comparison matrix implementation would compute view/chronicle overlap
        between {designIds.length} designs
      </div>
      {/* Full implementation would show NxN matrix of similarities */}
    </div>
  );
}

export function StrategyComparison({ designIds }: { designIds: string[] }) {
  if (designIds.length === 0) {
    return (
      <div className="text-xs text-slate-500 italic text-center py-8">
        Select 2+ designs to compare strategies
      </div>
    );
  }

  return (
    <div className="strategy-comparison space-y-4">
      <h3 className="text-sm font-bold text-slate-800">
        Strategy Comparison ({designIds.length} designs)
      </h3>

      <div className="comparison-grid grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {designIds.map((designId) => (
          <StrategyComparisonCard key={designId} designId={designId} />
        ))}
      </div>

      {designIds.length >= 2 && <ComparisonMatrix designIds={designIds} />}
    </div>
  );
}
