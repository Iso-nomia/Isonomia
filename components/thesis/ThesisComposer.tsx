// components/thesis/ThesisComposer.tsx
"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { ProngEditor } from "./ProngEditor";
import { ThesisSectionEditor } from "./ThesisSectionEditor";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookPlus,
  Lightbulb
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ThesisStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "ARCHIVED";
type ThesisTemplate = "LEGAL_DEFENSE" | "POLICY_CASE" | "ACADEMIC_THESIS" | "GENERAL";
type ProngRole = "SUPPORT" | "REBUT" | "PREEMPT";
type ThesisSectionType = "INTRODUCTION" | "BACKGROUND" | "LEGAL_STANDARD" | "CONCLUSION" | "APPENDIX" | "METHODOLOGY";

type Thesis = {
  id: string;
  slug: string;
  title: string;
  status: ThesisStatus;
  template: ThesisTemplate;
  abstract?: string;
  thesisClaim?: {
    id: string;
    text: string;
  };
  prongs: Prong[];
  sections: ThesisSection[];
};

type Prong = {
  id: string;
  order: number;
  title: string;
  role: ProngRole;
  mainClaim: {
    id: string;
    text: string;
  };
  introduction?: string;
  conclusion?: string;
  arguments: {
    id: string;
    order: number;
    role: string;
    argument: {
      id: string;
      text: string;
      // D4 Week 3: scheme instances enable per-prong enabler counts
      argumentSchemes?: {
        id: string;
        justification?: string | null;
        scheme: {
          id: string;
          key: string;
          name?: string | null;
          premises?: any;
        } | null;
      }[];
    };
  }[];
};

type ThesisSection = {
  id: string;
  order: number;
  sectionType: ThesisSectionType;
  title: string;
  content: string;
};

export function ThesisComposer({
  thesisId,
  deliberationId,
  authorId,
  onClose,
}: {
  thesisId?: string;
  deliberationId: string;
  authorId: string;
  onClose?: () => void;
}) {
  const [isCreating, setIsCreating] = useState(!thesisId);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [template, setTemplate] = useState<ThesisTemplate>("GENERAL");
  const [selectedThesisClaimId, setSelectedThesisClaimId] = useState<string | null>(null);
  const [showClaimPicker, setShowClaimPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"prongs" | "sections">("prongs");
  const [editingProngId, setEditingProngId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch thesis data if editing
  const { data: thesisData, mutate: mutateThesis } = useSWR<{ ok: boolean; thesis: Thesis }>(
    thesisId ? `/api/thesis/${thesisId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const thesis = thesisData?.thesis;

  // Populate form when editing
  useEffect(() => {
    if (thesis && !isCreating) {
      setTitle(thesis.title || "");
      setAbstract(thesis.abstract || "");
      setTemplate(thesis.template || "GENERAL");
      setSelectedThesisClaimId(thesis.thesisClaim?.id || null);
    }
  }, [thesis, isCreating]);

  // Validation state
  const canPublish = useMemo(() => {
    if (!thesis) return false;
    return thesis.thesisClaim && thesis.prongs.length > 0;
  }, [thesis]);

  // Save metadata (title, abstract, template, claim)
  const handleSaveMetadata = useCallback(async () => {
    if (!thesis) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/thesis/${thesis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          abstract: abstract.trim() || null,
          template,
          thesisClaimId: selectedThesisClaimId,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      await mutateThesis();
      toast.success("Thesis saved successfully");
    } catch (err) {
      toast.error("Failed to save thesis");
    } finally {
      setIsSaving(false);
    }
  }, [thesis, title, abstract, template, selectedThesisClaimId, mutateThesis]);

  // Delete thesis
  const handleDelete = useCallback(async () => {
    if (!thesis) return;

    try {
      const res = await fetch(`/api/thesis/${thesis.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Thesis deleted");
      mutate(`/api/thesis?deliberationId=${deliberationId}`);
      onClose?.();
    } catch (err) {
      toast.error("Failed to delete thesis");
    }
  }, [thesis, deliberationId, onClose]);

  // Handle thesis creation
  const handleCreateThesis = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Please enter a thesis title");
      return;
    }

    try {
      const res = await fetch("/api/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          title,
          template,
          thesisClaimId: selectedThesisClaimId,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed to create thesis");

      toast.success("Thesis created successfully");
      setIsCreating(false);
      
      // Redirect to edit mode
      window.location.href = `/deliberations/${deliberationId}/thesis/${json.thesis.id}`;
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create thesis");
    }
  }, [title, template, selectedThesisClaimId, deliberationId]);

  // Handle prong reordering
  const handleMoveProng = useCallback(
    async (prongId: string, direction: "up" | "down") => {
      if (!thesis) return;

      const currentIndex = thesis.prongs.findIndex((p) => p.id === prongId);
      if (currentIndex === -1) return;
      if (direction === "up" && currentIndex === 0) return;
      if (direction === "down" && currentIndex === thesis.prongs.length - 1) return;

      const items = Array.from(thesis.prongs);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];

      const prongIds = items.map((p) => p.id);

      try {
        const res = await fetch(`/api/thesis/${thesis.id}/prongs`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prongIds }),
        });

        if (!res.ok) throw new Error("Failed to reorder prongs");

        mutateThesis();
        toast.success("Prongs reordered");
      } catch (err) {
        toast.error("Failed to reorder prongs");
      }
    },
    [thesis, mutateThesis]
  );

  // Handle section reordering
  const handleMoveSection = useCallback(
    async (sectionId: string, direction: "up" | "down") => {
      if (!thesis) return;

      const currentIndex = thesis.sections.findIndex((s) => s.id === sectionId);
      if (currentIndex === -1) return;
      if (direction === "up" && currentIndex === 0) return;
      if (direction === "down" && currentIndex === thesis.sections.length - 1) return;

      const items = Array.from(thesis.sections);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];

      const sectionIds = items.map((s) => s.id);

      try {
        const res = await fetch(`/api/thesis/${thesis.id}/sections`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionIds }),
        });

        if (!res.ok) throw new Error("Failed to reorder sections");

        mutateThesis();
        toast.success("Sections reordered");
      } catch (err) {
        toast.error("Failed to reorder sections");
      }
    },
    [thesis, mutateThesis]
  );

  // Handle publish
  const handlePublish = useCallback(async () => {
    if (!thesis) return;

    if (!thesis.thesisClaim) {
      toast.error("Please set a main thesis claim before publishing");
      return;
    }

    if (thesis.prongs.length === 0) {
      toast.error("Please add at least one prong before publishing");
      return;
    }

    try {
      const res = await fetch(`/api/thesis/${thesis.id}/publish`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to publish");

      mutateThesis();
      toast.success("Thesis published successfully!");
    } catch (err) {
      toast.error("Failed to publish thesis");
    }
  }, [thesis, mutateThesis]);

  if (isCreating) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6 text-teal-600" />
              Create New Thesis
            </DialogTitle>
            <p className="text-sm text-slate-600 mt-2">
              Build a structured legal-style argument by composing claims and arguments into a cohesive thesis document.
            </p>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                placeholder="Enter a descriptive title for your thesis..."
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                Choose a clear, concise title that captures your main argument
              </p>
            </div>

            {/* Abstract */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Abstract (Optional)
              </label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none"
                rows={4}
                placeholder="Provide a brief summary of your thesis..."
              />
              <p className="text-xs text-slate-500 mt-1">
                A concise overview of your argument and key points
              </p>
            </div>

            {/* Template */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as ThesisTemplate)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                <option value="GENERAL">General — Flexible structure for any argument</option>
                <option value="LEGAL_DEFENSE">Legal Defense — Courtroom-style advocacy</option>
                <option value="POLICY_CASE">Policy Case — Public policy recommendation</option>
                <option value="ACADEMIC_THESIS">Academic Thesis — Scholarly research argument</option>
              </select>
            </div>

            {/* Main Claim */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Main Thesis Claim (Optional)
              </label>
              <button
                onClick={() => setShowClaimPicker(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-left hover:bg-slate-50 hover:border-teal-400 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-slate-400 group-hover:text-teal-600" />
                  <span className="text-slate-600 group-hover:text-slate-900">
                    {selectedThesisClaimId ? "Change thesis claim" : "Select a claim from this deliberation"}
                  </span>
                </div>
              </button>
              <p className="text-xs text-slate-500 mt-1">
                The primary claim your thesis will defend or explore
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={handleCreateThesis}
                disabled={!title.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <BookPlus className="w-5 h-5" />
                Create Thesis
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Claim Picker Modal */}
          <ClaimPicker
            deliberationId={deliberationId}
            open={showClaimPicker}
            onClose={() => setShowClaimPicker(false)}
            onPick={(claim) => {
              setSelectedThesisClaimId(claim.id);
              setShowClaimPicker(false);
            }}
            allowCreate={true}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (!thesis) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6 text-teal-600 flex-shrink-0" />
                <span className="truncate">{thesis.title}</span>
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  thesis.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" :
                  thesis.status === "SUBMITTED" ? "bg-sky-100 text-sky-800" :
                  thesis.status === "DRAFT" ? "bg-amber-100 text-amber-800" :
                  "bg-slate-100 text-slate-800"
                }`}>
                  {thesis.status}
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-teal-100 text-teal-800 font-semibold">
                  {thesis.template.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-500">
                  {thesis.prongs.length} prong{thesis.prongs.length !== 1 ? "s" : ""} • {thesis.sections.length} section{thesis.sections.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSaveMetadata}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                title="Save metadata"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save"}
              </button>

              {thesis.status === "DRAFT" && canPublish && (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Publish
                </button>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Delete thesis"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Validation Messages */}
          {thesis.status === "DRAFT" && !canPublish && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <strong>Cannot publish yet:</strong>{" "}
                {!thesis.thesisClaim && "Please select a main thesis claim. "}
                {thesis.prongs.length === 0 && "Please add at least one prong."}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Metadata Section - Collapsible */}
        <div className="border-b">
          <details className="group">
            <summary className="px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Thesis Metadata</span>
              <span className="text-xs text-slate-500 group-open:hidden">Click to edit title, abstract, claim...</span>
            </summary>
            <div className="px-6 py-4 bg-slate-50 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Thesis title..."
                />
              </div>

              {/* Abstract */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Abstract</label>
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                  rows={3}
                  placeholder="Brief summary of your thesis..."
                />
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Template</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as ThesisTemplate)}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="LEGAL_DEFENSE">Legal Defense</option>
                  <option value="POLICY_CASE">Policy Case</option>
                  <option value="ACADEMIC_THESIS">Academic Thesis</option>
                </select>
              </div>

              {/* Main Thesis Claim */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Main Thesis Claim</label>
                {thesis.thesisClaim ? (
                  <div className="p-4 bg-white border-2 border-teal-200 rounded-lg">
                    <p className="text-sm text-slate-700 mb-3">{thesis.thesisClaim.text}</p>
                    <button
                      onClick={() => setShowClaimPicker(true)}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Change claim
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClaimPicker(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-left hover:bg-white hover:border-teal-400 transition-all group flex items-center gap-3"
                  >
                    <Plus className="w-5 h-5 text-slate-400 group-hover:text-teal-600" />
                    <span className="text-slate-600 group-hover:text-slate-900">Select a thesis claim</span>
                  </button>
                )}
              </div>
            </div>
          </details>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200 mb-6 sticky top-0 bg-white z-10 -mt-4 pt-4">
            <button
              onClick={() => setActiveTab("prongs")}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === "prongs"
                  ? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              } rounded-t-lg`}
            >
              <div className="flex items-center gap-2">
                <span>Prongs</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "prongs" ? "bg-teal-200 text-teal-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {thesis.prongs.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("sections")}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === "sections"
                  ? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              } rounded-t-lg`}
            >
              <div className="flex items-center gap-2">
                <span>Sections</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "sections" ? "bg-teal-200 text-teal-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {thesis.sections.length}
                </span>
              </div>
            </button>
          </div>

          {/* Prongs Tab */}
          {activeTab === "prongs" && (
            <div className="space-y-4">
              {thesis.prongs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-teal-100 mx-auto mb-4 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No prongs yet</h3>
                  <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                    Prongs are the main pillars of your thesis. Each prong presents a distinct line of reasoning with supporting arguments.
                  </p>
                  <button
                    onClick={() => setEditingProngId("new")}
                    className="px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Your First Prong
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {thesis.prongs.map((prong, index) => (
                      <div
                        key={prong.id}
                        className="group border-2 border-slate-200 hover:border-teal-300 rounded-xl p-5 bg-white hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start gap-4">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-1 pt-1">
                            <button
                              onClick={() => handleMoveProng(prong.id, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move up"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveProng(prong.id, "down")}
                              disabled={index === thesis.prongs.length - 1}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move down"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                prong.role === "SUPPORT" ? "bg-emerald-100 text-emerald-800" :
                                prong.role === "REBUT" ? "bg-rose-100 text-rose-800" :
                                "bg-amber-100 text-amber-800"
                              }`}>
                                {prong.role}
                              </span>
                              <h4 className="font-semibold text-slate-900 truncate">{prong.title}</h4>
                            </div>
                            <div className="text-sm text-slate-700 mb-3 line-clamp-2">{prong.mainClaim.text}</div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" />
                                {prong.arguments.length} argument{prong.arguments.length !== 1 ? "s" : ""}
                              </span>
                              {(() => {
                                // D4 Week 3: surface inference-assumption count per prong
                                let enablers = 0;
                                for (const a of prong.arguments) {
                                  for (const inst of a.argument?.argumentSchemes ?? []) {
                                    const premises = inst?.scheme?.premises;
                                    if (Array.isArray(premises) && premises.length > 0) {
                                      enablers += 1;
                                    }
                                  }
                                }
                                if (enablers === 0) return null;
                                return (
                                  <span
                                    className="flex items-center gap-1 text-yellow-700"
                                    title="Inference assumptions surfaced from argumentation schemes"
                                  >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    {enablers} assumption{enablers !== 1 ? "s" : ""}
                                  </span>
                                );
                              })()}
                              {prong.introduction && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                  Has introduction
                                </span>
                              )}
                              {prong.conclusion && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                  Has conclusion
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Edit button */}
                          <button
                            onClick={() => setEditingProngId(prong.id)}
                            className="px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100"
                          >
                            <Eye className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setEditingProngId("new")}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/50 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Another Prong
                  </button>
                </>
              )}
            </div>
          )}        {/* Sections Tab */}
        {activeTab === "sections" && (
          <div className="space-y-4">
            {thesis.sections.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-purple-100 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No prose sections yet</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Add custom sections like introductions, methodology notes, or conclusions to provide context between your prongs.
                </p>
                <button
                  onClick={() => setEditingSectionId("new")}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Section
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {thesis.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="group border-2 border-slate-200 hover:border-purple-300 rounded-xl p-5 bg-white hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-4">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-1 pt-1">
                          <button
                            onClick={() => handleMoveSection(section.id, "up")}
                            disabled={index === 0}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveSection(section.id, "down")}
                            disabled={index === thesis.sections.length - 1}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                              section.sectionType === "INTRODUCTION" ? "bg-sky-100 text-sky-800" :
                              section.sectionType === "METHODOLOGY" ? "bg-purple-100 text-purple-800" :
                              section.sectionType === "CONCLUSION" ? "bg-green-100 text-green-800" :
                              "bg-slate-100 text-slate-800"
                            }`}>
                              {section.sectionType}
                            </span>
                            <h4 className="font-semibold text-slate-900 truncate">{section.title}</h4>
                          </div>
                          <div className="text-sm text-slate-700 line-clamp-3 mb-3">{section.content}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{section.content.length} characters</span>
                            {section.content.split(/\s+/).length > 50 && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                Substantial content
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit button */}
                        <button
                          onClick={() => setEditingSectionId(section.id)}
                          className="px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100"
                        >
                          <Eye className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setEditingSectionId("new")}
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50/50 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Section
                </button>
              </>
            )}
          </div>
        )}
        </div>

        {/* Claim Picker Modal */}
        {/* Claim Picker Modal */}
        <ClaimPicker
          deliberationId={deliberationId}
          open={showClaimPicker}
          onClose={() => setShowClaimPicker(false)}
          onPick={(claim) => {
            setSelectedThesisClaimId(claim.id);
            setShowClaimPicker(false);
          }}
          allowCreate={true}
        />

        {/* Prong Editor Modal */}
        {editingProngId && (
          <ProngEditor
            thesisId={thesis.id}
            prongId={editingProngId === "new" ? undefined : editingProngId}
            deliberationId={deliberationId}
            onClose={() => {
              setEditingProngId(null);
              mutateThesis();
            }}
          />
        )}

        {/* Section Editor Modal */}
        {editingSectionId && (
          <ThesisSectionEditor
            thesisId={thesis.id}
            sectionId={editingSectionId === "new" ? undefined : editingSectionId}
            onClose={() => {
              setEditingSectionId(null);
              mutateThesis();
            }}
          />
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Dialog open onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-rose-900">Delete Thesis?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  Are you sure you want to delete "{thesis.title}"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowDeleteConfirm(false);
                    }}
                    className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
