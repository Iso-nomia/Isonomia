"use client";

/**
 * ConsensusIndicator Component
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * Visual indicator for claim consensus status:
 * - Badge display with color coding
 * - Compact and detailed variants
 * - Challenge count summary
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  RotateCcw,
  Shield,
  Swords,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConsensusStatus, ChallengeSummary } from "@/lib/provenance/types";

// ─────────────────────────────────────────────────────────
// Status Configuration
// ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ConsensusStatus,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  UNDETERMINED: {
    label: "Undetermined",
    description: "Not enough engagement to determine consensus",
    icon: HelpCircle,
    color: "text-slate-500",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    borderColor: "border-slate-300 dark:border-slate-600",
  },
  EMERGING: {
    label: "Emerging",
    description: "Building support, more defended than challenged",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  ACCEPTED: {
    label: "Accepted",
    description: "Broad acceptance, all challenges defended",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-300 dark:border-green-700",
  },
  CONTESTED: {
    label: "Contested",
    description: "Active disagreement with open challenges",
    icon: Swords,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-300 dark:border-amber-700",
  },
  REJECTED: {
    label: "Rejected",
    description: "Broadly rejected, majority of challenges conceded",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-300 dark:border-red-700",
  },
  SUPERSEDED: {
    label: "Superseded",
    description: "Replaced by a refined version",
    icon: RotateCcw,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
};

// ─────────────────────────────────────────────────────────
// ConsensusIndicator Component
// ─────────────────────────────────────────────────────────

export interface ConsensusIndicatorProps {
  status: ConsensusStatus;
  challengeSummary?: ChallengeSummary;
  variant?: "badge" | "compact" | "detailed";
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function ConsensusIndicator({
  status,
  challengeSummary,
  variant = "badge",
  showLabel = true,
  showTooltip = true,
  className,
}: ConsensusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        variant === "detailed" && "flex-col items-start",
        className
      )}
    >
      {variant === "badge" && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 font-medium",
            config.bgColor,
            config.borderColor,
            config.color
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {showLabel && <span>{config.label}</span>}
        </Badge>
      )}

      {variant === "compact" && (
        <div className={cn("flex items-center gap-1", config.color)}>
          <Icon className="h-4 w-4" />
          {showLabel && (
            <span className="text-xs font-medium">{config.label}</span>
          )}
        </div>
      )}

      {variant === "detailed" && (
        <div className={cn("space-y-2 p-3 rounded-lg border", config.bgColor, config.borderColor)}>
          <div className={cn("flex items-center gap-2", config.color)}>
            <Icon className="h-5 w-5" />
            <span className="font-semibold">{config.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {challengeSummary && challengeSummary.total > 0 && (
            <ChallengeSummaryDisplay summary={challengeSummary} />
          )}
        </div>
      )}
    </div>
  );

  if (showTooltip && variant !== "detailed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {challengeSummary && challengeSummary.total > 0 && (
              <div className="pt-1 border-t mt-1 text-xs">
                {challengeSummary.total} challenge(s): {challengeSummary.open} open,{" "}
                {challengeSummary.defended} defended, {challengeSummary.conceded} conceded
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

// ─────────────────────────────────────────────────────────
// ChallengeSummaryDisplay Component
// ─────────────────────────────────────────────────────────

interface ChallengeSummaryDisplayProps {
  summary: ChallengeSummary;
  className?: string;
}

function ChallengeSummaryDisplay({
  summary,
  className,
}: ChallengeSummaryDisplayProps) {
  const items = [
    { label: "Open", value: summary.open, color: "text-amber-600" },
    { label: "Defended", value: summary.defended, color: "text-green-600" },
    { label: "Conceded", value: summary.conceded, color: "text-red-600" },
    { label: "Stalemate", value: summary.stalemate, color: "text-slate-500" },
  ].filter((item) => item.value > 0);

  return (
    <div className={cn("flex flex-wrap gap-2 text-xs", className)}>
      <span className="text-muted-foreground">
        {summary.total} challenge{summary.total !== 1 ? "s" : ""}:
      </span>
      {items.map((item, i) => (
        <span key={item.label} className={item.color}>
          {item.value} {item.label.toLowerCase()}
          {i < items.length - 1 && ","}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ConsensusStatusSelect Component
// ─────────────────────────────────────────────────────────

export interface ConsensusStatusSelectProps {
  value: ConsensusStatus;
  onChange: (status: ConsensusStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function ConsensusStatusSelect({
  value,
  onChange,
  disabled = false,
  className,
}: ConsensusStatusSelectProps) {
  const statuses: ConsensusStatus[] = [
    "UNDETERMINED",
    "EMERGING",
    "ACCEPTED",
    "CONTESTED",
    "REJECTED",
    "SUPERSEDED",
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {statuses.map((status) => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const isSelected = value === status;

        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
              "border transition-colors",
              isSelected
                ? cn(config.bgColor, config.borderColor, config.color)
                : "bg-background border-border text-muted-foreground hover:bg-muted",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ChallengeBreakdown Component
// ─────────────────────────────────────────────────────────

export interface ChallengeBreakdownProps {
  summary: ChallengeSummary;
  className?: string;
}

export function ChallengeBreakdown({
  summary,
  className,
}: ChallengeBreakdownProps) {
  if (summary.total === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No challenges raised
      </div>
    );
  }

  const defendedPct = Math.round((summary.defended / summary.total) * 100);
  const openPct = Math.round((summary.open / summary.total) * 100);
  const concededPct = Math.round((summary.conceded / summary.total) * 100);
  const otherPct = 100 - defendedPct - openPct - concededPct;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Challenge Resolution</span>
        <span className="text-muted-foreground">
          {summary.total} total
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 flex rounded-full overflow-hidden bg-muted">
        {defendedPct > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${defendedPct}%` }}
          />
        )}
        {openPct > 0 && (
          <div
            className="bg-amber-500"
            style={{ width: `${openPct}%` }}
          />
        )}
        {concededPct > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${concededPct}%` }}
          />
        )}
        {otherPct > 0 && (
          <div
            className="bg-slate-400"
            style={{ width: `${otherPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-green-500" />
          <span>Defended: {summary.defended}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 text-amber-500" />
          <span>Open: {summary.open}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Conceded: {summary.conceded}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3 text-slate-400" />
          <span>Other: {summary.stalemate + summary.partiallyDefended + summary.withdrawn}</span>
        </div>
      </div>
    </div>
  );
}

export default ConsensusIndicator;
