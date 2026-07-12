/**
 * Scheme Search Component
 * 
 * Unified search interface for finding argumentation schemes by name,
 * description, keywords, or scheme key. Includes filters and search suggestions.
 * 
 * Week 8, Task 8.4: Search Functionality
 */

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Clock, TrendingUp, Filter as FilterIcon } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import { useNavigationStore } from "@/lib/schemes/navigation-state";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SchemeSearchProps {
  onSchemeSelect: (scheme: ArgumentScheme) => void;
}

export default function SchemeSearch({ onSchemeSelect }: SchemeSearchProps) {
  const {
    searchState,
    setSearchQuery,
    setSearchFilters,
    addRecentSearch,
    clearSearchFilters,
  } = useNavigationStore();

  const { data: allSchemes, isLoading } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  const [localQuery, setLocalQuery] = useState(searchState.query || "");
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Update local query when store changes
  useEffect(() => {
    setLocalQuery(searchState.query || "");
  }, [searchState.query]);

  // Search logic
  const searchResults = useMemo(() => {
    if (!allSchemes || !searchState.query?.trim()) {
      return [];
    }

    const query = searchState.query.toLowerCase();
    const results = allSchemes.filter((scheme) => {
      // Search in name
      if (scheme.name?.toLowerCase().includes(query)) return true;

      // Search in description
      if (scheme.description?.toLowerCase().includes(query)) return true;

      // Search in summary
      if (scheme.summary?.toLowerCase().includes(query)) return true;

      // Search in key
      if (scheme.key.toLowerCase().includes(query)) return true;

      // Search in title
      if (scheme.title?.toLowerCase().includes(query)) return true;

      return false;
    });

    // Apply filters
    let filtered = results;

    if (searchState.filters?.purpose) {
      filtered = filtered.filter(
        (s) => s.purpose?.toLowerCase() === searchState.filters.purpose?.toLowerCase()
      );
    }

    if (searchState.filters?.source) {
      filtered = filtered.filter(
        (s) => s.source?.toLowerCase() === searchState.filters.source?.toLowerCase()
      );
    }

    if (searchState.filters?.cluster) {
      filtered = filtered.filter((s) => {
        const semanticCluster = (s as any).semanticCluster;
        return semanticCluster === searchState.filters.cluster;
      });
    }

    return filtered;
  }, [allSchemes, searchState.query, searchState.filters]);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    if (!allSchemes) return { purposes: [], sources: [], clusters: [] };

    const purposes = Array.from(
      new Set(allSchemes.map((s) => s.purpose).filter(Boolean))
    ).sort() as string[];

    const sources = Array.from(
      new Set(allSchemes.map((s) => s.source).filter(Boolean))
    ).sort() as string[];

    const clusters = Array.from(
      new Set(allSchemes.map((s) => (s as any).semanticCluster).filter(Boolean))
    ).sort() as string[];

    return { purposes, sources, clusters };
  }, [allSchemes]);

  // Search suggestions based on recent and popular searches
  const suggestions = useMemo(() => {
    if (!allSchemes || !localQuery.trim() || localQuery === searchState.query) {
      return [];
    }

    const query = localQuery.toLowerCase();
    const matchingSchemes = allSchemes
      .filter((s) => s.name?.toLowerCase().startsWith(query))
      .slice(0, 5);

    return matchingSchemes.map((s) => s.name || s.key);
  }, [allSchemes, localQuery, searchState.query]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      addRecentSearch(query);
    }
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(localQuery);
    }
  };

  const handleClearFilters = () => {
    clearSearchFilters();
  };

  const handleRecentSearchClick = (query: string) => {
    setLocalQuery(query);
    handleSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocalQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleSchemeClick = (scheme: ArgumentScheme) => {
    onSchemeSelect(scheme);
  };

  const activeFiltersCount = [
    searchState.filters?.purpose,
    searchState.filters?.source,
    searchState.filters?.cluster,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Search Input with Suggestions */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search schemes by name, description, or key..."
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowSuggestions(true)}
              className="pl-10 pr-24 text-base"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
              {localQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalQuery("");
                    handleSearch("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => handleSearch(localQuery)}
              >
                Search
              </Button>
            </div>

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <Card className="absolute top-full mt-2 w-full z-10 p-2">
                <div className="space-y-1">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                    >
                      <Search className="inline w-3 h-3 mr-2 text-muted-foreground" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Filters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium">Purpose</label>
                <Select
                  value={searchState.filters?.purpose || ""}
                  onValueChange={(value) =>
                    setSearchFilters({
                      ...(searchState.filters || {}),
                      purpose: value ? (value as "action" | "state_of_affairs") : undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All purposes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All purposes</SelectItem>
                    {filterOptions.purposes.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Source</label>
                <Select
                  value={searchState.filters?.source || ""}
                  onValueChange={(value) =>
                    setSearchFilters({
                      ...(searchState.filters || {}),
                      source: value ? (value as "internal" | "external") : undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sources</SelectItem>
                    {filterOptions.sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cluster</label>
                <Select
                  value={searchState.filters?.cluster || ""}
                  onValueChange={(value) =>
                    setSearchFilters({
                      ...(searchState.filters || {}),
                      cluster: value || undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All clusters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All clusters</SelectItem>
                    {filterOptions.clusters.map((cluster) => (
                      <SelectItem key={cluster} value={cluster}>
                        {cluster}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Recent Searches */}
      {!searchState.query && searchState.recentSearches.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" />
            <h3 className="font-semibold">Recent Searches</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchState.recentSearches.map((recent, idx) => (
              <button
                key={idx}
                onClick={() => handleRecentSearchClick(recent)}
                className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80 transition-colors"
              >
                {recent}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Search Results */}
      {searchState.query && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {isLoading ? (
                "Searching..."
              ) : (
                <>
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchState.query}&rdquo;
                </>
              )}
            </h3>
            {searchResults.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <TrendingUp className="inline w-4 h-4 mr-1" />
                Sorted by relevance
              </div>
            )}
          </div>

          {isLoading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading schemes...</p>
            </Card>
          ) : searchResults.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No schemes found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search or removing filters
              </p>
              {activeFiltersCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((scheme) => (
                <Card
                  key={scheme.id}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleSchemeClick(scheme)}
                >
                  <h4 className="font-semibold mb-2 line-clamp-2">
                    {scheme.name || scheme.key}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    {scheme.key}
                  </p>
                  {scheme.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {scheme.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {scheme.purpose && (
                      <Badge variant="secondary" className="text-xs">
                        {scheme.purpose}
                      </Badge>
                    )}
                    {scheme.source && (
                      <Badge variant="outline" className="text-xs">
                        {scheme.source}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State (no search query) */}
      {!searchState.query && searchState.recentSearches.length === 0 && (
        <Card className="p-12 text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Search Argumentation Schemes</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Enter a search query to find schemes by name, description, or key.
            Use filters to narrow down results by purpose, source, or cluster.
          </p>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground max-w-md mx-auto text-left">
            <p><strong>Search tips:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Try searching for &ldquo;authority&rdquo; to find authority-based schemes</li>
              <li>Search &ldquo;cause&rdquo; to find causal reasoning schemes</li>
              <li>Use filters to refine results by purpose or source</li>
              <li>Recent searches are saved for quick access</li>
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
