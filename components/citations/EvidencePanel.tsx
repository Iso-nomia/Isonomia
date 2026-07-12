// components/citations/EvidencePanel.tsx
// Phase 2.4: Full Evidence Panel with filtering, sorting, pagination

"use client";

import { useState, useEffect, useCallback } from "react";
import { EvidenceFilterBar, EvidenceFilters, defaultFilters } from "./EvidenceFilterBar";
import { GroupedCitationList, EvidenceBalanceBar } from "./GroupedCitationList";
import { CitationCard } from "./CitationCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusIcon,
  LayoutGridIcon,
  ListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EvidencePanelProps {
  targetType: string;
  targetId: string;
  canEdit?: boolean;
  compact?: boolean;
  className?: string;
  onAddCitation?: () => void;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function EvidencePanel({
  targetType,
  targetId,
  canEdit = false,
  compact = false,
  className,
  onAddCitation,
}: EvidencePanelProps) {
  const [mounted, setMounted] = useState(false);
  const [citations, setCitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: compact ? 10 : 20,
    total: 0,
    totalPages: 1,
  });
  const [facets, setFacets] = useState<{ intent: Record<string, number> }>({
    intent: {},
  });
  const [filters, setFilters] = useState<EvidenceFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");

  const fetchCitations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        targetType,
        targetId,
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

      const res = await fetch(`/api/citations/list?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch citations");
      }

      const data = await res.json();
      setCitations(data.citations || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
      }));
      setFacets(data.facets || { intent: {} });
    } catch (e: any) {
      setError(e.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId, filters, pagination.page, pagination.limit]);

  // Set mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchCitations();
    }
  }, [fetchCitations, mounted]);

  // Listen for citation changes
  useEffect(() => {
    const handler = () => {
      fetchCitations();
    };
    window.addEventListener("citations:changed", handler);
    return () => window.removeEventListener("citations:changed", handler);
  }, [fetchCitations]);

  const handleFilterChange = (newFilters: EvidenceFilters) => {
    setFilters(newFilters);
    setPagination((p) => ({ ...p, page: 1 })); // Reset to page 1 on filter change
  };

  const goToPage = (page: number) => {
    setPagination((p) => ({ ...p, page }));
  };

  // Show skeleton on initial render to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
          Evidence
          {pagination.total > 0 && (
            <span className="text-muted-foreground font-normal ml-2">
              ({pagination.total})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              className={cn("rounded-r-none", compact ? "h-7 px-2" : "h-8 px-2")}
              onClick={() => setViewMode("grouped")}
              title="Grouped by intent"
            >
              <LayoutGridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className={cn("rounded-l-none", compact ? "h-7 px-2" : "h-8 px-2")}
              onClick={() => setViewMode("list")}
              title="Flat list"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchCitations}
            disabled={loading}
            className={compact ? "h-7 px-2" : "h-8 px-2"}
            title="Refresh"
          >
            <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>

          {canEdit && onAddCitation && (
            <Button size="sm" onClick={onAddCitation} className={compact ? "h-7" : ""}>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Evidence balance bar (only when we have citations) */}
      {citations.length > 0 && (
        <EvidenceBalanceBar citations={citations} />
      )}

      {/* Filter bar */}
      <EvidenceFilterBar
        filters={filters}
        onChange={handleFilterChange}
        facets={facets}
        compact={compact}
      />

      {/* Error state */}
      {error && (
        <div className="text-center py-6 text-red-600">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchCitations}>
            Try again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className={compact ? "h-16 w-full" : "h-24 w-full"} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && citations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No citations found.</p>
          {(filters.search || filters.intents.length > 0) ? (
            <p className="text-sm mt-1">Try adjusting your filters.</p>
          ) : canEdit && onAddCitation ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAddCitation}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add your first citation
            </Button>
          ) : null}
        </div>
      )}

      {/* Citation list */}
      {!loading && !error && citations.length > 0 && (
        viewMode === "grouped" ? (
          <GroupedCitationList
            citations={citations}
            showGroups={true}
            showMissingEvidencePrompt={!filters.intents.length}
            compact={compact}
          />
        ) : (
          <div className="space-y-2">
            {citations.map((c) => (
              <CitationCard key={c.id} citation={c} compact={compact} showTrustBadges={true} />
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1 || loading}
            onClick={() => goToPage(pagination.page - 1)}
            className={compact ? "h-7" : ""}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.totalPages || loading}
            onClick={() => goToPage(pagination.page + 1)}
            className={compact ? "h-7" : ""}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
