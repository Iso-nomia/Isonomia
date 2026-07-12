"use client";

import * as React from "react";
import type { LegalityCheck } from "@/packages/ludics-core/dds/types";

interface LegalityBadgeProps {
  check: LegalityCheck;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * LegalityBadge - Displays the legality status of a position
 * 
 * A legal position must satisfy:
 * 1. Linearity - each address appears at most once
 * 2. Parity - polarity alternates correctly
 * 3. Justification - each non-initial move is justified
 * 4. Visibility - justifier occurs in player's view
 */
export function LegalityBadge({
  check,
  showDetails = true,
  size = "md",
  className = "",
}: LegalityBadgeProps) {
  const isLegal =
    check.isLinear && check.isParity && check.isJustified && check.isVisible;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-3 py-1.5",
    lg: "text-sm px-4 py-2",
  };

  const iconSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={`legality-badge ${className}`}>
      {/* Main badge */}
      <div
        className={`inline-flex items-center gap-2 rounded font-medium border ${
          sizeClasses[size]
        } ${
          isLegal
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}
      >
        <span className={iconSize[size]}>{isLegal ? "✓" : "✗"}</span>
        <span>{isLegal ? "Legal Position" : "Illegal Position"}</span>
      </div>

      {/* Detail breakdown */}
      {showDetails && (
        <div className="mt-2 space-y-1.5">
          <LegalityCondition
            label="Linearity"
            passed={check.isLinear}
            description="Each address appears at most once"
            size={size}
          />
          <LegalityCondition
            label="Parity"
            passed={check.isParity}
            description="Polarity alternates correctly"
            size={size}
          />
          <LegalityCondition
            label="Justification"
            passed={check.isJustified}
            description="Each move is justified"
            size={size}
          />
          <LegalityCondition
            label="Visibility"
            passed={check.isVisible}
            description="Justifier in player's view"
            size={size}
          />
        </div>
      )}

      {/* Errors */}
      {!isLegal && check.errors.length > 0 && showDetails && (
        <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">
          <div className="font-semibold mb-1">Violations:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {check.errors.map((err, i) => (
              <li key={i} className="break-words">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface LegalityConditionProps {
  label: string;
  passed: boolean;
  description: string;
  size: "sm" | "md" | "lg";
}

function LegalityCondition({
  label,
  passed,
  description,
  size,
}: LegalityConditionProps) {
  const textSize = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div
      className={`flex items-center gap-2 ${textSize[size]} ${
        passed ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      <span className="w-4">{passed ? "✓" : "✗"}</span>
      <span className="font-medium">{label}:</span>
      <span className="text-slate-500">{description}</span>
    </div>
  );
}

/**
 * CompactLegalityBadge - Minimal badge for inline display
 */
interface CompactLegalityBadgeProps {
  check: LegalityCheck;
  className?: string;
}

export function CompactLegalityBadge({
  check,
  className = "",
}: CompactLegalityBadgeProps) {
  const isLegal =
    check.isLinear && check.isParity && check.isJustified && check.isVisible;

  const conditions = [
    { key: "L", passed: check.isLinear, label: "Linear" },
    { key: "P", passed: check.isParity, label: "Parity" },
    { key: "J", passed: check.isJustified, label: "Justified" },
    { key: "V", passed: check.isVisible, label: "Visible" },
  ];

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      title={`${isLegal ? "Legal" : "Illegal"}: ${conditions
        .map((c) => `${c.label}: ${c.passed ? "✓" : "✗"}`)
        .join(", ")}`}
    >
      {conditions.map((cond) => (
        <span
          key={cond.key}
          className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded ${
            cond.passed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {cond.key}
        </span>
      ))}
    </div>
  );
}

export default LegalityBadge;
