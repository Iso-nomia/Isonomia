"use client";

// components/thesis/ThesisSnapshotDiff.tsx
//
// Living Thesis — Phase 5.4: snapshot diff viewer.
//
// Side-by-side view of stat deltas between a snapshot and either the
// current live state or another snapshot. Renders the structured response
// from POST /api/thesis/[id]/snapshots/[snapshotId]/compare.

import * as React from "react";
import useSWR from "swr";

interface ObjectDelta {
  id: string;
  kind: string | null;
  status: "added" | "removed" | "changed" | "unchanged";
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  changes: string[];
}

interface CompareResponse {
  comparedAt: string;
  from: { kind: "snapshot"; id: string; label: string | null; createdAt: string };
  to:
    | { kind: "live" }
    | { kind: "snapshot"; id?: string; label?: string | null; createdAt?: string };
  counts: { added: number; removed: number; changed: number; unchanged: number };
  deltas: ObjectDelta[];
  confidence: {
    before: number | null;
    after: number | null;
    delta: number | null;
    prongs: Array<{
      id: string;
      title: string | null;
      before: number | null;
      after: number | null;
      delta: number | null;
    }>;
  };
}

const STATUS_STYLES: Record<ObjectDelta["status"], string> = {
  added: "bg-emerald-50 text-emerald-700 border-emerald-200",
  removed: "bg-rose-50 text-rose-700 border-rose-200",
  changed: "bg-amber-50 text-amber-700 border-amber-200",
  unchanged: "bg-slate-50 text-slate-500 border-slate-200",
};

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

function deltaPct(n: number | null): string {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

const fetcher = async (url: string): Promise<CompareResponse> => {
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export interface ThesisSnapshotDiffProps {
  thesisId: string;
  snapshotId: string;
  /** "live" | <other snapshot id>. Defaults to "live". */
  against?: string;
}

export function ThesisSnapshotDiff({
  thesisId,
  snapshotId,
  against = "live",
}: ThesisSnapshotDiffProps) {
  const url = `/api/thesis/${thesisId}/snapshots/${snapshotId}/compare?against=${encodeURIComponent(against)}`;
  const { data, error, isLoading } = useSWR<CompareResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });

  const [showUnchanged, setShowUnchanged] = React.useState(false);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Computing diff…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Failed to compute diff: {String((error as Error)?.message ?? "unknown")}
      </div>
    );
  }

  const visibleDeltas = showUnchanged
    ? data.deltas
    : data.deltas.filter((d) => d.status !== "unchanged");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="text-sm font-semibold text-slate-800">
            {data.from.label || "snapshot"}
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({new Date(data.from.createdAt).toLocaleString()})
            </span>
          </div>
          <span className="text-slate-400">→</span>
          <div className="text-sm font-semibold text-slate-800">
            {data.to.kind === "live" ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                live
              </span>
            ) : (
              <>
                {("label" in data.to && data.to.label) || "snapshot"}
                {"createdAt" in data.to && data.to.createdAt && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ({new Date(data.to.createdAt).toLocaleString()})
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <CountChip label="added" count={data.counts.added} variant="added" />
          <CountChip label="removed" count={data.counts.removed} variant="removed" />
          <CountChip label="changed" count={data.counts.changed} variant="changed" />
          <CountChip label="unchanged" count={data.counts.unchanged} variant="unchanged" />
        </div>
      </div>

      {/* Confidence delta */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
          Confidence
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-lg text-slate-700">
            {pct(data.confidence.before)}
          </span>
          <span className="text-slate-400">→</span>
          <span className="font-mono text-lg text-slate-900">
            {pct(data.confidence.after)}
          </span>
          {data.confidence.delta != null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                data.confidence.delta > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : data.confidence.delta < 0
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {deltaPct(data.confidence.delta)}
            </span>
          )}
        </div>

        {data.confidence.prongs.length > 0 && (
          <div className="mt-3 space-y-1">
            {data.confidence.prongs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 text-xs text-slate-600"
              >
                <span className="truncate">{p.title || p.id.slice(0, 8)}</span>
                <span className="font-mono">
                  {pct(p.before)} → {pct(p.after)}{" "}
                  {p.delta != null && (
                    <span
                      className={
                        p.delta > 0
                          ? "text-emerald-600"
                          : p.delta < 0
                            ? "text-rose-600"
                            : "text-slate-500"
                      }
                    >
                      ({deltaPct(p.delta)})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-object deltas */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">
            Object-level changes
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
            />
            Show unchanged
          </label>
        </div>
        {visibleDeltas.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No changes to show.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleDeltas.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[d.status]}`}
                >
                  {d.status}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] text-slate-500">
                    {d.kind ?? "—"} · {d.id.slice(0, 12)}
                  </div>
                  {d.changes.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {d.changes.map((c, i) => (
                        <li key={i} className="font-mono">
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-slate-400">no field-level changes</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-[11px] text-slate-400">
        Computed {new Date(data.comparedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

function CountChip({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: ObjectDelta["status"];
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${STATUS_STYLES[variant]}`}
    >
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </span>
  );
}
