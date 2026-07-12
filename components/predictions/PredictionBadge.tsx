// components/predictions/PredictionBadge.tsx
"use client";

import * as React from "react";
import { TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PredictionBadgeProps {
  predictionCount: number;
  confirmedCount?: number;
  disconfirmedCount?: number;
  pendingCount?: number;
  size?: "sm" | "md";
  showTooltip?: boolean;
  className?: string;
}

export function PredictionBadge({
  predictionCount,
  confirmedCount = 0,
  disconfirmedCount = 0,
  pendingCount = 0,
  size = "sm",
  showTooltip = true,
  className,
}: PredictionBadgeProps) {
  if (predictionCount === 0) return null;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
  };

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  // Determine badge color based on resolution breakdown
  const getBadgeColor = () => {
    if (pendingCount === predictionCount) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    if (confirmedCount > disconfirmedCount) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (disconfirmedCount > confirmedCount) {
      return "bg-red-100 text-red-800 border-red-300";
    }
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const badge = (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizeClasses[size],
        getBadgeColor(),
        className
      )}
    >
      <TrendingUp className={iconSize} />
      <span>{predictionCount}</span>
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">
              {predictionCount} Prediction{predictionCount !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              {pendingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-600" />
                  {pendingCount} pending
                </span>
              )}
              {confirmedCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {confirmedCount} confirmed
                </span>
              )}
              {disconfirmedCount > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-600" />
                  {disconfirmedCount} wrong
                </span>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PredictionBadge;
