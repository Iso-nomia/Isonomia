/**
 * Phase 5: Saturation Analysis Panel
 * UI for saturation checking and closure computation
 */

"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

interface SaturationPanelProps {
  strategyId?: string;
  designId: string;
  deliberationId?: string;
}

type StrategyOption = {
  id: string;
  designId: string;
  player: "P" | "O";
  isInnocent: boolean;
  satisfiesPropagation: boolean;
  playCount: number;
  label: string;
  design?: {
    participantId?: string;
    scope?: string;
  };
};

type SaturationResult = {
  strategyId: string;
  isSaturated: boolean;
  viewsEqualStrategy?: boolean;
  playCount?: number;
  details?: {
    viewCount?: number;
    originalPlayCount?: number;
    reconstructedPlayCount?: number;
    missingCount?: number;
    extraCount?: number;
    interpretation?: string;
  };
  proof?: any;
  violations?: Array<{
    type: string;
    designIds?: string[];
    itemIds?: string[];
    description?: string;
  }>;
};

export function SaturationPanel({ strategyId: initialStrategyId, designId, deliberationId }: SaturationPanelProps) {
  const [selectedStrategyId, setSelectedStrategyId] = React.useState<string | undefined>(initialStrategyId);
  const [checkInProgress, setCheckInProgress] = React.useState(false);
  const [saturationResult, setSaturationResult] = React.useState<SaturationResult | null>(null);
  const [computeClosureMode, setComputeClosureMode] = React.useState(false);
  const [mode, setMode] = React.useState<"check" | "closure" | "deficiency">("check");

  // Fetch available strategies for this deliberation
  const { data: strategiesData } = useSWR<{ ok: boolean; strategies: StrategyOption[] }>(
    deliberationId ? `/api/ludics/dds/strategies/generate?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const strategies = strategiesData?.strategies || [];

  // Update selected strategy when prop changes
  React.useEffect(() => {
    if (initialStrategyId) {
      setSelectedStrategyId(initialStrategyId);
    }
  }, [initialStrategyId]);

  // Fetch existing saturation check if strategyId provided
  const { data: existingData, mutate: refetch } = useSWR(
    selectedStrategyId ? `/api/ludics/dds/analysis/saturation?strategyId=${selectedStrategyId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    if (existingData?.isSaturated !== undefined) {
      setSaturationResult(existingData);
    }
  }, [existingData]);

  const checkSaturation = async () => {
    if (!selectedStrategyId) return;
    
    setCheckInProgress(true);
    try {
      const response = await fetch("/api/ludics/dds/analysis/saturation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: selectedStrategyId,
          mode: mode,
        }),
      });
      const result = await response.json();
      
      if (result.ok) {
        setSaturationResult(result);
        refetch();
      }
    } catch (error) {
      console.error("Saturation check failed:", error);
    } finally {
      setCheckInProgress(false);
    }
  };

  const selectedStrategy = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="saturation-panel border rounded-lg bg-white/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Saturation Analysis</h4>
          <div className="text-[10px] text-slate-500">Proposition 4.17: Plays(Views(S)) = S</div>
        </div>
        {selectedStrategyId && (
          <button
            onClick={checkSaturation}
            disabled={checkInProgress}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-800 text-white rounded transition disabled:opacity-50"
          >
            {checkInProgress ? "Analyzing..." : "Run Analysis"}
          </button>
        )}
      </div>

      {/* Strategy Selector */}
      {strategies.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <label className="text-xs font-medium text-slate-700">Select Strategy</label>
          <select
            value={selectedStrategyId || ""}
            onChange={(e) => {
              setSelectedStrategyId(e.target.value || undefined);
              setSaturationResult(null);
            }}
            className="w-full text-xs px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">— Select a strategy —</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.player}-Strategy • {s.design?.participantId || "design"} • {s.playCount} plays
                {s.isInnocent ? " ✓ innocent" : ""}
              </option>
            ))}
          </select>
          {selectedStrategy && (
            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
              <span className={`px-1.5 py-0.5 rounded ${selectedStrategy.player === "P" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                {selectedStrategy.player}
              </span>
              <span>{selectedStrategy.playCount} plays</span>
              {selectedStrategy.isInnocent && <span className="text-emerald-600">✓ Innocent</span>}
              {selectedStrategy.satisfiesPropagation && <span className="text-purple-600">✓ Propagates</span>}
            </div>
          )}
        </div>
      )}

      {/* Mode Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-700">Mode:</label>
        <div className="flex gap-1">
          {[
            { value: "check", label: "Check" },
            { value: "closure", label: "Closure" },
            { value: "deficiency", label: "Deficiency" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value as typeof mode)}
              className={`px-2 py-1 text-xs rounded transition ${
                mode === m.value
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded p-3">
        <strong>What is saturation?</strong>
        <p className="mt-1">
          A strategy S is <em>saturated</em> if extracting views and reconstructing via Plays(−) gives back the same strategy:
        </p>
        <div className="font-mono text-center my-2 text-blue-700">
          Plays(Views(S)) = S
        </div>
        <p className="mt-1">
          {mode === "check" && "Check mode verifies whether the strategy satisfies this fixpoint property."}
          {mode === "closure" && "Closure mode computes the smallest saturated extension of the strategy."}
          {mode === "deficiency" && "Deficiency mode shows which plays are missing to achieve saturation."}
        </p>
      </div>

      {/* No Strategy Warning */}
      {!selectedStrategyId && strategies.length === 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <strong>No strategies found.</strong> Run strategy analysis first to generate strategies from designs.
        </div>
      )}

      {!selectedStrategyId && strategies.length > 0 && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
          Select a strategy above to run saturation analysis.
        </div>
      )}

      {/* Result */}
      {saturationResult && (
        <div
          className={`rounded-lg p-4 ${
            saturationResult.isSaturated
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">
              {saturationResult.isSaturated ? "✓" : "⚠"}
            </span>
            <div>
              <div
                className={`font-bold ${
                  saturationResult.isSaturated ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {saturationResult.isSaturated ? "Saturated Strategy" : "Not Saturated"}
              </div>
              <div className="text-xs text-slate-600">
                {saturationResult.isSaturated
                  ? "Plays(Views(S)) = S holds"
                  : "Plays(Views(S)) ≠ S"}
              </div>
            </div>
          </div>

          {/* Details */}
          {saturationResult.details && (
            <div className="mt-3 border-t pt-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Analysis Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/50 rounded p-2">
                  <div className="text-slate-500">Views Extracted</div>
                  <div className="font-medium">{saturationResult.details.viewCount ?? 0}</div>
                </div>
                <div className="bg-white/50 rounded p-2">
                  <div className="text-slate-500">Original Plays</div>
                  <div className="font-medium">{saturationResult.details.originalPlayCount ?? saturationResult.playCount ?? 0}</div>
                </div>
                <div className="bg-white/50 rounded p-2">
                  <div className="text-slate-500">Reconstructed Plays</div>
                  <div className="font-medium">{saturationResult.details.reconstructedPlayCount ?? 0}</div>
                </div>
                <div className="bg-white/50 rounded p-2">
                  <div className="text-slate-500">Missing / Extra</div>
                  <div className="font-medium">
                    {saturationResult.details.missingCount ?? 0} / {saturationResult.details.extraCount ?? 0}
                  </div>
                </div>
              </div>
              {saturationResult.details.interpretation && (
                <div className="text-xs text-slate-600 italic mt-2">
                  {saturationResult.details.interpretation}
                </div>
              )}
            </div>
          )}

          {/* Violations */}
          {saturationResult.violations && saturationResult.violations.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <div className="text-xs font-semibold text-amber-800 mb-2">Violations:</div>
              <div className="space-y-2">
                {saturationResult.violations.map((v, idx) => (
                  <div key={idx} className="text-xs bg-white/50 rounded p-2">
                    <div className="font-medium text-amber-700">
                      {v.type === "missing"
                        ? "Missing in Plays(Views(S))"
                        : v.type === "extra"
                          ? "Extra plays needed"
                          : v.type}
                    </div>
                    {v.description && (
                      <div className="text-slate-600 mt-1">{v.description}</div>
                    )}
                    {v.itemIds && v.itemIds.length > 0 && (
                      <div className="text-slate-500 mt-1 font-mono text-[10px] max-h-20 overflow-auto">
                        {v.itemIds.slice(0, 5).map((id, i) => (
                          <div key={i}>{id}</div>
                        ))}
                        {v.itemIds.length > 5 && <div>...and {v.itemIds.length - 5} more</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof (if saturated) */}
          {saturationResult.isSaturated && saturationResult.proof && (
            <div className="mt-3 border-t pt-3">
              <div className="text-xs font-semibold text-emerald-800 mb-2">Proof Structure:</div>
              <div className="text-xs text-slate-600 bg-white/50 rounded p-2 font-mono">
                Views: {saturationResult.proof.viewCount ?? saturationResult.proof.views?.length ?? 0}
                <br />
                Plays: {saturationResult.proof.playCount ?? saturationResult.proof.playsDesigns?.length ?? 0}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saturation Visual */}
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">Saturation Process</div>
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2 py-1 bg-white rounded border">Strategy S</div>
          <span className="text-slate-400">→</span>
          <div className="px-2 py-1 bg-white rounded border">Views(S)</div>
          <span className="text-slate-400">→</span>
          <div className="px-2 py-1 bg-white rounded border">Plays(Views(S))</div>
          <span className="text-slate-400">=?</span>
          <div className={`px-2 py-1 rounded border ${
            saturationResult?.isSaturated
              ? "bg-emerald-100 border-emerald-300"
              : "bg-slate-100"
          }`}>
            S
          </div>
        </div>
      </div>
    </div>
  );
}

export default SaturationPanel;
