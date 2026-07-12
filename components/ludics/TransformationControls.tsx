"use client";

import * as React from "react";
import type { TransformResult } from "@/packages/ludics-core/dds/correspondence";

interface TransformationControlsProps {
  designId?: string;
  strategyId?: string;
  onTransformDesign?: (result: TransformResult) => void;
  onTransformStrategy?: (result: TransformResult) => void;
  onRoundTrip?: (result: any) => void;
  isTransforming?: boolean;
}

export function TransformationControls({
  designId,
  strategyId,
  onTransformDesign,
  onTransformStrategy,
  onRoundTrip,
  isTransforming = false,
}: TransformationControlsProps) {
  const [operation, setOperation] = React.useState<"transform" | "round-trip">(
    "transform"
  );

  const handleDesignToStrategy = async () => {
    if (!designId || !onTransformDesign) return;

    try {
      const response = await fetch("/api/ludics/dds/correspondence/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "design",
          design: { id: designId }, // Simplified - actual impl would pass full design
          operation,
          counterDesigns: [],
        }),
      });

      const result = await response.json();
      if (result.ok) {
        if (operation === "round-trip" && onRoundTrip) {
          onRoundTrip(result);
        } else {
          onTransformDesign(result.transform);
        }
      }
    } catch (error) {
      console.error("Transform failed:", error);
    }
  };

  const handleStrategyToDesign = async () => {
    if (!strategyId || !onTransformStrategy) return;

    try {
      const response = await fetch("/api/ludics/dds/correspondence/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "strategy",
          strategy: { id: strategyId }, // Simplified - actual impl would pass full strategy
          operation,
          counterDesigns: [],
        }),
      });

      const result = await response.json();
      if (result.ok) {
        if (operation === "round-trip" && onRoundTrip) {
          onRoundTrip(result);
        } else {
          onTransformStrategy(result.transform);
        }
      }
    } catch (error) {
      console.error("Transform failed:", error);
    }
  };

  return (
    <div className="transformation-controls border rounded-lg p-4 bg-white/70 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Transformations</h3>
        <select
          value={operation}
          onChange={(e) =>
            setOperation(e.target.value as "transform" | "round-trip")
          }
          className="text-xs border rounded px-2 py-1 bg-white"
        >
          <option value="transform">Transform</option>
          <option value="round-trip">Round Trip</option>
        </select>
      </div>

      {/* Design → Strategy */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDesignToStrategy}
          disabled={!designId || isTransforming}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span className="text-sm">→</span>
          <span>Design → Strategy</span>
        </button>
        <div className="text-[10px] text-slate-500 w-16">via Disp</div>
      </div>

      {/* Strategy → Design */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStrategyToDesign}
          disabled={!strategyId || isTransforming}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span className="text-sm">←</span>
          <span>Strategy → Design</span>
        </button>
        <div className="text-[10px] text-slate-500 w-16">via Ch</div>
      </div>

      {/* Loading indicator */}
      {isTransforming && (
        <div className="text-xs text-slate-500 text-center">
          Transforming...
        </div>
      )}

      {/* Help text */}
      <div className="text-[10px] text-slate-400 border-t pt-2 mt-2">
        <p>
          <strong>Transform:</strong> Convert between representations
        </p>
        <p>
          <strong>Round Trip:</strong> D → S → D&apos; to check preservation
        </p>
      </div>
    </div>
  );
}

export default TransformationControls;
