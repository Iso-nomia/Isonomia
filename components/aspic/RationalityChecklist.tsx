// components/aspic/RationalityChecklist.tsx
"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface RationalityData {
  wellFormed: boolean;
  violations: string[];
  postulates: {
    axiomConsistency: boolean;
    wellFormedness: boolean;
    subArgumentClosure: boolean;
    transpositionClosure: boolean;
  };
}

interface RationalityChecklistProps {
  rationality: RationalityData;
  deliberationId: string;
  onRegenerateTransposition?: () => void;
}

interface PostulateInfo {
  id: keyof RationalityData["postulates"];
  name: string;
  description: string;
  explanation: string;
  importance: "critical" | "high" | "medium";
  learnMoreUrl?: string;
}

const POSTULATES: PostulateInfo[] = [
  {
    id: "axiomConsistency",
    name: "Axiom Consistency",
    description: "No axioms (accepted claims) are contraries of each other",
    explanation:
      "ASPIC+ requires that axioms (undisputed facts) do not contradict each other. Violating this creates logical inconsistency in the knowledge base, making it impossible to derive meaningful conclusions.",
    importance: "critical",
  },
  {
    id: "wellFormedness",
    name: "Well-Formedness",
    description: "Arguments follow valid inference patterns",
    explanation:
      "Each argument must be properly constructed: conclusions must follow from premises via valid rules, and all sub-arguments must be well-formed. This ensures deductive or presumptive validity throughout the argument structure.",
    importance: "critical",
  },
  {
    id: "transpositionClosure",
    name: "Closure under Transposition",
    description: "Strict rules include their contrapositives",
    explanation:
      "For rationality, strict rules must be closed under transposition (contraposition). If 'p → q' is a strict rule, then '¬q → ¬p' must also be a strict rule. This enables proper reasoning about necessary conditions and prevents logical gaps.",
    importance: "high",
    learnMoreUrl: "https://en.wikipedia.org/wiki/Transposition_(logic)",
  },
  {
    id: "subArgumentClosure",
    name: "Sub-Argument Closure",
    description: "All sub-arguments are included in the argument set",
    explanation:
      "Every sub-argument used to construct a larger argument must itself be a valid argument in the system. This ensures that attacks can target any level of argumentation, not just top-level conclusions.",
    importance: "medium",
  },
];

export function RationalityChecklist({
  rationality,
  deliberationId,
  onRegenerateTransposition,
}: RationalityChecklistProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const response = await fetch("/api/aspic/transposition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliberationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate transposed rules");
      }

      setGenerateResult({
        success: true,
        message: data.message || `Generated ${data.generated} transposed rule(s)`,
      });

      // Trigger parent refresh
      onRegenerateTransposition?.();
      
      // Dispatch custom event for AspicTheoryViewer to refresh
      window.dispatchEvent(new CustomEvent("aspic:theory:refresh"));
    } catch (error: any) {
      console.error("Error generating transposed rules:", error);
      setGenerateResult({
        success: false,
        message: error.message || "Failed to generate transposed rules",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const passedCount = Object.values(rationality.postulates).filter(Boolean).length;
  const totalCount = Object.keys(rationality.postulates).length;
  const allPassed = passedCount === totalCount;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Overall Status */}
        <div className="flex items-start gap-4 p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-sky-50">
          <div className="flex-shrink-0 mt-1">
            {allPassed ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Rationality Status
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {allPassed ? (
                <>
                  ✨ All rationality postulates satisfied! This argumentation system
                  conforms to ASPIC+ formal requirements.
                </>
              ) : (
                <>
                  {passedCount} of {totalCount} rationality postulates satisfied.
                  {rationality.violations.length > 0 && (
                    <> {rationality.violations.length} violation(s) detected.</>
                  )}
                </>
              )}
            </p>
            {!rationality.wellFormed && (
              <div className="mt-2">
                <Badge variant="destructive" className="text-xs">
                  System not well-formed
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Violations Alert */}
        {rationality.violations.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Violations Detected</AlertTitle>
            <AlertDescription className="mt-2">
              <ul className="list-disc list-inside space-y-1 text-xs">
                {rationality.violations.map((violation, idx) => (
                  <li key={idx}>{violation}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Postulates Checklist */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            Rationality Postulates
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs">
                  Rationality postulates are formal properties that ensure an
                  argumentation system is logically sound and behaves predictably.
                  Based on ASPIC+ framework (Modgil & Prakken 2013).
                </p>
              </TooltipContent>
            </Tooltip>
          </h4>

          <div className="space-y-2">
            {POSTULATES.map((postulate) => {
              const satisfied = rationality.postulates[postulate.id];
              return (
                <PostulateItem
                  key={postulate.id}
                  postulate={postulate}
                  satisfied={satisfied}
                />
              );
            })}
          </div>
        </div>

        {/* Transposition Auto-Generate */}
        {!rationality.postulates.transpositionClosure && (
          <Alert className="border-sky-200 bg-sky-50">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <AlertTitle className="text-sky-900">
              Auto-Generate Transposed Rules
            </AlertTitle>
            <AlertDescription className="text-sky-800 text-xs mt-2">
              <p className="mb-3">
                Mesh can automatically generate contrapositives for your strict
                rules. This will ensure transposition closure and satisfy the
                rationality postulate.
              </p>
              <Button
                size="sm"
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-2" />
                    Generate Transposed Rules
                  </>
                )}
              </Button>
              {generateResult && (
                <div
                  className={`mt-3 p-2 rounded text-xs ${
                    generateResult.success
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}
                >
                  {generateResult.message}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Success message when closure is achieved */}
        {rationality.postulates.transpositionClosure && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900 text-sm">
              Transposition Closure Satisfied
            </AlertTitle>
            <AlertDescription className="text-green-800 text-xs mt-2">
              All strict rules are closed under transposition. Your argumentation
              system satisfies the contraposition rationality postulate.
            </AlertDescription>
          </Alert>
        )}

        {/* Educational Resources */}
        <Alert className="border-purple-200 bg-purple-50">
          <Info className="h-4 w-4 text-purple-600" />
          <AlertTitle className="text-purple-900 text-sm">
            Learn More
          </AlertTitle>
          <AlertDescription className="text-purple-800 text-xs mt-2">
            <p className="mb-2">
              Rationality postulates ensure your argumentation system is
              logically sound and conforms to ASPIC+ formal requirements.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <a
                  href="https://www.sciencedirect.com/science/article/pii/S0004370213000872"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900"
                >
                  Modgil & Prakken (2013) - ASPIC+ Specification
                </a>
              </li>
              <li>
                <a
                  href="https://en.wikipedia.org/wiki/ASPIC%2B"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900"
                >
                  Wikipedia: ASPIC+ Framework
                </a>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

function PostulateItem({
  postulate,
  satisfied,
}: {
  postulate: PostulateInfo;
  satisfied: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const importanceColors = {
    critical: "text-red-600 bg-red-50 border-red-200",
    high: "text-amber-600 bg-amber-50 border-amber-200",
    medium: "text-sky-600 bg-sky-50 border-sky-200",
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        satisfied
          ? "bg-green-50 border-green-200"
          : importanceColors[postulate.importance]
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {satisfied ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle
              className={`h-5 w-5 ${
                postulate.importance === "critical"
                  ? "text-red-600"
                  : postulate.importance === "high"
                  ? "text-amber-600"
                  : "text-sky-600"
              }`}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h5
                className={`text-sm font-semibold ${
                  satisfied ? "text-green-900" : "text-gray-900"
                }`}
              >
                {postulate.name}
              </h5>
              <p
                className={`text-xs mt-0.5 ${
                  satisfied ? "text-green-700" : "text-gray-600"
                }`}
              >
                {postulate.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  postulate.importance === "critical"
                    ? "border-red-300 text-red-700"
                    : postulate.importance === "high"
                    ? "border-amber-300 text-amber-700"
                    : "border-sky-300 text-sky-700"
                }`}
              >
                {postulate.importance}
              </Badge>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="h-6 w-6 p-0"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {expanded ? "Hide" : "Show"} details
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {expanded && (
            <div
              className={`mt-3 pt-3 border-t text-xs ${
                satisfied
                  ? "border-green-200 text-green-800"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <p className="leading-relaxed">{postulate.explanation}</p>
              {postulate.learnMoreUrl && (
                <a
                  href={postulate.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 underline hover:no-underline"
                >
                  Learn more →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
