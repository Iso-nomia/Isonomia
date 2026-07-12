// components/thesis/ThesisSectionEditor.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ThesisSectionType = "INTRODUCTION" | "BACKGROUND" | "LEGAL_STANDARD" | "CONCLUSION" | "APPENDIX";

export function ThesisSectionEditor({
  thesisId,
  sectionId,
  onClose,
}: {
  thesisId: string;
  sectionId?: string;
  onClose: () => void;
}) {
  const isNew = !sectionId;

  const [title, setTitle] = useState("");
  const [sectionType, setSectionType] = useState<ThesisSectionType>("INTRODUCTION");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing section if editing
  const { data: thesisData } = useSWR(
    sectionId ? `/api/thesis/${thesisId}` : null,
    fetcher
  );

  const section = thesisData?.thesis?.sections?.find((s: any) => s.id === sectionId);

  // Populate form when editing
  useEffect(() => {
    if (section) {
      setTitle(section.title ?? "");
      setSectionType(section.sectionType ?? "INTRODUCTION");
      setContent(section.content ?? "");
    }
  }, [section]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Please enter a section title");
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter section content");
      return;
    }

    setSubmitting(true);

    try {
      if (isNew) {
        // Create new section
        const res = await fetch(`/api/thesis/${thesisId}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionType,
            title,
            content,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Failed to create section");

        toast.success("Section created");
      } else {
        // Update existing section
        const res = await fetch(`/api/thesis/${thesisId}/sections`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: sectionId,
            title,
            content,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Failed to update section");

        toast.success("Section updated");
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save section");
    } finally {
      setSubmitting(false);
    }
  }, [isNew, thesisId, sectionId, title, sectionType, content, onClose]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this section?")) return;

    try {
      const res = await fetch(`/api/thesis/${thesisId}/sections?sectionId=${sectionId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete section");

      toast.success("Section deleted");
      onClose();
    } catch (err) {
      toast.error("Failed to delete section");
    }
  }, [thesisId, sectionId, onClose]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add New Section" : "Edit Section"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Section Type */}
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Section Type
              </label>
              <select
                value={sectionType}
                onChange={(e) => setSectionType(e.target.value as ThesisSectionType)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="INTRODUCTION">Introduction</option>
                <option value="BACKGROUND">Background</option>
                <option value="LEGAL_STANDARD">Legal Standard</option>
                <option value="CONCLUSION">Conclusion</option>
                <option value="APPENDIX">Appendix</option>
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="e.g., Introduction to the Case"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
              rows={12}
              placeholder="Enter section content..."
            />
            <p className="mt-1 text-xs text-slate-500">
              Tip: You can use Markdown formatting
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 text-white rounded-lg font-medium hover:from-cyan-700 hover:to-sky-700 transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? "Saving..." : isNew ? "Create Section" : "Update Section"}
            </button>
            {!isNew && (
              <button
                onClick={handleDelete}
                className="px-6 py-3 border border-rose-300 text-rose-700 rounded-lg font-medium hover:bg-rose-50 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
