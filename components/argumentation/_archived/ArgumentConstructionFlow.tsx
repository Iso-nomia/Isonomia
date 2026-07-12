"use client";

import { useState, useEffect, useCallback } from "react";
import { ArgumentConstructor, type AttackContext } from "../ArgumentConstructor";
import { TemplateLibrary } from "../TemplateLibrary";
import { EvidenceMatchingVisualizer } from "./EvidenceMatchingVisualizer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Workflow,
  FileText,
  Library,
  Link2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type FlowStep = "choose-method" | "template-selection" | "construction" | "evidence-matching";

interface ArgumentConstructionFlowProps {
  mode: "attack" | "support" | "general";
  targetId: string;
  deliberationId: string;
  currentUserId: string;
  suggestion?: any;
  attackContext?: AttackContext;
  supportSuggestion?: any;
  onComplete?: (argumentId: string) => void;
  onCancel?: () => void;
}

interface FlowState {
  currentStep: FlowStep;
  useTemplate: boolean;
  selectedTemplate: any | null;
  constructorState: {
    selectedScheme: string | null;
    filledPremises: Record<string, string>;
    evidenceLinks: Record<string, string[]>;
    variables: Record<string, string>;
  };
  availableEvidence: any[];
}

// ============================================================================
// Main Component
// ============================================================================

export function ArgumentConstructionFlow({
  mode,
  targetId,
  deliberationId,
  currentUserId,
  suggestion,
  attackContext,
  supportSuggestion,
  onComplete,
  onCancel,
}: ArgumentConstructionFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>({
    currentStep: "choose-method",
    useTemplate: false,
    selectedTemplate: null,
    constructorState: {
      selectedScheme: suggestion?.targetSchemeInstance?.scheme?.id || 
                      supportSuggestion?.schemeId || 
                      null,
      filledPremises: {},
      evidenceLinks: {},
      variables: {},
    },
    availableEvidence: [],
  });

  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  const loadAvailableEvidence = useCallback(async () => {
    setIsLoadingEvidence(true);
    try {
      const response = await fetch(
        `/api/deliberations/${deliberationId}/evidence?targetId=${targetId}`
      );
      if (response.ok) {
        const data = await response.json();
        setFlowState((prev) => ({
          ...prev,
          availableEvidence: data.evidence || [],
        }));
      }
    } catch (err) {
      console.error("Failed to load evidence:", err);
    } finally {
      setIsLoadingEvidence(false);
    }
  }, [deliberationId, targetId]);

  // Load available evidence when we reach evidence matching step
  useEffect(() => {
    if (flowState.currentStep === "evidence-matching") {
      loadAvailableEvidence();
    }
  }, [flowState.currentStep, loadAvailableEvidence]);

  function handleMethodChoice(useTemplate: boolean) {
    setFlowState((prev) => ({
      ...prev,
      useTemplate,
      currentStep: useTemplate ? "template-selection" : "construction",
    }));
  }

  function handleTemplateSelect(template: any) {
    setFlowState((prev) => ({
      ...prev,
      selectedTemplate: template,
      constructorState: {
        ...prev.constructorState,
        selectedScheme: template.schemeId,
        filledPremises: template.filledPremises || {},
        variables: template.variables || {},
        evidenceLinks: template.evidenceLinks || {},
      },
      currentStep: "construction",
    }));
  }

  function handleConstructorStateChange(updates: Partial<FlowState["constructorState"]>) {
    setFlowState((prev) => ({
      ...prev,
      constructorState: {
        ...prev.constructorState,
        ...updates,
      },
    }));
  }

  function handleEvidenceAssign(premiseKey: string, evidenceId: string) {
    setFlowState((prev) => ({
      ...prev,
      constructorState: {
        ...prev.constructorState,
        evidenceLinks: {
          ...prev.constructorState.evidenceLinks,
          [premiseKey]: [
            ...(prev.constructorState.evidenceLinks[premiseKey] || []),
            evidenceId,
          ],
        },
      },
    }));
  }

  function handleEvidenceRemove(premiseKey: string, evidenceId: string) {
    setFlowState((prev) => ({
      ...prev,
      constructorState: {
        ...prev.constructorState,
        evidenceLinks: {
          ...prev.constructorState.evidenceLinks,
          [premiseKey]: (prev.constructorState.evidenceLinks[premiseKey] || []).filter(
            (id) => id !== evidenceId
          ),
        },
      },
    }));
  }

  const stepConfig = [
    { id: "choose-method" as FlowStep, label: "Choose Method", icon: Lightbulb },
    { id: "template-selection" as FlowStep, label: "Template", icon: Library, optional: true },
    { id: "construction" as FlowStep, label: "Build Argument", icon: FileText },
    { id: "evidence-matching" as FlowStep, label: "Link Evidence", icon: Link2 },
  ];

  const currentStepIndex = stepConfig.findIndex((s) => s.id === flowState.currentStep);
  const progress = ((currentStepIndex + 1) / stepConfig.length) * 100;

  return (
    <div className="space-y-6">
      {/* Flow Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-sky-600" />
            <CardTitle>Argument Construction Flow</CardTitle>
          </div>
          <CardDescription>
            {mode === "attack" && "Build a structured attack argument"}
            {mode === "support" && "Build a structured support argument"}
            {mode === "general" && "Build a structured argument"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {stepConfig
              .filter((step) => !step.optional || flowState.useTemplate)
              .map((step, idx) => {
                const isActive = step.id === flowState.currentStep;
                const isComplete = stepConfig.findIndex((s) => s.id === step.id) < currentStepIndex;
                const Icon = step.icon;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 ${
                      isActive ? "text-sky-600 font-medium" : 
                      isComplete ? "text-green-600" : 
                      "text-muted-foreground"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="text-sm">{step.label}</span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {flowState.currentStep === "choose-method" && (
        <MethodSelectionStep
          onSelectMethod={handleMethodChoice}
          onCancel={onCancel}
        />
      )}

      {flowState.currentStep === "template-selection" && (
        <TemplateSelectionStep
          onSelectTemplate={handleTemplateSelect}
          onSkip={() => handleMethodChoice(false)}
          onBack={() => setFlowState((prev) => ({ ...prev, currentStep: "choose-method" }))}
        />
      )}

      {flowState.currentStep === "construction" && (
        <ArgumentConstructor
          mode={mode}
          targetId={targetId}
          deliberationId={deliberationId}
          currentUserId={currentUserId}
          suggestion={suggestion}
          attackContext={attackContext}
          supportSuggestion={supportSuggestion}
          onComplete={onComplete}
          onCancel={onCancel}
          onSaveDraft={(draftId) => {
            // Track draft saved
          }}
        />
      )}

      {flowState.currentStep === "evidence-matching" && (
        <EvidenceMatchingStep
          premises={[]} // Get from constructor state
          availableEvidence={flowState.availableEvidence}
          currentMatches={flowState.constructorState.evidenceLinks}
          onEvidenceAssign={handleEvidenceAssign}
          onEvidenceRemove={handleEvidenceRemove}
          onComplete={() => {
            // Submit argument with evidence
            onComplete?.("argument-id");
          }}
          onBack={() => setFlowState((prev) => ({ ...prev, currentStep: "construction" }))}
          isLoading={isLoadingEvidence}
        />
      )}
    </div>
  );
}

// ============================================================================
// Method Selection Step
// ============================================================================

interface MethodSelectionStepProps {
  onSelectMethod: (useTemplate: boolean) => void;
  onCancel?: () => void;
}

function MethodSelectionStep({ onSelectMethod, onCancel }: MethodSelectionStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How would you like to build your argument?</CardTitle>
        <CardDescription>
          Choose a starting point that works best for you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Start from scratch */}
          <button
            onClick={() => onSelectMethod(false)}
            className="group relative overflow-hidden rounded-lg border-2 border-muted p-6 text-left transition-all hover:border-sky-600 hover:shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-sky-100 p-3">
                  <Sparkles className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-semibold">Start from Scratch</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Build your argument step-by-step with guided prompts and real-time quality
                feedback. Best for custom arguments.
              </p>
              <div className="flex items-center gap-2 text-sm text-sky-600 group-hover:translate-x-1 transition-transform">
                <span>Begin building</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </button>

          {/* Use template */}
          <button
            onClick={() => onSelectMethod(true)}
            className="group relative overflow-hidden rounded-lg border-2 border-muted p-6 text-left transition-all hover:border-purple-600 hover:shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-3">
                  <Library className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold">Use a Template</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Start with a pre-built template from your library or the community. Speed up
                construction with proven structures.
              </p>
              <div className="flex items-center gap-2 text-sm text-purple-600 group-hover:translate-x-1 transition-transform">
                <span>Browse templates</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </button>
        </div>

        {onCancel && (
          <div className="flex justify-center pt-4">
            <button
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Template Selection Step
// ============================================================================

interface TemplateSelectionStepProps {
  onSelectTemplate: (template: any) => void;
  onSkip: () => void;
  onBack: () => void;
}

function TemplateSelectionStep({
  onSelectTemplate,
  onSkip,
  onBack,
}: TemplateSelectionStepProps) {
  return (
    <div className="space-y-4">
      <TemplateLibrary
        onSelectTemplate={(template) => onSelectTemplate(template)}
        mode="select"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
        >
          Back
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4"
        >
          Skip & Build from Scratch
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Evidence Matching Step
// ============================================================================

interface EvidenceMatchingStepProps {
  premises: any[];
  availableEvidence: any[];
  currentMatches: Record<string, string[]>;
  onEvidenceAssign: (premiseKey: string, evidenceId: string) => void;
  onEvidenceRemove: (premiseKey: string, evidenceId: string) => void;
  onComplete: () => void;
  onBack: () => void;
  isLoading: boolean;
}

function EvidenceMatchingStep({
  premises,
  availableEvidence,
  currentMatches,
  onEvidenceAssign,
  onEvidenceRemove,
  onComplete,
  onBack,
  isLoading,
}: EvidenceMatchingStepProps) {
  const hasAllRequired = premises
    .filter((p) => p.isRequired)
    .every((p) => currentMatches[p.key]?.length > 0);

  return (
    <div className="space-y-4">
      <EvidenceMatchingVisualizer
        premises={premises}
        availableEvidence={availableEvidence}
        currentMatches={currentMatches}
        onEvidenceAssign={onEvidenceAssign}
        onEvidenceRemove={onEvidenceRemove}
      />

      {!hasAllRequired && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some required premises still need evidence. Link evidence to all required premises
            before completing your argument.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
        >
          Back to Construction
        </button>
        <button
          onClick={onComplete}
          disabled={!hasAllRequired || isLoading}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4"
        >
          {isLoading ? "Loading..." : "Complete Argument"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

export function trackFlowCompletion(data: {
  mode: string;
  usedTemplate: boolean;
  templateId?: string;
  timeSpent: number;
  stepsCompleted: number;
}) {
  if (typeof window !== "undefined" && (window as any).analytics) {
    (window as any).analytics.track("Argument Flow Completed", data);
  }
}

export function trackStepTransition(from: FlowStep, to: FlowStep, metadata?: any) {
  if (typeof window !== "undefined" && (window as any).analytics) {
    (window as any).analytics.track("Flow Step Transition", {
      from,
      to,
      ...metadata,
    });
  }
}
