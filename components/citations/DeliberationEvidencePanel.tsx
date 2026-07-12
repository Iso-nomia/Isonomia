// components/citations/DeliberationEvidencePanel.tsx
// Phase 2.4: Deliberation-level evidence browsing panel

"use client";

import { useState, useEffect, useCallback } from "react";
import { EvidenceFilterBar, EvidenceFilters, defaultFilters } from "./EvidenceFilterBar";
import { GroupedCitationList, EvidenceBalanceBar } from "./GroupedCitationList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  FileTextIcon,
  MessageSquareIcon,
  LayoutGridIcon,
  ListIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliberationEvidencePanelProps {
  deliberationId: string;
  className?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Use any for citations since they come from API and GroupedCitationList expects Prisma types
type Citation = any;

export function DeliberationEvidencePanel({
  deliberationId,
  className,
}: DeliberationEvidencePanelProps) {
  const [mounted, setMounted] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [facets, setFacets] = useState<{
    intent: Record<string, number>;
    targetType: Record<string, number>;
  }>({
    intent: {},
    targetType: {},
  });
  const [filters, setFilters] = useState<EvidenceFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string | null>(null);

  const fetchCitations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      if (filters.intents.length > 0) {
        params.set("intent", filters.intents.join(","));
      }
      if (filters.sourceKinds.length > 0) {
        params.set("sourceKind", filters.sourceKinds.join(","));
      }
      if (filters.minRelevance) {
        params.set("minRelevance", String(filters.minRelevance));
      }
      if (filters.search) {
        params.set("search", filters.search);
      }
      if (targetTypeFilter) {
        params.set("targetType", targetTypeFilter);
      }

      const res = await fetch(`/api/deliberations/${deliberationId}/evidence?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch evidence");
      }

      const data = await res.json();
      setCitations(data.citations || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
      }));
      setFacets(data.facets || { intent: {}, targetType: {} });
    } catch (err) {
      console.error("Failed to fetch citations:", err);
      setError("Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [deliberationId, filters, pagination.page, pagination.limit, targetTypeFilter]);

  // Set mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchCitations();
    }
  }, [fetchCitations, mounted]);

  const handleFilterChange = (newFilters: EvidenceFilters) => {
    setFilters(newFilters);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((p) => ({ ...p, page: newPage }));
  };

  const totalClaims = facets.targetType["claim"] || 0;
  const totalArgs = facets.targetType["argument"] || 0;

  // Show skeleton on initial render to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with type filter pills */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            Browse by:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTargetTypeFilter(null)}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors",
                !targetTypeFilter
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              All ({totalClaims + totalArgs})
            </button>
            <button
              onClick={() => setTargetTypeFilter("claim")}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1",
                targetTypeFilter === "claim"
                  ? "bg-sky-100 text-sky-700 border border-sky-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <FileTextIcon className="w-3 h-3" />
              Claims ({totalClaims})
            </button>
            <button
              onClick={() => setTargetTypeFilter("argument")}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1",
                targetTypeFilter === "argument"
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <MessageSquareIcon className="w-3 h-3" />
              Arguments ({totalArgs})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center  rounded-md">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 rounded-lg rounded-r-none"
              onClick={() => setViewMode("grouped")}
            >
              <LayoutGridIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 rounded-lg rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
          className="rounded-lg"
            onClick={fetchCitations}
            disabled={loading}
          >
            <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <EvidenceFilterBar
        filters={filters}
        onChange={handleFilterChange}
        facets={{ intent: facets.intent }}
      />

      {/* Balance bar */}
      {citations.length > 0 && (
        <EvidenceBalanceBar citations={citations} className="mb-2" />
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchCitations}>
            Retry
          </Button>
        </div>
      ) : citations.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p className="font-medium">No evidence found</p>
          <p className="text-sm mt-1">
            {filters.search || filters.intents.length > 0
              ? "Try adjusting your filters"
              : "Citations will appear here when added to claims or arguments"}
          </p>
        </div>
      ) : viewMode === "grouped" ? (
        <div className="space-y-4">
          <GroupedCitationList
            citations={citations}
            showGroups={true}
          />
          {/* Show target context in grouped view */}
          {citations.some((c) => c.targetText) && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-medium text-slate-600 mb-2">Target Context</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {[...new Map(citations.map((c) => [c.targetId, c])).values()].map((c) => (
                  <div
                    key={c.targetId}
                    className="text-xs text-slate-600 flex items-start gap-2"
                  >
                    {c.targetType === "claim" ? (
                      <FileTextIcon className="w-3 h-3 mt-0.5 text-sky-500 flex-shrink-0" />
                    ) : (
                      <MessageSquareIcon className="w-3 h-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                    )}
                    <span className="line-clamp-2">{c.targetText}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {citations.map((c) => (
            <div
              key={c.id}
              className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Target indicator */}
                <div className="flex-shrink-0">
                  {c.targetType === "claim" ? (
                    <div className="w-6 h-6 rounded bg-sky-100 flex items-center justify-center">
                      <FileTextIcon className="w-3.5 h-3.5 text-sky-600" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                      <MessageSquareIcon className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Source title */}
                  <div className="font-medium text-sm text-slate-800 line-clamp-1">
                    {c.source?.title || "Untitled Source"}
                  </div>

                  {/* Target text */}
                  {c.targetText && (
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      → {c.targetText}
                    </div>
                  )}

                  {/* Quote */}
                  {c.quote && (
                    <blockquote className="text-xs text-slate-600 mt-1 italic line-clamp-2 border-l-2 border-slate-300 pl-2">
                      &ldquo;{c.quote}&rdquo;
                    </blockquote>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                    {c.intent && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded",
                        c.intent === "supports" && "bg-green-100 text-green-700",
                        c.intent === "refutes" && "bg-red-100 text-red-700",
                        c.intent === "provides_context" && "bg-blue-100 text-blue-700",
                        !["supports", "refutes", "provides_context"].includes(c.intent || "") && "bg-slate-100 text-slate-600"
                      )}>
                        {c.intent}
                      </span>
                    )}
                    {c.locator && <span>{c.locator}</span>}
                    {c.relevance && <span>{"★".repeat(c.relevance)}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
