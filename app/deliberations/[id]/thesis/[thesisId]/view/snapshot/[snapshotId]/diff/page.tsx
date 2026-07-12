"use client";

// app/deliberations/[id]/thesis/[thesisId]/view/snapshot/[snapshotId]/diff/page.tsx
//
// Living Thesis — Phase 5.4: snapshot diff page.
//
// Compares this snapshot against ?against=live (default) or another
// snapshot id. Renders ThesisSnapshotDiff.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitCompare } from "lucide-react";
import { ThesisSnapshotDiff } from "@/components/thesis/ThesisSnapshotDiff";

export default function ThesisSnapshotDiffPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();

  const deliberationId = params?.id as string;
  const thesisId = params?.thesisId as string;
  const snapshotId = params?.snapshotId as string;
  const against = search?.get("against") ?? "live";

  if (!params) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <Link
            href={`/deliberations/${deliberationId}/thesis/${thesisId}/view/snapshot/${snapshotId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            View frozen snapshot
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-slate-700" />
          <h1 className="text-xl font-semibold text-slate-900">Snapshot diff</h1>
        </div>
        <ThesisSnapshotDiff
          thesisId={thesisId}
          snapshotId={snapshotId}
          against={against}
        />
      </div>
    </div>
  );
}
