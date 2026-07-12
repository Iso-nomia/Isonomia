// components/confidence/DecayExplanationTooltip.tsx
"use client";
import * as React from "react";
import { Info } from "lucide-react";

interface DecayExplanationTooltipProps {
  ageInDays: number;
  decayFactor: number;
  halfLife: number;
  minConfidence: number;
}

/**
 * Tooltip explaining temporal decay formula and parameters.
 * Phase 3.2: User education on temporal reasoning.
 */
export function DecayExplanationTooltip({
  ageInDays,
  decayFactor,
  halfLife,
  minConfidence,
}: DecayExplanationTooltipProps) {
  return (
    <div className="max-w-sm">
      <div className="font-semibold text-sm mb-2">Temporal Decay</div>
      
      <div className="text-xs space-y-2">
        <p>
          Confidence decays over time when arguments lack recent support or updates.
        </p>

        <div className="bg-slate-800 text-white p-2 rounded font-mono text-[10px]">
          decay = 0.5<sup>(age / halfLife)</sup>
          <br />
          decay = 0.5<sup>({ageInDays} / {halfLife})</sup>
          <br />
          decay = {decayFactor.toFixed(3)}
        </div>

        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-slate-600">Age:</dt>
            <dd className="font-medium">{ageInDays} days</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Half-life:</dt>
            <dd className="font-medium">{halfLife} days</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Min floor:</dt>
            <dd className="font-medium">{(minConfidence * 100).toFixed(0)}%</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Current factor:</dt>
            <dd className="font-medium">{(decayFactor * 100).toFixed(1)}%</dd>
          </div>
        </dl>

        <p className="text-slate-600 italic">
          Tip: Update argument premises or add supporting evidence to reset decay.
        </p>
      </div>
    </div>
  );
}
