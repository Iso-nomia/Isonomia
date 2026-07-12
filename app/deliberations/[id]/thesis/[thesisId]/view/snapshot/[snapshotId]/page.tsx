"use client";

// app/deliberations/[id]/thesis/[thesisId]/view/snapshot/[snapshotId]/page.tsx
//
// Living Thesis — Phase 5.3: frozen snapshot view.
//
// Renders the TipTap content frozen at snapshot time. Intentionally does
// NOT mount ThesisLiveProvider — embedded nodes show their snapshot stats
// from `statsSnapshot.objects` rather than live-polled data, and the
// "this is a snapshot, not live" banner is always visible.

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Camera, GitCompare } from "lucide-react";
import { ThesisLiveContent } from "@/components/thesis/ThesisLiveContent";

interface SnapshotPayload {
  snapshot: {
    id: string;
    thesisId: string;
    label: string | null;
    createdAt: string;
    createdById: string;
    parentSnapshotId: string | null;
    contentJson: any;
    statsSnapshot: any;
    confidenceSnapshot: any;
    attacksSnapshot: any;
  };
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<SnapshotPayload>;
  });

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ThesisSnapshotViewPage() {
  const params = useParams();
  const router = useRouter();
  const deliberationId = params?.id as string;
  const thesisId = params?.thesisId as string;
  const snapshotId = params?.snapshotId as string;

  const { data, error, isLoading } = useSWR<SnapshotPayload>(
    snapshotId ? `/api/thesis/${thesisId}/snapshots/${snapshotId}` : null,
    fetcher,
  );

  if (!params) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 font-mono">Loading snapshot…</div>
      </div>
    );
  }

  if (error || !data?.snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-rose-500 font-mono">
            {error ? String((error as Error).message) : "Snapshot not found"}
          </p>
          <button
            className="mt-4 rounded border border-slate-200 bg-white px-3 py-1 text-sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
            Back
          </button>
        </div>
      </div>
    );
  }

  const snapshot = data.snapshot;
  const overallScore =
    snapshot.confidenceSnapshot?.overall?.score != null
      ? `${Math.round((snapshot.confidenceSnapshot.overall.score as number) * 100)}%`
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href={`/deliberations/${deliberationId}/thesis/${thesisId}/view`}
            className="flex px-5 py-1 rounded-full btnv2 items-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="mr-0 h-3.5 w-3.5" />
            Back to live
          </Link>
          <Link
            href={`/deliberations/${deliberationId}/thesis/${thesisId}/view/snapshot/${snapshotId}/diff`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            <GitCompare className="h-4 w-4" />
            Compare to live
          </Link>
        </div>
      </div>

      {/* Frozen banner — always visible */}
      <div className="border-b border-amber-300 bg-amber-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Camera className="h-4 w-4 text-amber-700" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-900">
              This is a frozen snapshot, not the live thesis.
            </div>
            <div className="text-[12px] text-amber-800">
              {snapshot.label ? (
                <>
                  <span className="font-medium">{snapshot.label}</span> ·{" "}
                </>
              ) : null}
              Captured {formatTimestamp(snapshot.createdAt)}
              {overallScore && (
                <>
                  {" · "}
                  Confidence at capture: <span className="font-mono">{overallScore}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="bg-white rounded-xl shadow-md border border-slate-300 px-5 py-5">
          <ThesisLiveContent content={snapshot.contentJson} />
        </div>

        {/* Snapshot stats summary */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
            Snapshot stats
          </div>
          <SnapshotStatsSummary
            stats={snapshot.statsSnapshot}
            confidence={snapshot.confidenceSnapshot}
            attacks={snapshot.attacksSnapshot}
          />
        </div>
      </div>
    </div>
  );
}

function SnapshotStatsSummary({
  stats,
  confidence,
  attacks,
}: {
  stats: any;
  confidence: any;
  attacks: any;
}) {
  const objectCount = stats?.objects ? Object.keys(stats.objects).length : 0;
  let totalAttacks = 0;
  let undefendedAttacks = 0;
  if (stats?.objects) {
    for (const id of Object.keys(stats.objects)) {
      const o = stats.objects[id];
      totalAttacks += o.attackCount ?? 0;
      undefendedAttacks += o.undefendedAttackCount ?? 0;
    }
  }
  const overall = confidence?.overall?.score;
  const attackEntries = attacks?.entries?.length ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <Stat label="Embedded objects" value={String(objectCount)} />
      <Stat
        label="Attacks (total / undefended)"
        value={`${totalAttacks} / ${undefendedAttacks}`}
      />
      <Stat
        label="Confidence"
        value={overall != null ? `${Math.round(overall * 100)}%` : "—"}
      />
      <Stat label="Attack-register entries" value={String(attackEntries)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
