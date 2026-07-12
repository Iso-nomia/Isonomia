// components/agora/ConfidenceControls.tsx
"use client";
import { useConfidence } from "./useConfidence";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COMMON_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9];
const SNAP_TOLERANCE = 0.03;

export default function ConfidenceControls({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, tau, setTau } = useConfidence();

  // Snap to common thresholds when close
  const handleSliderChange = (value: number) => {
    for (const threshold of COMMON_THRESHOLDS) {
      if (Math.abs(value - threshold) < SNAP_TOLERANCE) {
        setTau(threshold);
        return;
      }
    }
    setTau(value);
  };

  const handleNumericInput = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setTau(num);
    } else if (value === "") {
      setTau(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <label className="text-[11px] text-neutral-600">Confidence</label>
      
      {/* Mode selector with tooltip */}
      <TooltipProvider>
        <div className="inline-flex items-center gap-1">
          <select
            className="menuv2--lite rounded px-2 py-1 text-[12px]"
            value={mode}
            onChange={e => setMode(e.target.value as any)}
          >
            <option value="min">weakest‑link (min)</option>
            <option value="product">independent (product)</option>
            <option value="logodds">corroboration (log‑odds)</option>
          </select>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3 text-xs">
              <div className="space-y-2">
                <div>
                  <strong className="text-slate-900">Weakest-link (min):</strong>
                  <p className="text-slate-600 mt-0.5">
                    Conservative mode for safety-critical decisions. One weak argument 
                    ruins the entire chain. Use when you need high certainty.
                  </p>
                </div>
                <div>
                  <strong className="text-slate-900">Independent (product):</strong>
                  <p className="text-slate-600 mt-0.5">
                    Default mode. Multiple independent lines of evidence accumulate. 
                    Best for most deliberations where arguments support each other.
                  </p>
                </div>
                <div>
                  <strong className="text-slate-900">Corroboration (log-odds):</strong>
                  <p className="text-slate-600 mt-0.5">
                    Lawful weight-of-evidence mode. Independent supporting arguments
                    add their log-odds, so evidence stacks without an artificial
                    noisy-OR ceiling. The neutral point is 0.5 (no evidence either way).
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {!compact && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="text-[11px] text-neutral-600 cursor-help">τ</label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3 text-xs">
                <div>
                  <strong className="text-slate-900">Acceptance Threshold (τ):</strong>
                  <p className="text-slate-600 mt-1">
                    Filter claims by confidence score. Only claims with confidence ≥ τ 
                    are marked as "accepted". Higher values = stricter filtering.
                  </p>
                  <p className="text-slate-600 mt-1.5 italic">
                    Examples: τ=0.9 (safety-critical), τ=0.7 (consensus), τ=0.5 (exploratory)
                  </p>
                  <p className="text-slate-500 mt-1.5 text-[10px]">
                    Tip: Double-click slider to reset
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <input
            type="range" 
            min={0} 
            max={1} 
            step={0.01}
            value={tau ?? 0}
            onChange={e => handleSliderChange(Number(e.target.value))}
            onDoubleClick={() => setTau(null)}
            className="cursor-pointer"
          />
          
          {/* Numeric input for precision */}
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={tau ?? ""}
            onChange={e => handleNumericInput(e.target.value)}
            placeholder="—"
            className="w-14 text-[11px] text-right tabular-nums px-1.5 py-0.5 rounded border border-slate-200 focus:border-slate-400 focus:outline-none"
          />
        </>
      )}
    </div>
  );
}
