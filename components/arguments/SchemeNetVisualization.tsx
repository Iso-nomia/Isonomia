"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronRight, AlertCircle, CheckCircle } from "lucide-react";

type SchemeNetStep = {
  id: string;
  stepOrder: number;
  label: string | null;
  stepText: string | null;
  confidence: number;
  inputFromStep: number | null;
  inputSlotMapping: Record<string, string> | null;
  scheme: {
    id: string;
    key: string;
    name: string;
    schemeMacagnoCategory: string | null;
  };
};

type SchemeNet = {
  id: string;
  description: string | null;
  overallConfidence: number;
  steps: SchemeNetStep[];
};

type Props = {
  argumentId: string;
  className?: string;
};

/**
 * Read-only visualization of a Scheme Net (Phase 5C)
 * 
 * Displays sequential chain of argumentation schemes with:
 * - Step-by-step flow visualization
 * - Confidence indicators per step (weakest link highlighted)
 * - Critical Questions grouped by step
 * - Input/output mapping between steps
 */
export default function SchemeNetVisualization({ argumentId, className = "" }: Props) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showCQs, setShowCQs] = useState(false);

  const { data, error, isLoading } = useSWR<{ net: SchemeNet | null }>(
    `/api/arguments/${argumentId}/scheme-net`,
    (url: string) => fetch(url).then((r) => r.json())
  );

  const { data: cqData } = useSWR<{
    steps: Array<{
      stepId: string;
      stepOrder: number;
      stepLabel: string;
      schemeKey: string;
      cqs: Array<{ id: string; text: string }>;
    }>;
  }>(
    showCQs && data?.net ? `/api/arguments/${argumentId}/scheme-net/cqs` : null,
    (url: string) => fetch(url).then((r) => r.json())
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
        <div className="h-24 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertCircle className="inline w-4 h-4 mr-1" />
        Failed to load scheme net
      </div>
    );
  }

  if (!data?.net) {
    return null;
  }

  const net = data.net;
  const weakestConfidence = net.overallConfidence;
  const weakestSteps = net.steps.filter((s) => s.confidence === weakestConfidence);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return "text-green-700 bg-green-50 border-green-200";
    if (conf >= 0.6) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 0.8) return "🟢";
    if (conf >= 0.6) return "🟡";
    return "🔴";
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Scheme Net ({net.steps.length} steps)
          </h3>
          <button
            onClick={() => setShowCQs(!showCQs)}
            className="text-xs text-indigo-600 hover:text-indigo-700 underline"
          >
            {showCQs ? "Hide CQs" : "Show CQs"}
          </button>
        </div>
        {net.description && (
          <p className="text-xs text-slate-600">{net.description}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-slate-500">Overall confidence:</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${getConfidenceColor(weakestConfidence)}`}
          >
            {getConfidenceBadge(weakestConfidence)} {(weakestConfidence * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-400">(weakest link)</span>
        </div>
      </div>

      {/* Step Flow */}
      <div className="space-y-2">
        {net.steps.map((step, idx) => {
          const isExpanded = expandedSteps.has(step.id);
          const isWeakest = weakestSteps.some((w) => w.id === step.id);
          const stepCQs = cqData?.steps.find((s) => s.stepId === step.id);

          return (
            <div key={step.id}>
              {/* Step Card */}
              <div
                className={`rounded-lg border ${
                  isWeakest
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
                } p-3 cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={() => toggleStep(step.id)}
              >
                {/* Step Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">
                        Step {step.stepOrder}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {step.label || `Step ${step.stepOrder}`}
                      </span>
                      {isWeakest && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium"
                          title="This step has the lowest confidence (weakest link)"
                        >
                          Weakest Link
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      {step.stepText || "No description"}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">Scheme:</span>
                      <span className="font-medium text-indigo-700">
                        {step.scheme.name}
                      </span>
                      {step.scheme.schemeMacagnoCategory && (
                        <span className="text-slate-400">
                          ({step.scheme.schemeMacagnoCategory})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded border ${getConfidenceColor(step.confidence)}`}
                    >
                      {getConfidenceBadge(step.confidence)}{" "}
                      {(step.confidence * 100).toFixed(0)}%
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    {/* Input Mapping */}
                    {step.inputFromStep !== null && step.inputSlotMapping && (
                      <div className="text-xs">
                        <span className="font-medium text-slate-700">
                          Input from Step {step.inputFromStep}:
                        </span>
                        <div className="mt-1 ml-4 space-y-1">
                          {Object.entries(step.inputSlotMapping).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="text-slate-600 font-mono text-[11px]"
                              >
                                <span className="text-indigo-600">{key}</span> ←{" "}
                                <span className="text-slate-500">{value}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Critical Questions */}
                    {showCQs && stepCQs && stepCQs.cqs.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium text-slate-700">
                          Critical Questions ({stepCQs.cqs.length}):
                        </span>
                        <ul className="mt-1 ml-4 space-y-1 list-disc list-inside">
                          {stepCQs.cqs.slice(0, 3).map((cq) => (
                            <li key={cq.id} className="text-slate-600">
                              {cq.text}
                            </li>
                          ))}
                          {stepCQs.cqs.length > 3 && (
                            <li className="text-slate-400 italic">
                              ... and {stepCQs.cqs.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow between steps */}
              {idx < net.steps.length - 1 && (
                <div className="flex justify-center my-1">
                  <div className="text-slate-300 text-xl">↓</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>
            Chain inference complete: {net.steps.length} sequential schemes
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Based on Macagno &amp; Walton Section 7: Each step&apos;s conclusion
          feeds into the next step&apos;s premise.
        </p>
      </div>
    </div>
  );
}
