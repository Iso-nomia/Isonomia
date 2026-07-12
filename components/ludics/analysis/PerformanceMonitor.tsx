/**
 * Phase 5: Performance Monitor Panel
 * UI for tracking computation metrics and optimization
 */

"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

interface PerformanceMonitorProps {
  designId: string;
  sessionId?: string;
}

interface PerformanceEntry {
  operation: string;
  durationMs: number;
  timestamp: string;
  inputSize?: number;
  cacheHit?: boolean;
}

interface PerformanceSummary {
  totalOperations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  cacheHitRate: number;
  byOperation: Record<
    string,
    { count: number; totalMs: number; avgMs: number }
  >;
}

export function PerformanceMonitor({ designId, sessionId }: PerformanceMonitorProps) {
  const [entries, setEntries] = React.useState<PerformanceEntry[]>([]);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  // Compute summary
  const summary = React.useMemo<PerformanceSummary>(() => {
    if (entries.length === 0) {
      return {
        totalOperations: 0,
        totalTimeMs: 0,
        avgTimeMs: 0,
        cacheHitRate: 0,
        byOperation: {},
      };
    }

    const totalTimeMs = entries.reduce((sum, e) => sum + e.durationMs, 0);
    const cacheHits = entries.filter((e) => e.cacheHit).length;

    const byOperation: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
    for (const e of entries) {
      if (!byOperation[e.operation]) {
        byOperation[e.operation] = { count: 0, totalMs: 0, avgMs: 0 };
      }
      byOperation[e.operation].count++;
      byOperation[e.operation].totalMs += e.durationMs;
    }
    for (const op of Object.keys(byOperation)) {
      byOperation[op].avgMs = byOperation[op].totalMs / byOperation[op].count;
    }

    return {
      totalOperations: entries.length,
      totalTimeMs,
      avgTimeMs: totalTimeMs / entries.length,
      cacheHitRate: (cacheHits / entries.length) * 100,
      byOperation,
    };
  }, [entries]);

  // Simulate recording (in real implementation, this would hook into actual API calls)
  const startRecording = () => {
    setIsRecording(true);
    setEntries([]);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  // Add a mock entry for demonstration
  const addMockEntry = () => {
    const ops = ["normalization", "orthogonality", "saturation", "typeInference", "closure"];
    const newEntry: PerformanceEntry = {
      operation: ops[Math.floor(Math.random() * ops.length)],
      durationMs: Math.floor(Math.random() * 500) + 10,
      timestamp: new Date().toISOString(),
      inputSize: Math.floor(Math.random() * 100) + 1,
      cacheHit: Math.random() > 0.7,
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  // Get bar width for visualization
  const getBarWidth = (ms: number) => {
    const maxMs = Math.max(...entries.map((e) => e.durationMs), 100);
    return `${Math.max((ms / maxMs) * 100, 5)}%`;
  };

  const getOperationColor = (op: string) => {
    const colors: Record<string, string> = {
      normalization: "bg-blue-400",
      orthogonality: "bg-purple-400",
      saturation: "bg-emerald-400",
      typeInference: "bg-amber-400",
      closure: "bg-rose-400",
    };
    return colors[op] || "bg-slate-400";
  };

  return (
    <div className="performance-monitor border rounded-lg bg-white/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Performance Monitor</h4>
          <div className="text-[10px] text-slate-500">Track computation metrics</div>
        </div>
        <div className="flex gap-2">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
            >
              ⏺ Record
            </button>
          )}
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={addMockEntry}
              className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-700 text-white rounded transition"
            >
              + Mock
            </button>
          )}
        </div>
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Recording operations...
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-50 rounded p-2 text-center">
          <div className="text-lg font-bold text-slate-800">{summary.totalOperations}</div>
          <div className="text-[10px] text-slate-500">Operations</div>
        </div>
        <div className="bg-slate-50 rounded p-2 text-center">
          <div className="text-lg font-bold text-slate-800">
            {summary.totalTimeMs.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-500">Total ms</div>
        </div>
        <div className="bg-slate-50 rounded p-2 text-center">
          <div className="text-lg font-bold text-slate-800">{summary.avgTimeMs.toFixed(1)}</div>
          <div className="text-[10px] text-slate-500">Avg ms</div>
        </div>
        <div className="bg-slate-50 rounded p-2 text-center">
          <div className="text-lg font-bold text-slate-800">
            {summary.cacheHitRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500">Cache Hit</div>
        </div>
      </div>

      {/* By Operation Breakdown */}
      {Object.keys(summary.byOperation).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">By Operation</div>
          <div className="space-y-1">
            {Object.entries(summary.byOperation).map(([op, stats]) => (
              <div key={op} className="flex items-center gap-2 text-xs">
                <div className="w-24 text-slate-600 truncate">{op}</div>
                <div className="flex-1 bg-slate-100 rounded overflow-hidden h-4">
                  <div
                    className={`h-full ${getOperationColor(op)} transition-all`}
                    style={{ width: `${(stats.avgMs / Math.max(...Object.values(summary.byOperation).map((s) => s.avgMs), 1)) * 100}%` }}
                  />
                </div>
                <div className="w-16 text-right text-slate-500">{stats.avgMs.toFixed(1)} ms</div>
                <div className="w-10 text-right text-slate-400">×{stats.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">Timeline</div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {entries.slice(-20).reverse().map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-slate-50 rounded p-1.5"
              >
                <div className={`w-2 h-2 rounded-full ${getOperationColor(entry.operation)}`} />
                <div className="flex-1">
                  <div className="text-slate-700">{entry.operation}</div>
                  {showDetails && (
                    <div className="text-[10px] text-slate-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                      {entry.inputSize && ` • ${entry.inputSize} items`}
                      {entry.cacheHit && " • cached"}
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-slate-200 rounded overflow-hidden h-2">
                  <div
                    className={`h-full ${getOperationColor(entry.operation)}`}
                    style={{ width: getBarWidth(entry.durationMs) }}
                  />
                </div>
                <div className="w-12 text-right text-slate-600">{entry.durationMs} ms</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && !isRecording && (
        <div className="text-center py-6 text-slate-400 text-xs">
          <div className="text-2xl mb-2">📊</div>
          Click &quot;Record&quot; to start tracking operations
        </div>
      )}

      {/* Optimization Tips */}
      {summary.totalOperations > 10 && summary.cacheHitRate < 50 && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded p-3">
          <strong className="text-amber-800">💡 Optimization Tip:</strong>
          <p className="text-amber-700 mt-1">
            Cache hit rate is low ({summary.cacheHitRate.toFixed(0)}%). Consider enabling
            aggressive caching for repeated operations.
          </p>
        </div>
      )}
    </div>
  );
}

export default PerformanceMonitor;
