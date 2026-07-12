"use client";

// components/thesis/ThesisSnapshotManager.tsx
//
// Living Thesis — Phase 5.3: snapshot manager UI.
//
// Renders a collapsible panel listing all snapshots for a thesis and an
// author-only "Create snapshot" button. Each row links to the frozen view
// at /deliberations/[id]/thesis/[thesisId]/view/snapshot/[snapshotId] and
// to the diff view (snapshot-vs-live or snapshot-vs-snapshot).

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Camera, ChevronDown, ChevronRight, GitCompare } from "lucide-react";

interface SnapshotRow {
  id: string;
  label: string | null;
  createdAt: string;
  createdById: string;
  parentSnapshotId: string | null;
}

interface ListResponse {
  snapshots: SnapshotRow[];
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ListResponse>;
  });

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface ThesisSnapshotManagerProps {
  thesisId: string;
  deliberationId: string;
  /** Set true to show the "Create snapshot" button. */
  canCreate?: boolean;
}

export function ThesisSnapshotManager({
  thesisId,
  deliberationId,
  canCreate = false,
}: ThesisSnapshotManagerProps) {
  const swrKey = `/api/thesis/${thesisId}/snapshots`;
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(swrKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
  });

  const [open, setOpen] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [labelInput, setLabelInput] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  const snapshots = data?.snapshots ?? [];
  const count = snapshots.length;

  async function createSnapshot() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(swrKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelInput.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setLabelInput("");
      await mutate();
    } catch (err: any) {
      setCreateError(String(err?.message ?? err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <Camera className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Snapshots</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {isLoading ? "…" : count}
          </span>
        </div>
        {error && (
          <span className="text-[11px] text-rose-600">failed to load</span>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {canCreate && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                Create snapshot
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Optional label (e.g. v1.0, before reviewer feedback)"
                  className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                  disabled={creating}
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={createSnapshot}
                  disabled={creating}
                  className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creating ? "Freezing…" : "Snapshot"}
                </button>
              </div>
              {createError && (
                <div className="mt-2 text-[11px] text-rose-600">{createError}</div>
              )}
              <div className="mt-2 text-[11px] text-slate-500">
                Freezes current content, live stats, and confidence. Auto-snapshots
                are deferred — create manually for stable cite anchors.
              </div>
            </div>
          )}

          {count === 0 && !isLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No snapshots yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {snapshots.map((s) => {
                const viewHref = `/deliberations/${deliberationId}/thesis/${thesisId}/view/snapshot/${s.id}`;
                const diffHref = `/deliberations/${deliberationId}/thesis/${thesisId}/view/snapshot/${s.id}/diff`;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {s.label || (
                          <span className="italic text-slate-500">
                            unlabeled snapshot
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatTimestamp(s.createdAt)} · {s.id.slice(0, 8)}
                        {s.parentSnapshotId && (
                          <span className="ml-2 text-slate-400">
                            · parent {s.parentSnapshotId.slice(0, 6)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={viewHref}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                      <Link
                        href={diffHref}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                      >
                        <GitCompare className="h-3 w-3" />
                        vs live
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
