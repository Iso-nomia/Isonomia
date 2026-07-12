"use client";

import * as React from "react";
import useSWR from "swr";
import { StrategyInspector } from "../StrategyInspector";
import { CorrespondenceViewer } from "../CorrespondenceViewer";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="stat-card border rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-semibold text-slate-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

export function AnalysisOverview({ designId, deliberationId }: { designId: string; deliberationId?: string }) {
  const [runningAnalysis, setRunningAnalysis] = React.useState(false);

  // Fetch deliberation-wide stats (canonical, not affected by scope)
  const { data: statsData, mutate: mutateStats } = useSWR(
    deliberationId ? `/api/ludics/dds/stats?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // For strategy inspection, we still need a specific design
  const { data: strategyData, mutate: mutateStrategy } = useSWR(
    designId ? `/api/ludics/dds/strategy/innocence?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const runFullAnalysis = async () => {
    if (!deliberationId) return;
    
    setRunningAnalysis(true);
    try {
      // Run deliberation-wide analyses
      await Promise.all([
        // Compute views for entire deliberation
        fetch(`/api/ludics/dds/views`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliberationId, forceRecompute: true }),
        }),
        // Compute chronicles for all designs
        fetch(`/api/ludics/dds/chronicles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliberationId }),
        }),
        // Strategy analysis for current design (as reference)
        fetch("/api/ludics/dds/strategy/innocence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId }),
        }),
        fetch("/api/ludics/dds/strategy/propagation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId }),
        }),
      ]);

      // Refetch stats
      await Promise.all([
        mutateStats(),
        mutateStrategy(),
      ]);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const stats = statsData?.stats || {};
  const actsCount = stats.acts || 0;
  const viewsCount = stats.views || 0;
  const chroniclesCount = stats.chronicles || 0;
  const designsCount = stats.designs || 0;
  const scopesCount = stats.scopes || 0;
  const strategiesCount = stats.strategies || 0;

  return (
    <div className="analysis-overview space-y-4">
      {/* Header with Run Analysis Button */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Deliberation Analysis</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Canonical analysis across all designs in this deliberation
          </p>
        </div>
        <button
          onClick={runFullAnalysis}
          disabled={runningAnalysis || !deliberationId}
          className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {runningAnalysis ? "Analyzing..." : "Run Full Analysis"}
        </button>
      </div>

      {/* Deliberation Summary */}
      {statsData?.ok && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
          📊 {designsCount} designs across {scopesCount} scopes • {strategiesCount} strategies computed
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Actions" value={actsCount} icon="🔷" />
        <StatCard label="Views" value={viewsCount} icon="👁" />
        <StatCard label="Chronicles" value={chroniclesCount} icon="📜" />
      </div>

      {/* Strategy Status */}
      {strategyData && (
        <div className="strategy-status border rounded-lg p-3 bg-slate-50">
          <div className="text-xs font-semibold text-slate-700 mb-2">Strategy Status</div>
          <div className="flex gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-bold ${
                strategyData.isInnocent
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {strategyData.isInnocent ? "✓ Innocent" : "⚠ Not Innocent"}
            </span>
          </div>
        </div>
      )}

      {/* Inline Strategy Analysis */}
      <div className="strategy-section">
        <StrategyInspector designId={designId} />
      </div>

      {/* Inline Correspondence */}
      <div className="correspondence-section">
        <CorrespondenceViewer
          designId={designId}
          deliberationId={deliberationId}
          strategyId={strategyData?.strategyId}
        />
      </div>
    </div>
  );
}
