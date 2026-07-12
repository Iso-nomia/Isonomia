// components/claims/SuggestedRetractionsPanel.tsx
// Sprint D2 — inline nudge panel on claim detail. When the grounded
// label flips a claim to OUT, this surfaces the ranked culprit-set list
// from `BeliefRevisionProposal`. Clicking "Retract" calls the existing
// `/api/assumptions/[id]/retract` endpoint; on success we re-validate the
// caller's claim view (re-fetched via SWR upstream).
//
// Honest-empty: when there are no open proposals (claim is IN/UNDEC, or
// the user has applied/dismissed all suggestions), the panel renders
// nothing rather than a misleading empty state.

"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";

interface AssumptionRow {
  id: string;
  argumentId: string | null;
  status: string;
  role: string;
  assumptionText: string | null;
  assumptionClaimId: string | null;
}
interface ProposalRow {
  id: string;
  argumentId: string;
  candidatesJson: Array<{
    assumptionIds: string[];
    badConclusionsExplained: number;
    retractionCost: number;
  }>;
  computedAt: string;
}
interface ApiResponse {
  ok: boolean;
  claimId: string;
  proposals: ProposalRow[];
  assumptions: AssumptionRow[];
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function SuggestedRetractionsPanel({ claimId }: { claimId: string }) {
  const { data, error } = useSWR<ApiResponse>(
    claimId ? `/api/claims/${claimId}/belief-revision` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (error || !data?.ok || !data.proposals?.length) return null;

  const assumptionById = new Map(data.assumptions.map((a) => [a.id, a] as const));

  const onRetract = async (assumptionId: string) => {
    setBusyId(assumptionId);
    try {
      const res = await fetch(`/api/assumptions/${assumptionId}/retract`, { method: "POST" });
      if (!res.ok) throw new Error(`retract failed: ${res.status}`);
      // Re-fetch this panel + any consumers of the claim view.
      await mutate(`/api/claims/${claimId}/belief-revision`);
      await mutate((key) => typeof key === "string" && key.includes(`/api/deliberations/`));
    } catch (err) {
      console.error("[SuggestedRetractionsPanel] retract failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"
      aria-label="Suggested retractions"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-amber-900">
          Suggested retractions
          <span className="ml-2 text-[11px] font-normal text-amber-800">
            (this claim is currently OUT)
          </span>
        </h3>
        <span className="text-[11px] text-amber-800">
          {data.proposals.length} argument{data.proposals.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="space-y-2">
        {data.proposals.map((p) => {
          // Show the cheapest candidate first; the schema currently emits
          // a single per-argument candidate, but we still pick by cost in
          // case Sprint D's algorithm later emits multiple.
          const cheapest = [...p.candidatesJson].sort(
            (a, b) =>
              b.badConclusionsExplained - a.badConclusionsExplained ||
              a.retractionCost - b.retractionCost
          )[0];
          if (!cheapest) return null;
          return (
            <li key={p.id} className="rounded border border-amber-200 bg-white p-2">
              <div className="text-[12px] text-slate-700">
                Retract these assumption{cheapest.assumptionIds.length === 1 ? "" : "s"} on
                argument <code className="text-[11px]">{p.argumentId.slice(0, 8)}…</code> to
                remove its support:
              </div>
              <ul className="mt-1 space-y-1">
                {cheapest.assumptionIds.map((aid) => {
                  const a = assumptionById.get(aid);
                  return (
                    <li key={aid} className="flex items-start justify-between gap-2 text-[12px]">
                      <span className="flex-1">
                        <span className="text-slate-500">[{a?.role ?? "?"}]</span>{" "}
                        {a?.assumptionText ?? <em className="text-slate-400">linked claim</em>}
                        <span className="ml-1 text-[10px] text-slate-400">
                          status: {a?.status ?? "?"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[11px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        onClick={() => onRetract(aid)}
                        disabled={busyId === aid || a?.status === "RETRACTED"}
                      >
                        {busyId === aid ? "…" : "Retract"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
