"use client";

import React, { useState } from "react";
import { useCrossRoomSearch } from "@/lib/crossDeliberation/hooks";
import { CrossRoomSearchResult } from "@/lib/crossDeliberation/types";
import { Search, Globe, Users, AlertTriangle } from "lucide-react";

interface CrossRoomSearchPanelProps {
  currentDeliberationId?: string;
  onSelectClaim?: (result: CrossRoomSearchResult) => void;
}

export default function CrossRoomSearchPanel({
  currentDeliberationId,
  onSelectClaim,
}: CrossRoomSearchPanelProps) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useCrossRoomSearch(
    query,
    currentDeliberationId
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Cross-Room Search</h3>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search claims across all deliberations..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Results */}
      {isLoading && query.length >= 3 && (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded" />
          ))}
        </div>
      )}

      {!isLoading && results && results.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {results.map((result) => (
            <CrossRoomResultCard
              key={result.canonicalClaim.id}
              result={result}
              onSelect={() => onSelectClaim?.(result)}
            />
          ))}
        </div>
      )}

      {!isLoading && query.length >= 3 && results?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No claims found across other deliberations</p>
        </div>
      )}

      {query.length > 0 && query.length < 3 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          Type at least 3 characters to search
        </div>
      )}
    </div>
  );
}

function CrossRoomResultCard({
  result,
  onSelect,
}: {
  result: CrossRoomSearchResult;
  onSelect: () => void;
}) {
  const statusColors: Record<string, string> = {
    ACCEPTED: "bg-green-100 text-green-700",
    EMERGING: "bg-blue-100 text-blue-600",
    CONTESTED: "bg-amber-100 text-amber-700",
    REJECTED: "bg-red-100 text-red-700",
    UNDETERMINED: "bg-gray-100 text-gray-600",
    SUPERSEDED: "bg-purple-100 text-purple-600",
  };

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition"
    >
      {/* Claim text */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
        {result.canonicalClaim.representativeText || result.canonicalClaim.title}
      </p>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {result.canonicalClaim.totalInstances} deliberation(s)
          </span>
          {result.canonicalClaim.totalChallenges > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {result.canonicalClaim.totalChallenges} challenge(s)
            </span>
          )}
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            statusColors[result.canonicalClaim.globalStatus] || statusColors.UNDETERMINED
          }`}
        >
          {result.canonicalClaim.globalStatus.replace("_", " ")}
        </span>
      </div>

      {/* Sample deliberations */}
      <div className="mt-2 flex flex-wrap gap-1">
        {result.instances.slice(0, 3).map((inst) => (
          <span
            key={inst.deliberation.id}
            className="text-xs px-2 py-0.5 bg-gray-100 rounded truncate max-w-[150px]"
          >
            {inst.deliberation.title}
          </span>
        ))}
        {result.instances.length > 3 && (
          <span className="text-xs text-gray-500">
            +{result.instances.length - 3} more
          </span>
        )}
      </div>
    </button>
  );
}
