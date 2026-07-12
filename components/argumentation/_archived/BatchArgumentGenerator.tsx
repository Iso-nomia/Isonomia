"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  CheckCircle2,
  Clock,
  List,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface GeneratedArgument {
  id: string;
  schemeId: string;
  schemeName: string;
  premises: Record<string, string>;
  evidence: Record<string, string[]>;
  strength: number;
  reasoning: string;
  status: "generated" | "reviewing" | "approved" | "rejected";
}

interface BatchGenerationConfig {
  targetArgumentId: string;
  maxArguments: number;
  minStrength: number;
  diversityMode: "maximize" | "balanced" | "focused";
  evidenceStrategy: "distribute" | "duplicate" | "prioritize";
  schemes: string[];
}

interface BatchArgumentGeneratorProps {
  targetArgumentId: string;
  availableEvidence: any[];
  onGenerateComplete?: (generatedArgs: GeneratedArgument[]) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function BatchArgumentGenerator({
  targetArgumentId,
  availableEvidence,
  onGenerateComplete,
}: BatchArgumentGeneratorProps) {
  const [config, setConfig] = useState<BatchGenerationConfig>({
    targetArgumentId,
    maxArguments: 5,
    minStrength: 60,
    diversityMode: "balanced",
    evidenceStrategy: "distribute",
    schemes: [],
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArguments, setGeneratedArguments] = useState<GeneratedArgument[]>([]);
  const [selectedArguments, setSelectedArguments] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<string>("");

  async function generateBatch() {
    setIsGenerating(true);
    setProgress(0);
    setGeneratedArguments([]);

    try {
      // Phase 1: Scheme selection
      setGenerationPhase("Selecting optimal schemes...");
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Phase 2: Evidence allocation
      setGenerationPhase("Allocating evidence to schemes...");
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Phase 3: Argument generation
      setGenerationPhase("Generating arguments...");
      setProgress(60);

      const response = await fetch("/api/arguments/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          evidence: availableEvidence,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedArguments(data.arguments);
        setProgress(100);
        setGenerationPhase("Complete!");
        onGenerateComplete?.(data.arguments);
      } else {
        throw new Error("Failed to generate batch");
      }
    } catch (err) {
      console.error("Batch generation failed:", err);
      setGenerationPhase("Error generating arguments");
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  }

  function toggleArgumentSelection(argumentId: string) {
    const newSelection = new Set(selectedArguments);
    if (newSelection.has(argumentId)) {
      newSelection.delete(argumentId);
    } else {
      newSelection.add(argumentId);
    }
    setSelectedArguments(newSelection);
  }

  function selectAll() {
    const pending = generatedArguments.filter(
      (a) => a.status === "generated" || a.status === "reviewing"
    );
    setSelectedArguments(new Set(pending.map((a) => a.id)));
  }

  function deselectAll() {
    setSelectedArguments(new Set());
  }

  function approveSelected() {
    setGeneratedArguments((prev) =>
      prev.map((a) =>
        selectedArguments.has(a.id) ? { ...a, status: "approved" as const } : a
      )
    );
    setSelectedArguments(new Set());
  }

  function rejectSelected() {
    setGeneratedArguments((prev) =>
      prev.map((a) =>
        selectedArguments.has(a.id) ? { ...a, status: "rejected" as const } : a
      )
    );
    setSelectedArguments(new Set());
  }

  const approvedCount = generatedArguments.filter((a) => a.status === "approved").length;
  const rejectedCount = generatedArguments.filter((a) => a.status === "rejected").length;
  const pendingCount = generatedArguments.filter(
    (a) => a.status === "generated" || a.status === "reviewing"
  ).length;

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-sky-600" />
            <CardTitle>Batch Generation Settings</CardTitle>
          </div>
          <CardDescription>
            Configure how multiple support arguments will be generated
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Max Arguments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Maximum Arguments</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.maxArguments}
                onChange={(e) =>
                  setConfig({ ...config, maxArguments: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Generate up to {config.maxArguments} arguments
              </p>
            </div>

            {/* Min Strength */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Minimum Strength ({config.minStrength}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.minStrength}
                onChange={(e) =>
                  setConfig({ ...config, minStrength: Number(e.target.value) })
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Only generate arguments with ≥{config.minStrength}% predicted strength
              </p>
            </div>

            {/* Diversity Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Diversity Mode</label>
              <select
                value={config.diversityMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    diversityMode: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="maximize">Maximize - Different categories</option>
                <option value="balanced">Balanced - Mix of best and diverse</option>
                <option value="focused">Focused - Best matches only</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {config.diversityMode === "maximize" &&
                  "Prioritize scheme diversity across categories"}
                {config.diversityMode === "balanced" &&
                  "Balance between quality and diversity"}
                {config.diversityMode === "focused" &&
                  "Focus on highest-scoring schemes"}
              </p>
            </div>

            {/* Evidence Strategy */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Evidence Strategy</label>
              <select
                value={config.evidenceStrategy}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    evidenceStrategy: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="distribute">Distribute - Each gets unique evidence</option>
                <option value="duplicate">Duplicate - Allow evidence reuse</option>
                <option value="prioritize">Prioritize - Best evidence to best schemes</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {config.evidenceStrategy === "distribute" &&
                  "Divide evidence evenly, no overlap"}
                {config.evidenceStrategy === "duplicate" &&
                  "Allow multiple arguments to use same evidence"}
                {config.evidenceStrategy === "prioritize" &&
                  "Allocate highest quality evidence to strongest schemes"}
              </p>
            </div>
          </div>

          {/* Evidence availability check */}
          {availableEvidence.length === 0 ? (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No evidence available. Add evidence to generate support arguments.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-sm text-muted-foreground">
              {availableEvidence.length} evidence items available for generation
            </div>
          )}

          <button
            onClick={generateBatch}
            disabled={isGenerating || availableEvidence.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generate Support Arguments
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* Generation progress */}
      {isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{generationPhase}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated arguments */}
      {generatedArguments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Arguments</CardTitle>
                <CardDescription>
                  {generatedArguments.length} arguments generated • {approvedCount} approved
                  • {rejectedCount} rejected • {pendingCount} pending
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  disabled={pendingCount === 0}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  disabled={selectedArguments.size === 0}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Deselect
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Bulk actions */}
            {selectedArguments.size > 0 && (
              <Alert className="bg-sky-50 border-sky-200">
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sky-900">
                    {selectedArguments.size} arguments selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={approveSelected}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Selected
                    </button>
                    <button
                      onClick={rejectSelected}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Reject Selected
                    </button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Argument cards */}
            <div className="space-y-3">
              {generatedArguments.map((argument) => (
                <GeneratedArgumentCard
                  key={argument.id}
                  argument={argument}
                  isSelected={selectedArguments.has(argument.id)}
                  onToggleSelect={() => toggleArgumentSelection(argument.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Generated Argument Card
// ============================================================================

interface GeneratedArgumentCardProps {
  argument: GeneratedArgument;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function GeneratedArgumentCard({
  argument,
  isSelected,
  onToggleSelect,
}: GeneratedArgumentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColors = {
    generated: "bg-gray-100 text-gray-700 border-gray-200",
    reviewing: "bg-sky-100 text-sky-700 border-sky-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const strengthColor =
    argument.strength >= 80
      ? "text-green-600"
      : argument.strength >= 60
      ? "text-yellow-600"
      : "text-red-600";

  const canSelect = argument.status === "generated" || argument.status === "reviewing";

  return (
    <Card className={isSelected ? "border-sky-600 border-2" : ""}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            {canSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
            )}

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{argument.schemeName}</h4>
                  <Badge className={statusColors[argument.status]}>
                    {argument.status}
                  </Badge>
                </div>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-muted rounded"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{argument.reasoning}</p>

              {/* Quick stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className={`flex items-center gap-1 ${strengthColor}`}>
                  <span className="font-medium">{argument.strength}%</span>
                  <span className="text-muted-foreground">strength</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <List className="h-4 w-4" />
                  <span>{Object.keys(argument.premises).length} premises</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span>
                    {Object.values(argument.evidence).flat().length} evidence links
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="pt-3 border-t space-y-3">
                  {/* Premises */}
                  <div>
                    <p className="text-sm font-medium mb-2">Premises</p>
                    <div className="space-y-2">
                      {Object.entries(argument.premises).map(([key, value]) => (
                        <div key={key} className="p-2 rounded bg-muted">
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            {key}
                          </div>
                          <div className="text-sm">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidence Links */}
                  <div>
                    <p className="text-sm font-medium mb-2">Evidence Links</p>
                    <div className="space-y-1">
                      {Object.entries(argument.evidence).map(([key, evidenceIds]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span>{" "}
                          <span className="text-muted-foreground">
                            {evidenceIds.length} items
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
