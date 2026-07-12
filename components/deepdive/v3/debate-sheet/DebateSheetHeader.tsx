/**
 * DebateSheetHeader Component
 * 
 * Header section for debate sheet with:
 * - Title
 * - Confidence mode selector
 * - Imports toggle
 * 
 * Part of Phase 2: Component Structure Refactor
 */

"use client";

import * as React from "react";

export interface DebateSheetHeaderProps {
  /** Title to display */
  title: string;
  
  /** Current confidence mode */
  mode: "product" | "min" | "ds";
  
  /** Handler for mode change */
  onModeChange: (mode: "product" | "min" | "ds") => void;
  
  /** Current imports setting */
  imports: "off" | "materialized" | "virtual" | "all";
  
  /** Handler for imports change */
  onImportsChange: (imports: "off" | "materialized" | "virtual" | "all") => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Header component for debate sheet
 */
export function DebateSheetHeader({
  title,
  mode,
  onModeChange,
  imports,
  onImportsChange,
  className,
}: DebateSheetHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-neutral-600">Confidence</label>
          <select
            className="menuv2--lite rounded px-2 py-1 text-[12px]"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as any)}
          >
            <option value="min">weakest‑link (min)</option>
            <option value="product">independent (product)</option>
            <option value="ds">DS (β/π) — (UI only for now)</option>
          </select>
          
          <label className="text-[11px] text-neutral-600">Imported</label>
          <select
            className="menuv2--lite rounded px-2 py-1 text-[12px]"
            value={imports}
            onChange={(e) => onImportsChange(e.target.value as any)}
          >
            <option value="off">hide</option>
            <option value="materialized">materialized</option>
            <option value="virtual">virtual</option>
            <option value="all">all</option>
          </select>
        </div>
      </div>
    </div>
  );
}
