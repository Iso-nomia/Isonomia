/**
 * Visual reputation score display
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Star, Award, Shield, Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReputationScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreTier(score: number) {
  if (score >= 80) return { tier: "Gold", color: "text-yellow-500", bg: "bg-yellow-50" };
  if (score >= 60) return { tier: "Silver", color: "text-gray-400", bg: "bg-gray-50" };
  if (score >= 40) return { tier: "Bronze", color: "text-orange-600", bg: "bg-orange-50" };
  return { tier: "Emerging", color: "text-blue-500", bg: "bg-blue-50" };
}

function getScoreIcon(score: number) {
  if (score >= 80) return <Award className="w-full h-full" />;
  if (score >= 60) return <Shield className="w-full h-full" />;
  if (score >= 40) return <Star className="w-full h-full" />;
  return <Zap className="w-full h-full" />;
}

export function ReputationScore({
  score,
  size = "md",
  showLabel = true,
}: ReputationScoreProps) {
  const { tier, color, bg } = getScoreTier(score);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "rounded-full flex items-center justify-center",
                sizeClasses[size],
                bg
              )}
            >
              <div className={cn(iconSizes[size], color)}>
                {getScoreIcon(score)}
              </div>
            </div>
            {showLabel && (
              <div>
                <div className={cn("font-bold", color)}>
                  {Math.round(score)}
                </div>
                <div className="text-xs text-muted-foreground">{tier}</div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reputation Score: {score.toFixed(1)} / 100</p>
          <p className="text-xs text-muted-foreground">
            Based on arguments, reviews, and impact
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact reputation badge for inline use
 */
export function ReputationBadge({ score }: { score: number }) {
  const { color, bg } = getScoreTier(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        bg,
        color
      )}
    >
      {getScoreIcon(score)}
      <span>{Math.round(score)}</span>
    </span>
  );
}
