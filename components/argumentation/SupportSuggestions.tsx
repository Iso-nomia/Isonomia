"use client";

import { useState, useEffect } from "react";
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
  Shield,
  TrendingUp,
  Lightbulb,
  Target,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SupportSuggestion {
  id: string;
  type: "evidence" | "premise" | "reinforcement" | "counterargument-defense";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  reasoning: string;
  expectedImpact: {
    strengthIncrease: number; // 0-100
    vulnerabilityReduction: number; // 0-100
    credibilityBoost: number; // 0-100
  };
  implementation: {
    difficulty: "easy" | "medium" | "hard";
    timeEstimate: string;
    requiredEvidence?: string[];
    suggestedScheme?: string;
  };
  relatedWeaknesses: string[];
}

interface ArgumentAnalysis {
  currentStrength: number;
  potentialStrength: number;
  vulnerabilities: Array<{
    id: string;
    type: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
  }>;
  evidenceGaps: Array<{
    premiseKey: string;
    premiseText: string;
    missingEvidenceType: string;
  }>;
  logicalGaps: string[];
}

interface SupportSuggestionsProps {
  argumentId: string;
  onSelectSuggestion?: (suggestion: SupportSuggestion) => void;
  onGenerateSupport?: (suggestion: SupportSuggestion) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function SupportSuggestions({
  argumentId,
  onSelectSuggestion,
  onGenerateSupport,
}: SupportSuggestionsProps) {
  const [analysis, setAnalysis] = useState<ArgumentAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<SupportSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"priority" | "impact" | "difficulty">("priority");

  useEffect(() => {
    analyzeArgument();
  }, [argumentId]);

  async function analyzeArgument() {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/arguments/${argumentId}/analyze-support`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Failed to analyze argument:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const filteredSuggestions = suggestions
    .filter((s) => !selectedType || s.type === selectedType)
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === "impact") {
        return b.expectedImpact.strengthIncrease - a.expectedImpact.strengthIncrease;
      }
      if (sortBy === "difficulty") {
        const diffOrder = { easy: 0, medium: 1, hard: 2 };
        return diffOrder[a.implementation.difficulty] - diffOrder[b.implementation.difficulty];
      }
      return 0;
    });

  const typeFilters = [
    { value: "evidence", label: "Evidence", icon: Target },
    { value: "premise", label: "Premises", icon: Lightbulb },
    { value: "reinforcement", label: "Reinforcement", icon: Shield },
    { value: "counterargument-defense", label: "Defense", icon: AlertTriangle },
  ];

  if (isAnalyzing) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Analyzing argument strengths and weaknesses...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Overview */}
      {analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Argument Analysis</CardTitle>
                <CardDescription>
                  Strength assessment and improvement opportunities
                </CardDescription>
              </div>
              <Badge className="bg-sky-600">
                {analysis.currentStrength}% Strength
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Strength meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Strength</span>
                <span className="font-medium">{analysis.currentStrength}%</span>
              </div>
              <Progress value={analysis.currentStrength} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Potential Strength</span>
                <span className="font-medium text-sky-600">{analysis.potentialStrength}%</span>
              </div>
              <Progress value={analysis.potentialStrength} className="h-2 bg-sky-100" />
              <p className="text-xs text-muted-foreground">
                +{analysis.potentialStrength - analysis.currentStrength}% possible improvement
              </p>
            </div>

            {/* Vulnerabilities */}
            {analysis.vulnerabilities.length > 0 && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-amber-900">
                      {analysis.vulnerabilities.length} vulnerabilities detected
                    </p>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {analysis.vulnerabilities.slice(0, 3).map((v) => (
                        <li key={v.id}>• {v.description}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Evidence gaps */}
            {analysis.evidenceGaps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Evidence Gaps</p>
                <div className="space-y-1">
                  {analysis.evidenceGaps.map((gap) => (
                    <div
                      key={gap.premiseKey}
                      className="text-sm p-2 rounded bg-muted"
                    >
                      <span className="font-medium">{gap.premiseKey}:</span>{" "}
                      Missing {gap.missingEvidenceType}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-600" />
              <CardTitle>Support Suggestions</CardTitle>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="priority">Sort by Priority</option>
              <option value="impact">Sort by Impact</option>
              <option value="difficulty">Sort by Difficulty</option>
            </select>
          </div>
          <CardDescription>
            {filteredSuggestions.length} ways to strengthen this argument
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Type filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedType === null
                  ? "bg-sky-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({suggestions.length})
            </button>
            {typeFilters.map((filter) => {
              const Icon = filter.icon;
              const count = suggestions.filter((s) => s.type === filter.value).length;
              return (
                <button
                  key={filter.value}
                  onClick={() => setSelectedType(filter.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === filter.value
                      ? "bg-sky-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {filter.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Suggestion cards */}
          <div className="space-y-3">
            {filteredSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onSelect={() => onSelectSuggestion?.(suggestion)}
                onGenerate={() => onGenerateSupport?.(suggestion)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Suggestion Card
// ============================================================================

interface SuggestionCardProps {
  suggestion: SupportSuggestion;
  onSelect?: () => void;
  onGenerate?: () => void;
}

function SuggestionCard({ suggestion, onSelect, onGenerate }: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const difficultyColors = {
    easy: "text-green-600",
    medium: "text-yellow-600",
    hard: "text-red-600",
  };

  const typeIcons = {
    evidence: Target,
    premise: Lightbulb,
    reinforcement: Shield,
    "counterargument-defense": AlertTriangle,
  };

  const Icon = typeIcons[suggestion.type];

  return (
    <Card className="hover:bg-muted/50 transition-all">
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="bg-sky-100 p-2 rounded-lg">
                <Icon className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{suggestion.title}</h4>
                  <Badge className={priorityColors[suggestion.priority]}>
                    {suggestion.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {suggestion.description}
                </p>
              </div>
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

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span>+{suggestion.expectedImpact.strengthIncrease}% strength</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-sky-600" />
              <span>-{suggestion.expectedImpact.vulnerabilityReduction}% vulnerability</span>
            </div>
            <div className={`flex items-center gap-1 ${difficultyColors[suggestion.implementation.difficulty]}`}>
              <span className="font-medium">{suggestion.implementation.difficulty}</span>
              <span className="text-muted-foreground">• {suggestion.implementation.timeEstimate}</span>
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="pt-3 border-t space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Reasoning</p>
                <p className="text-sm text-muted-foreground">
                  {suggestion.reasoning}
                </p>
              </div>

              {/* Expected impact */}
              <div>
                <p className="text-sm font-medium mb-2">Expected Impact</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Strength Increase</span>
                      <span className="font-medium">+{suggestion.expectedImpact.strengthIncrease}%</span>
                    </div>
                    <Progress value={suggestion.expectedImpact.strengthIncrease} className="h-1" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Vulnerability Reduction</span>
                      <span className="font-medium">-{suggestion.expectedImpact.vulnerabilityReduction}%</span>
                    </div>
                    <Progress value={suggestion.expectedImpact.vulnerabilityReduction} className="h-1" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Credibility Boost</span>
                      <span className="font-medium">+{suggestion.expectedImpact.credibilityBoost}%</span>
                    </div>
                    <Progress value={suggestion.expectedImpact.credibilityBoost} className="h-1" />
                  </div>
                </div>
              </div>

              {/* Implementation details */}
              {suggestion.implementation.requiredEvidence && suggestion.implementation.requiredEvidence.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Required Evidence</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.implementation.requiredEvidence.map((type) => (
                      <Badge key={type} className="bg-sky-100 text-sky-800">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {suggestion.implementation.suggestedScheme && (
                <div>
                  <p className="text-sm font-medium mb-1">Suggested Scheme</p>
                  <Badge className="bg-purple-100 text-purple-800">
                    {suggestion.implementation.suggestedScheme}
                  </Badge>
                </div>
              )}

              {/* Related weaknesses */}
              {suggestion.relatedWeaknesses.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Addresses Weaknesses</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {suggestion.relatedWeaknesses.map((weakness) => (
                      <li key={weakness}>• {weakness}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {onSelect && (
                  <button
                    onClick={onSelect}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Select This
                  </button>
                )}
                {onGenerate && (
                  <button
                    onClick={onGenerate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Generate Support
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
