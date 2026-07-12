"use client";

import { useState } from "react";
import { ArgumentConstructor } from "./ArgumentConstructor";
import { SupportSuggestions } from "./SupportSuggestions";
import { EvidenceSchemeMapper } from "./EvidenceSchemeMapper";
import { BatchArgumentGenerator } from "./BatchArgumentGenerator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Database,
  Zap,
  Eye,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SupportConstructionWizardProps {
  targetArgumentId: string;
  deliberationId: string;
  currentUserId: string;
  onComplete?: () => void;
}

type WizardStep =
  | "analyze"
  | "suggestions"
  | "evidence"
  | "mode"
  | "single"
  | "batch"
  | "review";

type ConstructionMode = "single" | "batch" | null;

interface WizardEvidenceItem {
  id: string;
  title: string;
  type: string;
  content: string;
  quality: number;
  source: string;
  credibility: number;
  relevance: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function SupportConstructionWizard({
  targetArgumentId,
  deliberationId,
  currentUserId,
  onComplete,
}: SupportConstructionWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("analyze");
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [availableEvidence, setAvailableEvidence] = useState<WizardEvidenceItem[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<any>(null);
  const [constructionMode, setConstructionMode] = useState<ConstructionMode>(null);
  const [completedArguments, setCompletedArguments] = useState<string[]>([]);

  const steps: Array<{ key: WizardStep; label: string; icon: any }> = [
    { key: "analyze", label: "Analyze", icon: Shield },
    { key: "suggestions", label: "Suggestions", icon: Lightbulb },
    { key: "evidence", label: "Evidence", icon: Database },
    { key: "mode", label: "Mode", icon: Zap },
    { key: "review", label: "Review", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  function nextStep() {
    const transitions: Record<WizardStep, WizardStep | null> = {
      analyze: "suggestions",
      suggestions: "evidence",
      evidence: "mode",
      mode: constructionMode === "single" ? "single" : "batch",
      single: "review",
      batch: "review",
      review: null,
    };

    const next = transitions[currentStep];
    if (next) {
      setCurrentStep(next);
    }
  }

  function previousStep() {
    const transitions: Record<WizardStep, WizardStep | null> = {
      analyze: null,
      suggestions: "analyze",
      evidence: "suggestions",
      mode: "evidence",
      single: "mode",
      batch: "mode",
      review: constructionMode === "single" ? "single" : "batch",
    };

    const prev = transitions[currentStep];
    if (prev) {
      setCurrentStep(prev);
    }
  }

  function skipToMode() {
    setCurrentStep("mode");
  }

  function handleSuggestionSelect(suggestion: any) {
    setSelectedSuggestion(suggestion);
  }

  function handleSchemeSelect(match: any) {
    setSelectedScheme(match);
  }

  function handleModeSelect(mode: ConstructionMode) {
    setConstructionMode(mode);
    nextStep();
  }

  function handleArgumentComplete(argumentId: string) {
    setCompletedArguments([...completedArguments, argumentId]);
  }

  function handleBatchComplete(generatedArgs: any[]) {
    const approved = generatedArgs.filter((a) => a.status === "approved");
    setCompletedArguments(approved.map((a) => a.id));
  }

  const canProceed = () => {
    if (currentStep === "analyze") return true;
    if (currentStep === "suggestions") return true;
    if (currentStep === "evidence") return availableEvidence.length > 0;
    if (currentStep === "mode") return constructionMode !== null;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Step indicators */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.key === currentStep;
                const isComplete = index < currentStepIndex;

                return (
                  <div
                    key={step.key}
                    className={`flex flex-col items-center gap-2 ${
                      isActive ? "opacity-100" : isComplete ? "opacity-75" : "opacity-40"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? "bg-sky-600 text-white"
                          : isComplete
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div>
        {/* Step 1: Analyze */}
        {currentStep === "analyze" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-sky-600" />
                <CardTitle>Analyze Target Argument</CardTitle>
              </div>
              <CardDescription>
                Review the argument you want to support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-sm font-medium mb-2">Target Argument ID</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {targetArgumentId}
                </div>
              </div>

              <Alert className="bg-sky-50 border-sky-200">
                <Lightbulb className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-900">
                  <strong>Tip:</strong> The wizard will help you analyze weaknesses,
                  gather evidence, and construct strong support arguments.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <button
                  onClick={nextStep}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                >
                  Continue to Suggestions
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Suggestions */}
        {currentStep === "suggestions" && (
          <div className="space-y-4">
            <SupportSuggestions
              argumentId={targetArgumentId}
              onSelectSuggestion={handleSuggestionSelect}
            />

            {selectedSuggestion && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  Selected: <strong>{selectedSuggestion.title}</strong>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <button
                    onClick={previousStep}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={skipToMode}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    Skip Suggestions
                  </button>
                  <button
                    onClick={nextStep}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                  >
                    Continue to Evidence
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Evidence */}
        {currentStep === "evidence" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-sky-600" />
                  Add Evidence
                </CardTitle>
                <CardDescription>
                  Upload or select evidence to support your arguments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 text-center">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Add evidence from your library or upload new evidence
                  </p>
                  <button
                    onClick={() => {
                      // Mock adding evidence for testing
                      setAvailableEvidence([
                        {
                          id: "e1",
                          title: "Expert Study on Policy Effectiveness",
                          type: "expert-opinion",
                          content: "Research shows the policy significantly improves outcomes",
                          quality: 85,
                          source: "Academic Journal",
                          credibility: 90,
                          relevance: 88,
                        },
                        {
                          id: "e2",
                          title: "Statistical Analysis Results",
                          type: "empirical-data",
                          content: "Data demonstrates 40% improvement over baseline",
                          quality: 80,
                          source: "Government Report",
                          credibility: 85,
                          relevance: 92,
                        },
                        {
                          id: "e3",
                          title: "Historical Case Study",
                          type: "case-study",
                          content: "Similar implementation in 2018 yielded positive results",
                          quality: 75,
                          source: "Case Study Database",
                          credibility: 78,
                          relevance: 82,
                        },
                      ]);
                    }}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                  >
                    Add Sample Evidence (for testing)
                  </button>
                </div>

                {availableEvidence.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {availableEvidence.length} Evidence Items Added
                    </p>
                    <div className="space-y-2">
                      {availableEvidence.map((evidence) => (
                        <div
                          key={evidence.id}
                          className="p-3 rounded-lg bg-muted flex items-start justify-between"
                        >
                          <div>
                            <div className="text-sm font-medium">{evidence.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {evidence.type} • {evidence.quality}% quality
                            </div>
                          </div>
                          <Badge className="bg-sky-100 text-sky-800">
                            {evidence.credibility}% credible
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {availableEvidence.length > 0 && (
              <EvidenceSchemeMapper
                targetArgumentId={targetArgumentId}
                availableEvidence={availableEvidence}
                onSelectScheme={handleSchemeSelect}
              />
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <button
                    onClick={previousStep}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={nextStep}
                    disabled={!canProceed()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Mode Selection
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Mode Selection */}
        {currentStep === "mode" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-sky-600" />
                Construction Mode
              </CardTitle>
              <CardDescription>
                Choose how you want to construct support arguments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Single Mode */}
                <button
                  onClick={() => handleModeSelect("single")}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover:border-sky-600 hover:bg-sky-50 ${
                    constructionMode === "single"
                      ? "border-sky-600 bg-sky-50"
                      : "border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Eye className="h-8 w-8 text-sky-600" />
                    {constructionMode === "single" && (
                      <CheckCircle2 className="h-5 w-5 text-sky-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Single Argument</h3>
                  <p className="text-sm text-muted-foreground">
                    Manually construct one detailed support argument with full control
                    over premises and evidence.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-green-100 text-green-800">More Control</Badge>
                    <Badge className="bg-sky-100 text-sky-800">Detailed</Badge>
                  </div>
                </button>

                {/* Batch Mode */}
                <button
                  onClick={() => handleModeSelect("batch")}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover:border-sky-600 hover:bg-sky-50 ${
                    constructionMode === "batch"
                      ? "border-sky-600 bg-sky-50"
                      : "border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Zap className="h-8 w-8 text-sky-600" />
                    {constructionMode === "batch" && (
                      <CheckCircle2 className="h-5 w-5 text-sky-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Batch Generate</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate multiple support arguments from different
                    angles based on your evidence.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-purple-100 text-purple-800">Fast</Badge>
                    <Badge className="bg-orange-100 text-orange-800">Multiple</Badge>
                  </div>
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={previousStep}
                  className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Single Construction */}
        {currentStep === "single" && (
          <div className="space-y-4">
            <ArgumentConstructor
              mode="support"
              targetId={targetArgumentId}
              deliberationId={deliberationId}
              currentUserId={currentUserId}
              supportSuggestion={
                selectedScheme
                  ? {
                      schemeId: selectedScheme.schemeId,
                      reasoning: selectedScheme.reasoning,
                    }
                  : undefined
              }
              onComplete={handleArgumentComplete}
            />

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <button
                    onClick={previousStep}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Mode
                  </button>
                  <button
                    onClick={() => setCurrentStep("review")}
                    disabled={completedArguments.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Continue to Review
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 6: Batch Construction */}
        {currentStep === "batch" && (
          <div className="space-y-4">
            <BatchArgumentGenerator
              targetArgumentId={targetArgumentId}
              availableEvidence={availableEvidence}
              onGenerateComplete={handleBatchComplete}
            />

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <button
                    onClick={previousStep}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Mode
                  </button>
                  <button
                    onClick={() => setCurrentStep("review")}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                  >
                    Continue to Review
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 7: Review */}
        {currentStep === "review" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle>Review & Complete</CardTitle>
              </div>
              <CardDescription>
                Summary of your support argument construction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>Success!</strong> You have created support arguments for this
                  argument.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h4 className="font-medium">Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-sky-600">
                      {completedArguments.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Arguments Created
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-sky-600">
                      {availableEvidence.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Evidence Used</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-sky-600">
                      {constructionMode === "single" ? "Single" : "Batch"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Construction Mode
                    </div>
                  </div>
                </div>
              </div>

              {selectedSuggestion && (
                <div className="space-y-2">
                  <h4 className="font-medium">Applied Suggestion</h4>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm font-medium">{selectedSuggestion.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedSuggestion.description}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={previousStep}
                  className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={onComplete}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete & Close
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
