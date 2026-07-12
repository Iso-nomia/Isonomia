"use client";
import * as React from "react";
import useSWR from "swr";
import { ExternalLink, Users, FileText, TrendingUp, Star } from "lucide-react";
import { SourceTrustBadges } from "@/components/sources/SourceTrustBadges";
import type { SourceVerificationStatus } from "@/components/sources/VerificationBadge";
import type { ArchiveStatus } from "@/components/sources/ArchiveBadge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EvidenceSource = {
  sourceId: string;
  title: string;
  url: string;
  type: string;
  authorsJson: any;
  year: number | null;
  publicationTitle: string | null;
  doi: string | null;
  usageCount: number;
  usedInArguments: number;
  usedInClaims: number;
  uniqueUsers: number;
  firstUsed: string;
  lastUsed: string;
  averageRating: number | null;
  ratingCount: number;
  // Phase 3.1: Trust fields
  verificationStatus?: SourceVerificationStatus;
  lastCheckedAt?: string | null;
  canonicalUrl?: string | null;
  archiveStatus?: ArchiveStatus;
  archiveUrl?: string | null;
  archivedAt?: string | null;
};

type EvidenceListProps = {
  deliberationId: string;
};

/**
 * EvidenceList - Displays all sources/citations used in a deliberation
 * 
 * Features:
 * - Shows usage metrics (how many times used, in arguments vs claims)
 * - Displays community quality ratings (1-10 scale)
 * - Allows users to rate source quality
 * - Sorts by usage or rating
 */
export function EvidenceList({ deliberationId }: EvidenceListProps) {
  const [sortBy, setSortBy] = React.useState<"usage" | "rating">("usage");
  const [selectedSource, setSelectedSource] = React.useState<string | null>(null);
  const [userRating, setUserRating] = React.useState<number>(0);

  // Fetch sources for this deliberation
  const { data, error, mutate } = useSWR(
    deliberationId ? `/api/deliberations/${deliberationId}/sources` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const sources: EvidenceSource[] = data?.sources || [];
  const loading = !data && !error;

  // Sort sources
  const sortedSources = React.useMemo(() => {
    const sorted = [...sources];
    if (sortBy === "usage") {
      sorted.sort((a, b) => b.usageCount - a.usageCount);
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => {
        const aRating = a.averageRating || 0;
        const bRating = b.averageRating || 0;
        return bRating - aRating;
      });
    }
    return sorted;
  }, [sources, sortBy]);

  // Format authors from JSON
  const formatAuthors = (authorsJson: any) => {
    if (!authorsJson) return "Unknown Author";
    try {
      const authors = typeof authorsJson === "string" ? JSON.parse(authorsJson) : authorsJson;
      if (Array.isArray(authors) && authors.length > 0) {
        const firstAuthor = authors[0];
        const name = firstAuthor.family ? `${firstAuthor.family}, ${firstAuthor.given || ""}` : firstAuthor.literal || "Unknown";
        return authors.length > 1 ? `${name} et al.` : name;
      }
    } catch {
      return "Unknown Author";
    }
    return "Unknown Author";
  };

  // Handle rating submission
  const submitRating = async (sourceId: string, rating: number) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (response.ok) {
        // Refresh data to show new rating
        mutate();
        setSelectedSource(null);
        setUserRating(0);
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-500">Loading sources...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-600">Failed to load sources</div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-slate-300 mb-3" />
        <div className="text-sm font-medium text-slate-700">No sources yet</div>
        <div className="text-xs text-slate-500 mt-1">
          Sources will appear here when arguments or claims are cited
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and sort */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="font-medium">
            {data.totalSources} {data.totalSources === 1 ? "Source" : "Sources"}
          </span>
          <span className="text-slate-400">|</span>
          <span>{data.totalCitations} total citations</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "usage" | "rating")}
            className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="usage">Usage</option>
            <option value="rating">Rating</option>
          </select>
        </div>
      </div>

      {/* Sources list */}
      <div className="space-y-3">
        {sortedSources.map((source) => (
          <div
            key={source.sourceId}
            className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors bg-white"
          >
            {/* Title and link */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 group"
                >
                  <span className="truncate">{source.title}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <div className="text-xs text-slate-600 mt-0.5">
                  {formatAuthors(source.authorsJson)}
                  {source.year && ` (${source.year})`}
                  {source.publicationTitle && (
                    <span className="text-slate-500"> · {source.publicationTitle}</span>
                  )}
                </div>
                {/* Phase 3.1: Trust Badges */}
                <div className="mt-1.5">
                  <SourceTrustBadges
                    source={{
                      id: source.sourceId,
                      verificationStatus: source.verificationStatus || "unverified",
                      lastCheckedAt: source.lastCheckedAt,
                      canonicalUrl: source.canonicalUrl,
                      archiveStatus: source.archiveStatus || "none",
                      archiveUrl: source.archiveUrl,
                      archivedAt: source.archivedAt,
                    }}
                    compact={true}
                  />
                </div>
              </div>
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              {/* Usage stats */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-slate-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="font-medium">{source.usageCount}</span>
                  <span className="text-slate-500">uses</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="text-slate-600">
                  <span className="font-medium">{source.usedInArguments}</span>
                  <span className="text-slate-500"> args</span>
                </div>
                <div className="text-slate-600">
                  <span className="font-medium">{source.usedInClaims}</span>
                  <span className="text-slate-500"> claims</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1 text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-medium">{source.uniqueUsers}</span>
                  <span className="text-slate-500">
                    {source.uniqueUsers === 1 ? "user" : "users"}
                  </span>
                </div>
              </div>

              {/* Rating */}
              <div className="ml-auto flex items-center gap-2">
                {source.averageRating !== null ? (
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-slate-700">
                      {source.averageRating.toFixed(1)}
                    </span>
                    <span className="text-slate-500">({source.ratingCount})</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Not rated</span>
                )}
                <button
                  onClick={() => setSelectedSource(source.sourceId)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  Rate
                </button>
              </div>
            </div>

            {/* Rating interface */}
            {selectedSource === source.sourceId && (
              <div className="mt-3 pt-3 border-t border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="text-xs font-medium text-slate-700 mb-2">
                  Rate source quality (1-10):
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setUserRating(rating)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                        userRating === rating
                          ? "bg-indigo-600 text-white scale-110"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => submitRating(source.sourceId, userRating)}
                    disabled={userRating === 0}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Submit Rating
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSource(null);
                      setUserRating(0);
                    }}
                    className="text-xs text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
