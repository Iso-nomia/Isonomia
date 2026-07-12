"use client";

import React, { useState } from "react";
import { MessageSquare, X, Check } from "lucide-react";

export interface ClaimData {
  text: string;
  position: "IN" | "OUT" | "UNDEC";
}

interface ClaimComposerEmbeddableProps {
  mode?: "modal" | "embedded";
  deliberationId: string;
  initialText?: string;
  initialPosition?: "IN" | "OUT" | "UNDEC";
  onSave: (data: ClaimData) => void;
  onCancel?: () => void;
}

/**
 * ClaimComposerEmbeddable - Unified claim composition component
 * 
 * Supports two modes:
 * - modal: Traditional modal dialog (default)
 * - embedded: Inline composition for thesis editor
 * 
 * Usage in thesis:
 * <ClaimComposerEmbeddable
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
export function ClaimComposerEmbeddable({
  mode = "modal",
  deliberationId,
  initialText = "",
  initialPosition = "UNDEC",
  onSave,
  onCancel,
}: ClaimComposerEmbeddableProps) {
  const [text, setText] = useState(initialText);
  const [position, setPosition] = useState<"IN" | "OUT" | "UNDEC">(initialPosition);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      alert("Please enter claim text");
      return;
    }

    setIsSaving(true);
    try {
      // Validate before calling onSave
      const data: ClaimData = {
        text: text.trim(),
        position,
      };
      
      await onSave(data);
      
      // Reset form if in embedded mode
      if (mode === "embedded") {
        setText("");
        setPosition("UNDEC");
      }
    } catch (err) {
      console.error("Save claim error:", err);
      alert("Failed to save claim");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      // Reset form
      setText(initialText);
      setPosition(initialPosition);
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
      <div className="inline-claim-composer border-2 border-teal-300 rounded-lg p-4 my-4 bg-teal-50/30 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <span className="font-semibold text-teal-900">Creating New Claim</span>
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

        {/* Claim Text Input */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Claim Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none transition-all"
            placeholder="Enter your claim..."
            rows={3}
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-1">
            Tip: Press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-xs">⌘+Enter</kbd> to save
          </p>
        </div>

        {/* Position Select */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Position
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setPosition("UNDEC")}
              className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                position === "UNDEC"
                  ? "border-slate-400 bg-slate-100 text-slate-900 font-medium"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="text-sm">Undecided</span>
              </div>
            </button>
            <button
              onClick={() => setPosition("IN")}
              className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                position === "IN"
                  ? "border-emerald-400 bg-emerald-100 text-emerald-900 font-medium"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-sm">Support (IN)</span>
              </div>
            </button>
            <button
              onClick={() => setPosition("OUT")}
              className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                position === "OUT"
                  ? "border-rose-400 bg-rose-100 text-rose-900 font-medium"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="text-sm">Oppose (OUT)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!text.trim() || isSaving}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

  // Modal mode: traditional dialog (placeholder for now)
  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-lg border border-slate-200 bg-white shadow-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Claim</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Claim Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              placeholder="Enter your claim..."
              rows={4}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as "IN" | "OUT" | "UNDEC")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="UNDEC">Undecided</option>
              <option value="IN">Support (IN)</option>
              <option value="OUT">Oppose (OUT)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={!text.trim() || isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Creating..." : "Create Claim"}
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
