// components/confidence/ConfidenceBreakdown.tsx
"use client";
import * as React from "react";
import { Info } from "lucide-react";
import { DecayExplanationTooltip } from "./DecayExplanationTooltip";

export interface ExplainData {
  schemeBase?: number;
  premiseProduct?: number;
  premiseMin?: number;
  cqPenalty?: number;
  unsatisfiedCQs?: number;
  undercutDefeat?: number;
  rebutCounter?: number;
  temporalDecay?: {
    enabled: boolean;
    ageInDays: number;
    decayFactor: number;
    halfLife: number;
    minConfidence: number;
  };
  final: number;
}

interface ConfidenceBreakdownProps {
  explain: ExplainData;
  mode?: "min" | "product" | "ds" | "logodds";
}

export function ConfidenceBreakdown({ explain, mode = "product" }: ConfidenceBreakdownProps) {
  const premiseValue = mode === "min" ? explain.premiseMin : explain.premiseProduct;
  const hasPremises = premiseValue !== undefined && premiseValue !== null;
  const hasCQPenalty = explain.cqPenalty !== undefined && explain.cqPenalty < 1;
  const hasUndercuts = explain.undercutDefeat !== undefined && explain.undercutDefeat > 0;
  const hasRebuts = explain.rebutCounter !== undefined && explain.rebutCounter > 0;
  const hasDecay = explain.temporalDecay?.enabled && explain.temporalDecay.decayFactor < 1;
  
  const [showDecayTooltip, setShowDecayTooltip] = React.useState(false);

  return (
    <div className="space-y-2 text-xs w-56">
      <div className="font-semibold text-sm mb-3 text-slate-900">
        Confidence Breakdown
      </div>

      {/* Scheme Base */}
      {explain.schemeBase !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Scheme Base:</span>
          <span className="font-medium text-slate-900">
            {(explain.schemeBase * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Premises */}
      {hasPremises && (
        <div className="flex items-center justify-between">
          <span className="text-slate-600">
            Premises ({mode === "min" ? "weakest" : "product"}):
          </span>
          <span className="font-medium text-slate-900">
            {(premiseValue! * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* CQ Penalty */}
      {hasCQPenalty && (
        <div className="flex items-center justify-between">
          <span className="text-slate-600">
            CQ Penalty {explain.unsatisfiedCQs ? `(${explain.unsatisfiedCQs})` : ""}:
          </span>
          <span className="font-medium text-amber-700">
            {(explain.cqPenalty! * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Undercut Defeat */}
      {hasUndercuts && (
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Undercut Defeat:</span>
          <span className="font-medium text-red-700">
            {(explain.undercutDefeat! * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Rebut Counter */}
      {hasRebuts && (
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Rebut Counter:</span>
          <span className="font-medium text-red-700">
            {(explain.rebutCounter! * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Temporal Decay (Phase 3.2) */}
      {hasDecay && explain.temporalDecay && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 text-xs">Temporal Decay:</span>
              <button
                onClick={() => setShowDecayTooltip(!showDecayTooltip)}
                className="text-yellow-600 hover:text-yellow-700"
                title="Show decay formula"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
            <span className="font-medium text-yellow-700">
              {(explain.temporalDecay.decayFactor * 100).toFixed(0)}%
            </span>
          </div>
          
          <div className="text-[10px] text-slate-600">
            {explain.temporalDecay.ageInDays} days old
          </div>
          
          {showDecayTooltip && (
            <div className="mt-2 p-2 bg-white rounded shadow-sm">
              <DecayExplanationTooltip
                ageInDays={explain.temporalDecay.ageInDays}
                decayFactor={explain.temporalDecay.decayFactor}
                halfLife={explain.temporalDecay.halfLife}
                minConfidence={explain.temporalDecay.minConfidence}
              />
            </div>
          )}
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-slate-200 my-2" />

      {/* Final Score */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">Final Score:</span>
        <span className="font-bold text-lg text-emerald-600">
          {(explain.final * 100).toFixed(0)}%
        </span>
      </div>

      {/* Formula Hint */}
      <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
        <span className="italic">
          {explain.schemeBase !== undefined ? "base" : "1"} 
          {hasPremises ? ` × premises` : ""}
          {hasCQPenalty ? ` × CQ` : ""}
          {hasDecay ? ` × decay` : ""}
          {hasUndercuts ? ` × (1 - undercut)` : ""}
          {hasRebuts ? ` × (1 - rebut)` : ""}
        </span>
      </div>
    </div>
  );
}
