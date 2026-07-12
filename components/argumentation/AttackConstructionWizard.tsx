"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
  Upload,
  Eye,
  RefreshCw,
  X,
} from "lucide-react";
import { useArgumentScoring } from "@/hooks/useArgumentScoring";
import type {
  AttackSuggestion,
  ArgumentTemplate,
} from "@/app/server/services/ArgumentGenerationService";

// ============================================================================
// Types
// ============================================================================

type WizardStep = "overview" | "premises" | "evidence" | "review";

interface AttackConstructionWizardProps {
  suggestion: AttackSuggestion;
  claimId: string;
  deliberationId: string;
  onComplete?: (argumentId: string) => void;
  onCancel?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function AttackConstructionWizard({
  suggestion,
  claimId,
  deliberationId,
  onComplete,
  onCancel,
}: AttackConstructionWizardProps) {
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>("overview");
  const [template, setTemplate] = useState<ArgumentTemplate | null>(null);
  
  // Simplified state for CQ-based attacks
  const [attackText, setAttackText] = useState<string>("");
  const [evidenceLinks, setEvidenceLinks] = useState<Record<string, string[]>>({});
  
  const [filledPremises, setFilledPremises] = useState<Record<string, string>>({});
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time scoring
  const { score, isScoring } = useArgumentScoring(
    template?.schemeId || "",
    claimId,
    filledPremises
  );

  // Load template on mount
  useEffect(() => {
    // If suggestion already has template, use it directly
    if (suggestion.template) {
      setTemplate(suggestion.template);
      if (suggestion.template.prefilledPremises) {
        setFilledPremises(suggestion.template.prefilledPremises);
      }
    } else {
      // Otherwise, fetch from API
      loadTemplate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  async function loadTemplate() {
    setIsLoadingTemplate(true);
    setError(null);

    try {
      const response = await fetch("/api/arguments/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId: (suggestion as any).targetSchemeInstance?.scheme?.id || "general-rebuttal",
          claimId,
          attackType: suggestion.attackType,
          targetCQ: (suggestion.cq as any).id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load template");
      }

      const data = await response.json();
      setTemplate(data.template);

      // Initialize with prefilled data
      if (data.template.prefilledPremises) {
        setFilledPremises(data.template.prefilledPremises);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTemplate(false);
    }
  }

  // Navigation
  function goToStep(step: WizardStep) {
    setCurrentStep(step);
  }

  function nextStep() {
    const steps: WizardStep[] = ["overview", "premises", "evidence", "review"];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx < steps.length - 1) {
      setCurrentStep(steps[currentIdx + 1]);
    }
  }

  function previousStep() {
    const steps: WizardStep[] = ["overview", "premises", "evidence", "review"];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx > 0) {
      setCurrentStep(steps[currentIdx - 1]);
    }
  }

  // Validation
  function canProceed(): boolean {
    if (!template) return false;

    switch (currentStep) {
      case "overview":
        return true; // Always can proceed from overview
      case "premises":
        // Check required premises are filled
        const requiredPremises = template.premises.filter((p) => p.required);
        return requiredPremises.every(
          (p) => filledPremises[p.key] && filledPremises[p.key].trim() !== ""
        );
      case "evidence":
        // Evidence is optional, can always proceed
        return true;
      case "review":
        // Check overall score
        return (score?.overallScore || 0) >= 40; // Minimum 40% score
      default:
        return false;
    }
  }

  // Submission
  async function handleSubmit() {
    if (!template) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create argument
      const response = await fetch("/api/arguments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          deliberationId,
          schemeId: template.schemeId,
          text: generateArgumentText(),
          premises: filledPremises,
          evidenceLinks,
          attackType: suggestion.attackType,
          targetCQ: (suggestion.cq as any).id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create argument");
      }

      const data = await response.json();

      onComplete?.(data.argument.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function generateArgumentText(): string {
    if (!template) return "";

    let text = "";

    // Add premises
    template.premises.forEach((premise) => {
      const filled = filledPremises[premise.key];
      if (filled && filled.trim() !== "") {
        text += filled + "\n\n";
      }
    });

    // Add conclusion
    text += "Therefore, " + template.conclusion;

    return text.trim();
  }

  // Render
  if (isLoadingTemplate) {
    return <LoadingSkeleton />;
  }

  if (error && !template) {
    return <ErrorState error={error} onRetry={loadTemplate} />;
  }

  if (!template) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <WizardProgress
        currentStep={currentStep}
        onStepClick={goToStep}
        score={score?.overallScore}
      />

      {/* Step content */}
      <Card>
        {currentStep === "overview" && (
          <OverviewStep
            suggestion={suggestion}
            template={template}
            onNext={nextStep}
            onCancel={onCancel}
          />
        )}

        {currentStep === "premises" && (
          <PremisesStep
            template={template}
            filledPremises={filledPremises}
            onPremiseChange={(key, value) => {
              setFilledPremises((prev) => ({ ...prev, [key]: value }));
            }}
            score={score}
            isScoring={isScoring}
            onNext={nextStep}
            onBack={previousStep}
            canProceed={canProceed()}
          />
        )}

        {currentStep === "evidence" && (
          <EvidenceStep
            template={template}
            filledPremises={filledPremises}
            evidenceLinks={evidenceLinks}
            onEvidenceChange={setEvidenceLinks}
            onNext={nextStep}
            onBack={previousStep}
          />
        )}

        {currentStep === "review" && (
          <ReviewStep
            template={template}
            filledPremises={filledPremises}
            evidenceLinks={evidenceLinks}
            score={score}
            suggestion={suggestion}
            onSubmit={handleSubmit}
            onBack={previousStep}
            isSubmitting={isSubmitting}
            error={error}
            canSubmit={canProceed()}
          />
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface WizardProgressProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
  score?: number;
}

function WizardProgress({ currentStep, onStepClick, score }: WizardProgressProps) {
  const steps = [
    { key: "overview" as const, label: "Overview", icon: FileText },
    { key: "premises" as const, label: "Premises", icon: Lightbulb },
    { key: "evidence" as const, label: "Evidence", icon: Upload },
    { key: "review" as const, label: "Review", icon: Eye },
  ];

  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  const progress = ((currentIdx + 1) / steps.length) * 100;

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />

      <div className="flex justify-between">
        {steps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isCompleted = idx < currentIdx;
          const Icon = step.icon;

          return (
            <button
              key={step.key}
              onClick={() => onStepClick(step.key)}
              className={`flex flex-col items-center gap-2 transition-all ${
                isActive
                  ? "text-sky-600"
                  : isCompleted
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
              disabled={idx > currentIdx}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  isActive
                    ? "border-sky-600 bg-sky-600 text-white"
                    : isCompleted
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-muted bg-background"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Score display */}
      {score !== undefined && score > 0 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Argument Quality:</span>
          <Badge
            variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}
            className={score >= 70 ? "bg-green-600" : score >= 40 ? "bg-amber-600" : ""}
          >
            {Math.round(score)}%
          </Badge>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Overview Step
// ============================================================================

interface OverviewStepProps {
  suggestion: AttackSuggestion;
  template: ArgumentTemplate;
  onNext: () => void;
  onCancel?: () => void;
}

function OverviewStep({ suggestion, template, onNext, onCancel }: OverviewStepProps) {
  const cqQuestion = (suggestion.cq as any).question || (suggestion.cq as any).text || "Critical Question";
  const burdenOfProof = String(suggestion.burdenOfProof || "").toLowerCase();
  
  return (
    <>
      <CardHeader>
        <CardTitle>Attack Strategy Overview</CardTitle>
        <CardDescription>
          Understanding your attack approach and what you&apos;ll need
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Attack summary */}
        <div className="space-y-3">
          <h3 className="font-medium">Critical Question</h3>
          <p className="text-lg">{cqQuestion}</p>

          <div className="flex items-center gap-2">
            <Badge className="bg-sky-600">{suggestion.attackType}</Badge>
            <Badge variant="outline">{suggestion.targetScope}</Badge>
          </div>
        </div>

        <Separator />

        {/* Reasoning */}
        <div className="space-y-3">
          <h3 className="font-medium">Why This Attack Works</h3>
          <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
        </div>

        <Separator />

        {/* Construction steps preview */}
        <div className="space-y-3">
          <h3 className="font-medium">Construction Steps</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            {(template.constructionSteps || []).slice(0, 3).map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
            {(template.constructionSteps || []).length > 3 && (
              <li className="text-xs italic">
                +{template.constructionSteps.length - 3} more steps
              </li>
            )}
          </ol>
        </div>

        <Separator />

        {/* Evidence requirements preview */}
        <div className="space-y-3">
          <h3 className="font-medium">Evidence You&apos;ll Need</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            {(template.evidenceRequirements || []).slice(0, 3).map((req, idx) => (
              <li key={idx}>{req}</li>
            ))}
            {(template.evidenceRequirements || []).length > 3 && (
              <li className="text-xs italic">
                +{template.evidenceRequirements.length - 3} more types
              </li>
            )}
          </ul>
        </div>

        {/* Burden indicator */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {burdenOfProof === "proponent" ? (
              <span className="text-green-700">
                ✅ <strong>Burden Advantage:</strong> Just asking this question shifts burden
                back to the original arguer.
              </span>
            ) : suggestion.requiresEvidence ? (
              <span className="text-red-700">
                ⚠️ <strong>You bear burden of proof:</strong> You must provide strong evidence
                to make this attack succeed.
              </span>
            ) : (
              <span className="text-amber-700">
                ⚠️ <strong>Moderate difficulty:</strong> Some evidence needed, but bar is not
                high.
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4 py-2"
          >
            Begin Construction <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ============================================================================
// Premises Step
// ============================================================================

interface PremisesStepProps {
  template: ArgumentTemplate;
  filledPremises: Record<string, string>;
  onPremiseChange: (key: string, value: string) => void;
  score: any;
  isScoring: boolean;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

function PremisesStep({
  template,
  filledPremises,
  onPremiseChange,
  score,
  isScoring,
  onNext,
  onBack,
  canProceed,
}: PremisesStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Fill in Premises</CardTitle>
        <CardDescription>
          Complete each premise with specific evidence and details
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Premises */}
        {template.premises.map((premise, idx) => (
          <div key={premise.key} className="space-y-3">
            <div className="flex items-start justify-between">
              <Label htmlFor={premise.key} className="text-base">
                Premise {idx + 1}
                {premise.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {score?.premiseScores?.[premise.key] !== undefined && (
                <Badge
                  variant={
                    score.premiseScores[premise.key] >= 70
                      ? "default"
                      : score.premiseScores[premise.key] >= 40
                      ? "secondary"
                      : "destructive"
                  }
                  className={
                    score.premiseScores[premise.key] >= 70
                      ? "bg-green-600"
                      : score.premiseScores[premise.key] >= 40
                      ? "bg-amber-600"
                      : ""
                  }
                >
                  {Math.round(score.premiseScores[premise.key])}%
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground italic">{premise.content}</p>

            {premise.evidenceType && (
              <p className="text-xs text-muted-foreground">
                Evidence type: <span className="font-medium">{premise.evidenceType}</span>
              </p>
            )}

            <Textarea
              id={premise.key}
              value={filledPremises[premise.key] || ""}
              onChange={(e) => onPremiseChange(premise.key, e.target.value)}
              placeholder={`Enter ${premise.required ? "required" : "optional"} premise...`}
              rows={4}
              className="resize-none"
            />

            {/* Individual premise feedback */}
            {score?.premiseScores?.[premise.key] !== undefined &&
              filledPremises[premise.key] &&
              score.premiseScores[premise.key] < 50 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This premise could be stronger. Try adding more specific details, names,
                    dates, or citations.
                  </AlertDescription>
                </Alert>
              )}
          </div>
        ))}

        <Separator />

        {/* Overall feedback */}
        {score && (
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggestions for Improvement
            </h3>

            {score.missingElements && score.missingElements.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {score.missingElements.map((element: string, idx: number) => (
                      <li key={idx}>{element}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {score.suggestions && score.suggestions.length > 0 && (
              <div className="space-y-2">
                {score.suggestions.map((suggestion: string, idx: number) => (
                  <div
                    key={idx}
                    className="text-sm text-muted-foreground bg-muted p-2 rounded flex items-start gap-2"
                  >
                    <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scoring indicator */}
        {isScoring && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Analyzing argument quality...</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </button>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4 py-2"
          >
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>

        {!canProceed && (
          <p className="text-sm text-muted-foreground text-center">
            Complete all required premises to continue
          </p>
        )}
      </CardContent>
    </>
  );
}

// ============================================================================
// Evidence Step
// ============================================================================

interface EvidenceStepProps {
  template: ArgumentTemplate;
  filledPremises: Record<string, string>;
  evidenceLinks: Record<string, string[]>;
  onEvidenceChange: (links: Record<string, string[]>) => void;
  onNext: () => void;
  onBack: () => void;
}

function EvidenceStep({
  template,
  filledPremises,
  evidenceLinks,
  onEvidenceChange,
  onNext,
  onBack,
}: EvidenceStepProps) {
  const [newLinks, setNewLinks] = useState<Record<string, string>>({});

  function addEvidenceLink(premiseKey: string) {
    const link = newLinks[premiseKey];
    if (!link || link.trim() === "") return;

    onEvidenceChange({
      ...evidenceLinks,
      [premiseKey]: [...(evidenceLinks[premiseKey] || []), link.trim()],
    });

    // Clear input
    setNewLinks((prev) => ({ ...prev, [premiseKey]: "" }));
  }

  function removeEvidenceLink(premiseKey: string, idx: number) {
    const updated = [...(evidenceLinks[premiseKey] || [])];
    updated.splice(idx, 1);
    onEvidenceChange({
      ...evidenceLinks,
      [premiseKey]: updated,
    });
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Add Supporting Evidence</CardTitle>
        <CardDescription>
          Optional: Link to sources, studies, or documents that support your premises
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {template.premises
          .filter((p) => filledPremises[p.key])
          .map((premise, idx) => (
            <div key={premise.key} className="space-y-3">
              <h3 className="font-medium">Premise {idx + 1}: Evidence Links</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {filledPremises[premise.key]}
              </p>

              {/* Existing links */}
              {evidenceLinks[premise.key]?.map((link, linkIdx) => (
                <div key={linkIdx} className="flex items-center gap-2 bg-muted p-2 rounded">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-sky-600 hover:underline truncate"
                  >
                    {link}
                  </a>
                  <button
                    onClick={() => removeEvidenceLink(premise.key, linkIdx)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Add new link */}
              <div className="flex items-center gap-2">
                <Input
                  value={newLinks[premise.key] || ""}
                  onChange={(e) =>
                    setNewLinks((prev) => ({ ...prev, [premise.key]: e.target.value }))
                  }
                  placeholder="https://example.com/source"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEvidenceLink(premise.key);
                    }
                  }}
                />
                <button
                  onClick={() => addEvidenceLink(premise.key)}
                  disabled={!newLinks[premise.key] || newLinks[premise.key].trim() === ""}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3"
                >
                  Add
                </button>
              </div>
            </div>
          ))}

        <Separator />

        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Tip:</strong> Adding credible sources strengthens your argument and shows
            you&apos;ve done research. Links to academic papers, news articles, or official
            documents are especially valuable.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4 py-2"
          >
            Continue to Review <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ============================================================================
// Review Step
// ============================================================================

interface ReviewStepProps {
  template: ArgumentTemplate;
  filledPremises: Record<string, string>;
  evidenceLinks: Record<string, string[]>;
  score: any;
  suggestion: AttackSuggestion;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
  canSubmit: boolean;
}

function ReviewStep({
  template,
  filledPremises,
  evidenceLinks,
  score,
  suggestion,
  onSubmit,
  onBack,
  isSubmitting,
  error,
  canSubmit,
}: ReviewStepProps) {
  const totalEvidence = Object.values(evidenceLinks).reduce(
    (sum, links) => sum + links.length,
    0
  );

  return (
    <>
      <CardHeader>
        <CardTitle>Review Your Attack</CardTitle>
        <CardDescription>Check everything before submitting</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Score summary */}
        <div className="space-y-3">
          <h3 className="font-medium">Argument Quality</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress
                value={score?.overallScore || 0}
                className={`h-2 ${
                  (score?.overallScore || 0) >= 70
                    ? "[&>*]:bg-green-600"
                    : (score?.overallScore || 0) >= 40
                    ? "[&>*]:bg-amber-600"
                    : "[&>*]:bg-red-600"
                }`}
              />
            </div>
            <Badge
              variant={
                (score?.overallScore || 0) >= 70
                  ? "default"
                  : (score?.overallScore || 0) >= 40
                  ? "secondary"
                  : "destructive"
              }
              className={`text-lg px-3 py-1 ${
                (score?.overallScore || 0) >= 70
                  ? "bg-green-600"
                  : (score?.overallScore || 0) >= 40
                  ? "bg-amber-600"
                  : ""
              }`}
            >
              {Math.round(score?.overallScore || 0)}%
            </Badge>
          </div>

          {(score?.overallScore || 0) < 70 && (
            <Alert variant={(score?.overallScore || 0) < 40 ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(score?.overallScore || 0) < 40
                  ? "Your argument needs more work before submission. Go back and add more detail."
                  : "Your argument is acceptable but could be stronger. Consider adding more evidence or detail."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Argument preview */}
        <div className="space-y-3">
          <h3 className="font-medium">Your Argument</h3>

          <div className="bg-muted p-4 rounded-lg space-y-4">
            {/* Attack type */}
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-600">{suggestion.attackType}</Badge>
              <Badge variant="outline">{suggestion.targetScope}</Badge>
            </div>

            {/* Premises */}
            {template.premises
              .filter((p) => filledPremises[p.key])
              .map((premise, idx) => (
                <div key={premise.key} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Premise {idx + 1}
                  </div>
                  <div className="text-sm">{filledPremises[premise.key]}</div>
                  {evidenceLinks[premise.key] && evidenceLinks[premise.key].length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📎 {evidenceLinks[premise.key].length} evidence link(s)
                    </div>
                  )}
                </div>
              ))}

            {/* Conclusion */}
            <div className="space-y-1 border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground">Conclusion</div>
              <div className="text-sm font-medium">Therefore, {template.conclusion}</div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <span>
                {template.premises.filter((p) => filledPremises[p.key]).length}/
                {template.premises.length} premises
              </span>
              <span>•</span>
              <span>{totalEvidence} evidence links</span>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>Submit Attack</>
            )}
          </button>
        </div>

        {!canSubmit && !isSubmitting && (
          <p className="text-sm text-muted-foreground text-center">
            Improve your argument quality to at least 40% before submitting
          </p>
        )}
      </CardContent>
    </>
  );
}

// ============================================================================
// Loading & Error States
// ============================================================================

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg font-medium mb-2">Failed to load template</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4 py-2"
        >
          Try Again
        </button>
      </CardContent>
    </Card>
  );
}
