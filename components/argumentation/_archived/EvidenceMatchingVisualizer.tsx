"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Link2,
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Zap,
  ArrowRight,
  Lightbulb,
  FileText,
  BarChart3,
  CircleDot,
  Sparkles,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Premise {
  key: string;
  text: string;
  evidenceType?: string;
  isRequired: boolean;
}

interface Evidence {
  id: string;
  title: string;
  type: string;
  content: string;
  quality: number; // 0-100
  relevance?: number; // 0-100 (calculated)
}

interface EvidenceMatch {
  evidenceId: string;
  evidenceTitle: string;
  evidenceType: string;
  premiseKey: string;
  premiseText: string;
  matchScore: number; // 0-100 (overall match quality)
  relevanceScore: number; // 0-100 (how relevant to premise)
  qualityScore: number; // 0-100 (evidence quality)
  reasoning: string;
  suggestedPlacement: "primary" | "supporting" | "alternative";
  confidence: number; // 0-100
}

interface CoverageMetrics {
  totalPremises: number;
  coveredPremises: number;
  coveragePercentage: number;
  requiredCovered: number;
  requiredTotal: number;
  optionalCovered: number;
  optionalTotal: number;
  averageMatchQuality: number;
}

interface EvidenceMatchingVisualizerProps {
  premises: Premise[];
  availableEvidence: Evidence[];
  currentMatches: Record<string, string[]>; // premiseKey -> evidenceIds
  onEvidenceAssign?: (premiseKey: string, evidenceId: string) => void;
  onEvidenceRemove?: (premiseKey: string, evidenceId: string) => void;
  schemeId?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function EvidenceMatchingVisualizer({
  premises,
  availableEvidence,
  currentMatches,
  onEvidenceAssign,
  onEvidenceRemove,
  schemeId,
}: EvidenceMatchingVisualizerProps) {
  const [matches, setMatches] = useState<EvidenceMatch[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedPremise, setSelectedPremise] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageMetrics | null>(null);

  const analyzeMatches = useCallback(async () => {
    if (premises.length === 0 || availableEvidence.length === 0) {
      setMatches([]);
      setCoverage(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/evidence/analyze-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premises,
          evidence: availableEvidence,
          currentMatches,
          schemeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
        setCoverage(data.coverage || null);
      }
    } catch (err) {
      console.error("Failed to analyze matches:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [premises, availableEvidence, currentMatches, schemeId]);

  useEffect(() => {
    analyzeMatches();
  }, [analyzeMatches]);

  // Calculate coverage metrics
  const calculatedCoverage: CoverageMetrics = coverage || {
    totalPremises: premises.length,
    coveredPremises: Object.keys(currentMatches).filter((k) => currentMatches[k].length > 0)
      .length,
    coveragePercentage:
      premises.length > 0
        ? (Object.keys(currentMatches).filter((k) => currentMatches[k].length > 0).length /
            premises.length) *
          100
        : 0,
    requiredCovered: premises
      .filter((p) => p.isRequired)
      .filter((p) => currentMatches[p.key]?.length > 0).length,
    requiredTotal: premises.filter((p) => p.isRequired).length,
    optionalCovered: premises
      .filter((p) => !p.isRequired)
      .filter((p) => currentMatches[p.key]?.length > 0).length,
    optionalTotal: premises.filter((p) => !p.isRequired).length,
    averageMatchQuality: 0,
  };

  // Get suggestions for selected premise or all uncovered premises
  const relevantMatches = selectedPremise
    ? matches.filter((m) => m.premiseKey === selectedPremise)
    : matches.filter(
        (m) => !currentMatches[m.premiseKey] || currentMatches[m.premiseKey].length === 0
      );

  // Group matches by premise
  const matchesByPremise = premises.reduce((acc, premise) => {
    acc[premise.key] = matches.filter((m) => m.premiseKey === premise.key);
    return acc;
  }, {} as Record<string, EvidenceMatch[]>);

  return (
    <div className="space-y-6">
      {/* Coverage Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sky-600" />
              <CardTitle>Evidence Coverage</CardTitle>
            </div>
            <Badge
              variant={calculatedCoverage.coveragePercentage === 100 ? "default" : "secondary"}
            >
              {calculatedCoverage.coveragePercentage.toFixed(0)}% Covered
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Coverage</span>
              <span className="font-medium">
                {calculatedCoverage.coveredPremises} / {calculatedCoverage.totalPremises}{" "}
                premises
              </span>
            </div>
            <Progress
              value={calculatedCoverage.coveragePercentage}
              className="h-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Required Premises</span>
              </div>
              <div className="text-2xl font-bold">
                {calculatedCoverage.requiredCovered} / {calculatedCoverage.requiredTotal}
              </div>
              <Progress
                value={
                  calculatedCoverage.requiredTotal > 0
                    ? (calculatedCoverage.requiredCovered / calculatedCoverage.requiredTotal) *
                      100
                    : 0
                }
                className="h-1"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Optional Premises</span>
              </div>
              <div className="text-2xl font-bold">
                {calculatedCoverage.optionalCovered} / {calculatedCoverage.optionalTotal}
              </div>
              <Progress
                value={
                  calculatedCoverage.optionalTotal > 0
                    ? (calculatedCoverage.optionalCovered / calculatedCoverage.optionalTotal) *
                      100
                    : 0
                }
                className="h-1"
              />
            </div>
          </div>

          {calculatedCoverage.coveragePercentage < 100 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {calculatedCoverage.requiredTotal - calculatedCoverage.requiredCovered > 0 ? (
                  <span>
                    <strong>
                      {calculatedCoverage.requiredTotal - calculatedCoverage.requiredCovered}{" "}
                      required premise(s)
                    </strong>{" "}
                    need evidence. Review suggestions below.
                  </span>
                ) : (
                  <span>
                    All required premises covered. Consider adding evidence to{" "}
                    <strong>
                      {calculatedCoverage.optionalTotal - calculatedCoverage.optionalCovered}{" "}
                      optional premise(s)
                    </strong>{" "}
                    to strengthen your argument.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Premise-Evidence Mapping */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-sky-600" />
              <CardTitle>Premise-Evidence Mapping</CardTitle>
            </div>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showSuggestions ? "Hide" : "Show"} Suggestions
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {premises.map((premise) => (
                <PremiseEvidenceCard
                  key={premise.key}
                  premise={premise}
                  currentEvidence={
                    currentMatches[premise.key]
                      ?.map((id) => availableEvidence.find((e) => e.id === id))
                      .filter(Boolean) as Evidence[]
                  }
                  suggestedMatches={matchesByPremise[premise.key] || []}
                  showSuggestions={showSuggestions}
                  isSelected={selectedPremise === premise.key}
                  onSelect={() =>
                    setSelectedPremise(selectedPremise === premise.key ? null : premise.key)
                  }
                  onAssignEvidence={(evidenceId) => onEvidenceAssign?.(premise.key, evidenceId)}
                  onRemoveEvidence={(evidenceId) => onEvidenceRemove?.(premise.key, evidenceId)}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Smart Suggestions */}
      {showSuggestions && relevantMatches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-600" />
              <CardTitle>Smart Evidence Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relevantMatches
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 5)
                .map((match) => (
                  <SuggestionCard
                    key={`${match.premiseKey}-${match.evidenceId}`}
                    match={match}
                    onAccept={() => onEvidenceAssign?.(match.premiseKey, match.evidenceId)}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isAnalyzing && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            Analyzing evidence matches...
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Premise Evidence Card
// ============================================================================

interface PremiseEvidenceCardProps {
  premise: Premise;
  currentEvidence: Evidence[];
  suggestedMatches: EvidenceMatch[];
  showSuggestions: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onAssignEvidence: (evidenceId: string) => void;
  onRemoveEvidence: (evidenceId: string) => void;
}

function PremiseEvidenceCard({
  premise,
  currentEvidence,
  suggestedMatches,
  showSuggestions,
  isSelected,
  onSelect,
  onAssignEvidence,
  onRemoveEvidence,
}: PremiseEvidenceCardProps) {
  const hasCoverage = currentEvidence.length > 0;
  const topSuggestions = suggestedMatches
    .filter((m) => !currentEvidence.find((e) => e.id === m.evidenceId))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  return (
    <Card
      className={`transition-all ${
        isSelected ? "ring-2 ring-sky-600 shadow-lg" : "hover:bg-muted/50"
      }`}
    >
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Premise header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={premise.isRequired ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {premise.key}
                </Badge>
                {premise.isRequired && (
                  <span className="text-xs text-red-600 font-medium">* Required</span>
                )}
                {hasCoverage && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
              <p className="text-sm">{premise.text}</p>
              {premise.evidenceType && (
                <p className="text-xs text-muted-foreground">
                  Suggested evidence type: {premise.evidenceType}
                </p>
              )}
            </div>
            <button
              onClick={onSelect}
              className="p-2 hover:bg-muted rounded-md"
            >
              <Target className="h-4 w-4" />
            </button>
          </div>

          <Separator />

          {/* Current evidence */}
          {currentEvidence.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Linked Evidence ({currentEvidence.length})
              </h4>
              {currentEvidence.map((evidence) => (
                <div
                  key={evidence.id}
                  className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{evidence.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {evidence.type}
                        </Badge>
                        <span>Quality: {evidence.quality}%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveEvidence(evidence.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-600"
                  >
                    <span className="text-sm">✕</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted p-3 rounded text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No evidence linked to this premise
              </p>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && topSuggestions.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Suggested Evidence
              </h4>
              {topSuggestions.map((match) => (
                <div
                  key={match.evidenceId}
                  className="flex items-center justify-between bg-sky-50 border border-sky-200 p-2 rounded"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">{match.evidenceTitle}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {match.evidenceType}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-sky-600" />
                        <span className="text-xs font-medium text-sky-600">
                          {match.matchScore}% match
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {match.reasoning}
                    </p>
                  </div>
                  <button
                    onClick={() => onAssignEvidence(match.evidenceId)}
                    className="ml-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-8 px-3"
                  >
                    Link
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Suggestion Card
// ============================================================================

interface SuggestionCardProps {
  match: EvidenceMatch;
  onAccept: () => void;
}

function SuggestionCard({ match, onAccept }: SuggestionCardProps) {
  return (
    <Card className="bg-gradient-to-r from-sky-50 to-transparent border-sky-200">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-600" />
              <Badge variant="outline" className="text-xs">
                {match.premiseKey}
              </Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">{match.evidenceTitle}</span>
            </div>

            <p className="text-sm text-muted-foreground">{match.reasoning}</p>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Match:</span>
                <span className="font-medium text-sky-600">{match.matchScore}%</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Relevance:</span>
                <span className="font-medium">{match.relevanceScore}%</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Quality:</span>
                <span className="font-medium">{match.qualityScore}%</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="secondary" className="text-xs">
                {match.suggestedPlacement}
              </Badge>
            </div>
          </div>

          <button
            onClick={onAccept}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-9 px-4 flex-shrink-0"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Accept
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function EvidenceMatchingVisualizerSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
