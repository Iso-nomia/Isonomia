// components/confidence/DSExplanationTooltip.tsx
"use client";
import * as React from "react";

interface DSExplanationTooltipProps {
  belief: number;
  plausibility: number;
  masses?: Record<string, number>; // Optional: mass assignments for each premise
  className?: string;
}

/**
 * DSExplanationTooltip
 * 
 * Tooltip explaining Dempster-Shafer theory and belief/plausibility computation.
 * Shows interval values, uncertainty calculation, and optional mass assignments.
 * 
 * Phase 3.3.3: DS Explanation Tooltip
 */
export function DSExplanationTooltip({
  belief,
  plausibility,
  masses,
  className = "",
}: DSExplanationTooltipProps) {
  const uncertainty = plausibility - belief;

  return (
    <div className={`max-w-md ${className}`}>
      <div className="font-semibold text-sm mb-2 text-slate-900">
        Dempster-Shafer Mode
      </div>
      
      <div className="text-xs space-y-2 text-slate-700">
        <p>
          DS theory represents confidence as an <strong>interval [Bel, Pl]</strong> rather than a single value.
          This captures uncertainty from conflicting or incomplete evidence.
        </p>

        {/* Interval Values Box */}
        <dl className="space-y-1 bg-slate-800 text-white p-2 rounded">
          <div className="flex justify-between font-mono text-xs">
            <dt>Belief (Bel):</dt>
            <dd className="font-semibold">{(belief * 100).toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between font-mono text-xs">
            <dt>Plausibility (Pl):</dt>
            <dd className="font-semibold">{(plausibility * 100).toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between font-mono text-xs border-t border-slate-600 pt-1 mt-1">
            <dt>Uncertainty:</dt>
            <dd className="font-semibold text-yellow-300">{(uncertainty * 100).toFixed(1)}%</dd>
          </div>
        </dl>

        {/* Definitions */}
        <div className="space-y-1.5 bg-slate-50 p-2 rounded border border-slate-200">
          <div>
            <strong className="text-green-700">Belief (Bel):</strong>
            <span className="text-slate-600"> Minimum confidence based on supporting evidence only.</span>
          </div>
          <div>
            <strong className="text-blue-700">Plausibility (Pl):</strong>
            <span className="text-slate-600"> Maximum confidence assuming uncertain evidence supports the claim.</span>
          </div>
          <div>
            <strong className="text-yellow-700">Uncertainty:</strong>
            <span className="text-slate-600"> Range between Bel and Pl, representing conflicting or missing evidence.</span>
          </div>
        </div>

        {/* Formula */}
        <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
          <div className="font-medium text-indigo-900 mb-1">Key Formulas:</div>
          <div className="font-mono text-[10px] space-y-0.5 text-indigo-800">
            <div>Bel(A) = Σ m(B) for all B ⊆ A</div>
            <div>Pl(A) = 1 - Bel(¬A)</div>
            <div>Uncertainty = Pl(A) - Bel(A)</div>
          </div>
        </div>

        {/* Optional: Mass Assignments */}
        {masses && Object.keys(masses).length > 0 && (
          <div className="bg-slate-100 p-2 rounded border border-slate-300">
            <p className="font-medium text-slate-900 mb-1">Mass Assignments:</p>
            <ul className="text-[10px] space-y-0.5 font-mono text-slate-700">
              {Object.entries(masses).map(([premise, mass]) => (
                <li key={premise} className="flex justify-between">
                  <span>m({premise.substring(0, 30)}{premise.length > 30 ? "..." : ""})</span>
                  <span className="font-semibold">{mass.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Use Case */}
        <div className="text-[11px] text-slate-500 italic bg-amber-50 p-2 rounded border border-amber-200">
          <strong>Use cases:</strong> DS mode is particularly useful when dealing with expert opinions,
          sensor data, or arguments with varying reliability. It makes epistemic uncertainty explicit.
        </div>

        {/* Additional Info */}
        <details className="text-[11px]">
          <summary className="cursor-pointer hover:text-slate-900 font-medium text-slate-700">
            Why DS theory?
          </summary>
          <div className="mt-1 pl-2 space-y-1 text-slate-600">
            <p>
              Traditional confidence values (single numbers) assume complete knowledge.
              DS theory acknowledges that we may have <strong>incomplete</strong> or <strong>conflicting</strong> evidence.
            </p>
            <p>
              The interval [Bel, Pl] gives us both a <strong>guaranteed minimum</strong> (belief)
              and a <strong>possible maximum</strong> (plausibility), with uncertainty in between.
            </p>
            <p>
              <strong>Example:</strong> If Bel=0.6 and Pl=0.9, we know the true confidence is somewhere
              between 60% and 90%, with 30% uncertainty due to conflicting or missing evidence.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
