// components/confidence/ConfidenceDisplay.tsx
"use client";
import * as React from "react";
import { Info } from "lucide-react";

interface ConfidenceDisplayProps {
  value: number; // Single confidence (standard mode)
  dsMode?: boolean;
  belief?: number; // DS lower bound
  plausibility?: number; // DS upper bound
  showLabel?: boolean;
  className?: string;
}

/**
 * ConfidenceDisplay
 * 
 * Displays confidence value in either standard mode (single value)
 * or Dempster-Shafer mode (belief/plausibility interval).
 * 
 * Phase 3.3.1: DS Mode Toggle Integration
 */
export function ConfidenceDisplay({
  value,
  dsMode = false,
  belief,
  plausibility,
  showLabel = true,
  className = "",
}: ConfidenceDisplayProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  if (dsMode && belief !== undefined && plausibility !== undefined) {
    // DS Mode: Show interval [bel, pl]
    const uncertainty = plausibility - belief;
    const uncertaintyLevel = uncertainty < 0.2 ? "low" : uncertainty < 0.5 ? "medium" : "high";

    return (
      <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
        <div className="flex items-center gap-1 text-xs">
          {showLabel && <span className="text-slate-600">DS:</span>}
          <span className="text-slate-600">[</span>
          <span className="font-semibold text-green-600" title="Belief (lower bound)">
            {(belief * 100).toFixed(1)}%
          </span>
          <span className="text-slate-400">–</span>
          <span className="font-semibold text-blue-600" title="Plausibility (upper bound)">
            {(plausibility * 100).toFixed(1)}%
          </span>
          <span className="text-slate-600">]</span>
        </div>

        {/* Info icon with tooltip */}
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="text-slate-400 hover:text-slate-600"
          aria-label="DS interval explanation"
        >
          <Info className="w-3 h-3" />
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-50 top-full left-0 mt-1 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg">
            <div className="space-y-1">
              <div>
                <strong>Belief (Bel):</strong> Lower bound – mass directly supporting hypothesis
              </div>
              <div>
                <strong>Plausibility (Pl):</strong> Upper bound – mass not contradicting hypothesis
              </div>
              <div>
                <strong>Uncertainty:</strong> {(uncertainty * 100).toFixed(1)}% ({uncertaintyLevel})
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard Mode: Single confidence
  return (
    <div className={`inline-flex items-center gap-1 text-xs ${className}`}>
      {showLabel && <span className="text-slate-600">Conf:</span>}
      <span className="font-semibold text-indigo-600">
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}
