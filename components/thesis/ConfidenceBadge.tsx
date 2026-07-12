"use client";

// components/thesis/ConfidenceBadge.tsx
//
// Living Thesis — Phase 4.3: confidence badge with audit popover.
//
// Reads /api/thesis/[id]/confidence and renders either the overall thesis
// score or a single prong's score. The popover surfaces the formula and
// every contributing input so the score is fully auditable, with deep
// links into the inspector drawer for each contributing object.

import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";
import type {
  ConfidenceInput,
  ConfidenceLevel,
  ConfidenceResult,
} from "@/lib/thesis/confidence";

interface ProngScore extends ConfidenceResult {
  id: string;
  title: string | null;
  mainClaimId: string | null;
}

interface ConfidenceResponse {
  computedAt: string;
  overall: ConfidenceResult;
  prongs: ProngScore[];
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ConfidenceResponse>;
  });

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-rose-50 text-rose-700 border-rose-200",
};

const LEVEL_DOT: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-rose-500",
};

function formatPct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export interface ConfidenceBadgeProps {
  thesisId: string;
  /** When set, render the score for this prong instead of the overall thesis. */
  prongId?: string;
  /** Visual size. Defaults to "md". */
  size?: "sm" | "md";
  /** Optional label override (e.g. "Prong strength"). */
  label?: string;
  className?: string;
}

export function ConfidenceBadge({
  thesisId,
  prongId,
  size = "md",
  label,
  className = "",
}: ConfidenceBadgeProps) {
  const swrKey = `/api/thesis/${thesisId}/confidence`;
  const { data, error, isLoading, mutate } = useSWR<ConfidenceResponse>(
    swrKey,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );
  const { mutate: globalMutate } = useSWRConfig();
  const openInspector = useOpenInspector();

  const result: ConfidenceResult | null = React.useMemo(() => {
    if (!data) return null;
    if (prongId) {
      return data.prongs.find((p) => p.id === prongId) ?? null;
    }
    return data.overall;
  }, [data, prongId]);

  const computedLabel = label ?? (prongId ? "Prong strength" : "Confidence");

  if (isLoading && !result) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 ${className}`}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
        {computedLabel}…
      </span>
    );
  }

  if (error || !result) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-400 ${className}`}
        title={error ? String(error) : "no data"}
      >
        {computedLabel} —
      </span>
    );
  }

  const sizeCls =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border ${LEVEL_STYLES[result.level]} ${sizeCls} font-medium transition hover:shadow-sm ${className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[result.level]}`} />
          <span>{computedLabel}</span>
          <span className="font-semibold">{formatPct(result.score)}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        className="w-96 bg-white/50 backdrop-blur-md border border-indigo-200 max-w-[90vw] space-y-3 p-4 text-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              {computedLabel}
            </div>
            <div className="text-base font-semibold text-slate-900">
              {formatPct(result.score)}{" "}
              <span className="text-xs font-normal text-slate-500">
                ({result.level})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            onClick={() => {
              mutate();
              globalMutate(swrKey);
            }}
            title="Recompute now"
          >
            recompute
          </button>
        </div>

        <div className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
          {result.formula}
        </div>

        <div className="space-y-2">
          {result.inputs.map((input) => (
            <ConfidenceInputRow
              key={input.key}
              input={input}
              onOpen={(ref) => {
                if (ref.id && ref.kind) {
                  openInspector({ kind: ref.kind, id: ref.id });
                }
              }}
            />
          ))}
        </div>

        {data && (
          <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            computed {formatAge(data.computedAt)}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function ConfidenceInputRow({
  input,
  onOpen,
}: {
  input: ConfidenceInput;
  onOpen: (ref: { id?: string; kind?: "claim" | "argument" | "proposition" }) => void;
}) {
  const contribution = input.value * input.weight;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium text-slate-800">{input.name}</div>
        <div className="font-mono text-[11px] text-slate-600">
          {(input.value).toFixed(2)} × {input.weight.toFixed(2)} ={" "}
          <span className="text-slate-900">{contribution.toFixed(3)}</span>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full bg-slate-400"
          style={{ width: `${Math.round(input.value * 100)}%` }}
        />
      </div>
      {input.detail && (
        <div className="text-[11px] text-slate-500">{input.detail}</div>
      )}
      {input.refs && input.refs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {input.refs.slice(0, 8).map((ref, i) =>
            ref.id && ref.kind ? (
              <button
                key={`${ref.kind}:${ref.id}:${i}`}
                type="button"
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                onClick={() => onOpen(ref)}
                title={`Open ${ref.kind}`}
              >
                {ref.kind} · {ref.id.slice(0, 6)}
              </button>
            ) : null,
          )}
          {input.refs.length > 8 && (
            <span className="text-[10px] text-slate-400">
              +{input.refs.length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
