"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * VersionBadge - Display semantic version with status colors
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

const versionBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        latest: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        major: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        outdated: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5",
        md: "text-xs px-2 py-0.5",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface VersionBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof versionBadgeVariants> {
  version: string;
  isLatest?: boolean;
  showPrefix?: boolean;
}

export function VersionBadge({
  className,
  variant,
  size,
  version,
  isLatest = false,
  showPrefix = true,
  ...props
}: VersionBadgeProps) {
  // Auto-determine variant if not specified
  const resolvedVariant = variant ?? (isLatest ? "latest" : "default");

  return (
    <span
      className={cn(versionBadgeVariants({ variant: resolvedVariant, size }), className)}
      {...props}
    >
      {showPrefix && <span className="opacity-60">v</span>}
      {version}
      {isLatest && (
        <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">
          latest
        </span>
      )}
    </span>
  );
}

/**
 * VersionDiff - Show version change (e.g., "1.0.0 → 1.1.0")
 */
export interface VersionDiffProps extends React.HTMLAttributes<HTMLSpanElement> {
  from: string;
  to: string;
  size?: "sm" | "md" | "lg";
}

export function VersionDiff({
  className,
  from,
  to,
  size = "md",
  ...props
}: VersionDiffProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono",
        size === "sm" && "text-[10px]",
        size === "md" && "text-xs",
        size === "lg" && "text-sm",
        className
      )}
      {...props}
    >
      <VersionBadge version={from} size={size} variant="outdated" showPrefix={false} />
      <span className="text-slate-400">→</span>
      <VersionBadge version={to} size={size} variant="latest" showPrefix={false} />
    </span>
  );
}
