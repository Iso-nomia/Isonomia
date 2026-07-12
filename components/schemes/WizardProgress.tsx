"use client";

import React from "react";
import { Check } from "lucide-react";
import type { Purpose, Source } from "@/lib/schemes/dichotomic-tree";
import { purposeOptions, sourceOptions } from "@/lib/schemes/dichotomic-tree";

type Step = "purpose" | "source" | "results";

interface WizardProgressProps {
  currentStep: Step;
  selections: {
    purpose: Purpose | null;
    source: Source | null;
  };
  compact?: boolean;
}

export default function WizardProgress({
  currentStep,
  selections,
  compact = false
}: WizardProgressProps) {
  const steps = [
    {
      id: "purpose" as const,
      label: "Purpose",
      description: "What are you trying to do?",
      completed: selections.purpose !== null
    },
    {
      id: "source" as const,
      label: "Evidence",
      description: "What kind of evidence?",
      completed: selections.source !== null
    },
    {
      id: "results" as const,
      label: "Results",
      description: "Select a scheme",
      completed: false
    }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = index < currentStepIndex;
          const isCompleted = step.completed;

          return (
            <React.Fragment key={step.id}>
              {/* Step circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-colors duration-200
                    ${isActive ? "bg-sky-600 text-white ring-4 ring-sky-100" : ""}
                    ${isPast || isCompleted ? "bg-green-600 text-white" : ""}
                    ${!isActive && !isPast && !isCompleted ? "bg-gray-200 text-gray-600" : ""}
                  `}
                >
                  {isPast || isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step label */}
                {!compact && (
                  <div className="mt-2 text-center">
                    <div className={`text-sm font-medium ${isActive ? "text-sky-600" : "text-gray-700"}`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {step.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    transition-colors duration-200
                    ${isPast || (index === currentStepIndex - 1 && isCompleted) 
                      ? "bg-green-600" 
                      : "bg-gray-200"}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current selection summary */}
      {!compact && (selections.purpose || selections.source) && (
        <div className="mt-3 px-6 py-3 bg-sky-100/60 border rounded-lg">
          <div className="text-sm font-medium text-sky-900 mb-1 ">Your Selections:</div>
          <div className="space-y-1 text-sm text-sky-700">
            {selections.purpose && (
              <div className="flex items-center gap-2">
                <span>{purposeOptions[selections.purpose].icon}</span>
                <span className="font-medium">{purposeOptions[selections.purpose].label}</span>
              </div>
            )}
            {selections.source && (
              <div className="flex items-center gap-2">
                <span>{sourceOptions[selections.source].icon}</span>
                <span className="font-medium">{sourceOptions[selections.source].label}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
