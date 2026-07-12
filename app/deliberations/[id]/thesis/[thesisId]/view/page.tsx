// app/deliberations/[id]/thesis/[thesisId]/view/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Download,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThesisExportModal } from "@/components/thesis/ThesisExportModal";
import { ThesisLiveContent } from "@/components/thesis/ThesisLiveContent";
import { ThesisInspectorDrawer } from "@/components/thesis/ThesisInspectorDrawer";
import { ThesisAttackRegister } from "@/components/thesis/ThesisAttackRegister";
import { ConfidenceBadge } from "@/components/thesis/ConfidenceBadge";
import { ThesisSnapshotManager } from "@/components/thesis/ThesisSnapshotManager";
import { ThesisFocusHandler } from "@/components/thesis/ThesisFocusHandler";
import { ThesisLiveProvider } from "@/lib/thesis/ThesisLiveContext";

interface ThesisData {
  id: string;
  title: string;
  slug: string;
  abstract?: string;
  content: any; // TipTap JSON
  status: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  author?: {
    name?: string;
    username?: string;
  };
}

export default function ThesisViewPage() {
  const params = useParams();
  const router = useRouter();
  const [thesis, setThesis] = useState<ThesisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const thesisId = params?.thesisId as string;
  const deliberationId = params?.id as string;

  useEffect(() => {
    if (!thesisId) return;
    
    async function fetchThesis() {
      try {
        const res = await fetch(`/api/thesis/${thesisId}`);
        if (!res.ok) throw new Error("Failed to fetch thesis");
        const data = await res.json();
        setThesis(data.thesis);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchThesis();
  }, [thesisId]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCurrentUserId(d?.userId ?? null))
      .catch(() => setCurrentUserId(null));
  }, []);

  if (!params) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          <p className="mt-4 text-sm text-slate-400 font-mono">
            Loading thesis...
          </p>
        </div>
      </div>
    );
  }

  if (error || !thesis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-rose-400 font-mono">
            {error || "Thesis not found"}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push(`/deliberation/${deliberationId}`)}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deliberation
          </Button>
        </div>
      </div>
    );
  }

  const publishedDate = thesis.publishedAt
    ? new Date(thesis.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            className="flex px-5 py-1 rounded-full btnv2 items-center text-sm text-slate-600 hover:text-slate-900"
            onClick={() => router.push(`/deliberation/${deliberationId}`)}
          >
            <ArrowLeft className="mr-0 h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {thesis.status === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/deliberations/${deliberationId}/thesis/${thesisId}`
                  )
                }
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Draft
              </Button>
            )}

            <button
              className="flex gap-2 items-center panelv2 text-sm rounded-lg px-3 py-2 bg-white/50"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-5">
        {/* Metadata */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <FileText className="h-4 w-4" />
            <span className="font-mono uppercase tracking-wide">Thesis</span>
            {thesis.status === "PUBLISHED" && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600 font-medium">Published</span>
              </>
            )}
          </div>

          <h1 className="text-3xl font-semibold text-slate-900 mb-2">
            {thesis.title || "Untitled Thesis"}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            {thesis.author && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>
                  {thesis.author.name || thesis.author.username || "Anonymous"}
                </span>
              </div>
            )}

            {publishedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{publishedDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Abstract */}
        {thesis.abstract && (
          <div className="mb-8 p-6 bg-slate-100 border border-slate-200 rounded-lg">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Abstract
            </h2>
            <p className="text-slate-700 leading-relaxed">{thesis.abstract}</p>
          </div>
        )}

        {/* Main Content (live-bound to deliberation state) */}
        <ThesisLiveProvider thesisId={thesisId}>
          <div className="mb-3 flex items-center justify-end">
            <ConfidenceBadge thesisId={thesisId} />
          </div>
          <div className="bg-white rounded-xl shadow-md border border-slate-500 px-5 py-5">
            <ThesisLiveContent content={thesis.content} />
          </div>
          <div className="mt-6">
            <ThesisAttackRegister thesisId={thesisId} />
          </div>
          <div className="mt-6">
            <ThesisSnapshotManager
              thesisId={thesisId}
              deliberationId={deliberationId}
              canCreate={
                !!currentUserId && !!thesis.authorId && currentUserId === thesis.authorId
              }
            />
          </div>
          <ThesisInspectorDrawer thesisId={thesisId} />
          <ThesisFocusHandler thesisId={thesisId} />
        </ThesisLiveProvider>
      </div>

      {/* Export Modal */}
      <ThesisExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        thesisId={thesisId}
        thesisTitle={thesis.title || "Untitled Thesis"}
      />
    </div>
  );
}

