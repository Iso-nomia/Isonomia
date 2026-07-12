"use client";

import { CheckCircle2, AlertCircle, AlertTriangle, Info, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ============================================================================
// Types
// ============================================================================

export type BurdenType = "proponent" | "challenger" | "PROPONENT" | "CHALLENGER";

export interface BurdenIndicatorProps {
  burden: BurdenType | string;
  requiresEvidence?: boolean;
  className?: string;
  variant?: "compact" | "detailed" | "inline";
}

export interface BurdenComparisonProps {
  yourBurden: BurdenType | string;
  theirBurden: BurdenType | string;
  requiresEvidence?: boolean;
  className?: string;
}

export interface BurdenExplanationProps {
  burden: BurdenType | string;
  context?: "attack" | "support" | "general";
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeBurden(burden: BurdenType | string): "proponent" | "challenger" {
  return String(burden || "").toLowerCase() === "proponent" ? "proponent" : "challenger";
}

function getBurdenConfig(burden: string, requiresEvidence: boolean = false) {
  const normalized = normalizeBurden(burden);

  if (normalized === "proponent") {
    return {
      type: "advantage" as const,
      icon: CheckCircle2,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-900",
      iconColor: "text-green-600",
      badgeColor: "bg-green-100 text-green-800",
      title: "Burden Advantage",
      description: "Just asking shifts burden back to original arguer",
    };
  }

  if (!requiresEvidence) {
    return {
      type: "moderate" as const,
      icon: AlertTriangle,
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-900",
      iconColor: "text-amber-600",
      badgeColor: "bg-amber-100 text-amber-800",
      title: "Moderate Difficulty",
      description: "Some evidence needed, but bar is not high",
    };
  }

  return {
    type: "challenger" as const,
    icon: AlertCircle,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-900",
    iconColor: "text-red-600",
    badgeColor: "bg-red-100 text-red-800",
    title: "High Difficulty",
    description: "You bear burden of proof and must provide strong evidence",
  };
}

// ============================================================================
// BurdenIndicator - Main Visual Indicator
// ============================================================================

export function BurdenIndicator({
  burden,
  requiresEvidence = false,
  className = "",
  variant = "detailed",
}: BurdenIndicatorProps) {
  const config = getBurdenConfig(burden, requiresEvidence);
  const Icon = config.icon;

  // Compact variant - just badge
  if (variant === "compact") {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Badge className={`${config.badgeColor} cursor-help ${className}`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.title}
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent className="w-72">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{config.title}</h4>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <BurdenExplanation burden={burden} />
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Inline variant - minimal inline indicator
  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${config.textColor} ${className}`}>
        <Icon className="h-3 w-3" />
        <span className="font-medium">{config.title}</span>
      </span>
    );
  }

  // Detailed variant - full alert box (default)
  return (
    <Alert className={`${config.bgColor} ${config.borderColor} ${className}`}>
      <Icon className={`h-4 w-4 ${config.iconColor}`} />
      <AlertDescription className="flex items-start justify-between">
        <div>
          <div className={`font-medium ${config.textColor}`}>{config.title}</div>
          <div className={config.iconColor}>{config.description}</div>
        </div>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <BurdenExplanation burden={burden} />
          </HoverCardContent>
        </HoverCard>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// BurdenBadge - Simple Badge Component
// ============================================================================

export function BurdenBadge({
  burden,
  requiresEvidence = false,
  className = "",
}: {
  burden: BurdenType | string;
  requiresEvidence?: boolean;
  className?: string;
}) {
  const config = getBurdenConfig(burden, requiresEvidence);
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.badgeColor} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.type === "advantage"
        ? "Burden: Proponent"
        : config.type === "moderate"
        ? "Burden: Moderate"
        : "Burden: Challenger"}
    </Badge>
  );
}

// ============================================================================
// BurdenExplanation - Detailed Explanation Component
// ============================================================================

export function BurdenExplanation({
  burden,
  context = "general",
  className = "",
}: BurdenExplanationProps) {
  const normalized = normalizeBurden(burden);

  const explanations = {
    attack: {
      proponent: {
        title: "You Have Burden Advantage",
        points: [
          "The original arguer made a claim using a specific argumentation scheme",
          "Every scheme has critical questions that probe its weaknesses",
          "Simply asking a relevant critical question shifts burden back to them",
          "They must answer your question or their argument loses force",
          "You don't need evidence to ask - just ask the right question",
        ],
        example:
          "If someone says 'Dr. Smith says X, therefore X is true' (Expert Opinion scheme), you can ask 'Is Dr. Smith really qualified in this domain?' This question alone challenges their argument.",
      },
      challenger: {
        title: "You Bear the Burden",
        points: [
          "To make this attack work, you must provide supporting evidence",
          "Critical questions alone won't be enough",
          "You need to demonstrate why your challenge is valid",
          "Strong evidence includes: data, expert testimony, citations, examples",
          "The quality of your evidence determines attack strength",
        ],
        example:
          "If you claim 'Dr. Smith is biased', you need to show proof: financial conflicts of interest, past statements showing bias, or documented inconsistencies.",
      },
    },
    support: {
      proponent: {
        title: "Favorable Burden Position",
        points: [
          "The structure of this argument scheme works in your favor",
          "The burden is on others to challenge your premises",
          "You only need to present a plausible case",
          "Challengers must provide evidence to refute you",
          "Focus on clarity and logical structure",
        ],
        example:
          "When making an expert opinion argument, you just need to cite a qualified expert. Others must prove the expert is unqualified or biased.",
      },
      challenger: {
        title: "Higher Evidentiary Standard",
        points: [
          "This argument requires substantial supporting evidence",
          "You must meet a higher standard of proof",
          "Mere assertions won't be sufficient",
          "Prepare citations, data, and concrete examples",
          "Anticipate and pre-empt potential challenges",
        ],
        example:
          "If arguing from analogy, you must demonstrate the similarity is strong and relevant, not just surface-level.",
      },
    },
    general: {
      proponent: {
        title: "Understanding Proponent Burden",
        points: [
          "Proponent = The person who made the original claim",
          "They have the burden to defend their argument",
          "Critical questions can shift burden back to them",
          "You can challenge without extensive evidence",
          "Strategic questioning is a powerful tool",
        ],
        example: null,
      },
      challenger: {
        title: "Understanding Challenger Burden",
        points: [
          "Challenger = You, responding to someone else's claim",
          "You must support your challenge with evidence",
          "Burden of proof falls on you to demonstrate weakness",
          "Higher standard = More work, but stronger result",
          "Invest time in research and evidence gathering",
        ],
        example: null,
      },
    },
  };

  const content = explanations[context][normalized];

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Scale className="h-4 w-4" />
          {content.title}
        </h4>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {content.points.map((point, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-sky-600 mt-0.5">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {content.example && (
        <div className="bg-muted p-3 rounded-md">
          <div className="text-xs font-medium mb-1">Example:</div>
          <div className="text-xs text-muted-foreground italic">{content.example}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BurdenComparison - Side-by-Side Comparison
// ============================================================================

export function BurdenComparison({
  yourBurden,
  theirBurden,
  requiresEvidence = false,
  className = "",
}: BurdenComparisonProps) {
  const yourConfig = getBurdenConfig(yourBurden, requiresEvidence);
  const theirConfig = getBurdenConfig(theirBurden, false); // Original arguer typically has proponent burden

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Burden of Proof Comparison
        </CardTitle>
        <CardDescription>Who needs to provide evidence?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Your burden */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Your Burden</div>
            <div
              className={`p-3 rounded-md border ${yourConfig.bgColor} ${yourConfig.borderColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {<yourConfig.icon className={`h-4 w-4 ${yourConfig.iconColor}`} />}
                <span className={`text-sm font-medium ${yourConfig.textColor}`}>
                  {yourConfig.title}
                </span>
              </div>
              <p className={`text-xs ${yourConfig.iconColor}`}>{yourConfig.description}</p>
            </div>
          </div>

          {/* Their burden */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Their Burden</div>
            <div
              className={`p-3 rounded-md border ${theirConfig.bgColor} ${theirConfig.borderColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {<theirConfig.icon className={`h-4 w-4 ${theirConfig.iconColor}`} />}
                <span className={`text-sm font-medium ${theirConfig.textColor}`}>
                  {theirConfig.title}
                </span>
              </div>
              <p className={`text-xs ${theirConfig.iconColor}`}>{theirConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Strategic insight */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {yourConfig.type === "advantage" ? (
              <span className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Strategic advantage:</strong> You can challenge their argument by simply
                  asking critical questions. They must defend or their argument weakens.
                </span>
              </span>
            ) : (
              <span className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Higher bar:</strong> You need to provide evidence to support your
                  challenge. Invest time in research and gather credible sources.
                </span>
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// BurdenProgressIndicator - Visual Progress Bar
// ============================================================================

export function BurdenProgressIndicator({
  currentBurden,
  evidenceProvided,
  className = "",
}: {
  currentBurden: BurdenType | string;
  evidenceProvided: number; // 0-100
  className?: string;
}) {
  const normalized = normalizeBurden(currentBurden);
  const config = getBurdenConfig(currentBurden, normalized === "challenger");

  // Calculate requirement
  const required = normalized === "proponent" ? 30 : 70; // Proponent needs less, challenger needs more
  const isMet = evidenceProvided >= required;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Evidence Requirement</span>
        <span className={isMet ? "text-green-600" : "text-muted-foreground"}>
          {evidenceProvided}% / {required}% {isMet && "✓"}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isMet ? "bg-green-600" : "bg-sky-600"
          }`}
          style={{ width: `${Math.min(100, evidenceProvided)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isMet ? (
          <span className="text-green-700">
            ✓ You&apos;ve met the evidentiary requirement for this burden level
          </span>
        ) : (
          <span>
            {normalized === "proponent"
              ? "Provide clear reasoning and basic support"
              : "Add more evidence, citations, and concrete examples"}
          </span>
        )}
      </p>
    </div>
  );
}
