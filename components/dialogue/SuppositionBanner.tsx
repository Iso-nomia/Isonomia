"use client";

import * as React from "react";

/**
 * SuppositionBanner - Visual indicator when inside a SUPPOSE scope
 * 
 * Shows a purple banner with the current supposition text and provides
 * visual context that we're reasoning hypothetically.
 * 
 * Usage:
 * <SuppositionBanner
 *   suppositionText="Suppose gas prices triple in the next five years"
 *   locusPath="0.supp1"
 * />
 */

interface SuppositionBannerProps {
  suppositionText: string;
  locusPath?: string;
  className?: string;
}

export function SuppositionBanner({
  suppositionText,
  locusPath,
  className = "",
}: SuppositionBannerProps) {
  return (
    <div
      className={`
        bg-purple-50 border-l-4 border-purple-500 p-3 mb-4 rounded-r shadow-sm
        ${className}
      `}
      role="status"
      aria-label="Active supposition"
    >
      <div className="flex items-center gap-2 text-purple-900">
        <span className="text-lg" aria-hidden="true">
          📍
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Inside Supposition</div>
          <div className="text-xs text-purple-700 leading-relaxed mt-0.5">
            {suppositionText}
          </div>
          {locusPath && (
            <div className="text-[10px] text-purple-600 font-mono mt-1">
              Locus: {locusPath}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * NestedMoveContainer - Wrapper for moves inside a supposition scope
 * 
 * Adds visual indentation and colored border to show hierarchy.
 * 
 * Usage:
 * <NestedMoveContainer level={1}>
 *   {nestedMoves.map(move => <MoveDisplay move={move} />)}
 * </NestedMoveContainer>
 */

interface NestedMoveContainerProps {
  children: React.ReactNode;
  level?: number; // Nesting depth (1 = first level, 2 = nested supposition, etc.)
  className?: string;
}

export function NestedMoveContainer({
  children,
  level = 1,
  className = "",
}: NestedMoveContainerProps) {
  // Calculate indentation and border color based on nesting level
  const levelStyles = {
    1: "ml-6 border-purple-300",
    2: "ml-12 border-purple-400",
    3: "ml-18 border-purple-500",
  };

  const style = levelStyles[Math.min(level, 3) as keyof typeof levelStyles] || levelStyles[3];

  return (
    <div
      className={`
        border-l-2 pl-4 space-y-2
        ${style}
        ${className}
      `}
      role="group"
      aria-label={`Nested moves (level ${level})`}
    >
      {children}
    </div>
  );
}
