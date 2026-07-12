"use client";

import * as React from "react";

export function BatchAnalysisControls({
  designIds,
  onBatchComplete,
}: {
  designIds: string[];
  onBatchComplete?: () => void;
}) {
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const runBatchAnalysis = async () => {
    setRunning(true);
    setProgress(0);

    try {
      // Process designs in batches of 5
      const batchSize = 5;
      for (let i = 0; i < designIds.length; i += batchSize) {
        const batch = designIds.slice(i, i + batchSize);

        // Run analysis for each design in batch
        await Promise.all(
          batch.map((designId) =>
            Promise.all([
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
            ])
          )
        );

        setProgress(Math.min(i + batchSize, designIds.length));
      }

      onBatchComplete?.();
    } catch (error) {
      console.error("Batch analysis failed:", error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="batch-analysis-controls flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
      <div className="flex-1">
        <div className="text-xs font-semibold text-slate-700 mb-1">
          Batch Analysis
        </div>
        <div className="text-[10px] text-slate-600">
          Analyze {designIds.length} designs
        </div>
      </div>

      {running && (
        <div className="flex-1">
          <div className="text-xs text-slate-600 mb-1">
            Progress: {progress} / {designIds.length}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${(progress / designIds.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={runBatchAnalysis}
        disabled={running || designIds.length === 0}
        className="px-4 py-2 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium"
      >
        {running ? "Analyzing..." : "Analyze All"}
      </button>
    </div>
  );
}
