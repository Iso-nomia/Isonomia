// components/argumentation/AttackArgumentWizard.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  Maximize2,
} from "lucide-react";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import CitationCollector, { type PendingCitation } from "@/components/citations/CitationCollector";
import type { AttackSuggestion } from "@/app/server/services/ArgumentGenerationService";
import { Textarea } from "../ui/textarea";
// ============================================================================
// Types
// ============================================================================

type WizardStep = "overview" | "response" | "evidence" | "review";

interface AttackArgumentWizardProps {
  suggestion: AttackSuggestion;
  targetArgumentId: string;
  targetClaimId: string;
  deliberationId: string;
  currentUserId: string;
  onComplete?: (claimId: string) => void;
  onCancel?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * AttackArgumentWizard
 * 
 * Simplified wizard for creating CQ-based attacks following the SchemeSpecificCQsModal pattern:
 * 1. User writes response text to the Critical Question
 * 2. User optionally adds evidence links
 * 3. System creates new Claim from response text
 * 4. System creates ConflictApplication linking claim → target argument
 * 
 * This follows UNDERCUTS pattern from SchemeSpecificCQsModal where user writes text
 * that becomes a claim, then that claim attacks the target.
 */
export function AttackArgumentWizard({
  suggestion,
  targetArgumentId,
  targetClaimId,
  deliberationId,
  currentUserId,
  onComplete,
  onCancel,
}: AttackArgumentWizardProps) {
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>("overview");
  const [attackText, setAttackText] = useState<string>("");
  const [pendingCitations, setPendingCitations] = useState<PendingCitation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedComposer, setExpandedComposer] = useState(false);

  // Simple text quality estimate (character count based)
  const textQuality = Math.min(100, Math.floor((attackText.trim().length / 200) * 100));

  // Navigation
  function nextStep() {
    const steps: WizardStep[] = ["overview", "response", "evidence", "review"];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx < steps.length - 1) {
      setCurrentStep(steps[currentIdx + 1]);
    }
  }

  function previousStep() {
    const steps: WizardStep[] = ["overview", "response", "evidence", "review"];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx > 0) {
      setCurrentStep(steps[currentIdx - 1]);
    }
  }

  function goToStep(step: WizardStep) {
    setCurrentStep(step);
  }

  // Validation
  function canProceed(): boolean {
    switch (currentStep) {
      case "overview":
        return true;
      case "response":
        return attackText.trim().length >= 20; // Minimum 20 characters
      case "evidence":
        return true; // Evidence is optional
      case "review":
        return textQuality >= 20; // Minimum 20% quality
      default:
        return false;
    }
  }

  // Submission
  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log("[AttackArgumentWizard] Starting submission with citations:", pendingCitations);
      
      // Step 1: Create claim from attack text
      const claimRes = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          authorId: currentUserId,
          text: attackText.trim(),
        }),
      });

      if (!claimRes.ok) {
        const data = await claimRes.json();
        throw new Error(data.error || "Failed to create claim");
      }

      const claimData = await claimRes.json();
      const attackClaimId = claimData.claim?.id || claimData.id;
      console.log("[AttackArgumentWizard] Created claim:", attackClaimId);

      // Step 2: Attach citations to the claim (if any)
      if (pendingCitations.length > 0) {
        console.log("[AttackArgumentWizard] Attaching", pendingCitations.length, "citations to claim:", attackClaimId);
        await Promise.all(
          pendingCitations.map(async (citation, idx) => {
            try {
              console.log(`[AttackArgumentWizard] Processing citation ${idx + 1}:`, citation);
              
              // First resolve the source
              let resolvePayload: any = {};
              if (citation.type === "url") {
                resolvePayload = { url: citation.value, meta: { title: citation.title } };
              } else if (citation.type === "doi") {
                resolvePayload = { doi: citation.value };
              } else if (citation.type === "library") {
                resolvePayload = { libraryPostId: citation.value, meta: { title: citation.title } };
              }

              console.log(`[AttackArgumentWizard] Resolving source with payload:`, resolvePayload);
              const resolveRes = await fetch("/api/citations/resolve", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(resolvePayload),
              });
              
              if (!resolveRes.ok) {
                const errorText = await resolveRes.text();
                console.error(`[AttackArgumentWizard] Resolve failed:`, resolveRes.status, errorText);
                throw new Error(`Failed to resolve source: ${resolveRes.status}`);
              }
              
              const { source } = await resolveRes.json();
              console.log(`[AttackArgumentWizard] Resolved source:`, source?.id);

              if (!source?.id) throw new Error("Failed to resolve source");

              // Then attach the citation
              const attachPayload = {
                targetType: "claim",
                targetId: attackClaimId,
                sourceId: source.id,
                locator: citation.locator || undefined,
                quote: citation.quote || "", // API requires string, not null
                note: citation.note || undefined,
              };
              console.log(`[AttackArgumentWizard] Attaching citation with payload:`, attachPayload);
              
              const attachRes = await fetch("/api/citations/attach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(attachPayload),
              });
              
              if (!attachRes.ok) {
                const errorText = await attachRes.text();
                console.error(`[AttackArgumentWizard] Attach failed:`, attachRes.status, errorText);
                throw new Error(`Failed to attach citation: ${attachRes.status}`);
              }
              
              const attachData = await attachRes.json();
              console.log(`[AttackArgumentWizard] Citation ${idx + 1} attached successfully:`, attachData);
            } catch (citErr) {
              console.error(`[AttackArgumentWizard] Failed to attach citation ${idx + 1}:`, citErr);
              // Continue with other citations even if one fails
            }
          })
        );
        console.log("[AttackArgumentWizard] All citations processed");
        // Clear citations after successful attachment
        setPendingCitations([]);
        // Notify listeners that citations changed
        window.dispatchEvent(new CustomEvent("citations:changed", { detail: { targetType: "claim", targetId: attackClaimId } } as any));
      }

      // Step 3: Create ConflictApplication
      const caPayload: any = {
        deliberationId,
        conflictingClaimId: attackClaimId,
        legacyAttackType: suggestion.attackType,
        legacyTargetScope: suggestion.targetScope,
        metaJson: {
          createdVia: "attack-argument-wizard",
          cqKey: (suggestion.cq as any).id || (suggestion.cq as any).key,
          cqText: (suggestion.cq as any).text || (suggestion.cq as any).question,
          schemeId: suggestion.targetSchemeInstance?.schemeId,
          aiGenerated: true,
          suggestionId: suggestion.id,
        },
      };

      // Set target based on attack type
      if (suggestion.attackType === "UNDERCUTS") {
        // Undercuts target the argument's inference
        caPayload.conflictedArgumentId = targetArgumentId;
      } else if (suggestion.attackType === "REBUTS") {
        // Rebuts target the conclusion claim only (not the argument)
        caPayload.conflictedClaimId = targetClaimId;
      } else {
        // UNDERMINES - would need premise selection, default to conclusion for now
        caPayload.conflictedClaimId = targetClaimId;
      }

      console.log("[AttackArgumentWizard] Creating ConflictApplication with payload:", caPayload);
      const caRes = await fetch("/api/ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caPayload),
      });

      if (!caRes.ok) {
        const data = await caRes.json();
        throw new Error(data.error || "Failed to create attack");
      }

      // Step 4: Fire refresh events
      window.dispatchEvent(new CustomEvent("claims:changed", { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent("arguments:changed", { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh", { detail: { deliberationId } } as any));

      // Complete
      onComplete?.(attackClaimId);
    } catch (err: any) {
      console.error("[AttackArgumentWizard] Submission error:", err);
      setError(err.message || "Failed to submit attack");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <WizardProgress
        currentStep={currentStep}
        onStepClick={goToStep}
        quality={textQuality}
      />

      {/* Step content */}
      <Card>
        {currentStep === "overview" && (
          <OverviewStep
            suggestion={suggestion}
            onNext={nextStep}
            onCancel={onCancel}
          />
        )}

        {currentStep === "response" && (
          <ResponseStep
            suggestion={suggestion}
            attackText={attackText}
            onTextChange={setAttackText}
            textQuality={textQuality}
            onNext={nextStep}
            onBack={previousStep}
            canProceed={canProceed()}
            deliberationId={deliberationId}
            expandedComposer={expandedComposer}
            onExpandedChange={setExpandedComposer}
            pendingCitations={pendingCitations}
            onCitationsChange={setPendingCitations}
          />
        )}

        {currentStep === "evidence" && (
          <EvidenceStep
            pendingCitations={pendingCitations}
            onCitationsChange={setPendingCitations}
            onNext={nextStep}
            onBack={previousStep}
          />
        )}

        {currentStep === "review" && (
          <ReviewStep
            suggestion={suggestion}
            attackText={attackText}
            pendingCitations={pendingCitations}
            textQuality={textQuality}
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
  quality?: number;
}

function WizardProgress({ currentStep, onStepClick, quality }: WizardProgressProps) {
  const steps = [
    { key: "overview" as const, label: "Overview", icon: FileText },
    { key: "response" as const, label: "Response", icon: Lightbulb },
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

      {/* Quality display */}
      {quality !== undefined && quality > 0 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Response Quality:</span>
          <Badge
            variant={quality >= 70 ? "default" : quality >= 20 ? "secondary" : "destructive"}
            className={quality >= 70 ? "bg-green-600" : quality >= 20 ? "bg-amber-600" : ""}
          >
            {Math.round(quality)}%
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
  onNext: () => void;
  onCancel?: () => void;
}

function OverviewStep({ suggestion, onNext, onCancel }: OverviewStepProps) {
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

        {/* Example attacks */}
        {suggestion.exampleAttacks && suggestion.exampleAttacks.length > 0 && (
          <>
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Example Attacks
              </h3>
              <div className="space-y-2">
                {suggestion.exampleAttacks.slice(0, 3).map((example, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                    &quot;{example}&quot;
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

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
            Begin Writing <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ============================================================================
// Response Step (NEW - replaces Premises step)
// ============================================================================

interface ResponseStepProps {
  suggestion: AttackSuggestion;
  attackText: string;
  onTextChange: (text: string) => void;
  textQuality: number;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  deliberationId: string;
  expandedComposer: boolean;
  onExpandedChange: (expanded: boolean) => void;
  pendingCitations: PendingCitation[];
  onCitationsChange: (citations: PendingCitation[]) => void;
}

function ResponseStep({
  suggestion,
  attackText,
  onTextChange,
  textQuality,
  onNext,
  onBack,
  canProceed,
  deliberationId,
  expandedComposer,
  onExpandedChange,
  pendingCitations,
  onCitationsChange,
}: ResponseStepProps) {
  const cqQuestion = (suggestion.cq as any).question || (suggestion.cq as any).text;

  /**
   * Handle proposition creation from expanded composer
   * Fetches citations from the created proposition and merges them into our pending list
   */
  async function handlePropositionCreated(prop: any) {
    // Extract text
    onTextChange(prop.text);
    
    // Fetch citations attached to this proposition
    try {
      const response = await fetch(`/api/propositions/${prop.id}/citations`);
      if (response.ok) {
        const data = await response.json();
        const propCitations = data.citations || [];
        
        // Convert proposition citations to pending citations format
        const convertedCitations: PendingCitation[] = propCitations.map((cit: any) => {
          // Determine citation type from source
          let type: "url" | "doi" | "library" = "url";
          if (cit.doi) {
            type = "doi";
          } else if (cit.platform === "library") {
            type = "library";
          }
          
          return {
            type,
            value: cit.doi || cit.url || cit.id,
            title: cit.title,
            locator: cit.locator,
            quote: cit.quote || cit.text,
            note: cit.note,
          };
        });
        
        // Merge with existing pending citations (avoid duplicates)
        const existingValues = new Set(pendingCitations.map(c => c.value));
        const newCitations = convertedCitations.filter(c => !existingValues.has(c.value));
        
        if (newCitations.length > 0) {
          onCitationsChange([...pendingCitations, ...newCitations]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch proposition citations:", error);
      // Non-fatal - continue with just the text
    }
    
    // Close modal
    onExpandedChange(false);
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Write Your Response</CardTitle>
        <CardDescription>
          Answer the critical question to challenge the argument
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Question reminder */}
        <Alert className="flex gap-2 items-center">
          <Lightbulb className="flex h-4 w-4" />
          <AlertDescription className="flex gap-1.5">
            <span className="flex font-semibold">Question:</span><span className="flex">{cqQuestion}</span> 
          </AlertDescription>
        </Alert>

        {/* Text input with expand button */}
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              value={attackText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Write your response to this critical question... Be specific and provide reasoning."
              rows={5}
              className="resize-none pr-24 articlesearchfield text-sm"
            />
            <Button
              onClick={() => onExpandedChange(true)}
              variant="ghost"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </Button>
          </div>

          {/* Character count */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{attackText.trim().length} characters</span>
            <span className={attackText.trim().length < 20 ? "text-red-500" : ""}>
              Minimum: 20 characters
            </span>
          </div>
        </div>

        {/* Quality meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Response Quality</span>
            <Badge
              variant={textQuality >= 70 ? "default" : textQuality >= 20 ? "secondary" : "destructive"}
              className={textQuality >= 70 ? "bg-green-600" : textQuality >= 20 ? "bg-amber-600" : ""}
            >
              {textQuality}%
            </Badge>
          </div>
          <Progress
            value={textQuality}
            className={`h-2 ${
              textQuality >= 70
                ? "[&>*]:bg-green-600"
                : textQuality >= 20
                ? "[&>*]:bg-amber-600"
                : "[&>*]:bg-red-600"
            }`}
          />
          {textQuality < 20 && (
            <p className="text-xs text-muted-foreground">
              Add more detail to improve quality. Aim for at least 200 characters.
            </p>
          )}
        </div>

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
            Write at least 20 characters to continue
          </p>
        )}
      </CardContent>

      {/* Expanded composer modal */}
      <Dialog open={expandedComposer} onOpenChange={onExpandedChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Compose Attack Response</DialogTitle>
            <DialogDescription>
              Use the rich editor to write your response with glossary linking and citations
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <PropositionComposerPro
              deliberationId={deliberationId}
              onCreated={handlePropositionCreated}
              placeholder={`Write your response to: ${cqQuestion}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Evidence Step
// ============================================================================

interface EvidenceStepProps {
  pendingCitations: PendingCitation[];
  onCitationsChange: (citations: PendingCitation[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function EvidenceStep({
  pendingCitations,
  onCitationsChange,
  onNext,
  onBack,
}: EvidenceStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Add Supporting Evidence</CardTitle>
        <CardDescription>
          Optional: Add citations from URLs, DOIs, or your library to support your response
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Tip:</strong> Adding credible sources strengthens your argument. Citations will
            automatically appear in the Sources tab for easy reference.
          </AlertDescription>
        </Alert>

        {/* Citation collector */}
        <CitationCollector
          citations={pendingCitations}
          onChange={onCitationsChange}
          className="w-full"
        />

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
  suggestion: AttackSuggestion;
  attackText: string;
  pendingCitations: PendingCitation[];
  textQuality: number;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
  canSubmit: boolean;
}

function ReviewStep({
  suggestion,
  attackText,
  pendingCitations,
  textQuality,
  onSubmit,
  onBack,
  isSubmitting,
  error,
  canSubmit,
}: ReviewStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Review Your Attack</CardTitle>
        <CardDescription>Check everything before submitting</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quality summary */}
        <div className="space-y-3">
          <h3 className="font-medium">Response Quality</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress
                value={textQuality}
                className={`h-2 ${
                  textQuality >= 70
                    ? "[&>*]:bg-green-600"
                    : textQuality >= 20
                    ? "[&>*]:bg-amber-600"
                    : "[&>*]:bg-red-600"
                }`}
              />
            </div>
            <Badge
              variant={textQuality >= 70 ? "default" : textQuality >= 20 ? "secondary" : "destructive"}
              className={`text-lg px-3 py-1 ${
                textQuality >= 70 ? "bg-green-600" : textQuality >= 20 ? "bg-amber-600" : ""
              }`}
            >
              {textQuality}%
            </Badge>
          </div>

          {textQuality < 70 && (
            <Alert variant={textQuality < 20 ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {textQuality < 20
                  ? "Your response needs more work before submission. Go back and add more detail."
                  : "Your response is acceptable but could be stronger. Consider adding more detail or evidence."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Attack preview */}
        <div className="space-y-3">
          <h3 className="font-medium">Your Attack</h3>

          <div className="bg-muted p-4 rounded-lg space-y-4">
            {/* Attack type */}
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-600">{suggestion.attackType}</Badge>
              <Badge variant="outline">{suggestion.targetScope}</Badge>
            </div>

            {/* Response text */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Your Response</div>
              <div className="text-sm whitespace-pre-wrap">{attackText}</div>
            </div>

            {/* Citations */}
            {pendingCitations.length > 0 && (
              <div className="space-y-1 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Evidence ({pendingCitations.length} citation{pendingCitations.length !== 1 ? "s" : ""})
                </div>
                <div className="space-y-2">
                  {pendingCitations.map((cit, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded border">
                      <div className="font-medium">
                        {cit.title || cit.value}
                      </div>
                      {cit.locator && (
                        <div className="text-slate-600 mt-0.5">Location: {cit.locator}</div>
                      )}
                      {cit.quote && (
                        <div className="text-slate-600 italic mt-0.5">&quot;{cit.quote}&quot;</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <span>{attackText.trim().length} characters</span>
              <span>•</span>
              <span>{pendingCitations.length} citations</span>
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
            Improve your response quality to at least 20% before submitting
          </p>
        )}
      </CardContent>
    </>
  );
}
