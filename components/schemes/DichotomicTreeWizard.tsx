"use client";

import React, { useState } from "react";
import type { ArgumentScheme } from "@prisma/client";
import type { Purpose, Source } from "@/lib/schemes/dichotomic-tree";
import PurposeStep from "./PurposeStep";
import SourceStep from "./SourceStep";
import ResultsStep from "./ResultsStep";
import WizardProgress from "./WizardProgress";

type Step = "purpose" | "source" | "results";

interface Selections {
  purpose: Purpose | null;
  source: Source | null;
}

export interface DichotomicTreeWizardProps {
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  initialStep?: Step;
  compactMode?: boolean;
}

export default function DichotomicTreeWizard({
  onSchemeSelect,
  initialStep = "purpose",
  compactMode = false
}: DichotomicTreeWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(initialStep);
  const [selections, setSelections] = useState<Selections>({
    purpose: null,
    source: null
  });

  /**
   * Handle purpose selection
   */
  const handlePurposeSelect = (purpose: Purpose) => {
    setSelections(prev => ({ ...prev, purpose }));
    setCurrentStep("source");
  };

  /**
   * Handle source selection
   */
  const handleSourceSelect = (source: Source) => {
    setSelections(prev => ({ ...prev, source }));
    setCurrentStep("results");
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    if (currentStep === "source") {
      setCurrentStep("purpose");
    } else if (currentStep === "results") {
      setCurrentStep("source");
    }
  };

  /**
   * Handle reset
   */
  const handleReset = () => {
    setSelections({ purpose: null, source: null });
    setCurrentStep("purpose");
  };

  return (
    <div className={`w-full panel-edge-blue rounded-xl ${compactMode ? "max-w-2xl" : "max-w-screen"} mx-auto p-5`}>
      {/* Progress indicator */}
      <WizardProgress
        currentStep={currentStep}
        selections={selections}
        compact={compactMode}
      />

      {/* Step content */}
      <div className="mt-5">
        {currentStep === "purpose" && (
          <PurposeStep
            onSelect={handlePurposeSelect}
            compact={compactMode}
          />
        )}

        {currentStep === "source" && selections.purpose && (
          <SourceStep
            purpose={selections.purpose}
            onSelect={handleSourceSelect}
            onBack={handleBack}
            compact={compactMode}
          />
        )}

        {currentStep === "results" && selections.purpose && selections.source && (
          <ResultsStep
            purpose={selections.purpose}
            source={selections.source}
            onSchemeSelect={onSchemeSelect}
            onBack={handleBack}
            onReset={handleReset}
            compact={compactMode}
          />
        )}
      </div>
    </div>
  );
}
