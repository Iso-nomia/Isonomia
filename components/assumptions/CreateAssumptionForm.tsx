// components/assumptions/CreateAssumptionForm.tsx
"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";

interface CreateAssumptionFormProps {
  deliberationId: string;
  onCreated?: (assumption: any) => void;
  onCancel?: () => void;
}

/**
 * CreateAssumptionForm
 * 
 * Form for creating new assumptions (propositions accepted for argument's sake).
 * Assumptions are submitted with PROPOSED status and must be accepted before use.
 * 
 * Phase A: ASPIC+ Assumptions (K_a) - Weak premises subject to automatic defeat
 * Assumptions in ASPIC+ are uncertain premises where undermining attacks always succeed.
 * 
 * Phase 3.4.4: Assumption Creation Form
 */
export function CreateAssumptionForm({
  deliberationId,
  onCreated,
  onCancel,
}: CreateAssumptionFormProps) {
  const [content, setContent] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [role, setRole] = React.useState("background");
  const [weight, setWeight] = React.useState<number>(0.5); // Phase A: Assumption weight (0-1)
  const [confidence, setConfidence] = React.useState<number>(0.5); // Phase A: Confidence (0-1)
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("Assumption content is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/assumptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          content: content.trim(),
          description: description.trim() || undefined,
          role: role,
          status: "PROPOSED", // New assumptions start as proposed
          weight, // Phase A: Include weight
          confidence, // Phase A: Include confidence
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create assumption");
      }

      const assumption = await res.json();
      
      // Reset form
      setContent("");
      setDescription("");
      setRole("background");
      setWeight(0.5);
      setConfidence(0.5);
      
      onCreated?.(assumption);
    } catch (err: any) {
      console.error("Failed to create assumption:", err);
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    setDescription("");
    setRole("background");
    setWeight(0.5);
    setConfidence(0.5);
    setError(null);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900">
          Create New Assumption
        </h4>
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Content Input */}
        <div>
          <label htmlFor="assumption-content" className="block text-xs font-medium text-slate-700 mb-1">
            Assumption Content <span className="text-red-500">*</span>
          </label>
          <input
            id="assumption-content"
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g., All participants act in good faith"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            disabled={loading}
            required
          />
        </div>

        {/* Role Select */}
        <div>
          <label htmlFor="assumption-role" className="block text-xs font-medium text-slate-700 mb-1">
            Role
          </label>
          <select
            id="assumption-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <option value="background">Background</option>
            <option value="domain">Domain Knowledge</option>
            <option value="simplification">Simplification</option>
            <option value="epistemic">Epistemic</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Classification helps organize assumptions by type
          </p>
        </div>

        {/* Description Textarea */}
        <div>
          <label htmlFor="assumption-description" className="block text-xs font-medium text-slate-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="assumption-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional context, justification, or notes..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed resize-none"
            disabled={loading}
          />
        </div>

        {/* Phase A: Weight Slider */}
        <div>
          <label htmlFor="assumption-weight" className="block text-xs font-medium text-slate-700 mb-1">
            Weight: {weight.toFixed(2)}
          </label>
          <input
            id="assumption-weight"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            disabled={loading}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Relative importance of this assumption (0 = weak, 1 = strong)
          </p>
        </div>

        {/* Phase A: Confidence Slider */}
        <div>
          <label htmlFor="assumption-confidence" className="block text-xs font-medium text-slate-700 mb-1">
            Confidence: {confidence.toFixed(2)}
          </label>
          <input
            id="assumption-confidence"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            disabled={loading}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            How certain are you about this assumption? (0 = uncertain, 1 = very certain)
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 rounded-md border border-red-200">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {loading ? "Creating..." : "Create Assumption"}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Info Note - Phase A: ASPIC+ Context */}
        <div className="text-[10px] text-slate-700 bg-amber-50 p-3 rounded border border-amber-200 space-y-1.5">
          <div>
            <strong>Status Flow:</strong> New assumptions start as PROPOSED and must be accepted before use in arguments.
          </div>
          <div className="pt-1 border-t border-amber-200">
            <strong>ASPIC+ Integration (K_a):</strong> Accepted assumptions become part of the knowledge base as "weak premises."
            Unlike ordinary premises or axioms, undermining attacks against assumptions always succeed, reflecting their uncertain nature.
          </div>
        </div>
      </div>
    </form>
  );
}
