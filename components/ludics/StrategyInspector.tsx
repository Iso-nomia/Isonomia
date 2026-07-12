"use client";

/**
 * DDS Phase 2: Strategy Inspector Component
 * 
 * Displays strategy analysis including:
 * - Innocence check (Definition 4.8)
 * - Propagation check (Definition 4.25)
 * - Design ↔ Strategy correspondence status
 */

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type InnocenceCheckResult = {
  isInnocent: boolean;
  isDeterministic: boolean;
  isViewStable: boolean;
  isSaturated?: boolean;
  violations: Array<{
    type: string;
    details: string;
    evidence?: any;
  }>;
};

type PropagationCheckResult = {
  satisfiesPropagation: boolean;
  satisfiesSliceLinearity?: boolean;
  satisfiesPairPropagation?: boolean;
  violations: Array<{
    views: [any[], any[]];
    commonPrefixLength: number;
    issue: string;
    conflictingAddresses?: [string, string];
  }>;
};

export function StrategyInspector({ designId }: { designId: string }) {
  const [checkInProgress, setCheckInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch cached innocence check
  const {
    data: innocenceData,
    mutate: refetchInnocence,
    isLoading: innocenceLoading,
  } = useSWR(
    `/api/ludics/dds/strategies/innocence?designId=${designId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch cached propagation check
  const {
    data: propagationData,
    mutate: refetchPropagation,
    isLoading: propagationLoading,
  } = useSWR(
    `/api/ludics/dds/strategies/propagation?designId=${designId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const innocenceCheck = innocenceData?.hasResult
    ? (innocenceData as InnocenceCheckResult)
    : null;
  const propagationCheck = propagationData?.hasResult
    ? (propagationData as PropagationCheckResult)
    : null;

  const runChecks = async () => {
    setCheckInProgress(true);
    setError(null);

    try {
      const [innocenceRes, propagationRes] = await Promise.all([
        fetch("/api/ludics/dds/strategies/innocence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId, forceRecheck: true }),
        }),
        fetch("/api/ludics/dds/strategies/propagation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId, forceRecheck: true }),
        }),
      ]);

      const [innocenceJson, propagationJson] = await Promise.all([
        innocenceRes.json(),
        propagationRes.json(),
      ]);

      if (!innocenceJson.ok) {
        setError(innocenceJson.error || "Innocence check failed");
      }
      if (!propagationJson.ok) {
        setError(propagationJson.error || "Propagation check failed");
      }

      await Promise.all([refetchInnocence(), refetchPropagation()]);
    } catch (e: any) {
      setError(e.message || "Failed to run analysis");
    } finally {
      setCheckInProgress(false);
    }
  };

  const isLoading = innocenceLoading || propagationLoading;

  return (
    <div className="strategy-inspector border rounded-lg p-4 bg-white/70 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Strategy Analysis</h3>
        <button
          onClick={runChecks}
          disabled={checkInProgress || isLoading}
          className="px-3 py-1.5 text-xs rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {checkInProgress ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-xs text-slate-500 animate-pulse">
          Loading cached results...
        </div>
      )}

      {/* Innocence Check Section */}
      <InnocenceSection check={innocenceCheck} />

      {/* Propagation Check Section */}
      <PropagationSection check={propagationCheck} />

      {/* Correspondence Section */}
      <CorrespondenceSection
        innocenceCheck={innocenceCheck}
        propagationCheck={propagationCheck}
      />
    </div>
  );
}

function InnocenceSection({
  check,
}: {
  check: InnocenceCheckResult | null;
}) {
  if (!check) {
    return (
      <div className="innocence-section">
        <div className="text-xs font-semibold text-slate-600 mb-2">
          Innocence Check
        </div>
        <div className="text-xs text-slate-500">No results yet</div>
      </div>
    );
  }

  return (
    <div className="innocence-section">
      <div className="text-xs font-semibold text-slate-600 mb-2">
        Innocence Check (Definition 4.8)
      </div>

      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded border ${
          check.isInnocent
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}
      >
        <span className="text-lg">{check.isInnocent ? "✓" : "⚠"}</span>
        <div>
          <div className="font-bold">
            {check.isInnocent ? "Innocent Strategy" : "Not Innocent"}
          </div>
          <div className="text-xs mt-1 space-y-0.5">
            <CheckItem label="Deterministic" value={check.isDeterministic} />
            <CheckItem label="View-Stable" value={check.isViewStable} />
            {check.isSaturated !== undefined && (
              <CheckItem label="Saturated" value={check.isSaturated} />
            )}
          </div>
        </div>
      </div>

      {check.violations.length > 0 && (
        <ViolationList
          violations={check.violations}
          className="mt-2 bg-amber-50 border-amber-200 text-amber-700"
        />
      )}
    </div>
  );
}

function PropagationSection({
  check,
}: {
  check: PropagationCheckResult | null;
}) {
  if (!check) {
    return (
      <div className="propagation-section">
        <div className="text-xs font-semibold text-slate-600 mb-2">
          Propagation Check
        </div>
        <div className="text-xs text-slate-500">No results yet</div>
      </div>
    );
  }

  return (
    <div className="propagation-section">
      <div className="text-xs font-semibold text-slate-600 mb-2">
        Propagation Check (Definition 4.25)
      </div>

      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded border ${
          check.satisfiesPropagation
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}
      >
        <span className="text-lg">
          {check.satisfiesPropagation ? "✓" : "✗"}
        </span>
        <div>
          <div className="font-bold">
            {check.satisfiesPropagation
              ? "Satisfies Propagation"
              : "Propagation Violated"}
          </div>
          {check.satisfiesSliceLinearity !== undefined && (
            <div className="text-xs mt-1 space-y-0.5">
              <CheckItem
                label="Slice Linearity"
                value={check.satisfiesSliceLinearity}
              />
              <CheckItem
                label="Pair Propagation"
                value={check.satisfiesPairPropagation ?? true}
              />
            </div>
          )}
        </div>
      </div>

      {check.violations.length > 0 && (
        <ViolationList
          violations={check.violations.map((v) => ({
            type: "propagation",
            details: v.issue,
            evidence: v.conflictingAddresses
              ? { addresses: v.conflictingAddresses }
              : undefined,
          }))}
          className="mt-2 bg-rose-50 border-rose-200 text-rose-700"
          maxItems={3}
        />
      )}
    </div>
  );
}

function CorrespondenceSection({
  innocenceCheck,
  propagationCheck,
}: {
  innocenceCheck: InnocenceCheckResult | null;
  propagationCheck: PropagationCheckResult | null;
}) {
  if (!innocenceCheck || !propagationCheck) {
    return null;
  }

  const satisfiesCorrespondence =
    innocenceCheck.isInnocent && propagationCheck.satisfiesPropagation;

  return (
    <div className="correspondence-section border-t pt-3">
      <div className="text-xs font-semibold text-slate-600 mb-2">
        Design ↔ Strategy Correspondence
      </div>

      {satisfiesCorrespondence ? (
        <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded border border-emerald-200">
          <div className="font-bold mb-1">✓ Full Correspondence</div>
          <p>
            This design corresponds to an{" "}
            <strong>innocent strategy with propagation</strong>. The full
            Design ↔ Strategy isomorphism holds (Proposition 4.27).
          </p>
        </div>
      ) : (
        <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
          <div className="font-medium mb-1">⚠ Partial Correspondence</div>
          <p>This design does not satisfy full correspondence conditions:</p>
          <ul className="mt-1 space-y-0.5">
            {!innocenceCheck.isInnocent && (
              <li>• Missing: Innocence (same view → same response)</li>
            )}
            {!propagationCheck.satisfiesPropagation && (
              <li>• Missing: Propagation (consistent addresses)</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={value ? "text-emerald-600" : "text-rose-600"}>
        {value ? "✓" : "✗"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function ViolationList({
  violations,
  className,
  maxItems = 5,
}: {
  violations: Array<{ type: string; details: string; evidence?: any }>;
  className?: string;
  maxItems?: number;
}) {
  const displayed = violations.slice(0, maxItems);
  const remaining = violations.length - maxItems;

  return (
    <div className={`text-xs p-2 rounded border ${className}`}>
      <div className="font-semibold mb-1">Violations:</div>
      {displayed.map((v, i) => (
        <div key={i} className="mb-0.5">
          • <span className="font-medium">{v.type}</span>: {v.details}
        </div>
      ))}
      {remaining > 0 && (
        <div className="italic opacity-75">... and {remaining} more</div>
      )}
    </div>
  );
}

export default StrategyInspector;
