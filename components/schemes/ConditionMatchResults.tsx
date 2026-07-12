/**
 * ConditionMatchResults Component
 * 
 * Displays a list of scheme matches with sorting, filtering, and quality grouping.
 * Includes visual indicators and match explanations.
 * 
 * Week 7, Task 7.3: Results Display with Match Scores
 */

"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Filter } from "lucide-react";
import { ConditionMatchResult } from "./ConditionMatchResult";
import { MatchQualityIndicator } from "./MatchQualityIndicator";
import type { ArgumentScheme } from "@prisma/client";
import type { SchemeMatch } from "@/lib/schemes/identification-conditions";

interface ConditionMatchResultsProps {
  matches: SchemeMatch[];
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  compact?: boolean;
}

type SortOption = "score" | "name" | "quality";
type FilterOption = "all" | "perfect" | "strong" | "moderate" | "weak";

export function ConditionMatchResults({
  matches,
  onSchemeSelect,
  compact = false,
}: ConditionMatchResultsProps) {
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [filterQuality, setFilterQuality] = useState<FilterOption>("all");
  const [showDetails, setShowDetails] = useState(true);

  // Apply filtering and sorting
  const processedMatches = useMemo(() => {
    let filtered = matches;

    // Filter by quality
    if (filterQuality !== "all") {
      filtered = filtered.filter((m) => m.quality === filterQuality);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "score":
          return b.score - a.score; // Descending
        case "name":
          return (a.scheme.name || "").localeCompare(b.scheme.name || ""); // Alphabetical
        case "quality":
          // Perfect > Strong > Moderate > Weak
          const qualityOrder = { perfect: 0, strong: 1, moderate: 2, weak: 3 };
          return qualityOrder[a.quality] - qualityOrder[b.quality];
        default:
          return 0;
      }
    });

    return sorted;
  }, [matches, sortBy, filterQuality]);

  // Group by quality for display
  const qualityCounts = useMemo(() => {
    const counts = {
      perfect: 0,
      strong: 0,
      moderate: 0,
      weak: 0,
      total: matches.length,
    };

    matches.forEach((match) => {
      counts[match.quality]++;
    });

    return counts;
  }, [matches]);

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Quality Distribution Indicator */}
      <MatchQualityIndicator matches={matches} compact={compact} />

      {/* Controls */}
      <Card className="p-4 panelv2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Control */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Show:</span>
            <Select
              value={filterQuality}
              onValueChange={(v) => setFilterQuality(v as FilterOption)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All ({qualityCounts.total})
                </SelectItem>
                <SelectItem value="perfect">
                  Perfect ({qualityCounts.perfect})
                </SelectItem>
                <SelectItem value="strong">
                  Strong ({qualityCounts.strong})
                </SelectItem>
                <SelectItem value="moderate">
                  Moderate ({qualityCounts.moderate})
                </SelectItem>
                <SelectItem value="weak">
                  Weak ({qualityCounts.weak})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggle Details */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide" : "Show"} Details
          </Button>
        </div>

        {/* Quality Summary */}
        <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Match quality:</span>
          {qualityCounts.perfect > 0 && (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-700"
            >
              {qualityCounts.perfect} Perfect
            </Badge>
          )}
          {qualityCounts.strong > 0 && (
            <Badge
              variant="outline"
              className="bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-700"
            >
              {qualityCounts.strong} Strong
            </Badge>
          )}
          {qualityCounts.moderate > 0 && (
            <Badge
              variant="outline"
              className="bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-700"
            >
              {qualityCounts.moderate} Moderate
            </Badge>
          )}
          {qualityCounts.weak > 0 && (
            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-700"
            >
              {qualityCounts.weak} Weak
            </Badge>
          )}
        </div>
      </Card>

      {/* Results List */}
      <div className="space-y-3 panelv2">
        {processedMatches.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No schemes match the selected quality filter.
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setFilterQuality("all")}
              className="mt-2"
            >
              Show all results
            </Button>
          </Card>
        ) : (
          processedMatches.map((match) => (
            <ConditionMatchResult
              key={match.scheme.id}
              match={match}
              onSelect={onSchemeSelect}
              showDetails={showDetails}
              compact={compact}
            />
          ))
        )}
      </div>

      {/* Results Count */}
      <div className="text-center text-sm text-muted-foreground">
        Showing {processedMatches.length} of {matches.length} result
        {matches.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
