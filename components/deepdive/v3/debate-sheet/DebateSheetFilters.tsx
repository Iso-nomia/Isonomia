/**
 * DebateSheetFilters Component
 * 
 * Filter controls for debate sheet:
 * - Scheme filter dropdown
 * - Open CQs only checkbox
 * - Attacked only checkbox
 * - Clear filters button
 * 
 * Part of Phase 2: Component Structure Refactor
 */

"use client";

import * as React from "react";
import type { DebateFilters } from "../hooks/useDebateFilters";

export interface DebateSheetFiltersProps {
  /** Current filter state */
  filters: DebateFilters;
  
  /** Available scheme options */
  availableSchemes: string[];
  
  /** Handler for scheme filter change */
  onSchemeChange: (scheme: string | null) => void;
  
  /** Handler for open CQs filter toggle */
  onOpenCQsChange: (enabled: boolean) => void;
  
  /** Handler for attacked filter toggle */
  onAttackedChange: (enabled: boolean) => void;
  
  /** Handler for clear all filters */
  onClearFilters: () => void;
  
  /** Whether any filters are active */
  hasActiveFilters: boolean;
  
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Filters component for debate sheet
 */
export function DebateSheetFilters({
  filters,
  availableSchemes,
  onSchemeChange,
  onOpenCQsChange,
  onAttackedChange,
  onClearFilters,
  hasActiveFilters,
  className,
}: DebateSheetFiltersProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[11px] text-neutral-600">Filters:</label>
        
        {/* Scheme filter dropdown */}
        <select
          className="menuv2--lite rounded px-2 py-1 text-[12px]"
          value={filters.scheme ?? ""}
          onChange={(e) => onSchemeChange(e.target.value || null)}
        >
          <option value="">All schemes</option>
          {availableSchemes.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        
        {/* Open CQs filter */}
        <label className="text-[11px] inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={filters.openCQsOnly}
            onChange={(e) => onOpenCQsChange(e.target.checked)}
          />
          Open CQs only
        </label>
        
        {/* Attacked filter */}
        <label className="text-[11px] inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={filters.attackedOnly}
            onChange={(e) => onAttackedChange(e.target.checked)}
          />
          Attacked only
        </label>
        
        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            className="text-[11px] underline text-blue-600"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
