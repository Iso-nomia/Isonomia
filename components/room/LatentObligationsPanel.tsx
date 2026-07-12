// components/room/LatentObligationsPanel.tsx
//
// Phase 4 / Spec 3 §3.5 — collapsed-by-default panel rendering the
// CQs that have NOT yet been raised against an open SchemeInstance.
// Surfaces the latent stratum of the exposure map (CQs in the
// scheme's behaviour bundle that no participant has yet engaged).
//
// Affordances (Spec §3.5):
//   - "Raise as opponent": dispatches a WHY move via /api/dialogue/move
//   - "Offer pre-emptively": same dispatch, with the marker that the
//     proponent is opening the sub-locus themselves.
//
// Per-clause polish (Spec §3.4 / phase 3d UI side):
//   - burden + evidence + premiseType hint copy via
//     lib/utils/cq-burden-helpers.ts
//   - exception premises get the "challenger must establish" header
//
// Quiet styling: collapsed by default. The latent stratum is
// information, not pressure.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBurdenBadgeColor,
  getBurdenBadgeText,
  getCQBurdenExplanation,
  getCQEvidenceGuidance,
  getPremiseTypeDisplay,
} from "@/lib/utils/cq-burden-helpers";

type ObligationStatus =
  | "not-offered"
  | "offered-open"
  | "offered-engaged"
  | "discharged"
  | "failed"
  | "waived";

type Obligation = {
  cqKey: string;
  cqId: string | null;
  status: ObligationStatus;
  burdenOfProof: "PROPONENT" | "CHALLENGER";
  requiresEvidence: boolean;
  premiseType: "ORDINARY" | "ASSUMPTION" | "EXCEPTION" | null;
  subLocusId: string | null;
  closingMoveId: string | null;
  evidenceRefs: string[];
  text: string | null;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES" | null;
  targetScope: "conclusion" | "inference" | "premise" | null;
};

type ProtocolStateResponse = {
  instance: {
    id: string;
    schemeId: string;
    schemeKey: string;
    schemeTitle: string;
    targetType: "claim" | "card";
    targetId: string;
    status: "open" | "closed" | "failed";
    createdAt: string;
    closedAt: string | null;
  };
  obligations: Obligation[];
};

export interface LatentObligationsPanelProps {
  /** SchemeInstance id to display */
  instanceId: string;
  /** Deliberation context for dispatched WHY moves */
  deliberationId: string;
  /** Current user id (also the actor for any dispatched WHY) */
  currentUserId: string;
  /** True if the current user is the scheme-instance's proponent */
  isProponent?: boolean;
  /** Override default collapsed state for tests / admin */
  defaultOpen?: boolean;
}

function scopeCopy(scope: Obligation["targetScope"]): string {
  switch (scope) {
    case "conclusion":
      return "the scheme's conclusion";
    case "inference":
      return "the scheme's inference";
    case "premise":
      return "one of the scheme's premises";
    default:
      return "the scheme";
  }
}

export function LatentObligationsPanel(props: LatentObligationsPanelProps) {
  const { instanceId, deliberationId, currentUserId, isProponent = false } = props;
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [data, setData] = useState<ProtocolStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schemes/instances/${instanceId}/protocol-state`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setError(`fetch failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as ProtocolStateResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (open && !data) fetchState();
  }, [open, data, fetchState]);

  const latent = useMemo(
    () => (data?.obligations ?? []).filter((o) => o.status === "not-offered"),
    [data]
  );

  const dispatchWhy = useCallback(
    async (ob: Obligation, mode: "raise" | "preempt") => {
      if (!data) return;
      setDispatching(ob.cqKey);
      try {
        const moveRes = await fetch(`/api/dialogue/move`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: data.instance.targetType,
            targetId: data.instance.targetId,
            kind: "WHY",
            payload: {
              cqId: ob.cqId,
              schemeKey: data.instance.schemeKey,
              expression: ob.text ?? `Raise ${ob.cqKey}`,
              raisedBy: mode === "preempt" ? "proponent-preemptive" : "opponent",
            },
            autoCompile: true,
            autoStep: false,
          }),
        });
        if (!moveRes.ok) {
          const j = await moveRes.json().catch(() => ({}));
          setError(`dispatch failed: ${j?.error ?? moveRes.status}`);
          return;
        }
        await fetchState();
      } catch (e: any) {
        setError(e?.message ?? "dispatch failed");
      } finally {
        setDispatching(null);
      }
    },
    [data, deliberationId, fetchState]
  );

  // --- render

  return (
    <section
      className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
      data-testid="latent-obligations-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Latent obligations
          {data ? (
            <span className="ml-2 text-xs text-slate-500">
              ({latent.length} unraised)
            </span>
          ) : null}
        </span>
        <span className="text-xs text-slate-500">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="px-3 pb-3">
          <p className="text-xs text-slate-500 italic mb-2">
            CQs that have not yet been raised against this scheme-instance.
            The scheme's claim is provisionally accepted only as long as
            these remain unraised.
          </p>

          {loading ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : error ? (
            <div className="text-xs text-red-600">{error}</div>
          ) : latent.length === 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-400">
              All obligations have been engaged.
            </div>
          ) : (
            <ul className="space-y-2">
              {latent.map((ob) => {
                const ptypeLabel = getPremiseTypeDisplay(ob.premiseType ?? null);
                return (
                  <li
                    key={ob.cqKey}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                    data-testid={`latent-cq-${ob.cqKey}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-800 dark:text-slate-100">
                          {ob.text ?? ob.cqKey}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          If raised, would target {scopeCopy(ob.targetScope)};{" "}
                          burden on{" "}
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getBurdenBadgeColor(ob.burdenOfProof)}`}
                          >
                            {getBurdenBadgeText(ob.burdenOfProof)}
                          </span>
                          {ptypeLabel ? (
                            <span className="ml-1 text-[10px] text-slate-500">
                              · {ptypeLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getCQBurdenExplanation(
                            ob.burdenOfProof,
                            ob.premiseType ?? null
                          )}
                        </div>
                        {ob.requiresEvidence ? (
                          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {getCQEvidenceGuidance(
                              ob.burdenOfProof,
                              ob.premiseType ?? null,
                              true
                            )}
                          </div>
                        ) : null}
                        {ob.premiseType === "EXCEPTION" ? (
                          <div className="mt-1 text-xs italic text-slate-500">
                            Carneades exception: the challenger must establish that this exception applies.
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        {isProponent ? (
                          <button
                            type="button"
                            disabled={dispatching === ob.cqKey}
                            onClick={() => dispatchWhy(ob, "preempt")}
                            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            Offer pre-emptively
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={dispatching === ob.cqKey}
                            onClick={() => dispatchWhy(ob, "raise")}
                            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            Raise as opponent
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
