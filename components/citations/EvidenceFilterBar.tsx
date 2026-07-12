// components/citations/EvidenceFilterBar.tsx
// Phase 2.4: Filter bar for evidence list

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  SortDescIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EvidenceFilters {
  intents: string[];
  sourceKinds: string[];
  minRelevance: number | null;
  search: string;
  sortBy: "createdAt" | "relevance" | "source" | "intent";
  sortOrder: "asc" | "desc";
}

interface EvidenceFilterBarProps {
  filters: EvidenceFilters;
  onChange: (filters: EvidenceFilters) => void;
  facets?: {
    intent: Record<string, number>;
  };
  compact?: boolean;
}

const intentOptions = [
  { value: "supports", label: "Supports", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "refutes", label: "Refutes", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "context", label: "Context", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "defines", label: "Defines", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "method", label: "Method", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "background", label: "Background", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "acknowledges", label: "Acknowledges", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "example", label: "Example", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "unclassified", label: "Unclassified", color: "bg-slate-100 text-slate-600 border-slate-200" },
];

const sortOptions = [
  { value: "createdAt", label: "Date Added" },
  { value: "relevance", label: "Relevance" },
  { value: "source", label: "Source Title" },
  { value: "intent", label: "Intent" },
];

export function EvidenceFilterBar({
  filters,
  onChange,
  facets,
  compact = false,
}: EvidenceFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const toggleIntent = (intent: string) => {
    const newIntents = filters.intents.includes(intent)
      ? filters.intents.filter((i) => i !== intent)
      : [...filters.intents, intent];
    onChange({ ...filters, intents: newIntents });
  };

  const handleSearch = () => {
    onChange({ ...filters, search: searchInput });
  };

  const clearFilters = () => {
    setSearchInput("");
    onChange({
      intents: [],
      sourceKinds: [],
      minRelevance: null,
      search: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  const hasActiveFilters =
    filters.intents.length > 0 ||
    filters.sourceKinds.length > 0 ||
    filters.minRelevance ||
    filters.search;

  return (
    <div className={cn("space-y-3 p-3 bg-muted/30 rounded-lg border", compact && "p-2 space-y-2")}>
      {/* Search row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search citations..."
            className={cn("pl-8", compact && "h-8 text-sm")}
          />
        </div>
        <Button 
          onClick={handleSearch} 
          variant="secondary" 
          size={compact ? "sm" : "default"}
        >
          Search
        </Button>
      </div>

      {/* Intent filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground self-center mr-1 flex items-center gap-1">
          <FilterIcon className="h-3 w-3" />
          Intent:
        </span>
        {intentOptions.map((intent) => {
          const count = facets?.intent?.[intent.value] || 0;
          const isActive = filters.intents.includes(intent.value);
          // Only show intents that have citations (or are active)
          if (count === 0 && !isActive) return null;
          return (
            <button
              key={intent.value}
              onClick={() => toggleIntent(intent.value)}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-all border",
                isActive
                  ? `${intent.color} ring-2 ring-offset-1 ring-primary/50`
                  : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
              )}
            >
              {intent.label}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort and additional filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select
            value={filters.sortBy}
            onValueChange={(v) =>
              onChange({ ...filters, sortBy: v as EvidenceFilters["sortBy"] })
            }
          >
            <SelectTrigger className={cn("w-28 text-xs", compact ? "h-7" : "h-8")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className={cn("p-0", compact ? "h-7 w-7" : "h-8 w-8")}
            onClick={() =>
              onChange({
                ...filters,
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
            title={filters.sortOrder === "asc" ? "Ascending" : "Descending"}
          >
            {filters.sortOrder === "asc" ? (
              <SortAscIcon className="h-4 w-4" />
            ) : (
              <SortDescIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Min relevance:</span>
          <Select
            value={filters.minRelevance?.toString() || "any"}
            onValueChange={(v) =>
              onChange({
                ...filters,
                minRelevance: v === "any" ? null : parseInt(v, 10),
              })
            }
          >
            <SelectTrigger className={cn("w-16 text-xs", compact ? "h-7" : "h-8")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className={cn("text-xs text-muted-foreground", compact && "h-7")}
          >
            <XIcon className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export const defaultFilters: EvidenceFilters = {
  intents: [],
  sourceKinds: [],
  minRelevance: null,
  search: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};
