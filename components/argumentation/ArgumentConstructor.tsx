"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  BookOpenText,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit,
  Upload,
  Eye,
  Clock,
  Loader2,
  List,
  Network,
  GitFork,
  Shield,
  Plus,
  X,
  Maximize2,
} from "lucide-react";

import { useArgumentScoring } from "@/hooks/useArgumentScoring";
import CitationCollector, { type PendingCitation } from "@/components/citations/CitationCollector";
import { createClaim } from "@/lib/client/aifApi";
import { SchemeComposerPicker } from "@/components/SchemeComposerPicker";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";

// ============================================================================
// Types
// ============================================================================

export type ArgumentMode = "attack" | "support" | "general";
export type WizardStep = "scheme" | "template" | "premises" | "evidence" | "review";

export type AttackContext =
  | { mode: "REBUTS"; targetClaimId: string; hint?: string }
  | { mode: "UNDERCUTS"; targetArgumentId: string; hint?: string }
  | { mode: "UNDERMINES"; targetPremiseId: string; hint?: string }
  | null;

export interface AttackSuggestion {
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetSchemeInstance?: any;
  cq?: any;
  reasoning?: string;
}

export interface SupportSuggestion {
  schemeId: string;
  reasoning?: string;
}

export interface ArgumentTemplate {
  schemeId: string;
  schemeName: string;
  conclusion: string;
  premises: Array<{
    key: string;
    text: string;
    required: boolean;
    evidenceType?: string;
  }>;
  variables: Record<string, string>;
  constructionSteps: string[];
  evidenceRequirements: string[];
  formalStructure?: {
    majorPremise?: string;
    minorPremise?: string;
    conclusion?: string;
  };
  schemeMetadata?: {
    materialRelation?: string;
    reasoningType?: string;
    clusterTag?: string;
    purpose?: string;
    source?: string;
    slotHints?: Record<string, string>;
    premisesWithVariables?: Array<{
      id: string;
      type: "major" | "minor" | "general";
      text: string;
      variables: string[];
    }>;
  };
}

export interface ArgumentDraft {
  id: string;
  mode: ArgumentMode;
  schemeId: string;
  filledPremises: Record<string, string>;
  evidenceLinks: Record<string, string[]>;
  variables: Record<string, string>;
  lastModified: Date;
}

interface ArgumentConstructorProps {
  mode: ArgumentMode;
  targetId: string; // claimId or argumentId
  deliberationId: string;
  currentUserId: string; // NEW: Required for creating claims
  // For attack mode
  suggestion?: AttackSuggestion;
  attackContext?: AttackContext; // NEW: Structured attack context for CA creation
  // For support mode
  supportSuggestion?: SupportSuggestion;
  // Callbacks
  onComplete?: (argumentId: string) => void;
  onCancel?: () => void;
  onSaveDraft?: (draftId: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function ArgumentConstructor({
  mode,
  targetId,
  deliberationId,
  currentUserId,
  suggestion,
  attackContext,
  supportSuggestion,
  onComplete,
  onCancel,
  onSaveDraft,
}: ArgumentConstructorProps) {
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    mode === "general" ? "scheme" : "template"
  );
  const [selectedScheme, setSelectedScheme] = useState<string | null>(
    (suggestion as any)?.targetSchemeInstance?.scheme?.id ||
      supportSuggestion?.schemeId ||
      null
  );
  const [template, setTemplate] = useState<ArgumentTemplate | null>(null);
  const [filledPremises, setFilledPremises] = useState<Record<string, string>>({});
  const [evidenceLinks, setEvidenceLinks] = useState<Record<string, string[]>>({});
  const [pendingCitations, setPendingCitations] = useState<PendingCitation[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // Disabled until drafts API is implemented
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Claim picker state
  const [showClaimPicker, setShowClaimPicker] = useState<string | null>(null); // premise key or "conclusion"
  const [pickedClaimIds, setPickedClaimIds] = useState<Record<string, string>>({}); // premise key -> claim ID

  // Structured premises state (for schemes with formalStructure)
  const [usesStructuredPremises, setUsesStructuredPremises] = useState(false);
  const [majorPremise, setMajorPremise] = useState<{ id?: string; text: string } | null>(null);
  const [minorPremise, setMinorPremise] = useState<{ id?: string; text: string } | null>(null);

  // Justification field (optional warrant explanation)
  const [justification, setJustification] = useState<string>("");

  // Expanded composer state for PropositionComposerPro modals
  const [expandedComposer, setExpandedComposer] = useState<{
    type: "major" | "minor" | "premise" | "conclusion" | "justification" | null;
    key?: string;
  }>({ type: null });

  // Real-time scoring
  // For general mode, we don't have a targetClaimId yet, so pass null
  const scoringTargetId = mode === "general" ? null : targetId;
  const { score, isScoring } = useArgumentScoring(
    selectedScheme || "",
    scoringTargetId,
    filledPremises
  );

  // Steps configuration based on mode
  const steps = getStepsForMode(mode);
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const body: any = {
        schemeId: selectedScheme,
        targetId,
        mode,
      };

      if (mode === "attack" && suggestion) {
        body.attackType = suggestion.attackType;
        body.targetCQ = (suggestion.cq as any)?.id;
      }

      const response = await fetch("/api/arguments/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to load template");
      }

      const data = await response.json();
      setTemplate(data.template);

      // Initialize conclusion from template
      if (data.template.conclusion) {
        setFilledPremises((prev) => ({
          ...prev,
          conclusion: data.template.conclusion
        }));
      }

      // Detect if scheme uses structured premises (major/minor)
      const hasFormalStructure = 
        data.template.formalStructure?.majorPremise && 
        data.template.formalStructure?.minorPremise;
      setUsesStructuredPremises(!!hasFormalStructure);
      
      console.log("[ArgumentConstructor] Template loaded:", {
        schemeName: data.template.schemeName,
        hasFormalStructure,
        premisesCount: data.template.premises.length
      });

      // Initialize variables
      if (data.template.variables) {
        setVariables(data.template.variables);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedScheme, targetId, mode, suggestion]);

  const loadDraft = useCallback(async () => {
    // Disabled until drafts API is implemented
    return;
    
    /* eslint-disable-next-line no-unreachable */
    try {
      const response = await fetch(
        `/api/arguments/drafts?targetId=${targetId}&mode=${mode}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.draft) {
          setSelectedScheme(data.draft.schemeId);
          setFilledPremises(data.draft.filledPremises || {});
          setEvidenceLinks(data.draft.evidenceLinks || {});
          setVariables(data.draft.variables || {});
          setLastSaved(new Date(data.draft.lastModified));
        }
      }
    } catch (err) {
      console.error("Failed to load draft:", err);
    }
  }, [targetId, mode]);

  const saveDraft = useCallback(async () => {
    // Disabled until drafts API is implemented
    return;
    
    /* eslint-disable-next-line no-unreachable */
    if (!selectedScheme) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/arguments/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          targetId,
          deliberationId,
          schemeId: selectedScheme,
          filledPremises,
          evidenceLinks,
          variables,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLastSaved(new Date());
        onSaveDraft?.(data.draft.id);
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedScheme,
    mode,
    targetId,
    deliberationId,
    filledPremises,
    evidenceLinks,
    variables,
    onSaveDraft,
  ]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!autoSaveEnabled || !selectedScheme) return;

    const timer = setTimeout(() => {
      saveDraft();
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [filledPremises, evidenceLinks, variables, autoSaveEnabled, selectedScheme, saveDraft]);

  // Load existing draft on mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Load template when scheme is selected
  useEffect(() => {
    if (selectedScheme && !template) {
      loadTemplate();
    }
  }, [selectedScheme, template, loadTemplate]);

  // Navigation
  function goToStep(step: WizardStep) {
    if (steps.indexOf(step) <= currentStepIndex) {
      setCurrentStep(step);
    }
  }

  function nextStep() {
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStep(steps[nextIdx]);
    }
  }

  function previousStep() {
    const prevIdx = currentStepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(steps[prevIdx]);
    }
  }

  // Validation
  function canProceed(): boolean {
    if (!template) return false;

    switch (currentStep) {
      case "scheme":
        return selectedScheme !== null;
      case "template":
        return Object.keys(variables).every((key) => variables[key]?.trim());
      case "premises":
        const requiredPremises = template.premises.filter((p) => p.required);
        return requiredPremises.every((p) => filledPremises[p.key]?.trim());
      case "evidence":
        return true; // Evidence is optional
      case "review":
        return score !== null && score.overallScore >= 40;
      default:
        return false;
    }
  }

  // Claim picker handler
  function handleClaimPicked(item: { id: string; label: string }, premiseKey: string) {
    // Store the picked claim ID
    setPickedClaimIds(prev => ({ ...prev, [premiseKey]: item.id }));
    // Fill the premise text with the claim's text
    setFilledPremises(prev => ({ ...prev, [premiseKey]: item.label }));
    // Close picker
    setShowClaimPicker(null);
  }

  // Helper to create ConflictApplication record for attacks
  async function postCA(body: any) {
    const response = await fetch("/api/ca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }
    return result;
  }

  // Submission
  async function handleSubmit() {
    if (!template) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("[ArgumentConstructor] Starting argument creation...");
      
      // Step 1: Create Claims for premises (or use picked claims)
      const premiseClaimIds: string[] = [];
      for (const premise of template.premises) {
        const premiseText = filledPremises[premise.key];
        if (!premiseText || !premiseText.trim()) {
          throw new Error(`Missing required premise: ${premise.key}`);
        }
        
        // Check if user picked an existing claim for this premise
        if (pickedClaimIds[premise.key]) {
          console.log(`[ArgumentConstructor] Using picked claim for premise ${premise.key}:`, pickedClaimIds[premise.key]);
          premiseClaimIds.push(pickedClaimIds[premise.key]);
        } else {
          // Create new claim
          console.log(`[ArgumentConstructor] Creating claim for premise ${premise.key}:`, premiseText);
          const claimId = await createClaim({
            deliberationId,
            authorId: currentUserId,
            text: premiseText.trim(),
          });
          premiseClaimIds.push(claimId);
        }
      }
      
      console.log("[ArgumentConstructor] Premise claims:", premiseClaimIds);

      // Step 2: Create or get conclusion Claim
      let conclusionClaimId: string;
      // Use edited conclusion from filledPremises if available, otherwise fall back to template
      const conclusionText = (filledPremises.conclusion || template.conclusion).trim();
      
      // For attack/support modes, conclusion might already exist or be derived
      if (mode === "attack" || mode === "support") {
        // For now, create a new claim for the conclusion
        // TODO: In future, may want to reference existing target claim
        console.log("[ArgumentConstructor] Creating conclusion claim:", conclusionText);
        conclusionClaimId = await createClaim({
          deliberationId,
          authorId: currentUserId,
          text: conclusionText,
        });
      } else {
        // General mode: create conclusion claim
        console.log("[ArgumentConstructor] Creating conclusion claim:", conclusionText);
        conclusionClaimId = await createClaim({
          deliberationId,
          authorId: currentUserId,
          text: conclusionText,
        });
      }
      
      console.log("[ArgumentConstructor] Created conclusion claim:", conclusionClaimId);

      // Step 3: Create argument with claim IDs
      const argumentText = generateArgumentText();
      console.log("[ArgumentConstructor] Creating argument with", premiseClaimIds.length, "premises");
      
      const response = await fetch("/api/arguments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          authorId: currentUserId,
          conclusionClaimId,
          premiseClaimIds,
          schemeId: selectedScheme,
          text: argumentText,
          attackType: mode === "attack" ? suggestion?.attackType : undefined,
          implicitWarrant: justification.trim() ? { text: justification.trim() } : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit argument");
      }

      const data = await response.json();
      const argumentId = data.argument.id;
      console.log("[ArgumentConstructor] Created argument:", argumentId);

      // Step 4: Create ConflictApplication if this is an attack
      if (attackContext || (mode === "attack" && suggestion)) {
        console.log("[ArgumentConstructor] Creating ConflictApplication for attack");
        
        try {
          // Determine attack details from attackContext or suggestion
          const attackType = attackContext?.mode || suggestion?.attackType;
          
          if (attackContext?.mode === "REBUTS") {
            await postCA({
              deliberationId,
              conflictingClaimId: conclusionClaimId,
              conflictedClaimId: attackContext.targetClaimId,
              legacyAttackType: "REBUTS",
              legacyTargetScope: "conclusion",
            });
            console.log("[ArgumentConstructor] Created REBUTS ConflictApplication");
          } else if (attackContext?.mode === "UNDERCUTS") {
            await postCA({
              deliberationId,
              conflictingClaimId: conclusionClaimId,
              conflictedArgumentId: attackContext.targetArgumentId,
              legacyAttackType: "UNDERCUTS",
              legacyTargetScope: "inference",
            });
            console.log("[ArgumentConstructor] Created UNDERCUTS ConflictApplication");
          } else if (attackContext?.mode === "UNDERMINES") {
            await postCA({
              deliberationId,
              conflictingClaimId: conclusionClaimId,
              conflictedClaimId: attackContext.targetPremiseId,
              legacyAttackType: "UNDERMINES",
              legacyTargetScope: "premise",
            });
            console.log("[ArgumentConstructor] Created UNDERMINES ConflictApplication");
          } else if (mode === "attack" && suggestion?.attackType) {
            // Fallback to suggestion-based attack (using targetId)
            // Assume targetId is the claim or argument being attacked
            const isArgumentAttack = suggestion.attackType === "UNDERCUTS";
            
            await postCA({
              deliberationId,
              conflictingClaimId: conclusionClaimId,
              ...(isArgumentAttack 
                ? { conflictedArgumentId: targetId }
                : { conflictedClaimId: targetId }
              ),
              legacyAttackType: suggestion.attackType,
              legacyTargetScope: 
                suggestion.attackType === "REBUTS" ? "conclusion" :
                suggestion.attackType === "UNDERCUTS" ? "inference" :
                "premise",
            });
            console.log(`[ArgumentConstructor] Created ${suggestion.attackType} ConflictApplication (fallback)`);
          }
        } catch (caError) {
          console.error("[ArgumentConstructor] Failed to create ConflictApplication:", caError);
          // Don't fail the whole submission if CA creation fails
          setError(`Warning: Argument created but attack link failed: ${caError instanceof Error ? caError.message : "Unknown error"}`);
        }
      }

      // Attach citations to the argument (if any)
      if (pendingCitations.length > 0) {
        console.log("[ArgumentConstructor] Attaching citations to argument:", argumentId);
        await Promise.allSettled(
          pendingCitations.map(async (citation, idx) => {
            try {
              console.log(`[ArgumentConstructor] Processing citation ${idx + 1}:`, citation);
              
              // Validate citation has required fields
              if (!citation || !citation.type || !citation.value) {
                console.warn(`[ArgumentConstructor] Citation ${idx + 1} missing required fields, skipping`);
                return;
              }
              
              // First resolve the source
              let resolvePayload: any = {};
              if (citation.type === "url") {
                resolvePayload = { url: citation.value, meta: { title: citation.title } };
              } else if (citation.type === "doi") {
                resolvePayload = { doi: citation.value };
              } else if (citation.type === "library") {
                resolvePayload = { libraryPostId: citation.value, meta: { title: citation.title } };
              } else {
                console.warn(`[ArgumentConstructor] Unknown citation type: ${citation.type}, skipping`);
                return;
              }

              const resolveRes = await fetch("/api/citations/resolve", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(resolvePayload),
              });
              
              if (!resolveRes.ok) {
                console.error(`[ArgumentConstructor] Resolve failed:`, resolveRes.status);
                return;
              }
              
              const resolveData = await resolveRes.json();
              console.log(`[ArgumentConstructor] Resolve response:`, resolveData);
              
              const source = resolveData?.source;
              if (!source || !source.id) {
                console.warn(`[ArgumentConstructor] No valid source returned for citation ${idx + 1}`);
                return;
              }

              // Then attach the citation to the argument
              const attachPayload = {
                targetType: "argument",
                targetId: argumentId,
                sourceId: source.id,
                locator: citation.locator || undefined,
                quote: citation.quote || "",
                note: citation.note || undefined,
              };
              
              const attachRes = await fetch("/api/citations/attach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(attachPayload),
              });
              
              if (!attachRes.ok) {
                console.error(`[ArgumentConstructor] Attach failed:`, attachRes.status);
                return;
              }
              
              console.log(`[ArgumentConstructor] Citation ${idx + 1} attached successfully`);
            } catch (citErr) {
              console.error(`[ArgumentConstructor] Failed to attach citation ${idx + 1}:`, citErr);
            }
          })
        );
        
        console.log("[ArgumentConstructor] All citations processed");
        setPendingCitations([]);
        window.dispatchEvent(new CustomEvent("citations:changed", { detail: { targetType: "argument", targetId: argumentId } } as any));
      }

      // Note: Draft deletion disabled until drafts API is implemented
      // Delete draft after successful submission
      // try {
      //   await fetch(`/api/arguments/drafts?targetId=${targetId}&mode=${mode}`, {
      //     method: "DELETE",
      //   });
      // } catch (err) {
      //   console.error("Failed to delete draft:", err);
      // }

      onComplete?.(data.argument.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function generateArgumentText(): string {
    if (!template) return "";

    let text = "";

    template.premises.forEach((premise) => {
      const filled = filledPremises[premise.key];
      if (filled) {
        text += filled + " ";
      }
    });

    text += "Therefore, " + template.conclusion;

    return text.trim();
  }

  // Render
  if (isLoading && !template && currentStep !== "scheme") {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header with auto-save indicator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {mode === "attack" && "Build Attack"}
                {mode === "support" && "Build Support"}
                {mode === "general" && "Build Argument"}
              </CardTitle>
              <CardDescription>
                {mode === "attack" &&
                  "Construct a strategic attack using argumentation theory"}
                {mode === "support" &&
                  "Strengthen an argument with supporting evidence"}
                {mode === "general" && "Create a well-structured argument"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-save indicator - hidden until drafts API is implemented */}
              {autoSaveEnabled && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : lastSaved ? (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Saved {formatRelativeTime(lastSaved)}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Not saved</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => saveDraft()}
                    className="flex items-center gap-2 py-1.5 px-3 rounded border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 text-sm transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress indicator */}
      <WizardProgress
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
        mode={mode}
      />

      {/* Step content */}
      <Card>
        {currentStep === "scheme" && (
          <SchemeSelectionStep
            deliberationId={deliberationId}
            targetId={targetId}
            selectedScheme={selectedScheme}
            onSchemeSelect={setSelectedScheme}
            onNext={nextStep}
            onCancel={onCancel}
          />
        )}

        {currentStep === "template" && (
          <TemplateCustomizationStep
            template={template}
            variables={variables}
            onVariableChange={(key, value) =>
              setVariables((prev) => ({ ...prev, [key]: value }))
            }
            conclusion={filledPremises.conclusion || template?.conclusion || ""}
            onConclusionChange={(value) =>
              setFilledPremises((prev) => ({ ...prev, conclusion: value }))
            }
            justification={justification}
            onJustificationChange={setJustification}
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

        {currentStep === "premises" && template && (
          <PremisesFillingStep
            template={template}
            filledPremises={filledPremises}
            pickedClaimIds={pickedClaimIds}
            onPremiseChange={(key, value) =>
              setFilledPremises((prev) => ({ ...prev, [key]: value }))
            }
            onPickExistingClaim={(premiseKey) => setShowClaimPicker(premiseKey)}
            score={score}
            isScoring={isScoring}
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

        {currentStep === "evidence" && template && (
          <EvidenceCollectionStep
            template={template}
            evidenceLinks={evidenceLinks}
            pendingCitations={pendingCitations}
            onEvidenceChange={(key, links) =>
              setEvidenceLinks((prev) => ({ ...prev, [key]: links }))
            }
            onCitationsChange={setPendingCitations}
            onNext={nextStep}
            onBack={previousStep}
          />
        )}

        {currentStep === "review" && template && (
          <ReviewSubmitStep
            mode={mode}
            template={template}
            filledPremises={filledPremises}
            evidenceLinks={evidenceLinks}
            pendingCitations={pendingCitations}
            score={score}
            isSubmitting={isLoading}
            error={error}
            onSubmit={handleSubmit}
            onBack={previousStep}
            onCancel={onCancel}
          />
        )}
      </Card>

      {/* Claim Picker Modal */}
      {showClaimPicker && (
        <SchemeComposerPicker
          kind="claim"
          open={showClaimPicker !== null}
          onClose={() => setShowClaimPicker(null)}
          onPick={(item) => handleClaimPicked(item, showClaimPicker)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Wizard Progress
// ============================================================================

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
  mode: ArgumentMode;
}

function WizardProgress({
  steps,
  currentStep,
  onStepClick,
  mode,
}: WizardProgressProps) {
  const currentIdx = steps.indexOf(currentStep);
  const progress = ((currentIdx + 1) / steps.length) * 100;

  const stepConfig: Record<
    WizardStep,
    { label: string; icon: React.ComponentType<any> }
  > = {
    scheme: { label: "Select Scheme", icon: GitFork },
    template: { label: "Customize", icon: FileText },
    premises: { label: "Fill Premises", icon: Edit },
    evidence: { label: "Add Evidence", icon: BookOpenText },
    review: { label: "Review", icon: Eye },
  };

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const config = stepConfig[step];
          const Icon = config.icon;
          const isActive = step === currentStep;
          const isCompleted = idx < currentIdx;
          const isClickable = idx <= currentIdx;

          return (
            <button
              key={step}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-2 flex-1 py-2 px-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-sky-50 text-sky-700"
                  : isCompleted
                  ? "text-green-700 hover:bg-green-50"
                  : "text-muted-foreground cursor-not-allowed"
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  isActive
                    ? "bg-sky-600 text-white"
                    : isCompleted
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Scheme Selection Step (for general mode)
// ============================================================================

interface SchemeSelectionStepProps {
  deliberationId: string;
  targetId: string;
  selectedScheme: string | null;
  onSchemeSelect: (schemeId: string) => void;
  onNext: () => void;
  onCancel?: () => void;
}

function SchemeSelectionStep({
  deliberationId,
  targetId,
  selectedScheme,
  onSchemeSelect,
  onNext,
  onCancel,
}: SchemeSelectionStepProps) {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSchemes();
  }, []);

  async function loadSchemes() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/schemes/all");
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not { schemes: [...] }
        setSchemes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load schemes:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredSchemes = schemes.filter(
    (scheme) =>
      scheme?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <CardHeader>
        <CardTitle>Select Argumentation Scheme</CardTitle>
        <CardDescription>
          Choose the type of argument you want to construct
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div>
          <Input
            placeholder="Search schemes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Scheme list */}
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : filteredSchemes.length > 0 ? (
              filteredSchemes.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => onSchemeSelect(scheme.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedScheme === scheme.id
                      ? "border-sky-500 bg-sky-50"
                      : "border-gray-200 hover:border-sky-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{scheme.name}</div>
                    <div className="flex gap-1.5">
                      {scheme.materialRelation && (
                        <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-300">
                          {scheme.materialRelation}
                        </Badge>
                      )}
                      {scheme.reasoningType && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                          {scheme.reasoningType}
                        </Badge>
                      )}
                      {scheme.clusterTag && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                          {scheme.clusterTag.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {scheme.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {scheme.description}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No schemes found
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <Separator />
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!selectedScheme}
            className={`flex-1 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
              selectedScheme
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ============================================================================
// Template Customization Step
// ============================================================================

interface TemplateCustomizationStepProps {
  template: ArgumentTemplate | null;
  variables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
  conclusion: string;
  onConclusionChange: (value: string) => void;
  justification: string;
  onJustificationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  deliberationId: string;
  expandedComposer: { type: "major" | "minor" | "premise" | "conclusion" | "justification" | null; key?: string };
  onExpandedChange: (state: { type: "major" | "minor" | "premise" | "conclusion" | "justification" | null; key?: string }) => void;
  pendingCitations: PendingCitation[];
  onCitationsChange: (citations: PendingCitation[]) => void;
}

function TemplateCustomizationStep({
  template,
  variables,
  onVariableChange,
  conclusion,
  onConclusionChange,
  justification,
  onJustificationChange,
  onNext,
  onBack,
  canProceed,
  deliberationId,
  expandedComposer,
  onExpandedChange,
  pendingCitations,
  onCitationsChange,
}: TemplateCustomizationStepProps) {
  if (!template) {
    return (
      <CardContent className="py-12">
        <div className="text-center text-muted-foreground">
          Loading template...
        </div>
      </CardContent>
    );
  }

  const templateVariables = Object.keys(template.variables || {});

  return (
    <>
      <CardHeader>
        <CardTitle>Customize Template</CardTitle>
        <CardDescription>
          Fill in the template variables for your argument
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template info */}
        <Alert>
          
          <AlertDescription>
            <div className="font-medium mb-1">Using: {template.schemeName}</div>
            <div className="text-sm">
              This template will help you structure your argument effectively.
            </div>
          </AlertDescription>
        </Alert>

        {/* Formal Structure Display (if available) */}
        {template.formalStructure && (
          <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-indigo-50 via-purple-50 to-sky-50 border border-indigo-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
              <div className="h-2 w-2 rounded-full bg-indigo-600" />
              Formal Argument Structure
            </div>
            
            {/* Major Premise */}
            {template.formalStructure.majorPremise && (
              <div className="space-y-1 p-3 rounded-md bg-white/60 border border-purple-200">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                    Major Premise
                  </Badge>
                </div>
                <div className="text-sm text-gray-700 pl-2">
                  {template.formalStructure.majorPremise}
                </div>
              </div>
            )}

            {/* Minor Premise */}
            {template.formalStructure.minorPremise && (
              <div className="space-y-1 p-3 rounded-md bg-white/60 border border-sky-200">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-sky-100 text-sky-700 border-sky-300">
                    Minor Premise
                  </Badge>
                </div>
                <div className="text-sm text-gray-700 pl-2">
                  {template.formalStructure.minorPremise}
                </div>
              </div>
            )}

            {/* Conclusion */}
            {template.formalStructure.conclusion && (
              <div className="space-y-1 p-3 rounded-md bg-white/60 border border-indigo-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-indigo-600">∴</span>
                  <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-300">
                    Conclusion
                  </Badge>
                </div>
                <div className="text-sm text-gray-700 pl-2">
                  {template.formalStructure.conclusion}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Editable Conclusion */}
        <div className="space-y-2">
          <Label htmlFor="conclusion" className="text-sm font-semibold">
            Conclusion
          </Label>
          <div className="relative">
            <Textarea
              id="conclusion"
              value={conclusion}
              onChange={(e) => onConclusionChange(e.target.value)}
              placeholder="Enter the conclusion your premises will support..."
              rows={3}
              className="resize-none pr-24 articlesearchfield text-sm"
            />
            <button
              onClick={() => onExpandedChange({ type: "conclusion" })}
              className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-white hover:bg-accent hover:text-accent-foreground h-8 px-3"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </button>
          </div>
        </div>

        {/* Justification / Warrant */}
        <div className="space-y-2">
          <Label htmlFor="justification" className="text-sm font-medium text-gray-700">
            Implicit Warrant <span className="text-xs text-gray-500">(optional)</span>
          </Label>
          <div className="text-xs text-gray-600 mb-1">
            Missing premise that connects premises to conclusion
          </div>
          <div className="relative">
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => onJustificationChange(e.target.value)}
              placeholder="Missing premise or general rule (e.g., 'All X are Y', 'Experts in X are reliable', 'If P then Q')"
              rows={3}
              className="resize-none pr-24 articlesearchfield text-sm"
            />
            <button
              onClick={() => onExpandedChange({ type: "justification" })}
              className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-white hover:bg-accent hover:text-accent-foreground h-8 px-3"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </button>
          </div>
        </div>

        {/* Variables */}
        {templateVariables.length > 0 ? (
          <div className="space-y-4">
            {templateVariables.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key} className="capitalize">
                  {key.replace(/_/g, " ")}
                </Label>
                <Input
                  id={key}
                  value={variables[key] || ""}
                  onChange={(e) => onVariableChange(key, e.target.value)}
                  placeholder={`Enter ${key.replace(/_/g, " ")}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No customization needed for this template
          </div>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
              canProceed
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </CardContent>

      {/* Expanded composer modal */}
      {expandedComposer.type && (
        <Dialog
          open={expandedComposer.type === "conclusion" || expandedComposer.type === "justification"}
          onOpenChange={(open) => !open && onExpandedChange({ type: null })}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>
                {expandedComposer.type === "conclusion" ? "Compose Conclusion" : "Compose Justification"}
              </DialogTitle>
              <DialogDescription>
                {expandedComposer.type === "conclusion"
                  ? "Use the rich editor to write your conclusion with glossary linking and citations"
                  : "Explain the warrant connecting your premises to the conclusion"}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <PropositionComposerPro
                deliberationId={deliberationId}
                onCreated={async (prop: any) => {
                  // Extract text
                  if (expandedComposer.type === "conclusion") {
                    onConclusionChange(prop.text);
                  } else if (expandedComposer.type === "justification") {
                    onJustificationChange(prop.text);
                  }

                  // Fetch citations attached to this proposition
                  try {
                    const response = await fetch(`/api/propositions/${prop.id}/citations`);
                    if (response.ok) {
                      const data = await response.json();
                      const propCitations = data.citations || [];

                      // Convert proposition citations to pending citations format
                      const convertedCitations: PendingCitation[] = propCitations.map((cit: any) => {
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
                  onExpandedChange({ type: null });
                }}
                placeholder={
                  expandedComposer.type === "conclusion"
                    ? "Write your conclusion..."
                    : "Explain why the premises support the conclusion..."
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ============================================================================
// Premises, Evidence, and Review Steps
// ============================================================================

// Note: These components are similar to AttackConstructionWizard steps
// but with mode-specific customizations. For brevity, showing placeholders.

interface PremisesFillingStepProps {
  template: ArgumentTemplate;
  filledPremises: Record<string, string>;
  pickedClaimIds: Record<string, string>;
  onPremiseChange: (key: string, value: string) => void;
  onPickExistingClaim: (premiseKey: string) => void;
  score: any;
  isScoring: boolean;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  deliberationId: string;
  expandedComposer: { type: "major" | "minor" | "premise" | "conclusion" | "justification" | null; key?: string };
  onExpandedChange: (state: { type: "major" | "minor" | "premise" | "conclusion" | "justification" | null; key?: string }) => void;
  pendingCitations: PendingCitation[];
  onCitationsChange: (citations: PendingCitation[]) => void;
}

function PremisesFillingStep({
  template,
  filledPremises,
  pickedClaimIds,
  onPremiseChange,
  onPickExistingClaim,
  score,
  isScoring,
  onNext,
  onBack,
  canProceed,
  deliberationId,
  expandedComposer,
  onExpandedChange,
  pendingCitations,
  onCitationsChange,
}: PremisesFillingStepProps) {
  // Check if this scheme has formal structure (major/minor premises)
  const hasFormalStructure = 
    template.formalStructure?.majorPremise && 
    template.formalStructure?.minorPremise;

  return (
    <>
      <CardHeader>
        <CardTitle>Fill Premises</CardTitle>
        <CardDescription>
          {hasFormalStructure 
            ? "Complete the major and minor premises for this formal argument"
            : "Complete each premise for your argument"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasFormalStructure ? (
          // Structured premise mode (major/minor)
          <>
            <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-900">
                <div className="h-2 w-2 rounded-full bg-indigo-600" />
                Formal Argument Structure
              </div>
              <div className="text-xs text-indigo-700">
                This scheme uses classical logical form with major and minor premises
              </div>
            </div>

            {/* Major Premise */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="major-premise" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                    Major Premise
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {template.formalStructure?.majorPremise}
                  </span>
                  <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => onExpandedChange({ type: "major" })}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  title="Expand to full editor"
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand
                </button>
              </div>
              <Textarea
                id="major-premise"
                value={filledPremises["major"] || ""}
                onChange={(e) => onPremiseChange("major", e.target.value)}
                placeholder="Enter the major (universal) premise..."
                rows={3}
                className="border-purple-200 focus:border-purple-400"
              />
            </div>

            {/* Minor Premise */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="minor-premise" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300">
                    Minor Premise
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {template.formalStructure?.minorPremise}
                  </span>
                  <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => onExpandedChange({ type: "minor" })}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  title="Expand to full editor"
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand
                </button>
              </div>
              <Textarea
                id="minor-premise"
                value={filledPremises["minor"] || ""}
                onChange={(e) => onPremiseChange("minor", e.target.value)}
                placeholder="Enter the minor (specific) premise..."
                rows={3}
                className="border-sky-200 focus:border-sky-400"
              />
            </div>
          </>
        ) : (
          // Standard premise mode (list)
          template.premises.map((premise, index) => {
            // Find matching premise with variables from schemeMetadata
            const premiseWithVars = template.schemeMetadata?.premisesWithVariables?.find(
              (p) => p.id === `P${index + 1}` || p.text.includes(premise.text.substring(0, 20))
            );
            const variables = premiseWithVars?.variables || [];
            const slotHint = template.schemeMetadata?.slotHints?.[premise.key];

            return (
              <div key={premise.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={premise.key} className="capitalize flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {premise.text}
                      {premise.required && <span className="text-red-500 ml-1">*</span>}
                      {slotHint && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                          {slotHint}
                        </Badge>
                      )}
                      {pickedClaimIds[premise.key] && (
                        <Badge variant="secondary" className="text-xs">
                          Using Existing Claim
                        </Badge>
                      )}
                    </div>
                    {variables.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Variables:</span>
                        {variables.map((v) => (
                          <Badge 
                            key={v} 
                            variant="outline" 
                            className="text-xs bg-sky-50 text-sky-700 border-sky-300"
                          >
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onExpandedChange({ type: "premise", key: premise.key })}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      title="Expand to full editor"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Expand
                    </button>
                    <button
                      type="button"
                      onClick={() => onPickExistingClaim(premise.key)}
                      className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                    >
                      {pickedClaimIds[premise.key] ? "Change Claim" : "Pick Existing"}
                    </button>
                  </div>
                </div>
                <Textarea
                  id={premise.key}
                  value={filledPremises[premise.key] || ""}
                  onChange={(e) => onPremiseChange(premise.key, e.target.value)}
                  placeholder={`Enter ${premise.text.toLowerCase()} or pick an existing claim`}
                  rows={3}
                />
                {score?.premiseScores?.[premise.key] !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Progress
                      value={score.premiseScores[premise.key]}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-muted-foreground">
                      {score.premiseScores[premise.key]}%
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {score && (
          <Alert>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Quality:</span>
              <Badge
                className={
                  score.overallScore >= 70
                    ? "bg-green-600"
                    : score.overallScore >= 40
                    ? "bg-amber-600"
                    : "bg-red-600"
                }
              >
                {score.overallScore}%
              </Badge>
            </div>
          </Alert>
        )}

        <Separator />
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
              canProceed
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </CardContent>

      {/* Expanded composer modal for premises */}
      {expandedComposer.type && (expandedComposer.type === "major" || expandedComposer.type === "minor" || expandedComposer.type === "premise") && (
        <Dialog
          open={true}
          onOpenChange={(open) => !open && onExpandedChange({ type: null })}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>
                {expandedComposer.type === "major"
                  ? "Compose Major Premise"
                  : expandedComposer.type === "minor"
                  ? "Compose Minor Premise"
                  : "Compose Premise"}
              </DialogTitle>
              <DialogDescription>
                {expandedComposer.type === "major"
                  ? template.formalStructure?.majorPremise
                  : expandedComposer.type === "minor"
                  ? template.formalStructure?.minorPremise
                  : expandedComposer.key && template.premises.find(p => p.key === expandedComposer.key)?.text}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <PropositionComposerPro
                deliberationId={deliberationId}
                onCreated={async (prop: any) => {
                  // Determine which premise to update
                  const premiseKey = 
                    expandedComposer.type === "major" ? "major" :
                    expandedComposer.type === "minor" ? "minor" :
                    expandedComposer.key || "";

                  // Update premise text
                  onPremiseChange(premiseKey, prop.text);

                  // Fetch citations attached to this proposition
                  try {
                    const response = await fetch(`/api/propositions/${prop.id}/citations`);
                    if (response.ok) {
                      const data = await response.json();
                      const propCitations = data.citations || [];

                      // Convert proposition citations to pending citations format
                      const convertedCitations: PendingCitation[] = propCitations.map((cit: any) => {
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
                  onExpandedChange({ type: null });
                }}
                placeholder={
                  expandedComposer.type === "major"
                    ? "Write the major (universal) premise..."
                    : expandedComposer.type === "minor"
                    ? "Write the minor (specific) premise..."
                    : "Write this premise..."
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

interface EvidenceCollectionStepProps {
  template: ArgumentTemplate;
  evidenceLinks: Record<string, string[]>;
  pendingCitations: PendingCitation[];
  onEvidenceChange: (key: string, links: string[]) => void;
  onCitationsChange: (citations: PendingCitation[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function EvidenceCollectionStep({
  template,
  evidenceLinks,
  pendingCitations,
  onEvidenceChange,
  onCitationsChange,
  onNext,
  onBack,
}: EvidenceCollectionStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Add Evidence</CardTitle>
        <CardDescription>
          Link supporting evidence to your premises (optional)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add credible sources from URLs, DOIs, or your library to strengthen your argument. Citations will automatically appear in the Sources tab.
          </AlertDescription>
        </Alert>

        {/* New: CitationCollector for unified citation management */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Evidence & Citations</Label>
          <CitationCollector
            citations={pendingCitations}
            onChange={onCitationsChange}
          />
        </div>

        <Separator />

        {/* Legacy: Keep evidenceLinks for backward compatibility */}
        {Object.keys(evidenceLinks).length > 0 && (
          <>
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground">
                Legacy Evidence Links (deprecated)
              </Label>
              {template.premises.map((premise) => {
                const links = evidenceLinks[premise.key] || [];
                if (links.length === 0) return null;
                return (
                  <div key={premise.key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{premise.text}</Label>
                    <div className="space-y-2">
                      {links.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input value={link} readOnly className="flex-1 text-sm" />
                          <button
                            onClick={() =>
                              onEvidenceChange(
                                premise.key,
                                links.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-2 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
          >
            Continue to Review
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </>
  );
}

interface ReviewSubmitStepProps {
  mode: ArgumentMode;
  template: ArgumentTemplate;
  filledPremises: Record<string, string>;
  evidenceLinks: Record<string, string[]>;
  pendingCitations: PendingCitation[];
  score: any;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
  onCancel?: () => void;
}

function ReviewSubmitStep({
  mode,
  template,
  filledPremises,
  evidenceLinks,
  pendingCitations,
  score,
  isSubmitting,
  error,
  onSubmit,
  onBack,
  onCancel,
}: ReviewSubmitStepProps) {
  const canSubmit = score && score.overallScore >= 40;

  return (
    <>
      <CardHeader>
        <CardTitle>Review & Submit</CardTitle>
        <CardDescription>
          Review your argument before submission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quality score */}
        {score && (
          <Alert className={score.overallScore >= 70 ? "bg-green-50 border-green-200" : score.overallScore >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}>
            <AlertDescription>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Argument Quality:</span>
                <Badge
                  className={
                    score.overallScore >= 70
                      ? "bg-green-600"
                      : score.overallScore >= 40
                      ? "bg-amber-600"
                      : "bg-red-600"
                  }
                >
                  {score.overallScore}%
                </Badge>
              </div>
              {score.overallScore < 40 && (
                <p className="text-sm text-red-800">
                  Quality score below 40% minimum. Consider improving premises or
                  adding evidence.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Premises preview */}
        <div className="space-y-3">
          <h4 className="font-medium">Premises:</h4>
          {template.premises.map((premise) => (
            <div
              key={premise.key}
              className="p-3 border rounded-lg bg-muted space-y-1"
            >
              <div className="text-sm font-medium text-muted-foreground">
                {premise.text}
              </div>
              <div className="text-sm">
                {filledPremises[premise.key] || <em>Not filled</em>}
              </div>
            </div>
          ))}
        </div>

        {/* Evidence preview */}
        <div className="space-y-2">
          <h4 className="font-medium">Evidence & Citations</h4>
          {pendingCitations.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {pendingCitations.length} citation(s) will be attached after submission
              </div>
              {pendingCitations.filter(cit => cit && cit.type).map((cit, idx) => (
                <div key={idx} className="p-2 border rounded bg-muted text-sm">
                  <div className="font-medium">{cit.type?.toUpperCase() || 'CITATION'}: {cit.title || cit.value || 'No title'}</div>
                  {cit.locator && <div className="text-xs text-muted-foreground">Locator: {cit.locator}</div>}
                  {cit.note && <div className="text-xs text-muted-foreground">Note: {cit.note}</div>}
                </div>
              ))}
            </div>
          ) : Object.values(evidenceLinks).flat().length > 0 ? (
            <div className="text-sm text-muted-foreground">
              {Object.values(evidenceLinks).flat().length} legacy evidence links added
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              No evidence added
            </div>
          )}
        </div>

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Separator />
        <div className="flex gap-3">
          <button
            onClick={onBack}
            disabled={isSubmitting}
            className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
              canSubmit && !isSubmitting
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit {mode === "attack" ? "Attack" : mode === "support" ? "Support" : "Argument"}
              </>
            )}
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStepsForMode(mode: ArgumentMode): WizardStep[] {
  if (mode === "general") {
    return ["scheme", "template", "premises", "evidence", "review"];
  }
  // Attack and support modes skip scheme selection
  return ["template", "premises", "evidence", "review"];
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}
