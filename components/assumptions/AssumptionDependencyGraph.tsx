// components/assumptions/AssumptionDependencyGraph.tsx
"use client";
import * as React from "react";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";

interface AssumptionDependencyGraphProps {
  deliberationId: string;
  assumptionId: string;
}

interface DependentArgument {
  id: string;
  title?: string;
  conclusionText?: string;
  confidence?: number;
  createdAt?: string;
}

/**
 * AssumptionDependencyGraph
 * 
 * Visualizes which arguments depend on a specific assumption.
 * Shows impact analysis and warnings for retraction.
 * 
 * Phase 3.4.3: Assumption Dependency Tracker
 */
export function AssumptionDependencyGraph({
  deliberationId,
  assumptionId,
}: AssumptionDependencyGraphProps) {
  const [dependentArguments, setDependentArguments] = React.useState<DependentArgument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchDependencies = async () => {
      try {
        setLoading(true);
        setError(null);

        // Query arguments that reference this assumption
        const res = await fetch(
          `/api/arguments?deliberationId=${deliberationId}&assumptionId=${assumptionId}`
        );
        
        if (!res.ok) {
          throw new Error("Failed to fetch dependent arguments");
        }

        const data = await res.json();
        setDependentArguments(data.arguments || []);
      } catch (err: any) {
        console.error("Failed to fetch dependencies:", err);
        setError(err.message || "Failed to load dependencies");
      } finally {
        setLoading(false);
      }
    };

    fetchDependencies();
  }, [deliberationId, assumptionId]);

  // Calculate average confidence of dependent arguments (must be before early returns)
  const avgConfidence = React.useMemo(() => {
    const confidences = dependentArguments
      .map((a) => a.confidence)
      .filter((c): c is number => c !== undefined);
    
    if (confidences.length === 0) return null;
    
    const sum = confidences.reduce((acc, c) => acc + c, 0);
    return sum / confidences.length;
  }, [dependentArguments]);

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded border border-slate-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading dependencies...</span>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
        Failed to load dependencies: {error}
      </div>
    );
  }

  // Empty State
  if (dependentArguments.length === 0) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
        <div className="text-xs text-slate-500 italic">
          No arguments depend on this assumption yet.
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          Arguments that use this assumption will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Impact Stats */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
        <div>
          <div className="text-xs font-semibold text-blue-700">
            Dependent Arguments ({dependentArguments.length})
          </div>
          <p className="text-[10px] text-blue-600 mt-0.5">
            These arguments rely on this assumption
          </p>
        </div>
        {avgConfidence !== null && (
          <div className="text-right">
            <div className="text-[10px] text-blue-600">Avg Confidence</div>
            <div className="text-sm font-semibold text-blue-700">
              {(avgConfidence * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Argument List */}
      <div className="space-y-2">
        {dependentArguments.map((arg) => (
          <div
            key={arg.id}
            className="flex items-start gap-2 p-2 bg-white border border-slate-200 rounded hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">
                {arg.title || arg.conclusionText || "Untitled Argument"}
              </div>
              {arg.confidence !== undefined && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Confidence: {(arg.confidence * 100).toFixed(0)}%
                </div>
              )}
            </div>
            {arg.confidence !== undefined && (
              <div
                className="w-12 h-2 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 mt-1"
                title={`Confidence: ${(arg.confidence * 100).toFixed(0)}%`}
              >
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${(arg.confidence * 100).toFixed(0)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Warning Box */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-medium text-amber-900">
            Impact Warning
          </div>
          <p className="text-[10px] text-amber-700 mt-1">
            Retracting or challenging this assumption will affect all {dependentArguments.length} dependent {dependentArguments.length === 1 ? "argument" : "arguments"}.
            Their confidence scores may need to be recalculated.
          </p>
        </div>
      </div>
    </div>
  );
}
