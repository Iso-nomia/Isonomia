"use client";

/**
 * ArgumentCitationBadge Component
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Visual badge for displaying citation types:
 * - Color-coded by type (supportive/critical/neutral)
 * - Tooltip with description
 * - Compact and regular variants
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ThumbsUp,
  ArrowRight,
  Layers,
  GitCompare,
  XCircle,
  Edit3,
  Settings,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArgCitationType,
  CITATION_TYPE_LABELS,
} from "@/lib/citations/argumentCitationTypes";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ArgumentCitationBadgeProps {
  type: ArgCitationType;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────
// Icon Mapping
// ─────────────────────────────────────────────────────────

const ICON_MAP: Record<ArgCitationType, React.ElementType> = {
  SUPPORT: ThumbsUp,
  EXTENSION: ArrowRight,
  APPLICATION: Layers,
  CONTRAST: GitCompare,
  REBUTTAL: XCircle,
  REFINEMENT: Edit3,
  METHODOLOGY: Settings,
  CRITIQUE: AlertTriangle,
};

// ─────────────────────────────────────────────────────────
// Color Classes
// ─────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  green: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  purple: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ArgumentCitationBadge({
  type,
  size = "md",
  showLabel = true,
  showIcon = true,
  className,
}: ArgumentCitationBadgeProps) {
  const config = CITATION_TYPE_LABELS[type];
  const Icon = ICON_MAP[type];

  const sizeClasses = {
    xs: "text-[10px] px-1 py-0.5 gap-0.5",
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded border font-medium transition-colors",
            COLOR_CLASSES[config.color],
            sizeClasses[size],
            className
          )}
        >
          {showIcon && <Icon className={iconSizes[size]} />}
          {showLabel ? config.label : type.slice(0, 3).toUpperCase()}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────
// Citation Type Selector
// ─────────────────────────────────────────────────────────

export interface CitationTypeSelectorProps {
  value?: ArgCitationType;
  onChange: (type: ArgCitationType) => void;
  size?: "sm" | "md";
  className?: string;
}

const ALL_CITATION_TYPES: ArgCitationType[] = [
  "SUPPORT",
  "EXTENSION",
  "APPLICATION",
  "CONTRAST",
  "REBUTTAL",
  "REFINEMENT",
  "METHODOLOGY",
  "CRITIQUE",
];

export function CitationTypeSelector({
  value,
  onChange,
  size = "md",
  className,
}: CitationTypeSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {ALL_CITATION_TYPES.map((type) => {
        const config = CITATION_TYPE_LABELS[type];
        const Icon = ICON_MAP[type];
        const isSelected = value === type;

        return (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(type)}
                className={cn(
                  "inline-flex items-center gap-1 rounded border font-medium transition-all",
                  size === "sm" ? "text-xs px-2 py-1" : "text-sm px-2.5 py-1.5",
                  isSelected
                    ? cn(COLOR_CLASSES[config.color], "ring-2 ring-offset-1 ring-current/30")
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                )}
              >
                <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
                {config.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{config.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────

export function ArgumentCitationBadgeSkeleton({
  size = "md",
}: {
  size?: "xs" | "sm" | "md";
}) {
  const sizeClasses = {
    xs: "h-4 w-12",
    sm: "h-5 w-16",
    md: "h-6 w-20",
  };

  return (
    <div
      className={cn(
        "rounded bg-gray-200 animate-pulse dark:bg-gray-700",
        sizeClasses[size]
      )}
    />
  );
}

export default ArgumentCitationBadge;
