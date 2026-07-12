/**
 * Phase 5: Behaviour Panel
 * UI for orthogonality testing and biorthogonal closure computation
 */

"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

interface StrategyOption {
  id: string;
  designId: string;
  player: string;
  isInnocent: boolean;
  satisfiesPropagation: boolean;
  label: string;
  design?: {
    participantId?: string;
    scope?: string;
  };
}

interface BehaviourPanelProps {
  strategyId?: string;
  designId: string;
  deliberationId?: string;
  onStrategyChange?: (strategyId: string) => void;
}

type OrthogonalityResult = {
  isOrthogonal: boolean;
  strategyAId: string;
  strategyBId: string;
  reason?: string;
  counterExamples?: Array<{
    designA: string;
    designB: string;
    reason: string;
  }>;
  details?: {
    designA: {
      id: string;
      participantId?: string;
      actCount: number;
      initialPolarity?: string;
      initialLocus?: string;
    };
    designB: {
      id: string;
      participantId?: string;
      actCount: number;
      initialPolarity?: string;
      initialLocus?: string;
    };
  };
  diagnostics?: {
    polarityCompatible: boolean;
    locusCompatible: boolean;
    hint: string;
  };
};

type ClosureResult = {
  strategyId?: string;
  closureIds?: string[];
  closedDesignIds?: string[];
  iterationsNeeded?: number;
  iterations?: number;
  fixpointReached?: boolean;
  isClosed?: boolean;
  converged?: boolean;
  originalCount?: number;
  closedCount?: number;
};

export function BehaviourPanel({ strategyId, designId, deliberationId, onStrategyChange }: BehaviourPanelProps) {
  const [selectedStrategyId, setSelectedStrategyId] = React.useState(strategyId || "");
  const [compareStrategyId, setCompareStrategyId] = React.useState("");
  const [orthResult, setOrthResult] = React.useState<OrthogonalityResult | null>(null);
  const [closureResult, setClosureResult] = React.useState<ClosureResult | null>(null);
  const [loading, setLoading] = React.useState<"orth" | "closure" | null>(null);
  const [activeTab, setActiveTab] = React.useState<"orth" | "closure" | "game">("orth");

  // Fetch available strategies for the deliberation
  const { data: strategiesData } = useSWR<{ ok: boolean; strategies: StrategyOption[] }>(
    deliberationId ? `/api/ludics/strategies?deliberationId=${encodeURIComponent(deliberationId)}` : null,
    fetcher
  );

  const strategies = strategiesData?.strategies || [];
  const effectiveStrategyId = selectedStrategyId || strategyId;

  // Update when strategyId prop changes
  React.useEffect(() => {
    if (strategyId && strategyId !== selectedStrategyId) {
      setSelectedStrategyId(strategyId);
    }
  }, [strategyId]);

  const handleStrategyChange = (id: string) => {
    setSelectedStrategyId(id);
    setOrthResult(null);
    setClosureResult(null);
    onStrategyChange?.(id);
  };

  // Check orthogonality between two strategies
  const checkOrthogonality = async () => {
    if (!effectiveStrategyId || !compareStrategyId) return;

    setLoading("orth");
    try {
      const response = await fetch(`/api/ludics/dds/behaviours/orthogonality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyAId: effectiveStrategyId,
          strategyBId: compareStrategyId,
        }),
      });
      const result = await response.json();
      if (result.ok !== false) {
        setOrthResult(result);
      }
    } catch (error) {
      console.error("Orthogonality check failed:", error);
    } finally {
      setLoading(null);
    }
  };

  // Compute biorthogonal closure
  const computeClosure = async () => {
    if (!effectiveStrategyId) return;

    setLoading("closure");
    try {
      const response = await fetch(`/api/ludics/dds/behaviours/closure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyIds: [effectiveStrategyId],
        }),
      });
      const result = await response.json();
      if (result.ok !== false) {
        setClosureResult(result);
      }
    } catch (error) {
      console.error("Closure computation failed:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="behaviour-panel border rounded-lg bg-white/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Behaviour Analysis</h4>
          <div className="text-[10px] text-slate-500">Orthogonality & Biorthogonal Closure</div>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="strategy-selector">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Select Strategy
        </label>
        <select
          value={selectedStrategyId}
          onChange={(e) => handleStrategyChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="">Select a strategy...</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.player}-Strategy • {s.design?.participantId || "design"} {s.isInnocent ? "✓ innocent" : ""}
            </option>
          ))}
        </select>
        {strategies.length === 0 && deliberationId && (
          <p className="text-xs text-slate-400 mt-1">
            No strategies found. Run the compiler to generate strategies from designs.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["orth", "closure", "game"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs transition -mb-px ${
              activeTab === tab
                ? "border-b-2 border-purple-500 text-purple-700 font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "orth" ? "Orthogonality" : tab === "closure" ? "Closure" : "Game"}
          </button>
        ))}
      </div>

      {/* Orthogonality Tab */}
      {activeTab === "orth" && (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-xs text-slate-600 bg-purple-50 border border-purple-200 rounded p-3">
            <strong>Orthogonality (⊥) — Definition 6.1</strong>
            <p className="mt-1">
              Two strategies S and T of opposite polarities are <em>orthogonal</em> (S ⊥ T) if
              they intersect in exactly one play: <strong>S ∩ T = p</strong>
            </p>
            <div className="font-mono text-center my-2 text-purple-700">
              S ⊥ T &nbsp;⟺&nbsp; |S ∩ T| = 1
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              This means when the strategies interact, they converge to a single deterministic outcome.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <div className="text-xs text-slate-600">Compare with strategy:</div>
            <div className="flex gap-2">
              <select
                value={compareStrategyId}
                onChange={(e) => setCompareStrategyId(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs border rounded bg-white"
              >
                <option value="">Select strategy to compare...</option>
                {strategies
                  .filter(s => s.id !== effectiveStrategyId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.player}-Strategy • {s.design?.participantId || "design"}
                    </option>
                  ))
                }
              </select>
              <button
                onClick={checkOrthogonality}
                disabled={!effectiveStrategyId || !compareStrategyId || loading === "orth"}
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition disabled:opacity-50"
              >
                {loading === "orth" ? "Checking..." : "Check ⊥"}
              </button>
            </div>
            {strategies.filter(s => s.id !== effectiveStrategyId).length === 0 && effectiveStrategyId && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                <strong>No other strategies available.</strong> Orthogonality requires at least two strategies 
                (typically one P-strategy and one O-strategy). Run the compiler on both Proponent and Opponent 
                designs to generate their strategies.
              </p>
            )}
          </div>

          {/* No Strategy Warning */}
          {!effectiveStrategyId && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <strong>No strategy selected.</strong> Select a strategy above or run strategy analysis first.
            </div>
          )}

          {/* Orthogonality Result */}
          {orthResult && (
            <div
              className={`rounded-lg p-4 ${
                orthResult.isOrthogonal
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{orthResult.isOrthogonal ? "⊥" : "⊥̸"}</span>
                <div>
                  <div
                    className={`font-bold ${
                      orthResult.isOrthogonal ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {orthResult.isOrthogonal ? "Orthogonal" : "Not Orthogonal"}
                  </div>
                  <div className="text-xs text-slate-600">{orthResult.reason}</div>
                </div>
              </div>

              {/* Design Details */}
              {orthResult.details && (
                <div className="mt-3 border-t pt-3 grid grid-cols-2 gap-3">
                  <div className="text-xs bg-white/50 rounded p-2">
                    <div className="font-semibold text-slate-700">Design A ({orthResult.details.designA.participantId || "?"})</div>
                    <div className="text-slate-500">
                      Polarity: <span className="font-mono">{orthResult.details.designA.initialPolarity || "?"}</span>
                    </div>
                    <div className="text-slate-500">
                      Locus: <span className="font-mono">{orthResult.details.designA.initialLocus || "?"}</span>
                    </div>
                    <div className="text-slate-500">
                      Acts: {orthResult.details.designA.actCount}
                    </div>
                  </div>
                  <div className="text-xs bg-white/50 rounded p-2">
                    <div className="font-semibold text-slate-700">Design B ({orthResult.details.designB.participantId || "?"})</div>
                    <div className="text-slate-500">
                      Polarity: <span className="font-mono">{orthResult.details.designB.initialPolarity || "?"}</span>
                    </div>
                    <div className="text-slate-500">
                      Locus: <span className="font-mono">{orthResult.details.designB.initialLocus || "?"}</span>
                    </div>
                    <div className="text-slate-500">
                      Acts: {orthResult.details.designB.actCount}
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostics for non-orthogonal results */}
              {orthResult.diagnostics && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs font-semibold text-amber-800 mb-2">Diagnosis:</div>
                  <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span>{orthResult.diagnostics.polarityCompatible ? "✅" : "❌"}</span>
                      <span>Polarity compatibility (requires P ⊥ O)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{orthResult.diagnostics.locusCompatible ? "✅" : "❌"}</span>
                      <span>Locus compatibility (requires same initial locus)</span>
                    </div>
                    {orthResult.diagnostics.hint && (
                      <div className="mt-2 pt-2 border-t border-amber-200 text-amber-700">
                        <strong>💡 Hint:</strong> {orthResult.diagnostics.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Counter-examples */}
              {orthResult.counterExamples && orthResult.counterExamples.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs font-semibold text-red-800 mb-2">Counter-examples:</div>
                  <div className="space-y-2">
                    {orthResult.counterExamples.slice(0, 3).map((ce, idx) => (
                      <div key={idx} className="text-xs bg-white/50 rounded p-2 font-mono">
                        D: {ce.designA.slice(0, 12)}... ⊥̸ E: {ce.designB.slice(0, 12)}...
                        <div className="text-slate-500 mt-1">{ce.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Closure Tab */}
      {activeTab === "closure" && (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-xs text-slate-600 bg-indigo-50 border border-indigo-200 rounded p-3">
            <strong>Biorthogonal Closure (S⊥⊥) — Definition 6.2</strong>
            <p className="mt-1">
              A <em>behaviour</em> G is a set of innocent strategies equal to its biorthogonal: G = G⊥⊥.
              The biorthogonal closure S⊥⊥ is the smallest behaviour containing S.
            </p>
            <div className="font-mono text-center my-2 text-indigo-700">
              S⊥ = {"{"} T | ∀D ∈ S. T ⊥ D {"}"} &nbsp;&nbsp;(orthogonal set)
            </div>
            <div className="font-mono text-center my-2 text-indigo-700">
              S⊥⊥ = (S⊥)⊥ &nbsp;&nbsp;(biorthogonal closure)
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Based on Definition 6.1: Two strategies S ⊥ T are orthogonal if S ∩ T = p (exactly one play in intersection).
            </p>
          </div>

          {/* Action */}
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-600">
              Compute the behaviour generated by current strategy
            </div>
            <button
              onClick={computeClosure}
              disabled={!effectiveStrategyId || loading === "closure"}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition disabled:opacity-50"
            >
              {loading === "closure" ? "Computing..." : "Compute S⊥⊥"}
            </button>
          </div>

          {/* No Strategy Warning */}
          {!effectiveStrategyId && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <strong>No strategy selected.</strong> Select a strategy above first.
            </div>
          )}

          {/* Closure Result */}
          {closureResult && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">
                  {(closureResult.fixpointReached || closureResult.isClosed || closureResult.converged) ? "∞" : "↺"}
                </span>
                <div>
                  <div className="font-bold text-indigo-700">
                    {(closureResult.fixpointReached || closureResult.isClosed || closureResult.converged) 
                      ? "Fixpoint Reached" 
                      : "Closure Computed"}
                  </div>
                  <div className="text-xs text-slate-600">
                    {closureResult.iterationsNeeded || closureResult.iterations || 0} iteration(s)
                  </div>
                </div>
              </div>

              <div className="bg-white/50 rounded p-3">
                <div className="text-xs font-semibold text-indigo-800 mb-2">
                  Closure contains {closureResult.closedCount || (closureResult.closureIds || closureResult.closedDesignIds || []).length} design(s):
                </div>
                {(closureResult.closureIds || closureResult.closedDesignIds) && (closureResult.closureIds || closureResult.closedDesignIds)!.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {(closureResult.closureIds || closureResult.closedDesignIds)!.map((id, idx) => (
                      <div key={id} className="text-xs font-mono text-slate-600">
                        {idx + 1}. {id.slice(0, 16)}...
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Original: {closureResult.originalCount || 1} → Closed: {closureResult.closedCount || 1}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Tab */}
      {activeTab === "game" && (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-xs text-slate-600 bg-teal-50 border border-teal-200 rounded p-3">
            <strong>Games from Behaviours — Definition 6.2</strong>
            <p className="mt-1">
              A <em>game</em> G = (A, A⊥) is defined from two mutually orthogonal behaviours.
              Proponent plays strategies from A, Opponent plays from A⊥.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/test/ludics-arena-game?deliberationId=${deliberationId || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-rose-50 rounded-lg border hover:shadow-sm transition text-sm"
            >
              <span className="text-lg">🎲</span>
              <div>
                <div className="font-medium text-slate-700">Arena & Game Demo</div>
                <div className="text-xs text-slate-500">Interactive visualization</div>
              </div>
            </a>

            <button
              onClick={() => {
                // Navigate to create game with current behaviour
                if (effectiveStrategyId && deliberationId) {
                  window.open(
                    `/test/ludics-arena-game?deliberationId=${deliberationId}&strategyId=${effectiveStrategyId}`,
                    "_blank"
                  );
                }
              }}
              disabled={!effectiveStrategyId}
              className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-lg border hover:shadow-sm transition text-sm disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <span className="text-lg">🎮</span>
              <div>
                <div className="font-medium text-slate-700">Create Game</div>
                <div className="text-xs text-slate-500">From current strategy</div>
              </div>
            </button>
          </div>

          {/* Game Structure Visual */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-700 mb-3">Game Structure</div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-blue-400 bg-blue-50 flex items-center justify-center">
                  <span className="text-blue-700 font-bold">A</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">Proponent (P)</div>
              </div>
              <div className="text-lg text-slate-400">⊥</div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-rose-400 bg-rose-50 flex items-center justify-center">
                  <span className="text-rose-700 font-bold">A⊥</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">Opponent (O)</div>
              </div>
            </div>
          </div>

          {/* Status */}
          {effectiveStrategyId ? (
            <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2 flex items-center gap-2">
              <span>✓</span>
              <span>Strategy selected: <span className="font-mono">{effectiveStrategyId.slice(0, 12)}...</span></span>
            </div>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Select a strategy</strong> above to create a game.
            </div>
          )}

          {/* Theory Note */}
          <div className="text-xs text-slate-500 border-t pt-3 mt-2">
            <strong>Tip:</strong> Use the Closure tab to compute S⊥⊥ and find orthogonal strategies,
            then create a game from the behaviour pair.
          </div>
        </div>
      )}
    </div>
  );
}

export default BehaviourPanel;
