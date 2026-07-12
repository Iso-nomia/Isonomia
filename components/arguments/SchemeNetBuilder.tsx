"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Plus, X, GripVertical, AlertCircle, Save, Trash2 } from "lucide-react";

type ArgumentScheme = {
  id: string;
  key: string;
  name: string;
  schemeMacagnoCategory: string | null;
  schemeWaltonType: string | null;
};

type SchemeNetStepInput = {
  schemeId: string;
  stepOrder: number;
  label: string;
  stepText: string;
  confidence: number;
  inputFromStep: number | null;
  inputSlotMapping: Record<string, string>;
};

type Props = {
  argumentId: string;
  initialNetData?: {
    description: string;
    steps: SchemeNetStepInput[];
  };
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
};

/**
 * Interactive builder for creating/editing Scheme Nets (Phase 5C)
 * 
 * Features:
 * - Add/remove/reorder steps
 * - Scheme selection per step with autocomplete
 * - Input mapping between steps
 * - Confidence sliders
 * - Live validation feedback
 * - Weakest link calculation preview
 */
export default function SchemeNetBuilder({
  argumentId,
  initialNetData,
  onSave,
  onCancel,
  className = "",
}: Props) {
  const [description, setDescription] = useState(
    initialNetData?.description || ""
  );
  const [steps, setSteps] = useState<SchemeNetStepInput[]>(
    initialNetData?.steps || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: schemesData } = useSWR<{ schemes: ArgumentScheme[] }>(
    "/api/schemes",
    (url: string) => fetch(url).then((r) => r.json())
  );

  const schemes = schemesData?.schemes || [];

  const addStep = () => {
    const nextOrder = steps.length + 1;
    setSteps([
      ...steps,
      {
        schemeId: "",
        stepOrder: nextOrder,
        label: `Step ${nextOrder}`,
        stepText: "",
        confidence: 0.8,
        inputFromStep: nextOrder > 1 ? nextOrder - 1 : null,
        inputSlotMapping: {},
      },
    ]);
  };

  const removeStep = (stepOrder: number) => {
    const filtered = steps
      .filter((s) => s.stepOrder !== stepOrder)
      .map((s, idx) => ({
        ...s,
        stepOrder: idx + 1,
        inputFromStep:
          s.inputFromStep !== null && s.inputFromStep >= stepOrder
            ? Math.max(1, s.inputFromStep - 1)
            : s.inputFromStep,
      }));
    setSteps(filtered);
  };

  const updateStep = (
    stepOrder: number,
    updates: Partial<SchemeNetStepInput>
  ) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.stepOrder === stepOrder ? { ...s, ...updates } : s
      )
    );
  };

  const calculateOverallConfidence = () => {
    if (steps.length === 0) return 1.0;
    return Math.min(...steps.map((s) => s.confidence));
  };

  const validate = (): string[] => {
    const errors: string[] = [];

    if (steps.length === 0) {
      errors.push("Add at least one step");
    }

    steps.forEach((step) => {
      if (!step.schemeId) {
        errors.push(`Step ${step.stepOrder}: Select a scheme`);
      }
      if (!step.stepText.trim()) {
        errors.push(`Step ${step.stepOrder}: Enter step text`);
      }
      if (step.inputFromStep !== null && step.inputFromStep >= step.stepOrder) {
        errors.push(
          `Step ${step.stepOrder}: Input must reference an earlier step`
        );
      }
    });

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/arguments/${argumentId}/scheme-net`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, steps }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save scheme net");
      }

      onSave?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this scheme net?")) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/arguments/${argumentId}/scheme-net`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      onSave?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSaving(false);
    }
  };

  const overallConfidence = calculateOverallConfidence();
  const validationErrors = validate();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          Build Scheme Net
        </h3>
        <p className="text-xs text-slate-600 mb-3">
          Create a sequential chain of argumentation schemes where each
          step&apos;s conclusion feeds into the next step&apos;s premise.
        </p>
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const selectedScheme = schemes.find((s) => s.id === step.schemeId);

          return (
            <div key={step.stepOrder}>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                {/* Step Header */}
                <div className="flex items-start gap-2 mb-3">
                  <div className="cursor-move pt-1">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-400">
                        Step {step.stepOrder}
                      </span>
                      <input
                        type="text"
                        placeholder="Label (e.g., Classification)"
                        value={step.label}
                        onChange={(e) =>
                          updateStep(step.stepOrder, { label: e.target.value })
                        }
                        className="flex-1 text-xs border-b border-slate-200 px-1 py-0.5 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    {/* Scheme Selector */}
                    <div className="mb-2">
                      <label className="text-[10px] text-slate-500 block mb-1">
                        Argumentation Scheme *
                      </label>
                      <select
                        value={step.schemeId}
                        onChange={(e) =>
                          updateStep(step.stepOrder, {
                            schemeId: e.target.value,
                          })
                        }
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">Select scheme...</option>
                        {schemes.map((scheme) => (
                          <option key={scheme.id} value={scheme.id}>
                            {scheme.name}{" "}
                            {scheme.schemeMacagnoCategory &&
                              `(${scheme.schemeMacagnoCategory})`}
                          </option>
                        ))}
                      </select>
                      {selectedScheme && (
                        <div className="mt-1 text-[10px] text-slate-500">
                          Key: {selectedScheme.key} •{" "}
                          {selectedScheme.schemeWaltonType || "N/A"}
                        </div>
                      )}
                    </div>

                    {/* Step Text */}
                    <div className="mb-2">
                      <label className="text-[10px] text-slate-500 block mb-1">
                        Step Text *
                      </label>
                      <textarea
                        placeholder="Describe this reasoning step..."
                        value={step.stepText}
                        onChange={(e) =>
                          updateStep(step.stepOrder, {
                            stepText: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    {/* Confidence Slider */}
                    <div className="mb-2">
                      <label className="text-[10px] text-slate-500 block mb-1">
                        Confidence: {(step.confidence * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={step.confidence * 100}
                        onChange={(e) =>
                          updateStep(step.stepOrder, {
                            confidence: parseInt(e.target.value) / 100,
                          })
                        }
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Input From Step */}
                    {step.stepOrder > 1 && (
                      <div className="mb-2">
                        <label className="text-[10px] text-slate-500 block mb-1">
                          Input From Step
                        </label>
                        <select
                          value={step.inputFromStep ?? ""}
                          onChange={(e) =>
                            updateStep(step.stepOrder, {
                              inputFromStep: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                        >
                          <option value="">None (independent)</option>
                          {Array.from({ length: step.stepOrder - 1 }, (_, i) => i + 1).map(
                            (prevStep) => (
                              <option key={prevStep} value={prevStep}>
                                Step {prevStep}:{" "}
                                {steps[prevStep - 1]?.label || `Step ${prevStep}`}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeStep(step.stepOrder)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Remove step"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Arrow between steps */}
              {idx < steps.length - 1 && (
                <div className="flex justify-center my-1">
                  <div className="text-slate-300 text-xl">↓</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Step Button */}
      <button
        onClick={addStep}
        className="w-full border-2 border-dashed border-slate-200 rounded-lg p-3 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Step
      </button>

      {/* Summary */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Total steps:</span>
            <span className="font-medium text-slate-900">{steps.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Overall confidence:</span>
            <span className="font-medium text-slate-900">
              {(overallConfidence * 100).toFixed(0)}% (weakest link)
            </span>
          </div>
          {validationErrors.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-red-600 font-medium">
                {validationErrors.length} error{validationErrors.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <div className="flex gap-2">
          {initialNetData && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || validationErrors.length > 0}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            {isSaving ? "Saving..." : "Save Net"}
          </button>
        </div>
      </div>
    </div>
  );
}
