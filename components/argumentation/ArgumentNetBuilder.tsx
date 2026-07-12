"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Network,
  Plus,
  Trash2,
  Info,
  Eye,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NetStepCard, type NetStep as ImportedNetStep, type Scheme } from "@/components/argumentation/NetStepCard";

// ============================
// Types
// ============================

type NetType = "serial" | "convergent" | "divergent" | "hybrid";

// Re-export imported types
type NetStep = ImportedNetStep;

interface ArgumentNetBuilderProps {
  open: boolean;
  onClose: () => void;
  argumentId?: string; // Now optional for standalone mode
  onComplete: (netId: string) => void;
  deliberationId?: string; // Required for standalone mode
}

// ============================
// Net Type Descriptions
// ============================

const NET_TYPE_INFO: Record<
  NetType,
  { label: string; description: string; example: string }
> = {
  serial: {
    label: "Serial Chain (A → B → C)",
    description:
      "Sequential chain where each scheme's conclusion feeds into the next scheme's premise. Most common type.",
    example:
      "Expert Opinion → Sign Evidence → Causal Mechanism → Practical Action",
  },
  convergent: {
    label: "Convergent (A+B+C → D)",
    description:
      "Multiple independent schemes converge to support a single conclusion.",
    example:
      "Expert Opinion + Statistical Evidence + Historical Precedent → Policy Recommendation",
  },
  divergent: {
    label: "Divergent (A → B, A → C, A → D)",
    description:
      "One scheme provides premises that branch into multiple separate conclusions.",
    example:
      "Climate Data → [Economic Impact, Social Impact, Environmental Impact]",
  },
  hybrid: {
    label: "Hybrid (Mixed Structure)",
    description:
      "Complex combination of serial, convergent, and divergent patterns.",
    example:
      "Multiple evidence chains converging then branching to multiple conclusions",
  },
};

// ============================
// Main Component
// ============================

export function ArgumentNetBuilder({
  open,
  onClose,
  argumentId: initialArgumentId,
  onComplete,
  deliberationId,
}: ArgumentNetBuilderProps) {
  // State
  const [currentTab, setCurrentTab] = useState<"select-argument" | "type" | "steps" | "dependencies" | "preview">(
    initialArgumentId ? "type" : "select-argument"
  );
  const [argumentId, setArgumentId] = useState<string | null>(initialArgumentId || null);
  const [netType, setNetType] = useState<NetType>("serial");
  const [steps, setSteps] = useState<NetStep[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  
  // Standalone mode state
  const [availableArguments, setAvailableArguments] = useState<Array<{ id: string; conclusion: string }>>([]);
  const [loadingArguments, setLoadingArguments] = useState(false);
  const [createNewArgument, setCreateNewArgument] = useState(false);
  const [newArgumentConclusion, setNewArgumentConclusion] = useState("");
  const [creatingArgument, setCreatingArgument] = useState(false);

  // Load arguments for standalone mode
  useEffect(() => {
    async function fetchArguments() {
      if (!open || !deliberationId || initialArgumentId || availableArguments.length > 0) return;
      
      setLoadingArguments(true);
      try {
        const response = await fetch(`/api/deliberations/${deliberationId}/arguments/aif?limit=100`);
        if (!response.ok) throw new Error("Failed to fetch arguments");
        const data = await response.json();
        // Extract arguments from paginated response
        const args = (data.items || []).map((item: any) => ({
          id: item.id,
          conclusion: item.aif?.conclusion?.propositionText || item.text || `Argument ${item.id}`,
        }));
        setAvailableArguments(args);
      } catch (err) {
        console.error("[ArgumentNetBuilder] Error fetching arguments:", err);
        setError("Failed to load arguments");
      } finally {
        setLoadingArguments(false);
      }
    }
    
    void fetchArguments();
  }, [open, deliberationId, initialArgumentId, availableArguments.length]);

  // Load schemes when dialog opens
  useEffect(() => {
    async function fetchSchemes() {
      if (!open || schemes.length > 0) return;
      
      setLoadingSchemes(true);
      try {
        const response = await fetch("/api/schemes/all");
        if (!response.ok) throw new Error("Failed to fetch schemes");
        const data = await response.json();
        // API returns array directly, not { schemes: [...] }
        setSchemes(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[ArgumentNetBuilder] Error fetching schemes:", err);
        setError("Failed to load schemes");
      } finally {
        setLoadingSchemes(false);
      }
    }
    
    void fetchSchemes();
  }, [open, schemes.length]);

  // Step management
  const addStep = useCallback(() => {
    const newStep: NetStep = {
      id: `temp-${Date.now()}`,
      schemeId: "",
      schemeName: "",
      label: "",
      stepText: "",
      confidence: 1.0,
      order: steps.length + 1,
      inputFromStep: steps.length > 0 ? steps.length : null,
      inputSlotMapping: null,
    };
    setSteps((prev) => [...prev, newStep]);
  }, [steps.length]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Reorder remaining steps
      return updated.map((step, i) => ({
        ...step,
        order: i + 1,
        inputFromStep:
          step.inputFromStep && step.inputFromStep > index + 1
            ? step.inputFromStep - 1
            : step.inputFromStep,
      }));
    });
  }, []);

  const updateStep = useCallback((index: number, updates: Partial<NetStep>) => {
    setSteps((prev) =>
      prev.map((step, i) => {
        if (i === index) {
          const newStep = { ...step, ...updates };
          // If scheme changed, update scheme name
          if (updates.schemeId) {
            const scheme = schemes.find((s) => s.id === updates.schemeId);
            newStep.schemeName = scheme?.name || "";
          }
          return newStep;
        }
        return step;
      })
    );
  }, [schemes]);

  // Calculate overall confidence (weakest link)
  const overallConfidence = steps.length > 0 ? Math.min(...steps.map((s) => s.confidence)) : 1.0;

  // Validation
  const canProceedToSteps = Boolean(netType);
  const canProceedToDependencies = steps.length > 0 && steps.every((s) => s.schemeId && s.label);
  const canSubmit = canProceedToDependencies && steps.length > 0;

  // Standalone mode: Create new argument
  const handleCreateArgument = async () => {
    if (!newArgumentConclusion.trim() || !deliberationId) return;
    
    setCreatingArgument(true);
    setError(null);
    
    try {
      // For now, show a helpful message instead of creating
      // Full argument creation requires claims, premises, etc.
      setError(
        "Creating new arguments requires using the full argument composer. " +
        "Please select an existing argument or create one using the 'Create Argument' tab first."
      );
      setCreateNewArgument(false);
    } catch (err) {
      console.error("[ArgumentNetBuilder] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to create argument");
    } finally {
      setCreatingArgument(false);
    }
  };

  // Navigation helpers
  const goToSteps = () => {
    if (canProceedToSteps) setCurrentTab("steps");
  };
  const goToDependencies = () => {
    if (canProceedToDependencies) setCurrentTab("dependencies");
  };
  const goToPreview = () => {
    if (canSubmit) setCurrentTab("preview");
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create SchemeNet record
      const netResponse = await fetch("/api/nets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          argumentId,
          description: description || `${netType} net with ${steps.length} steps`,
          overallConfidence,
        }),
      });

      if (!netResponse.ok) {
        const errorData = await netResponse.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create net");
      }

      const { id: netId } = await netResponse.json();
      console.log("[ArgumentNetBuilder] Created net:", netId);

      // 2. Create SchemeNetStep records
      for (const step of steps) {
        const stepResponse = await fetch(`/api/nets/${netId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepOrder: step.order,
            schemeId: step.schemeId,
            label: step.label,
            stepText: step.stepText,
            confidence: step.confidence,
            inputFromStep: step.inputFromStep,
            inputSlotMapping: step.inputSlotMapping,
          }),
        });

        if (!stepResponse.ok) {
          const errorData = await stepResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to create step ${step.order}`);
        }
      }

      console.log("[ArgumentNetBuilder] Net created successfully:", netId);
      onComplete(netId);
      handleClose();
    } catch (err) {
      console.error("[ArgumentNetBuilder] Error creating net:", err);
      setError(err instanceof Error ? err.message : "Failed to create net");
    } finally {
      setSubmitting(false);
    }
  };

  // Close handler (reset state)
  const handleClose = () => {
    setCurrentTab(initialArgumentId ? "type" : "select-argument");
    setArgumentId(initialArgumentId || null);
    setNetType("serial");
    setSteps([]);
    setDescription("");
    setError(null);
    setCreateNewArgument(false);
    setNewArgumentConclusion("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-white overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Argument Net Builder
          </DialogTitle>
          <DialogDescription>
            Create an explicit multi-scheme net with sequential steps, dependencies, and per-step
            confidence levels. This is an advanced tool for pedagogical and expert use cases.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={currentTab} onValueChange={(val) => setCurrentTab(val as typeof currentTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={initialArgumentId ? "grid w-full grid-cols-4" : "grid w-full grid-cols-5"}>
            {!initialArgumentId && (
              <TabsTrigger value="select-argument">1. Select Argument</TabsTrigger>
            )}
            <TabsTrigger value="type" disabled={!argumentId}>
              {initialArgumentId ? "1" : "2"}. Net Type
            </TabsTrigger>
            <TabsTrigger value="steps" disabled={!canProceedToSteps}>
              {initialArgumentId ? "2" : "3"}. Add Steps
            </TabsTrigger>
            <TabsTrigger value="dependencies" disabled={!canProceedToDependencies}>
              {initialArgumentId ? "3" : "4"}. Dependencies
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!canSubmit}>
              {initialArgumentId ? "4" : "5"}. Preview
            </TabsTrigger>
          </TabsList>

          {/* Tab Content Container with Scroll */}
          <div className="flex-1 overflow-y-auto mt-4">
            {/* STEP 0: ARGUMENT SELECTION (Standalone Mode Only) */}
            {!initialArgumentId && (
              <TabsContent value="select-argument" className="space-y-4 m-0">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Select or Create Argument</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose an existing argument to build a net for, or create a new argument.
                  </p>
                </div>

                {!createNewArgument ? (
                  <>
                    {loadingArguments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading arguments...</span>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Select Existing Argument</Label>
                          {availableArguments.length === 0 ? (
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                No arguments found in this deliberation. Create a new one to get started.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Select value={argumentId || ""} onValueChange={setArgumentId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose an argument..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableArguments.map((arg) => (
                                  <SelectItem key={arg.id} value={arg.id}>
                                    {arg.conclusion || `Argument ${arg.id}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t border-gray-300" />
                          <span className="text-sm text-muted-foreground">or</span>
                          <div className="flex-1 border-t border-gray-300" />
                        </div>

                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setCreateNewArgument(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create New Argument
                        </Button>

                        {argumentId && (
                          <div className="flex justify-end mt-4">
                            <Button onClick={() => setCurrentTab("type")}>
                              Next: Choose Net Type
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Argument Conclusion</Label>
                        <Textarea
                          placeholder="Enter the main conclusion of your argument..."
                          value={newArgumentConclusion}
                          onChange={(e) => setNewArgumentConclusion(e.target.value)}
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          You&apos;ll add premises and schemes in the next steps.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setCreateNewArgument(false);
                          setNewArgumentConclusion("");
                        }}
                      >
                        Back
                      </Button>
                      <Button 
                        onClick={handleCreateArgument}
                        disabled={!newArgumentConclusion.trim() || creatingArgument}
                      >
                        {creatingArgument ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            Create & Continue
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            )}
            
            {/* STEP 1: NET TYPE SELECTION */}
            <TabsContent value="type" className="space-y-4 m-0">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Net Type</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose the structural pattern that best describes your multi-scheme argument.
                </p>
              </div>

              <RadioGroup value={netType} onValueChange={(val) => setNetType(val as NetType)}>
                {(Object.keys(NET_TYPE_INFO) as NetType[]).map((type) => {
                  const info = NET_TYPE_INFO[type];
                  return (
                    <div key={type} className="flex items-start space-x-3 border rounded-lg p-4">
                      <RadioGroupItem value={type} id={type} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={type} className="text-base font-semibold cursor-pointer">
                          {info.label}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Example: {info.example}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Describe the purpose of this net..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={goToSteps} disabled={!canProceedToSteps}>
                  Next: Add Steps
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* STEP 2: ADD STEPS */}
            <TabsContent value="steps" className="space-y-4 m-0">
              <div>
                <h3 className="text-lg font-semibold mb-2">Build Net Steps</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add reasoning steps to your net. Each step uses a specific argumentation scheme.
                </p>
              </div>

              {loadingSchemes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading schemes...</span>
                </div>
              ) : (
                <>
                  {steps.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No steps yet. Click &quot;Add Step&quot; to begin building your net.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      {steps.map((step, index) => (
                        <NetStepCard
                          key={step.id}
                          step={step}
                          index={index}
                          schemes={schemes}
                          onUpdate={(updates) => updateStep(index, updates)}
                          onRemove={() => removeStep(index)}
                        />
                      ))}
                    </div>
                  )}

                  <Button onClick={addStep} variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={() => setCurrentTab("type")}>
                      Back
                    </Button>
                    <Button onClick={goToDependencies} disabled={!canProceedToDependencies}>
                      Next: Configure Dependencies
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* STEP 3: DEPENDENCIES */}
            <TabsContent value="dependencies" className="space-y-4 m-0">
              <div>
                <h3 className="text-lg font-semibold mb-2">Configure Step Dependencies</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Specify how each step&apos;s conclusion feeds into the next step&apos;s premises.
                </p>
              </div>

              {netType === "convergent" || netType === "divergent" ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {netType === "convergent"
                      ? "Convergent nets typically have all steps feeding into a final step."
                      : "Divergent nets have one initial step branching to multiple conclusions."}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <DependencyRow
                    key={step.id}
                    step={step}
                    index={index}
                    steps={steps}
                    onUpdate={(updates) => updateStep(index, updates)}
                  />
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentTab("steps")}>
                  Back
                </Button>
                <Button onClick={goToPreview} disabled={!canSubmit}>
                  Next: Preview
                  <Eye className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* STEP 4: PREVIEW */}
            <TabsContent value="preview" className="space-y-4 m-0">
              <div>
                <h3 className="text-lg font-semibold mb-2">Preview Net Structure</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Review your net before creating it. You can go back to make changes.
                </p>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                {/* Net Metadata */}
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {NET_TYPE_INFO[netType].label}
                    </Badge>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Overall Confidence</div>
                    <div className="text-2xl font-bold">
                      {Math.round(overallConfidence * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">(weakest link)</div>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Steps ({steps.length})</h4>
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 border rounded p-3 bg-muted/30"
                    >
                      <Badge variant="outline">{step.order}</Badge>
                      <div className="flex-1">
                        <div className="font-medium">{step.schemeName || step.schemeId}</div>
                        <div className="text-sm text-muted-foreground">{step.label}</div>
                        {step.inputFromStep && (
                          <div className="text-xs text-muted-foreground mt-1">
                            ← Feeds from Step {step.inputFromStep}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {Math.round(step.confidence * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentTab("dependencies")}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Net
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================
// Sub-Components
// ============================

interface DependencyRowProps {
  step: NetStep;
  index: number;
  steps: NetStep[];
  onUpdate: (updates: Partial<NetStep>) => void;
}

function DependencyRow({ step, index, steps, onUpdate }: DependencyRowProps) {
  const [showSlotMapping, setShowSlotMapping] = useState(false);
  const [slotMappingText, setSlotMappingText] = useState(
    step.inputSlotMapping ? JSON.stringify(step.inputSlotMapping, null, 2) : ""
  );

  const handleSlotMappingChange = (text: string) => {
    setSlotMappingText(text);
    try {
      const parsed = JSON.parse(text);
      onUpdate({ inputSlotMapping: parsed });
    } catch {
      // Invalid JSON, don't update
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Step {step.order}</Badge>
        <span className="font-medium">{step.label || "Unlabeled"}</span>
      </div>

      {/* Input From Step */}
      <div className="space-y-2">
        <Label>Feeds From</Label>
        <Select
          value={step.inputFromStep?.toString() || "null"}
          onValueChange={(val) =>
            onUpdate({ inputFromStep: val === "null" ? null : parseInt(val) })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">None (first step or independent)</SelectItem>
            {steps.slice(0, index).map((prevStep) => (
              <SelectItem key={prevStep.order} value={prevStep.order.toString()}>
                Step {prevStep.order}: {prevStep.label || prevStep.schemeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Slot Mapping (Optional Advanced Feature) */}
      {step.inputFromStep !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Slot Mapping (Optional, Advanced)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSlotMapping(!showSlotMapping)}
            >
              {showSlotMapping ? "Hide" : "Show"}
            </Button>
          </div>
          {showSlotMapping && (
            <>
              <Textarea
                placeholder='{&quot;A&quot;: &quot;P1.conclusion&quot;, &quot;B&quot;: &quot;P2.premise&quot;}'
                value={slotMappingText}
                onChange={(e) => handleSlotMappingChange(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                JSON mapping of how conclusion variables from the previous step map to premise
                variables in this step. Leave empty for automatic inference.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
