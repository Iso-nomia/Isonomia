// components/discourse/shared/SearchFilter.tsx
"use client";

import * as React from "react";
import { Search, Calendar, X } from "lucide-react";

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: "all" | "today" | "week" | "month";
  onDateFilterChange: (value: "all" | "today" | "week" | "month") => void;
  placeholder?: string;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  placeholder = "Search...",
}: SearchFilterProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onSearchChange("");
    inputRef.current?.focus();
  };

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
      role="search"
      aria-label="Filter and search content"
    >
      {/* Search Input */}
      <div className="relative flex-1">
        <label htmlFor="discourse-search" className="sr-only">
          Search content
        </label>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="discourse-search"
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          aria-describedby="search-description"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
            aria-label="Clear search"
            type="button"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
        <span id="search-description" className="sr-only">
          Type to filter content by text
        </span>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <label htmlFor="date-filter" className="sr-only">
          Filter by date
        </label>
        <select
          id="date-filter"
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value as "all" | "today" | "week" | "month")}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Date range filter"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Utility hook for filtering items by search term and date
 */
export function useSearchFilter<T extends { createdAt?: string }>(
  items: T[],
  searchTerm: string,
  dateFilter: "all" | "today" | "week" | "month",
  getSearchableText: (item: T) => string
): T[] {
  return React.useMemo(() => {
    let filtered = items;

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoff: Date;

      switch (dateFilter) {
        case "today":
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }

      filtered = filtered.filter((item) => {
        if (!item.createdAt) return true;
        return new Date(item.createdAt) >= cutoff;
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((item) =>
        getSearchableText(item).toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [items, searchTerm, dateFilter, getSearchableText]);
}
