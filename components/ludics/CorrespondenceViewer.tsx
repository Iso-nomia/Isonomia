"use client";

import * as React from "react";
import useSWR from "swr";
import type {
  Correspondence,
  IsomorphismResults,
  IsomorphismCheck,
} from "@/packages/ludics-core/dds/correspondence";

interface StrategyOption {
  id: string;
  designId: string;
  player: string;
  isInnocent: boolean;
  satisfiesPropagation: boolean;
  playCount: number;
  viewCount: number;
  isPrimary: boolean;
  label: string;
  design?: {
    participantId?: string;
    scope?: string;
  };
}

interface StrategySummary {
  total: number;
  pStrategies: number;
  oStrategies: number;
  innocentCount: number;
  propagatingCount: number;
}

interface CorrespondenceViewerProps {
  designId: string;
  deliberationId?: string;
  strategyId?: string;
  correspondence?: Correspondence;
  onStrategyChange?: (strategyId: string) => void;
  onVerify?: () => void;
  isVerifying?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function CorrespondenceViewer({
  designId,
  deliberationId,
  strategyId,
  correspondence,
  onStrategyChange,
  onVerify,
  isVerifying = false,
}: CorrespondenceViewerProps) {
  const [selectedStrategyId, setSelectedStrategyId] = React.useState(strategyId || "");
  const [localCorrespondence, setLocalCorrespondence] = React.useState<Correspondence | undefined>(correspondence);
  const [verifying, setVerifying] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [includeCounter, setIncludeCounter] = React.useState(false);

  // Fetch available strategies for the deliberation using the generate endpoint for better data
  const { data: strategiesData, mutate: mutateStrategies } = useSWR<{ 
    ok: boolean; 
    strategies: StrategyOption[];
    summary?: StrategySummary;
  }>(
    deliberationId ? `/api/ludics/dds/strategies/generate?deliberationId=${encodeURIComponent(deliberationId)}` : null,
    fetcher
  );

  const strategies = strategiesData?.strategies || [];
  const summary = strategiesData?.summary;
  
  // Group strategies by player
  const pStrategies = strategies.filter(s => s.player === "P");
  const oStrategies = strategies.filter(s => s.player === "O");

  // Update parent when strategy changes
  const handleStrategyChange = (id: string) => {
    setSelectedStrategyId(id);
    setLocalCorrespondence(undefined); // Reset correspondence when strategy changes
    onStrategyChange?.(id);
  };

  // Generate strategies for all designs
  const handleGenerateStrategies = async () => {
    if (!deliberationId) return;
    
    setGenerating(true);
    try {
      const res = await fetch(`/api/ludics/dds/strategies/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          includeCounterStrategies: includeCounter,
          forceRegenerate: false,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await mutateStrategies();
      }
    } catch (err) {
      console.error("Strategy generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  // Verify correspondence
  const handleVerify = async () => {
    if (!selectedStrategyId) return;
    
    if (onVerify) {
      onVerify();
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/ludics/dds/correspondence?strategyId=${encodeURIComponent(selectedStrategyId)}`);
      const data = await res.json();
      if (data.ok) {
        setLocalCorrespondence({
          id: data.id || `corr-${Date.now()}`,
          type: "design-to-strategy",
          designId,
          strategyId: selectedStrategyId,
          isVerified: data.isomorphisms?.allHold ?? false,
          isomorphisms: data.isomorphisms,
        });
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  const effectiveStrategyId = selectedStrategyId || strategyId;
  const isomorphisms = localCorrespondence?.isomorphisms || correspondence?.isomorphisms;
  const isCorrespondenceVerified = localCorrespondence?.isVerified || correspondence?.isVerified;

  return (
    <div className="correspondence-viewer border rounded-lg p-4 bg-white/70 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">
          Design ↔ Strategy Correspondence
        </h3>
        {effectiveStrategyId && (
          <button
            onClick={handleVerify}
            disabled={verifying || isVerifying}
            className="px-3 py-1 text-xs rounded bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {(verifying || isVerifying) ? "Verifying..." : "Verify Isomorphisms"}
          </button>
        )}
      </div>

      {/* Strategy Summary */}
      {summary && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1 flex gap-3 flex-wrap">
          <span className="text-emerald-600">P: {summary.pStrategies}</span>
          <span className="text-rose-600">O: {summary.oStrategies}</span>
          <span>✓ {summary.innocentCount} innocent</span>
          <span>↗ {summary.propagatingCount} propagating</span>
        </div>
      )}

      {/* Strategy Generator */}
      {strategies.length === 0 && deliberationId && (
        <div className="strategy-generator bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
          <div className="text-xs text-amber-800 font-medium">
            No strategies found for this deliberation
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateStrategies}
              disabled={generating}
              className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Strategies"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={includeCounter}
                onChange={(e) => setIncludeCounter(e.target.checked)}
                className="rounded"
              />
              Include counter-strategies
            </label>
          </div>
          <p className="text-[10px] text-amber-700">
            Generates P-Strategies for Proponent designs and O-Strategies for Opponent designs.
            Counter-strategies create the opposite player&apos;s strategy for each design.
          </p>
        </div>
      )}

      {/* Strategy Selector - Grouped by Player */}
      {strategies.length > 0 && (
        <div className="strategy-selector space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600">
              Select Strategy
            </label>
            <button
              onClick={handleGenerateStrategies}
              disabled={generating}
              className="text-[10px] text-slate-500 hover:text-slate-700 underline"
            >
              {generating ? "Regenerating..." : "↻ Regenerate"}
            </button>
          </div>
          <select
            value={selectedStrategyId}
            onChange={(e) => handleStrategyChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select a strategy...</option>
            {pStrategies.length > 0 && (
              <optgroup label={`Proponent Strategies (${pStrategies.length})`}>
                {pStrategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    P • {s.design?.participantId || "design"} • {s.playCount} plays {s.isInnocent ? "✓" : ""} {s.isPrimary ? "(primary)" : "(counter)"}
                  </option>
                ))}
              </optgroup>
            )}
            {oStrategies.length > 0 && (
              <optgroup label={`Opponent Strategies (${oStrategies.length})`}>
                {oStrategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    O • {s.design?.participantId || "design"} • {s.playCount} plays {s.isInnocent ? "✓" : ""} {s.isPrimary ? "(primary)" : "(counter)"}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* Verification Status */}
      {isCorrespondenceVerified ? (
        <div className="verified-badge bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="text-xl">✓</span>
            <div>
              <div className="font-bold">Correspondence Verified</div>
              <div className="text-xs mt-1">
                Design D ≅ Strategy S (Proposition 4.27)
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="unverified-badge bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600">
            {effectiveStrategyId
              ? "Correspondence not yet verified. Click 'Verify Isomorphisms' to check."
              : "Select a strategy to verify correspondence."}
          </div>
        </div>
      )}

      {/* Isomorphism Checklist */}
      {isomorphisms && (
        <div className="isomorphisms-section">
          <div className="text-xs font-semibold text-slate-600 mb-2">
            Isomorphism Checks
          </div>
          <div className="grid grid-cols-2 gap-2">
            <IsomorphismBadge
              name="Plays(Views(S)) = S"
              reference="Prop 4.18"
              check={isomorphisms.playsViews}
            />
            <IsomorphismBadge
              name="Views(Plays(V)) = V"
              reference="Prop 4.18"
              check={isomorphisms.viewsPlays}
            />
            <IsomorphismBadge
              name="Disp(Ch(S)) = S"
              reference="Prop 4.27"
              check={isomorphisms.dispCh}
            />
            <IsomorphismBadge
              name="Ch(Disp(D)) = D"
              reference="Prop 4.27"
              check={isomorphisms.chDisp}
            />
          </div>
        </div>
      )}

      {/* IDs Display */}
      <div className="ids-section border-t pt-3">
        <div className="text-xs text-slate-500 space-y-1">
          <div>
            <span className="font-medium">Design:</span>{" "}
            <code className="bg-slate-100 px-1 rounded">{designId}</code>
          </div>
          {effectiveStrategyId && (
            <div>
              <span className="font-medium">Strategy:</span>{" "}
              <code className="bg-slate-100 px-1 rounded">{effectiveStrategyId}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface IsomorphismBadgeProps {
  name: string;
  reference: string;
  check: IsomorphismCheck;
}

function IsomorphismBadge({ name, reference, check }: IsomorphismBadgeProps) {
  if (!check.checked) {
    return (
      <div className="p-2 rounded border border-slate-200 bg-slate-50">
        <div className="text-[10px] font-mono text-slate-600">{name}</div>
        <div className="text-[9px] text-slate-400">{reference}</div>
        <div className="text-xs text-slate-500 mt-1">Not checked</div>
      </div>
    );
  }

  return (
    <div
      className={`p-2 rounded border ${
        check.holds
          ? "bg-emerald-50 border-emerald-200"
          : "bg-rose-50 border-rose-200"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={check.holds ? "text-emerald-700" : "text-rose-700"}>
          {check.holds ? "✓" : "✗"}
        </span>
        <div className="text-[10px] font-mono text-slate-700">{name}</div>
      </div>
      <div className="text-[9px] text-slate-500 mt-0.5">{reference}</div>
      {check.evidence && !check.holds && (
        <div className="text-[9px] text-rose-600 mt-1">
          {check.evidence.error ||
            `${check.evidence.difference?.inOriginal || 0} missing, ${
              check.evidence.difference?.inReconstructed || 0
            } extra`}
        </div>
      )}
    </div>
  );
}

export default CorrespondenceViewer;
