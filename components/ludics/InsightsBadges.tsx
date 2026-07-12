"use client";

import React from "react";

/**
 * InsightsBadge - Displays Ludics interaction complexity score
 * Phase 1: Task 2.1
 */

interface InsightsBadgeProps {
  complexityScore: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function InsightsBadge({
  complexityScore,
  size = "md",
  showLabel = true,
}: InsightsBadgeProps) {
  // Determine color based on complexity
  const getColorClasses = (score: number) => {
    if (score >= 70) return "bg-red-100 text-red-700 border-red-200";
    if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const getComplexityLabel = (score: number) => {
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full border
        font-medium transition-colors
        ${getColorClasses(complexityScore)}
        ${sizeClasses[size]}
      `}
      title={`Interaction complexity: ${complexityScore}/100`}
    >
      <span className="font-mono font-bold">{complexityScore}</span>
      {showLabel && (
        <span className="font-normal opacity-80">
          {getComplexityLabel(complexityScore)}
        </span>
      )}
    </div>
  );
}

/**
 * LocusBadge - Displays locus path and role
 * Phase 1: Task 2.1
 */

interface LocusBadgeProps {
  path: string; // e.g., "0.1.2"
  role?: string; // "opener" | "responder" | "daimon" | "neutral"
  actCount?: number;
  size?: "sm" | "md" | "lg";
}

export function LocusBadge({
  path,
  role = "neutral",
  actCount,
  size = "md",
}: LocusBadgeProps) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "opener":
        return "⊕"; // Positive polarity
      case "responder":
        return "⊖"; // Negative polarity
      case "daimon":
        return "†"; // Daimon (end)
      default:
        return "•";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "opener":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "responder":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "daimon":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const depth = path.split(".").length;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-md border
        font-medium transition-colors
        ${getRoleColor(role)}
        ${sizeClasses[size]}
      `}
      title={`Locus: ${path} (${role}, depth ${depth}${actCount ? `, ${actCount} acts` : ""})`}
    >
      <span className="opacity-70">{getRoleIcon(role)}</span>
      <span className="font-mono text-xs">{path}</span>
      {actCount && (
        <span className="text-xs opacity-60">×{actCount}</span>
      )}
    </div>
  );
}

/**
 * PolarityBadge - Shows polarity distribution
 * Phase 1: Task 2.1
 */

interface PolarityBadgeProps {
  positive: number;
  negative: number;
  neutral: number;
  size?: "sm" | "md";
}

export function PolarityBadge({
  positive,
  negative,
  neutral,
  size = "md",
}: PolarityBadgeProps) {
  const total = positive + negative + neutral;
  if (total === 0) return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
  };

  return (
    <div
      className={`
        inline-flex items-center rounded-full border border-gray-400
        bg-gray-100  font-medium transition-colors
        ${sizeClasses[size]}
      `}
      title={`Polarity: ${positive} positive, ${negative} negative, ${neutral} neutral`}
    >
      <span className="text-sky-600">⊕ {positive}</span>
      <span className="text-gray-400">/</span>
      <span className="text-purple-600">⊖{negative}</span>
      {neutral > 0 && (
        <>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">•{neutral}</span>
        </>
      )}
    </div>
  );
}

/**
 * OrthogonalityBadge - Shows orthogonality status
 * Phase 2 Week 2: Task 2.9
 */

interface OrthogonalityBadgeProps {
  status: "orthogonal" | "non-orthogonal" | "pending" | "convergent" | string;
  size?: "sm" | "md";
}

export function OrthogonalityBadge({
  status,
  size = "md",
}: OrthogonalityBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "orthogonal":
        return {
          icon: "⊥",
          label: "Orthogonal",
          color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
      case "non-orthogonal":
        return {
          icon: "⋈",
          label: "Non-Orthogonal",
          color: "bg-rose-100 text-rose-700 border-rose-200",
        };
      case "convergent":
        return {
          icon: "✓",
          label: "Convergent",
          color: "bg-sky-100 text-sky-700 border-sky-200",
        };
      default:
        return {
          icon: "⊥",
          label: "Pending",
          color: "bg-gray-100 text-gray-600 border-gray-200",
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full border
        font-medium transition-colors
        ${config.color}
        ${sizeClasses[size]}
      `}
      title={`Ludics Orthogonality: ${config.label}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

/**
 * DecisiveBadge - Shows decisive step count
 * Phase 2 Week 2: Task 2.9
 */

interface DecisiveBadgeProps {
  count: number;
  size?: "sm" | "md";
}

export function DecisiveBadge({ count, size = "md" }: DecisiveBadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full border
        bg-amber-100 text-amber-700 border-amber-200
        font-medium transition-colors
        ${sizeClasses[size]}
      `}
      title={`${count} decisive step${count !== 1 ? "s" : ""} in trace`}
    >
      <span>⛭</span>
      <span>{count}</span>
    </div>
  );
}

/**
 * CommitmentAnchorBadge - Shows commitment anchor count
 * Phase 2 Week 2: Task 2.9
 */

interface CommitmentAnchorBadgeProps {
  count: number;
  size?: "sm" | "md";
}

export function CommitmentAnchorBadge({
  count,
  size = "md",
}: CommitmentAnchorBadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full border
        bg-indigo-100 text-indigo-700 border-indigo-200
        font-medium transition-colors
        ${sizeClasses[size]}
      `}
      title={`${count} commitment anchor${count !== 1 ? "s" : ""}`}
    >
      <span>⚓</span>
      <span>{count}</span>
    </div>
  );
}

