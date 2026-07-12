"use client";

import * as React from "react";

export function QuickAnalysisActions({
  designId,
  onAnalysisComplete,
}: {
  designId: string;
  onAnalysisComplete?: () => void;
}) {
  const [running, setRunning] = React.useState(false);

  const runQuickAnalysis = async () => {
    setRunning(true);
    try {
      // Run innocence and propagation checks in parallel
      await Promise.all([
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

      onAnalysisComplete?.();
    } catch (error) {
      console.error("Quick analysis failed:", error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={runQuickAnalysis}
      disabled={running}
      className="quick-analysis-btn px-2 py-1 text-[10px] rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium"
      title="Run quick strategy analysis"
    >
      {running ? "⟳ Analyzing..." : "⚡ Quick Check"}
    </button>
  );
}
