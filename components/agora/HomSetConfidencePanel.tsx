// components/agora/HomSetConfidencePanel.tsx
"use client";
import * as React from "react";
import { ArrowRight, TrendingUp, TrendingDown, AlertCircle, GitBranch } from "lucide-react";
import type { HomSetConfidenceResult } from "@/lib/agora/homSetConfidence";

interface HomSetConfidencePanelProps {
  argumentId: string;
  direction?: "outgoing" | "incoming" | "both";
  edgeTypeFilter?: string;
  autoLoad?: boolean;
  showCompositionalPaths?: boolean;
  className?: string;
}

interface MorphismData {
  id: string;
  fromArgumentId: string;
  toArgumentId: string;
  type: string;
  confidence: number;
  fromText?: string;
  toText?: string;
  createdAt?: string;
}

interface HomSetData {
  argumentId: string;
  direction: string;
  morphismCount: number;
  morphisms: MorphismData[];
  aggregate?: HomSetConfidenceResult;
}

/**
 * HomSetConfidencePanel
 * 
 * Displays hom-set analysis for an argument in categorical framework:
 * - Individual morphism (edge) confidences
 * - Aggregate hom-set confidence metrics
 * - Uncertainty visualization
 * - Optional compositional path breakdown
 * 
 * Phase 2.6: Hom-Set Confidence
 */
export function HomSetConfidencePanel({
  argumentId,
  direction = "both",
  edgeTypeFilter,
  autoLoad = true,
  showCompositionalPaths = false,
  className = "",
}: HomSetConfidencePanelProps) {
  const [data, setData] = React.useState<HomSetData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  // Fetch hom-set data
  const fetchHomSet = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        direction,
        computeAggregate: "true",
      });

      if (edgeTypeFilter) {
        params.set("edgeType", edgeTypeFilter);
      }

      if (showCompositionalPaths) {
        params.set("includeCompositionalPaths", "true");
      }

      const res = await fetch(
        `/api/arguments/${argumentId}/hom-set?${params.toString()}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch hom-set");
      }

      const homSetData = await res.json();
      setData(homSetData);
    } catch (err: any) {
      setError(err.message || "Failed to load hom-set data");
    } finally {
      setLoading(false);
    }
  }, [argumentId, direction, edgeTypeFilter, showCompositionalPaths]);

  // Auto-load on mount
  React.useEffect(() => {
    if (autoLoad) {
      fetchHomSet();
    }
  }, [autoLoad, fetchHomSet]);

  // Toggle morphism detail expansion
  const toggleExpanded = (morphismId: string) => {
    setExpanded((prev) => ({ ...prev, [morphismId]: !prev[morphismId] }));
  };

  if (loading && !data) {
    return (
      <div className={`border border-slate-200 rounded-lg p-6 bg-white ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-slate-600">Loading hom-set data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border border-red-200 rounded-lg p-6 bg-red-50 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-900">Error Loading Hom-Set</div>
            <div className="text-sm text-red-700 mt-1">{error}</div>
            <button
              onClick={fetchHomSet}
              className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.morphismCount === 0) {
    return (
      <div className={`border border-slate-200 rounded-lg p-6 bg-slate-50 ${className}`}>
        <div className="text-center text-slate-600">
          <GitBranch className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="font-medium">No Morphisms Found</div>
          <div className="text-sm mt-1">
            This argument has no {direction} edges
            {edgeTypeFilter && ` of type "${edgeTypeFilter}"`}.
          </div>
        </div>
      </div>
    );
  }

  const { aggregate } = data;

  return (
    <div className={`border border-slate-200 rounded-lg bg-white ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-200 p-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Hom-Set Analysis</h3>
          </div>
          <div className="text-sm text-slate-600">
            {data.morphismCount} morphism{data.morphismCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Direction Badge */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700">Direction:</span>
          <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
            {direction === "outgoing" && "Hom(A, *)"}
            {direction === "incoming" && "Hom(*, A)"}
            {direction === "both" && "Hom(A, *) ∪ Hom(*, A)"}
          </span>
        </div>
      </div>

      {/* Aggregate Confidence Section */}
      {aggregate && (
        <div className="p-4 space-y-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="font-medium text-slate-900">Aggregate Confidence</div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Aggregate Confidence */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 mb-1">Weighted Avg</div>
              <div className="text-2xl font-bold text-indigo-600">
                {(aggregate.aggregateConfidence * 100).toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-1">
                {aggregate.aggregateConfidence >= 0.7 ? (
                  <TrendingUp className="w-3 h-3 text-green-600" />
                ) : aggregate.aggregateConfidence >= 0.4 ? (
                  <span className="w-3 h-3 text-slate-600">—</span>
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className="text-xs text-slate-600">
                  {aggregate.aggregateConfidence >= 0.7
                    ? "High"
                    : aggregate.aggregateConfidence >= 0.4
                    ? "Medium"
                    : "Low"}
                </span>
              </div>
            </div>

            {/* Uncertainty */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 mb-1">Uncertainty</div>
              <div className="text-2xl font-bold text-purple-600">
                {(aggregate.uncertainty * 100).toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 text-purple-600" />
                <span className="text-xs text-slate-600">
                  {aggregate.uncertainty < 0.2
                    ? "Low"
                    : aggregate.uncertainty < 0.5
                    ? "Medium"
                    : "High"}
                </span>
              </div>
            </div>

            {/* Min Confidence */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 mb-1">Min Confidence</div>
              <div className="text-2xl font-bold text-slate-700">
                {(aggregate.minConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Lower bound</div>
            </div>

            {/* Max Confidence */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 mb-1">Max Confidence</div>
              <div className="text-2xl font-bold text-slate-700">
                {(aggregate.maxConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Upper bound</div>
            </div>
          </div>

          {/* Confidence Range Visualization */}
          <div>
            <div className="text-xs text-slate-600 mb-2">Confidence Range</div>
            <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
              {/* Min to Max Range Bar */}
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-red-200 via-yellow-200 to-green-200"
                style={{
                  left: `${aggregate.minConfidence * 100}%`,
                  width: `${(aggregate.maxConfidence - aggregate.minConfidence) * 100}%`,
                }}
              />
              {/* Aggregate Marker */}
              <div
                className="absolute top-0 h-full w-1 bg-indigo-600"
                style={{ left: `${aggregate.aggregateConfidence * 100}%` }}
              />
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-slate-600">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gradient-to-r from-red-200 to-green-200 rounded" />
                <span>Min-Max Range</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-3 bg-indigo-600" />
                <span>Aggregate</span>
              </div>
            </div>
          </div>

          {/* Edge Type Distribution */}
          {Object.keys(aggregate.edgeTypeDistribution).length > 0 && (
            <div>
              <div className="text-xs text-slate-600 mb-2">Edge Type Distribution</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(aggregate.edgeTypeDistribution).map(([type, count]) => (
                  <div
                    key={type}
                    className="px-3 py-1 rounded-full bg-white border border-slate-300 text-xs"
                  >
                    <span className="font-medium text-slate-700">{type}:</span>{" "}
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Individual Morphisms List */}
      <div className="p-4">
        <div className="font-medium text-slate-900 mb-3">Individual Morphisms</div>
        <div className="space-y-2">
          {data.morphisms.map((morphism) => (
            <div
              key={morphism.id}
              className="border border-slate-200 rounded-lg p-3 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Morphism Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Edge Type Badge */}
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        morphism.type === "support"
                          ? "bg-green-100 text-green-700"
                          : morphism.type === "rebut"
                          ? "bg-red-100 text-red-700"
                          : morphism.type === "undercut"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {morphism.type}
                    </span>

                    {/* Confidence Badge */}
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                      {(morphism.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>

                  {/* Argument Texts (Truncated) */}
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">From:</span>
                      <span className="truncate">{morphism.fromText || morphism.fromArgumentId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">To:</span>
                      <span className="truncate">{morphism.toText || morphism.toArgumentId}</span>
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleExpanded(morphism.id)}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {expanded[morphism.id] ? "Show Less" : "Show Details"}
                  </button>

                  {/* Expanded Details */}
                  {expanded[morphism.id] && (
                    <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-2">
                      <div>
                        <span className="font-medium text-slate-700">Morphism ID:</span>{" "}
                        <span className="text-slate-600 font-mono">{morphism.id}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">From Argument:</span>{" "}
                        <span className="text-slate-600 font-mono">{morphism.fromArgumentId}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">To Argument:</span>{" "}
                        <span className="text-slate-600 font-mono">{morphism.toArgumentId}</span>
                      </div>
                      {morphism.createdAt && (
                        <div>
                          <span className="font-medium text-slate-700">Created:</span>{" "}
                          <span className="text-slate-600">
                            {new Date(morphism.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Confidence Bar */}
                <div className="flex-shrink-0 w-16">
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        morphism.confidence >= 0.7
                          ? "bg-green-500"
                          : morphism.confidence >= 0.4
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${morphism.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compositional Paths Section (if included) */}
      {aggregate?.compositionalPaths && aggregate.compositionalPaths.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="font-medium text-slate-900 mb-3">Compositional Paths</div>
          <div className="text-xs text-slate-600 mb-3">
            Sequences of morphisms (A → B → C) with composed confidence scores.
          </div>
          <div className="space-y-2">
            {aggregate.compositionalPaths.map((path, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">
                    Path {idx + 1} ({path.length} edges)
                  </span>
                  <span className="text-xs font-semibold text-indigo-600">
                    {(path.totalConfidence * 100).toFixed(1)}% confident
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  {path.morphisms.map((m, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ArrowRight className="w-3 h-3" />}
                      <span className="px-2 py-1 bg-slate-100 rounded">
                        {m.type}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Uncertainty: {(path.uncertainty * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={fetchHomSet}
          disabled={loading}
          className="w-full px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh Analysis"}
        </button>
      </div>
    </div>
  );
}
