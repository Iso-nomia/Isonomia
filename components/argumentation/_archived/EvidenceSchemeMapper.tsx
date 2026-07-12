"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Zap,
  CheckCircle2,
  ArrowRight,
  Filter,
  TrendingUp,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SchemeMatch {
  schemeId: string;
  schemeName: string;
  schemeCategory: string;
  matchScore: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  evidenceUtilization: {
    usedEvidence: string[];
    unusedEvidence: string[];
    utilizationRate: number; // percentage
  };
  premiseMapping: Array<{
    premiseKey: string;
    premiseTemplate: string;
    mappedEvidence: string[];
    fillability: number; // 0-100
  }>;
  strengthPrediction: {
    expectedStrength: number;
    confidenceInterval: [number, number];
    keyFactors: string[];
  };
  requirements: {
    met: string[];
    missing: string[];
    optional: string[];
  };
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: string;
  content: string;
  quality: number;
  source: string;
  credibility: number;
  relevance: number;
}

interface EvidenceSchemeMapperProps {
  targetArgumentId?: string;
  availableEvidence: EvidenceItem[];
  onSelectScheme?: (match: SchemeMatch) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function EvidenceSchemeMapper({
  targetArgumentId,
  availableEvidence,
  onSelectScheme,
}: EvidenceSchemeMapperProps) {
  const [matches, setMatches] = useState<SchemeMatch[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState(60);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"match" | "strength" | "utilization">("match");

  const analyzeSchemeMatches = useCallback(async () => {
    if (availableEvidence.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/evidence/match-schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence: availableEvidence,
          targetArgumentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches);
      }
    } catch (err) {
      console.error("Failed to analyze scheme matches:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [availableEvidence, targetArgumentId]);

  useEffect(() => {
    analyzeSchemeMatches();
  }, [analyzeSchemeMatches]);

  const filteredMatches = matches
    .filter((m) => m.matchScore >= minMatchScore)
    .filter((m) => !selectedCategory || m.schemeCategory === selectedCategory)
    .sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore;
      if (sortBy === "strength") return b.strengthPrediction.expectedStrength - a.strengthPrediction.expectedStrength;
      if (sortBy === "utilization") return b.evidenceUtilization.utilizationRate - a.evidenceUtilization.utilizationRate;
      return 0;
    });

  const categories = Array.from(new Set(matches.map((m) => m.schemeCategory)));

  const evidenceStats = {
    total: availableEvidence.length,
    highQuality: availableEvidence.filter((e) => e.quality >= 80).length,
    mediumQuality: availableEvidence.filter((e) => e.quality >= 50 && e.quality < 80).length,
    lowQuality: availableEvidence.filter((e) => e.quality < 50).length,
  };

  if (availableEvidence.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <Database className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No evidence available</p>
            <p className="text-sm text-muted-foreground">Add evidence to see scheme recommendations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Evidence Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-sky-600" />
                Evidence Collection
              </CardTitle>
              <CardDescription>
                {evidenceStats.total} items available for scheme matching
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {evidenceStats.highQuality}
              </div>
              <div className="text-sm text-green-600">High Quality</div>
              <div className="text-xs text-muted-foreground">≥80%</div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">
                {evidenceStats.mediumQuality}
              </div>
              <div className="text-sm text-yellow-600">Medium Quality</div>
              <div className="text-xs text-muted-foreground">50-79%</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {evidenceStats.lowQuality}
              </div>
              <div className="text-sm text-red-600">Low Quality</div>
              <div className="text-xs text-muted-foreground">&lt;50%</div>
            </div>
          </div>

          <button
            onClick={analyzeSchemeMatches}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Analyzing Matches...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Re-analyze Schemes
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* Scheme Matches */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recommended Schemes</CardTitle>
              <CardDescription>
                {filteredMatches.length} schemes match your evidence
              </CardDescription>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="match">Sort by Match Score</option>
              <option value="strength">Sort by Predicted Strength</option>
              <option value="utilization">Sort by Evidence Use</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by Category:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? "bg-sky-600 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                All ({matches.length})
              </button>
              {categories.map((category) => {
                const count = matches.filter((m) => m.schemeCategory === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? "bg-sky-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {category} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Match score filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Minimum Match Score</span>
              <span className="font-medium">{minMatchScore}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Scheme cards */}
          <div className="space-y-3">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No schemes meet the current filter criteria
              </div>
            ) : (
              filteredMatches.map((match) => (
                <SchemeMatchCard
                  key={match.schemeId}
                  match={match}
                  evidence={availableEvidence}
                  onSelect={() => onSelectScheme?.(match)}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Scheme Match Card
// ============================================================================

interface SchemeMatchCardProps {
  match: SchemeMatch;
  evidence: EvidenceItem[];
  onSelect?: () => void;
}

function SchemeMatchCard({ match, evidence, onSelect }: SchemeMatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const matchColor =
    match.matchScore >= 80
      ? "text-green-600"
      : match.matchScore >= 60
      ? "text-yellow-600"
      : "text-red-600";

  const confidenceColor =
    match.confidence >= 80
      ? "bg-green-100 text-green-800 border-green-200"
      : match.confidence >= 60
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";

  return (
    <Card className="hover:bg-muted/50 transition-all">
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="bg-sky-100 p-2 rounded-lg">
                <Star className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{match.schemeName}</h4>
                  <Badge className="bg-gray-100 text-gray-700">
                    {match.schemeCategory}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {match.reasoning}
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
            <div className={`flex items-center gap-1 ${matchColor}`}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">{match.matchScore}% match</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              <span>{match.strengthPrediction.expectedStrength}% predicted strength</span>
            </div>
            <Badge className={confidenceColor}>
              {match.confidence}% confidence
            </Badge>
          </div>

          {/* Evidence utilization bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Evidence Utilization</span>
              <span className="font-medium">
                {match.evidenceUtilization.usedEvidence.length} / {evidence.length} used
                ({Math.round(match.evidenceUtilization.utilizationRate)}%)
              </span>
            </div>
            <Progress value={match.evidenceUtilization.utilizationRate} className="h-2" />
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="pt-3 border-t space-y-4">
              {/* Premise Mapping */}
              <div>
                <p className="text-sm font-medium mb-2">Premise Mapping</p>
                <div className="space-y-2">
                  {match.premiseMapping.map((premise) => (
                    <div
                      key={premise.premiseKey}
                      className="p-3 rounded-lg bg-muted space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {premise.premiseKey}
                        </span>
                        <Badge
                          className={
                            premise.fillability >= 80
                              ? "bg-green-100 text-green-800"
                              : premise.fillability >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {premise.fillability}% fillable
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {premise.premiseTemplate}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        {premise.mappedEvidence.length} evidence items mapped
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strength Prediction */}
              <div>
                <p className="text-sm font-medium mb-2">Strength Prediction</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Expected Strength</span>
                      <span className="font-medium">
                        {match.strengthPrediction.expectedStrength}%
                      </span>
                    </div>
                    <Progress value={match.strengthPrediction.expectedStrength} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      Confidence interval: {match.strengthPrediction.confidenceInterval[0]}% - {match.strengthPrediction.confidenceInterval[1]}%
                    </div>
                  </div>
                  {match.strengthPrediction.keyFactors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Key Factors:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {match.strengthPrediction.keyFactors.map((factor, i) => (
                          <li key={i}>• {factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div>
                <p className="text-sm font-medium mb-2">Requirements</p>
                <div className="space-y-2">
                  {match.requirements.met.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1">✓ Met:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {match.requirements.met.map((req, i) => (
                          <li key={i}>• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {match.requirements.missing.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 mb-1">✗ Missing:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {match.requirements.missing.map((req, i) => (
                          <li key={i}>• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Unused Evidence */}
              {match.evidenceUtilization.unusedEvidence.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Unused Evidence</p>
                  <div className="text-xs text-muted-foreground">
                    {match.evidenceUtilization.unusedEvidence.length} items not utilized by this scheme
                  </div>
                </div>
              )}

              {/* Action */}
              {onSelect && (
                <button
                  onClick={onSelect}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Use This Scheme
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
