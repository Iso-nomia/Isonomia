"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Target,
  Shield,
  TrendingUp,
  Clock,
  User,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BurdenIndicator,
  BurdenComparison,
} from "@/components/argumentation/BurdenOfProofIndicators";

// ============================================================================
// Types
// ============================================================================

export type AttackType = "REBUTS" | "UNDERCUTS" | "UNDERMINES";

export interface AttackData {
  // Attack strategy
  attackType: AttackType;
  targetId: string;
  targetType: "conclusion" | "inference" | "premise";
  targetText: string;
  
  // Scheme and construction
  schemeId: string;
  schemeName: string;
  
  // Premises
  premises: Record<string, string>;
  
  // Evidence
  evidence: Array<{
    id: string;
    type: string;
    content: string;
    source?: string;
  }>;
  
  // Burden of proof
  burdenOfProof: "proponent" | "challenger";
  burdenAdvantage: boolean;
  
  // Quality scores
  overallScore: number;
  completenessScore: number;
  evidenceScore: number;
  coherenceScore: number;
  vulnerabilityScore: number;
  
  // Strategic info
  strategicValue: number;
  difficulty: number;
  reasoning?: string;
  constructionSteps?: string[];
}

export interface SubmissionResult {
  success: boolean;
  attackId?: string;
  error?: string;
  message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAttackTypeInfo(type: AttackType): {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgClass: string;
} {
  switch (type) {
    case "REBUTS":
      return {
        label: "Rebuttal",
        description: "Directly contradicts the claim with counter-evidence",
        icon: <Shield className="h-4 w-4" />,
        color: "red",
        bgClass: "bg-red-100 text-red-800 border-red-300",
      };
    case "UNDERCUTS":
      return {
        label: "Undercut",
        description: "Challenges the reasoning or inference",
        icon: <Target className="h-4 w-4" />,
        color: "orange",
        bgClass: "bg-orange-100 text-orange-800 border-orange-300",
      };
    case "UNDERMINES":
      return {
        label: "Undermine",
        description: "Questions the premises or assumptions",
        icon: <TrendingUp className="h-4 w-4" />,
        color: "amber",
        bgClass: "bg-amber-100 text-amber-800 border-amber-300",
      };
  }
}

function getQualityLevel(score: number): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (score >= 70) {
    return {
      label: "Strong",
      color: "green",
      icon: <CheckCircle2 className="h-4 w-4" />,
    };
  } else if (score >= 40) {
    return {
      label: "Moderate",
      color: "amber",
      icon: <AlertTriangle className="h-4 w-4" />,
    };
  } else {
    return {
      label: "Weak",
      color: "red",
      icon: <AlertCircle className="h-4 w-4" />,
    };
  }
}

// ============================================================================
// AttackPreview Component
// ============================================================================

export interface AttackPreviewProps {
  attack: AttackData;
  showFullDetails?: boolean;
  className?: string;
}

/**
 * Comprehensive preview of an attack before submission.
 * Shows all details: strategy, premises, evidence, quality scores, burden analysis.
 */
export function AttackPreview({
  attack,
  showFullDetails = true,
  className = "",
}: AttackPreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["strategy", "premises", "quality"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const attackTypeInfo = getAttackTypeInfo(attack.attackType);
  const qualityLevel = getQualityLevel(attack.overallScore);
  const premiseCount = Object.keys(attack.premises).length;
  const filledPremises = Object.values(attack.premises).filter(
    (p) => p && p.trim() !== ""
  ).length;
  const evidenceCount = attack.evidence.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with attack type and quality */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${attackTypeInfo.bgClass}`}>
                  {attackTypeInfo.icon}
                </div>
                <div>
                  <CardTitle>{attackTypeInfo.label} Attack</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {attackTypeInfo.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                className={
                  qualityLevel.color === "green"
                    ? "bg-green-600"
                    : qualityLevel.color === "amber"
                    ? "bg-amber-600"
                    : "bg-red-600"
                }
              >
                {qualityLevel.label} ({attack.overallScore}%)
              </Badge>
              {attack.burdenAdvantage && (
                <Badge className="bg-sky-600">Burden Advantage</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Target info */}
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg border">
            <Target className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="text-sm font-medium">
                Targeting {attack.targetType}
              </div>
              <div className="text-sm text-muted-foreground">
                {attack.targetText}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-sky-600">
                {filledPremises}/{premiseCount}
              </div>
              <div className="text-xs text-muted-foreground">Premises</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-sky-600">
                {evidenceCount}
              </div>
              <div className="text-xs text-muted-foreground">Evidence Items</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-sky-600">
                {attack.strategicValue}%
              </div>
              <div className="text-xs text-muted-foreground">Strategic Value</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Section */}
      <CollapsibleSection
        title="Attack Strategy"
        isExpanded={expandedSections.has("strategy")}
        onToggle={() => toggleSection("strategy")}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">Argumentation Scheme</div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded border">
              {attack.schemeName}
            </div>
          </div>

          {attack.reasoning && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Strategic Reasoning</div>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded border">
                {attack.reasoning}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Difficulty</div>
              <div className="flex items-center gap-2">
                <Progress value={attack.difficulty} className="h-2 flex-1" />
                <span className="text-sm text-muted-foreground">
                  {attack.difficulty}%
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Strategic Value</div>
              <div className="flex items-center gap-2">
                <Progress value={attack.strategicValue} className="h-2 flex-1" />
                <span className="text-sm text-muted-foreground">
                  {attack.strategicValue}%
                </span>
              </div>
            </div>
          </div>

          {/* Burden comparison */}
          <BurdenComparison
            yourBurden={attack.burdenOfProof}
            theirBurden={
              attack.burdenOfProof === "proponent" ? "challenger" : "proponent"
            }
          />
        </div>
      </CollapsibleSection>

      {/* Premises Section */}
      <CollapsibleSection
        title="Premises"
        badge={`${filledPremises}/${premiseCount}`}
        isExpanded={expandedSections.has("premises")}
        onToggle={() => toggleSection("premises")}
      >
        <div className="space-y-3">
          {Object.entries(attack.premises).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="text-sm font-medium capitalize">
                {key.replace(/_/g, " ")}
              </div>
              <div
                className={`text-sm p-3 rounded border ${
                  value && value.trim()
                    ? "bg-green-50 border-green-200 text-green-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                {value && value.trim() ? (
                  value
                ) : (
                  <span className="italic">Not filled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Evidence Section */}
      <CollapsibleSection
        title="Evidence"
        badge={String(evidenceCount)}
        isExpanded={expandedSections.has("evidence")}
        onToggle={() => toggleSection("evidence")}
      >
        <div className="space-y-3">
          {attack.evidence.length > 0 ? (
            attack.evidence.map((ev) => (
              <Card key={ev.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="bg-sky-50">
                      {ev.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">{ev.content}</div>
                  {ev.source && (
                    <div className="flex items-center gap-1 text-xs text-sky-600">
                      <ExternalLink className="h-3 w-3" />
                      <a
                        href={ev.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline truncate"
                      >
                        {ev.source}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No evidence attached. This is optional but may strengthen your
                attack.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CollapsibleSection>

      {/* Quality Scores Section */}
      <CollapsibleSection
        title="Quality Assessment"
        badge={`${attack.overallScore}%`}
        isExpanded={expandedSections.has("quality")}
        onToggle={() => toggleSection("quality")}
      >
        <div className="space-y-4">
          {/* Overall score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Quality</span>
              <span className={`font-bold text-${qualityLevel.color}-600`}>
                {attack.overallScore}%
              </span>
            </div>
            <Progress value={attack.overallScore} className="h-3" />
          </div>

          <Separator />

          {/* Component scores */}
          <div className="space-y-3">
            <ScoreBar
              label="Completeness"
              score={attack.completenessScore}
              description="All premises filled and well-formed"
            />
            <ScoreBar
              label="Evidence Quality"
              score={attack.evidenceScore}
              description="Strength and credibility of supporting evidence"
            />
            <ScoreBar
              label="Logical Coherence"
              score={attack.coherenceScore}
              description="Premises logically support the conclusion"
            />
            <ScoreBar
              label="Resilience"
              score={100 - attack.vulnerabilityScore}
              description="Resistance to counter-attacks"
            />
          </div>

          {/* Quality gate warning */}
          {attack.overallScore < 40 && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm">
                <div className="font-medium text-red-900">
                  Quality Below Minimum
                </div>
                <div className="text-red-800 mt-1">
                  This attack has a quality score below 40%. Consider improving
                  premises or evidence before submitting.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CollapsibleSection>

      {showFullDetails && attack.constructionSteps && (
        <CollapsibleSection
          title="Construction Steps"
          isExpanded={expandedSections.has("steps")}
          onToggle={() => toggleSection("steps")}
        >
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            {attack.constructionSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================================
// ScoreBar Component
// ============================================================================

interface ScoreBarProps {
  label: string;
  score: number;
  description: string;
}

function ScoreBar({ label, score, description }: ScoreBarProps) {
  const color = score >= 70 ? "green" : score >= 40 ? "amber" : "red";
  const bgClass =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <span className="font-medium">{label}</span>
          <div className="group relative">
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-black text-white text-xs rounded shadow-lg z-10">
              {description}
            </div>
          </div>
        </div>
        <span className="text-muted-foreground">{score}%</span>
      </div>
      <Progress value={score} className="h-2">
        <div
          className={`h-full ${bgClass} transition-all`}
          style={{ width: `${score}%` }}
        />
      </Progress>
    </div>
  );
}

// ============================================================================
// CollapsibleSection Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  badge,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {badge && (
              <Badge variant="outline" className="bg-sky-50">
                {badge}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isExpanded && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// ============================================================================
// AttackSubmission Component
// ============================================================================

export interface AttackSubmissionProps {
  attack: AttackData;
  onSubmit: (attack: AttackData) => Promise<SubmissionResult>;
  onCancel?: () => void;
  className?: string;
}

/**
 * Submission flow with validation, confirmation, and result handling.
 * Includes quality gate enforcement and submission confirmation.
 */
export function AttackSubmission({
  attack,
  onSubmit,
  onCancel,
  className = "",
}: AttackSubmissionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [confirmationStep, setConfirmationStep] = useState<
    "preview" | "confirm" | "result"
  >("preview");

  // Validation checks
  const checks = React.useMemo(() => {
    const filledPremises = Object.values(attack.premises).filter(
      (p) => p && p.trim() !== ""
    );
    const premiseCount = Object.keys(attack.premises).length;

    return {
      allPremisesFilled: filledPremises.length === premiseCount,
      minimumQuality: attack.overallScore >= 20,
      hasEvidence: attack.evidence.length > 0,
      canSubmit:
        filledPremises.length === premiseCount && attack.overallScore >= 20,
    };
  }, [attack]);

  const handleSubmit = async () => {
    if (!checks.canSubmit) return;

    setIsSubmitting(true);
    try {
      const submissionResult = await onSubmit(attack);
      setResult(submissionResult);
      setConfirmationStep("result");
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "Submission failed",
      });
      setConfirmationStep("result");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview step
  if (confirmationStep === "preview") {
    return (
      <div className={`space-y-4 ${className}`}>
        <AttackPreview attack={attack} showFullDetails={true} />

        {/* Validation checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ready to Submit?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ValidationCheck
              passed={checks.allPremisesFilled}
              label="All premises filled"
            />
            <ValidationCheck
              passed={checks.minimumQuality}
              label="Quality score ≥ 20%"
            />
            <ValidationCheck
              passed={checks.hasEvidence}
              label="Evidence provided (recommended)"
              optional
            />

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
                onClick={() => setConfirmationStep("confirm")}
                disabled={!checks.canSubmit}
                className={`flex-1 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                  checks.canSubmit
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                Continue to Submit
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation step
  if (confirmationStep === "confirm") {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirm Submission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription>
                <div className="font-medium text-amber-900 mb-1">
                  You are about to submit this attack
                </div>
                <div className="text-sm text-amber-800">
                  Once submitted, this attack will be visible to other participants
                  and may impact the deliberation. Make sure you&apos;ve reviewed
                  all details.
                </div>
              </AlertDescription>
            </Alert>

            {/* Quick summary */}
            <div className="space-y-2 p-4 bg-muted rounded-lg border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Attack Type</span>
                <Badge className="bg-sky-600">
                  {getAttackTypeInfo(attack.attackType).label}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quality Score</span>
                <span className="font-medium">{attack.overallScore}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Premises</span>
                <span className="font-medium">
                  {Object.keys(attack.premises).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Evidence</span>
                <span className="font-medium">{attack.evidence.length}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmationStep("preview")}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Back to Review
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Attack"
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Result step
  return (
    <div className={`space-y-4 ${className}`}>
      <SubmissionConfirmation result={result!} />
    </div>
  );
}

// ============================================================================
// ValidationCheck Component
// ============================================================================

interface ValidationCheckProps {
  passed: boolean;
  label: string;
  optional?: boolean;
}

function ValidationCheck({ passed, label, optional }: ValidationCheckProps) {
  return (
    <div className="flex items-center gap-2">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : optional ? (
        <Info className="h-4 w-4 text-amber-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
      )}
      <span
        className={`text-sm ${
          passed
            ? "text-green-900"
            : optional
            ? "text-amber-900"
            : "text-red-900"
        }`}
      >
        {label}
        {optional && " (optional)"}
      </span>
    </div>
  );
}

// ============================================================================
// SubmissionConfirmation Component
// ============================================================================

export interface SubmissionConfirmationProps {
  result: SubmissionResult;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Success or error message after submission attempt.
 */
export function SubmissionConfirmation({
  result,
  onDismiss,
  className = "",
}: SubmissionConfirmationProps) {
  if (result.success) {
    return (
      <Card className={`${className} border-green-200`}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCheck className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-900">
                Attack Submitted Successfully!
              </h3>
              <p className="text-sm text-muted-foreground">
                {result.message ||
                  "Your attack has been added to the deliberation and is now visible to other participants."}
              </p>
              {result.attackId && (
                <p className="text-xs text-muted-foreground font-mono">
                  Attack ID: {result.attackId}
                </p>
              )}
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} border-red-200`}>
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-red-900">
              Submission Failed
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.error || "An error occurred while submitting your attack."}
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
