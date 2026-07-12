"use client";

import * as React from "react";
import type { AnalysisFilterState } from "./types";

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span>{label}</span>
    </label>
  );
}

export function AnalysisFilters({
  filters,
  onFiltersChange,
}: {
  filters: AnalysisFilterState;
  onFiltersChange: (filters: AnalysisFilterState) => void;
}) {
  const toggleFilter = (key: keyof AnalysisFilterState) => {
    onFiltersChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="analysis-filters space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          Filters {activeCount > 0 && `(${activeCount})`}
        </span>
        {activeCount > 0 && (
          <button
            onClick={() =>
              onFiltersChange({
                showOnlyInnocent: false,
                showOnlyVerified: false,
                showOnlyWithDisputes: false,
              })
            }
            className="text-[10px] text-indigo-600 hover:text-indigo-800"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-1">
        <FilterCheckbox
          label="Innocent Strategies Only"
          checked={filters.showOnlyInnocent}
          onChange={() => toggleFilter("showOnlyInnocent")}
        />
        <FilterCheckbox
          label="Verified Correspondences Only"
          checked={filters.showOnlyVerified}
          onChange={() => toggleFilter("showOnlyVerified")}
        />
        <FilterCheckbox
          label="With Disputes Only"
          checked={filters.showOnlyWithDisputes}
          onChange={() => toggleFilter("showOnlyWithDisputes")}
        />
      </div>
    </div>
  );
}
