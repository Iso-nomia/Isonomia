/**
 * ConditionMatchResult Component
 * 
 * Displays a single scheme match with detailed scoring information,
 * matched conditions, and quality indicators.
 * 
 * Week 7, Task 7.3: Results Display with Match Scores
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import type { SchemeMatch } from "@/lib/schemes/identification-conditions";
import { identificationConditions } from "@/lib/schemes/identification-conditions";

interface ConditionMatchResultProps {
  match: SchemeMatch;
  onSelect: (scheme: ArgumentScheme) => void;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Get color classes for match quality
 */
function getQualityColor(quality: string): {
  badge: string;
  border: string;
  bg: string;
  text: string;
} {
  switch (quality) {
    case "perfect":
      return {
        badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-300 dark:border-green-700",
        border: "border-green-200 dark:border-green-800",
        bg: "bg-green-50 dark:bg-green-950",
        text: "text-green-700 dark:text-green-400",
      };
    case "strong":
      return {
        badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-700",
        border: "border-sky-200 dark:border-sky-800",
        bg: "bg-sky-50 dark:bg-sky-950",
        text: "text-sky-700 dark:text-sky-400",
      };
    case "moderate":
      return {
        badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
        border: "border-yellow-200 dark:border-yellow-800",
        bg: "bg-yellow-50 dark:bg-yellow-950",
        text: "text-yellow-700 dark:text-yellow-400",
      };
    default: // weak
      return {
        badge: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300 border-gray-300 dark:border-gray-700",
        border: "border-gray-200 dark:border-gray-800",
        bg: "bg-gray-50 dark:bg-gray-950",
        text: "text-gray-700 dark:text-gray-400",
      };
  }
}

export function ConditionMatchResult({
  match,
  onSelect,
  showDetails = true,
  compact = false,
}: ConditionMatchResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getQualityColor(match.quality);

  return (
    <Card
      className={`transition-all ${colors.border} hover:shadow-md`}
    >
      {/* Main Content - Always Visible */}
      <div
        className={`${compact ? "p-3" : "p-4"} cursor-pointer`}
        onClick={() => onSelect(match.scheme)}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Scheme Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold">{match.scheme.name}</h4>
              {match.quality === "perfect" && (
                <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
              )}
            </div>

            {match.scheme.summary && !compact && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {match.scheme.summary}
              </p>
            )}

            {/* Match Summary */}
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className={`font-medium ${colors.text}`}>
                {match.matchedConditions.length} condition
                {match.matchedConditions.length !== 1 ? "s" : ""} matched
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                Score: {(match.score * 100).toFixed(1)}
              </span>
            </div>
          </div>

          {/* Right: Quality Badge */}
          <div className="shrink-0 text-right">
            <Badge
              variant="outline"
              className={`${colors.badge} font-semibold`}
            >
              {match.percentage}%
            </Badge>
            <p className={`text-xs mt-1 capitalize ${colors.text}`}>
              {match.quality} match
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      {showDetails && match.matchedConditions.length > 0 && (
        <>
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-full flex items-center justify-between text-xs"
            >
              <span className="font-medium">
                {isExpanded ? "Hide" : "Show"} matched conditions
              </span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>

          {isExpanded && (
            <div className={`border-t ${colors.bg} p-4 space-y-2`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Why this scheme matches
              </p>

              {match.matchedConditions.map((conditionId) => {
                const condition = identificationConditions[conditionId];
                if (!condition) return null;

                return (
                  <div
                    key={conditionId}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{condition.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {condition.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {Math.round(condition.weight * 100)}%
                    </Badge>
                  </div>
                );
              })}

              {/* Score Breakdown */}
              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                <p>
                  <strong>Score calculation:</strong> {match.matchedConditions.length}{" "}
                  matched conditions with combined weight of{" "}
                  {(match.score * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
