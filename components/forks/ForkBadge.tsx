"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GitFork,
  Lightbulb,
  Microscope,
  Expand,
  Swords,
  GraduationCap,
  Archive,
} from "lucide-react";

/**
 * ForkBadge - Display fork type with appropriate icon and color
 * ForkTypePicker - Select fork type with descriptions
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 */

// ─────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────

export type ForkType =
  | "ASSUMPTION_VARIANT"
  | "METHODOLOGICAL"
  | "SCOPE_EXTENSION"
  | "ADVERSARIAL"
  | "EDUCATIONAL"
  | "ARCHIVAL";

export const FORK_TYPE_CONFIG: Record<ForkType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  ASSUMPTION_VARIANT: {
    label: "Assumption Variant",
    description: "Explore different foundational assumptions",
    icon: Lightbulb,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  METHODOLOGICAL: {
    label: "Methodological",
    description: "Apply different analytical methods",
    icon: Microscope,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  SCOPE_EXTENSION: {
    label: "Scope Extension",
    description: "Extend the deliberation to new domains",
    icon: Expand,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  ADVERSARIAL: {
    label: "Adversarial",
    description: "Stress-test with opposing viewpoints",
    icon: Swords,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
  },
  EDUCATIONAL: {
    label: "Educational",
    description: "Create a teaching or example variant",
    icon: GraduationCap,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  ARCHIVAL: {
    label: "Archival",
    description: "Archive a specific state for reference",
    icon: Archive,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-50 dark:bg-slate-900/20",
    borderColor: "border-slate-200 dark:border-slate-700",
  },
};

// ─────────────────────────────────────────────────────────
// ForkBadge Component
// ─────────────────────────────────────────────────────────

export interface ForkBadgeProps {
  type: ForkType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ForkBadge({
  type,
  size = "md",
  showLabel = true,
  className,
}: ForkBadgeProps) {
  const config = FORK_TYPE_CONFIG[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// ForkIndicator - Small inline indicator for forked items
// ─────────────────────────────────────────────────────────

export interface ForkIndicatorProps {
  className?: string;
}

export function ForkIndicator({ className }: ForkIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400",
        className
      )}
    >
      <GitFork className="w-3 h-3" />
      <span>Forked</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// ForkTypePicker Component
// ─────────────────────────────────────────────────────────

export interface ForkTypePickerProps {
  value: ForkType;
  onChange: (type: ForkType) => void;
  disabled?: boolean;
  className?: string;
}

export function ForkTypePicker({
  value,
  onChange,
  disabled = false,
  className,
}: ForkTypePickerProps) {
  const forkTypes = Object.keys(FORK_TYPE_CONFIG) as ForkType[];

  return (
    <div className={cn("space-y-2", className)}>
      {forkTypes.map((type) => {
        const config = FORK_TYPE_CONFIG[type];
        const Icon = config.icon;
        const isSelected = value === type;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
              "hover:bg-slate-50 dark:hover:bg-slate-800/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/20",
              isSelected
                ? cn(config.bgColor, config.borderColor, "ring-2 ring-primary/30")
                : "border-slate-200 dark:border-slate-700",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                config.bgColor
              )}
            >
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  isSelected
                    ? config.color
                    : "text-slate-700 dark:text-slate-300"
                )}
              >
                {config.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {config.description}
              </div>
            </div>
            {isSelected && (
              <div
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                  config.bgColor
                )}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full", config.color.replace("text-", "bg-"))} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
