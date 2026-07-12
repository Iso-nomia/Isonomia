"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  BarChart3,
  User,
  Eye,
  BookOpen,
  TrendingUp,
  Link2,
  Info,
  Lightbulb,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ============================================================================
// Types
// ============================================================================

export type EvidenceType =
  | "expert-testimony"
  | "statistical-data"
  | "eyewitness-testimony"
  | "documentary-evidence"
  | "example"
  | "causal-evidence"
  | "general-evidence";

export type EvidenceQuality = "strong" | "moderate" | "weak" | "none";

export interface EvidenceRequirement {
  type: EvidenceType;
  description: string;
  required: boolean;
  strengthNeeded: number; // 0-100
  examples: string[];
  tips: string[];
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  content: string;
  source?: string;
  quality: EvidenceQuality;
  strengthScore: number; // 0-100
  issues?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEvidenceTypeIcon(type: EvidenceType): React.ReactNode {
  switch (type) {
    case "expert-testimony":
      return <User className="h-4 w-4" />;
    case "statistical-data":
      return <BarChart3 className="h-4 w-4" />;
    case "eyewitness-testimony":
      return <Eye className="h-4 w-4" />;
    case "documentary-evidence":
      return <FileText className="h-4 w-4" />;
    case "example":
      return <BookOpen className="h-4 w-4" />;
    case "causal-evidence":
      return <TrendingUp className="h-4 w-4" />;
    case "general-evidence":
      return <Link2 className="h-4 w-4" />;
  }
}

function getEvidenceTypeLabel(type: EvidenceType): string {
  switch (type) {
    case "expert-testimony":
      return "Expert Testimony";
    case "statistical-data":
      return "Statistical Data";
    case "eyewitness-testimony":
      return "Eyewitness Testimony";
    case "documentary-evidence":
      return "Documentary Evidence";
    case "example":
      return "Example";
    case "causal-evidence":
      return "Causal Evidence";
    case "general-evidence":
      return "General Evidence";
  }
}

function getQualityConfig(quality: EvidenceQuality): {
  label: string;
  color: string;
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (quality) {
    case "strong":
      return {
        label: "Strong Evidence",
        color: "green",
        icon: <CheckCircle2 className="h-4 w-4" />,
        bgClass: "bg-green-50",
        textClass: "text-green-900",
        borderClass: "border-green-200",
      };
    case "moderate":
      return {
        label: "Moderate Evidence",
        color: "amber",
        icon: <Minus className="h-4 w-4" />,
        bgClass: "bg-amber-50",
        textClass: "text-amber-900",
        borderClass: "border-amber-200",
      };
    case "weak":
      return {
        label: "Weak Evidence",
        color: "orange",
        icon: <AlertTriangle className="h-4 w-4" />,
        bgClass: "bg-orange-50",
        textClass: "text-orange-900",
        borderClass: "border-orange-200",
      };
    case "none":
      return {
        label: "No Evidence",
        color: "red",
        icon: <AlertCircle className="h-4 w-4" />,
        bgClass: "bg-red-50",
        textClass: "text-red-900",
        borderClass: "border-red-200",
      };
  }
}

function getStrengthColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

// ============================================================================
// EvidenceRequirements Component
// ============================================================================

export interface EvidenceRequirementsProps {
  requirements: EvidenceRequirement[];
  className?: string;
}

/**
 * Displays required evidence types for an argument with detailed guidance.
 * Shows what types of evidence are needed, their importance, and tips.
 */
export function EvidenceRequirements({
  requirements,
  className = "",
}: EvidenceRequirementsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-sky-600" />
        <h3 className="font-semibold text-lg">Evidence Requirements</h3>
      </div>

      <div className="space-y-3">
        {requirements.map((req, index) => (
          <EvidenceTypeCard key={index} requirement={req} />
        ))}
      </div>

      {requirements.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No specific evidence requirements. General supporting evidence is sufficient.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ============================================================================
// EvidenceTypeCard Component
// ============================================================================

interface EvidenceTypeCardProps {
  requirement: EvidenceRequirement;
}

/**
 * Card showing details for a specific evidence type requirement.
 */
function EvidenceTypeCard({ requirement }: EvidenceTypeCardProps) {
  const icon = getEvidenceTypeIcon(requirement.type);
  const label = getEvidenceTypeLabel(requirement.type);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">{icon}</div>
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {requirement.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {requirement.required && (
              <Badge className="bg-red-600 hover:bg-red-700">Required</Badge>
            )}
            <HoverCard>
              <HoverCardTrigger>
                <Badge variant="outline" className="cursor-help">
                  {requirement.strengthNeeded}% strength
                </Badge>
              </HoverCardTrigger>
              <HoverCardContent className="w-64">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Strength Needed</p>
                  <p className="text-sm text-muted-foreground">
                    Your evidence should meet at least{" "}
                    {requirement.strengthNeeded}% quality to satisfy this
                    requirement.
                  </p>
                  <Progress value={requirement.strengthNeeded} className="h-2" />
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Examples */}
        {requirement.examples.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-3.5 w-3.5 text-sky-600" />
              Examples
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-5">
              {requirement.examples.map((example, idx) => (
                <li key={idx}>{example}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tips */}
        {requirement.tips.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Tips
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-5">
              {requirement.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EvidenceValidator Component
// ============================================================================

export interface EvidenceValidatorProps {
  evidence: EvidenceItem[];
  requirements: EvidenceRequirement[];
  className?: string;
}

/**
 * Validates evidence against requirements and shows validation status.
 * Displays what's missing, what's weak, and what's strong.
 */
export function EvidenceValidator({
  evidence,
  requirements,
  className = "",
}: EvidenceValidatorProps) {
  // Calculate validation results
  const validation = React.useMemo(() => {
    const results: {
      satisfied: EvidenceRequirement[];
      missing: EvidenceRequirement[];
      weak: Array<{ requirement: EvidenceRequirement; evidence: EvidenceItem }>;
    } = {
      satisfied: [],
      missing: [],
      weak: [],
    };

    requirements.forEach((req) => {
      const matchingEvidence = evidence.filter((ev) => ev.type === req.type);

      if (matchingEvidence.length === 0) {
        results.missing.push(req);
      } else {
        const strongestEvidence = matchingEvidence.reduce((prev, curr) =>
          curr.strengthScore > prev.strengthScore ? curr : prev
        );

        if (strongestEvidence.strengthScore >= req.strengthNeeded) {
          results.satisfied.push(req);
        } else {
          results.weak.push({
            requirement: req,
            evidence: strongestEvidence,
          });
        }
      }
    });

    return results;
  }, [evidence, requirements]);

  const totalRequired = requirements.filter((r) => r.required).length;
  const satisfiedRequired = validation.satisfied.filter((r) => r.required).length;
  const overallProgress =
    requirements.length > 0
      ? (validation.satisfied.length / requirements.length) * 100
      : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-sky-600" />
          <h3 className="font-semibold text-lg">Evidence Validation</h3>
        </div>
        <Badge
          className={
            overallProgress >= 70
              ? "bg-green-600"
              : overallProgress >= 40
              ? "bg-amber-600"
              : "bg-red-600"
          }
        >
          {Math.round(overallProgress)}% Complete
        </Badge>
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {validation.satisfied.length} of {requirements.length} requirements satisfied
          </span>
          {totalRequired > 0 && (
            <span className="text-muted-foreground">
              {satisfiedRequired}/{totalRequired} required
            </span>
          )}
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      <Separator />

      {/* Satisfied requirements */}
      {validation.satisfied.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
            <ThumbsUp className="h-4 w-4" />
            Satisfied ({validation.satisfied.length})
          </div>
          <div className="space-y-2">
            {validation.satisfied.map((req, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm text-muted-foreground bg-green-50 p-2 rounded border border-green-200"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span>{getEvidenceTypeLabel(req.type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak evidence */}
      {validation.weak.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Needs Improvement ({validation.weak.length})
          </div>
          <div className="space-y-2">
            {validation.weak.map(({ requirement, evidence: ev }, idx) => (
              <Alert key={idx} className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {getEvidenceTypeLabel(requirement.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ev.strengthScore}% / {requirement.strengthNeeded}% needed
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Evidence quality is below required strength. Consider finding
                    stronger sources or providing more detail.
                  </p>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Missing requirements */}
      {validation.missing.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <ThumbsDown className="h-4 w-4" />
            Missing ({validation.missing.length})
          </div>
          <div className="space-y-2">
            {validation.missing.map((req, idx) => (
              <Alert key={idx} className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {getEvidenceTypeLabel(req.type)}
                    </span>
                    {req.required && (
                      <Badge className="bg-red-600 text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">{req.description}</p>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EvidenceQualityIndicator Component
// ============================================================================

export interface EvidenceQualityIndicatorProps {
  evidence: EvidenceItem;
  showDetails?: boolean;
  className?: string;
}

/**
 * Displays quality assessment for a specific piece of evidence.
 * Shows strength score, quality level, and any issues detected.
 */
export function EvidenceQualityIndicator({
  evidence,
  showDetails = true,
  className = "",
}: EvidenceQualityIndicatorProps) {
  const qualityConfig = getQualityConfig(evidence.quality);
  const strengthColor = getStrengthColor(evidence.strengthScore);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Quality badge and score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${qualityConfig.bgClass}`}>
            {qualityConfig.icon}
          </div>
          <div>
            <div className="font-medium text-sm">{qualityConfig.label}</div>
            <div className="text-xs text-muted-foreground">
              {getEvidenceTypeLabel(evidence.type)}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`${qualityConfig.bgClass} ${qualityConfig.borderClass}`}
        >
          {evidence.strengthScore}%
        </Badge>
      </div>

      {/* Strength meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Evidence Strength</span>
          <span>{evidence.strengthScore}%</span>
        </div>
        <Progress value={evidence.strengthScore} className="h-2">
          <div
            className={`h-full ${strengthColor} transition-all`}
            style={{ width: `${evidence.strengthScore}%` }}
          />
        </Progress>
      </div>

      {showDetails && (
        <>
          {/* Evidence content preview */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Content
            </div>
            <div className="text-sm bg-muted p-2 rounded border text-muted-foreground">
              {evidence.content.slice(0, 150)}
              {evidence.content.length > 150 && "..."}
            </div>
          </div>

          {/* Source */}
          {evidence.source && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Source
              </div>
              <div className="text-sm text-sky-600 underline truncate">
                {evidence.source}
              </div>
            </div>
          )}

          {/* Issues */}
          {evidence.issues && evidence.issues.length > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">Quality Issues Detected</div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {evidence.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// EvidenceSuggestions Component
// ============================================================================

export interface EvidenceSuggestion {
  type: EvidenceType;
  description: string;
  searchTerms: string[];
  sources: string[];
}

export interface EvidenceSuggestionsProps {
  suggestions: EvidenceSuggestion[];
  onApplySuggestion?: (suggestion: EvidenceSuggestion) => void;
  className?: string;
}

/**
 * AI-powered suggestions for finding and improving evidence.
 * Shows what to search for, where to look, and how to strengthen evidence.
 */
export function EvidenceSuggestions({
  suggestions,
  onApplySuggestion,
  className = "",
}: EvidenceSuggestionsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-lg">Evidence Suggestions</h3>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    {getEvidenceTypeIcon(suggestion.type)}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {getEvidenceTypeLabel(suggestion.type)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Search terms */}
              {suggestion.searchTerms.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Try Searching For:</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.searchTerms.map((term, idx) => (
                      <Badge key={idx} variant="outline" className="bg-sky-50">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended sources */}
              {suggestion.sources.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recommended Sources:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-1">
                    {suggestion.sources.map((source, idx) => (
                      <li key={idx}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Apply button */}
              {onApplySuggestion && (
                <button
                  onClick={() => onApplySuggestion(suggestion)}
                  className="w-full py-2 px-3 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-medium transition-colors"
                >
                  Use This Suggestion
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {suggestions.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No evidence suggestions available. Your evidence appears sufficient.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ============================================================================
// EvidenceStrengthMeter Component
// ============================================================================

export interface EvidenceStrengthMeterProps {
  overallStrength: number;
  breakdown: Array<{
    category: string;
    score: number;
    description: string;
  }>;
  className?: string;
}

/**
 * Visual meter showing overall evidence strength with category breakdown.
 * Helps users understand what's strong and what needs work.
 */
export function EvidenceStrengthMeter({
  overallStrength,
  breakdown,
  className = "",
}: EvidenceStrengthMeterProps) {
  const strengthColor = getStrengthColor(overallStrength);
  const strengthLabel =
    overallStrength >= 70 ? "Strong" : overallStrength >= 40 ? "Moderate" : "Weak";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Evidence Strength</span>
          <Badge
            className={
              overallStrength >= 70
                ? "bg-green-600"
                : overallStrength >= 40
                ? "bg-amber-600"
                : "bg-red-600"
            }
          >
            {strengthLabel} ({overallStrength}%)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall strength meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Quality</span>
            <span className="font-medium">{overallStrength}%</span>
          </div>
          <Progress value={overallStrength} className="h-3">
            <div
              className={`h-full ${strengthColor} transition-all`}
              style={{ width: `${overallStrength}%` }}
            />
          </Progress>
        </div>

        <Separator />

        {/* Category breakdown */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Category Breakdown</div>
          {breakdown.map((category, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <HoverCard>
                  <HoverCardTrigger className="cursor-help underline decoration-dotted">
                    {category.category}
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <p className="text-sm">{category.description}</p>
                  </HoverCardContent>
                </HoverCard>
                <span className="text-muted-foreground">{category.score}%</span>
              </div>
              <Progress value={category.score} className="h-1.5">
                <div
                  className={`h-full ${getStrengthColor(category.score)} transition-all`}
                  style={{ width: `${category.score}%` }}
                />
              </Progress>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
