"use client";
import React from "react";
import clsx from "clsx";

/**
 * ChipBar Component
 * 
 * Extracted from DeepDivePanelV2.tsx (Week 1 - Phase 0)
 * A compact container for displaying metadata chips/badges
 * 
 * Used for configuration controls, stats display, etc.
 */

export interface ChipBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ChipBar({ children, className }: ChipBarProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-1",
        "rounded-md border-[.5px] border-indigo-200",
        "bg-white/60 px-2 py-1.5",
        "text-xs",
        className
      )}
    >
      {children}
    </div>
  );
}
