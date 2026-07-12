"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import { Lightbulb, X, Check } from "lucide-react";

export interface PropositionData {
  text: string;
  mediaType?: "text" | "image";
  mediaUrl?: string;
}

interface PropositionComposerEmbeddableProps {
  mode?: "modal" | "embedded";
  deliberationId: string;
  initialText?: string;
  initialMediaUrl?: string;
  onSave: (data: PropositionData) => void;
  onCancel?: () => void;
  placeholder?: string;
}

/**
 * PropositionComposerEmbeddable - Unified proposition composition component
 * 
 * Supports two modes:
 * - modal: Traditional modal dialog (default)
 * - embedded: Inline composition for thesis editor
 * 
 * Usage in thesis:
 * <PropositionComposerEmbeddable
 *   mode="embedded"
 *   deliberationId={deliberationId}
 *   onSave={(data) => {
 *     // Save as draft node in thesis
 *   }}
 *   onCancel={() => {
 *     // Remove draft node
 *   }}
 * />
 */
export function PropositionComposerEmbeddable({
  mode = "modal",
  deliberationId,
  initialText = "",
  initialMediaUrl = "",
  onSave,
  onCancel,
  placeholder = "State your proposition…",
}: PropositionComposerEmbeddableProps) {
  const [text, setText] = useState(initialText);
  const [mediaUrl, setMediaUrl] = useState(initialMediaUrl);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.style.height = "0px";
      el.style.height = Math.min(360, el.scrollHeight) + "px";
    });
    return () => cancelAnimationFrame(raf);
  }, [text]);

  const handleSave = async () => {
    if (!text.trim()) {
      alert("Please enter proposition text");
      return;
    }

    setIsSaving(true);
    try {
      const data: PropositionData = {
        text: text.trim(),
        mediaType: mediaUrl ? "image" : "text",
        mediaUrl: mediaUrl || undefined,
      };
      
      await onSave(data);
      
      // Reset form if in embedded mode
      if (mode === "embedded") {
        setText("");
        setMediaUrl("");
      }
    } catch (err) {
      console.error("Save proposition error:", err);
      alert("Failed to save proposition");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setText(initialText);
      setMediaUrl(initialMediaUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      handleCancel();
    }
  };

  // Embedded mode: inline rendering
  if (mode === "embedded") {
    return (
      <div className="inline-proposition-composer border-2 border-purple-300 rounded-lg p-4 my-4 bg-purple-50/30 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-purple-900">Creating New Proposition</span>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium border border-amber-300">
              DRAFT
            </span>
          </div>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Proposition Text Input */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Proposition Text
          </label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all"
            placeholder={placeholder}
            rows={3}
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-1">
            Tip: Press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-xs">⌘+Enter</kbd> to save
          </p>
        </div>

        {/* Optional Media URL */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Media URL (Optional)
          </label>
          <input
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!text.trim() || isSaving}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          
          {onCancel && (
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Modal mode: traditional dialog
  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-lg border border-slate-200 bg-white shadow-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Proposition</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Proposition Text
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
              placeholder={placeholder}
              rows={4}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Media URL (Optional)
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={!text.trim() || isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Creating..." : "Create Proposition"}
            </button>
            {onCancel && (
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-6 py-3 border-2 border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
