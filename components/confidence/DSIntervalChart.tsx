// components/confidence/DSIntervalChart.tsx
"use client";
import * as React from "react";

interface DSIntervalChartProps {
  belief: number; // Lower bound (0-1)
  plausibility: number; // Upper bound (0-1)
  width?: number;
  height?: number;
  showLegend?: boolean;
  showInterpretation?: boolean;
}

/**
 * DSIntervalChart
 * 
 * Visualizes Dempster-Shafer epistemic interval as a horizontal bar chart.
 * Shows belief (green), uncertainty (yellow), and disbelief (red) regions.
 * 
 * Layout:
 * [====Belief====][~~~Uncertainty~~~][====Disbelief====]
 *  0%            bel                 pl                 100%
 * 
 * Phase 3.3.2: DS Interval Chart Component
 */
export function DSIntervalChart({
  belief,
  plausibility,
  width = 300,
  height = 40,
  showLegend = true,
  showInterpretation = true,
}: DSIntervalChartProps) {
  const beliefPercent = belief * 100;
  const plausibilityPercent = plausibility * 100;
  const uncertaintyPercent = plausibilityPercent - beliefPercent;
  const disbeliefPercent = 100 - plausibilityPercent;

  // Uncertainty level classification
  const uncertaintyLevel = React.useMemo(() => {
    if (uncertaintyPercent < 10) return { label: "Low", icon: "✅", color: "green" };
    if (uncertaintyPercent < 30) return { label: "Moderate", icon: "⚠️", color: "yellow" };
    return { label: "High", icon: "❌", color: "red" };
  }, [uncertaintyPercent]);

  return (
    <div className="space-y-2">
      {/* Bar Chart */}
      <div
        className="flex rounded overflow-hidden border border-slate-300 shadow-sm"
        style={{ width, height }}
      >
        {/* Belief (green) - mass directly supporting hypothesis */}
        {beliefPercent > 0 && (
          <div
            className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold transition-all hover:bg-green-600"
            style={{ width: `${beliefPercent}%` }}
            title={`Belief (Bel): ${beliefPercent.toFixed(1)}% - Mass directly supporting hypothesis`}
          >
            {beliefPercent > 10 && `${beliefPercent.toFixed(0)}%`}
          </div>
        )}

        {/* Uncertainty (yellow) - epistemic gap between belief and plausibility */}
        {uncertaintyPercent > 0 && (
          <div
            className="bg-yellow-400 flex items-center justify-center text-slate-800 text-xs font-semibold transition-all hover:bg-yellow-500"
            style={{ width: `${uncertaintyPercent}%` }}
            title={`Uncertainty: ${uncertaintyPercent.toFixed(1)}% - Epistemic gap (conflicting or missing evidence)`}
          >
            {uncertaintyPercent > 10 && `${uncertaintyPercent.toFixed(0)}%`}
          </div>
        )}

        {/* Disbelief (red) - mass contradicting hypothesis */}
        {disbeliefPercent > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold transition-all hover:bg-red-600"
            style={{ width: `${disbeliefPercent}%` }}
            title={`Disbelief: ${disbeliefPercent.toFixed(1)}% - Mass contradicting hypothesis (1 - Pl)`}
          >
            {disbeliefPercent > 10 && `${disbeliefPercent.toFixed(0)}%`}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-slate-700">
              <strong>Belief:</strong> {beliefPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-400 rounded" />
            <span className="text-slate-700">
              <strong>Uncertainty:</strong> {uncertaintyPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span className="text-slate-700">
              <strong>Disbelief:</strong> {disbeliefPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Interpretation Box */}
      {showInterpretation && (
        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
          <span className="mr-1">{uncertaintyLevel.icon}</span>
          <strong>{uncertaintyLevel.label} uncertainty:</strong>
          {uncertaintyLevel.label === "Low" && " Strong evidence for or against the hypothesis."}
          {uncertaintyLevel.label === "Moderate" && " Some conflicting evidence or gaps in knowledge."}
          {uncertaintyLevel.label === "High" && " Significant conflicting evidence or lack of data."}
        </div>
      )}

      {/* Technical Details (collapsible) */}
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer hover:text-slate-800 font-medium">
          Technical Details
        </summary>
        <div className="mt-2 space-y-1 pl-4 border-l-2 border-slate-300">
          <div>
            <strong>Bel(A):</strong> {belief.toFixed(3)} (lower bound)
          </div>
          <div>
            <strong>Pl(A):</strong> {plausibility.toFixed(3)} (upper bound)
          </div>
          <div>
            <strong>Interval width:</strong> {uncertaintyPercent.toFixed(1)}% (Pl - Bel)
          </div>
          <div>
            <strong>Formula:</strong> Disbelief = 1 - Pl(A) = {disbeliefPercent.toFixed(1)}%
          </div>
        </div>
      </details>
    </div>
  );
}
