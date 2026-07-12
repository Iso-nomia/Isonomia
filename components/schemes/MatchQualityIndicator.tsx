/**
 * MatchQualityIndicator Component
 * 
 * Visual indicator showing the distribution of match quality levels.
 * Displays a progress bar with color-coded segments for perfect/strong/moderate/weak matches.
 * 
 * Week 7, Task 7.3: Results Display with Match Scores
 */

"use client";

import { Card } from "@/components/ui/card";
import type { SchemeMatch } from "@/lib/schemes/identification-conditions";

interface MatchQualityIndicatorProps {
  matches: SchemeMatch[];
  compact?: boolean;
}

export function MatchQualityIndicator({
  matches,
  compact = false,
}: MatchQualityIndicatorProps) {
  if (matches.length === 0) {
    return null;
  }

  // Calculate quality distribution
  const distribution = {
    perfect: matches.filter((m) => m.quality === "perfect").length,
    strong: matches.filter((m) => m.quality === "strong").length,
    moderate: matches.filter((m) => m.quality === "moderate").length,
    weak: matches.filter((m) => m.quality === "weak").length,
  };

  const total = matches.length;

  // Calculate percentages
  const percentages = {
    perfect: (distribution.perfect / total) * 100,
    strong: (distribution.strong / total) * 100,
    moderate: (distribution.moderate / total) * 100,
    weak: (distribution.weak / total) * 100,
  };

  return (
    <Card className={`${compact ? "p-3 panelv2" : "p-4 panelv2" }`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Match Quality Distribution</span>
          <span className="text-muted-foreground">{total} total</span>
        </div>

        {/* Visual Bar */}
        <div className="h-6 flex rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900">
          {distribution.perfect > 0 && (
            <div
              className="bg-green-500 dark:bg-green-600 transition-all duration-300"
              style={{ width: `${percentages.perfect}%` }}
              title={`${distribution.perfect} perfect matches (${percentages.perfect.toFixed(1)}%)`}
            />
          )}
          {distribution.strong > 0 && (
            <div
              className="bg-sky-500 dark:bg-sky-600 transition-all duration-300"
              style={{ width: `${percentages.strong}%` }}
              title={`${distribution.strong} strong matches (${percentages.strong.toFixed(1)}%)`}
            />
          )}
          {distribution.moderate > 0 && (
            <div
              className="bg-yellow-500 dark:bg-yellow-600 transition-all duration-300"
              style={{ width: `${percentages.moderate}%` }}
              title={`${distribution.moderate} moderate matches (${percentages.moderate.toFixed(1)}%)`}
            />
          )}
          {distribution.weak > 0 && (
            <div
              className="bg-gray-400 dark:bg-gray-600 transition-all duration-300"
              style={{ width: `${percentages.weak}%` }}
              title={`${distribution.weak} weak matches (${percentages.weak.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          {distribution.perfect > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500 dark:bg-green-600" />
              <span>
                Perfect: <strong>{distribution.perfect}</strong>{" "}
                <span className="text-muted-foreground">
                  ({percentages.perfect.toFixed(0)}%)
                </span>
              </span>
            </div>
          )}
          {distribution.strong > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-sky-500 dark:bg-sky-600" />
              <span>
                Strong: <strong>{distribution.strong}</strong>{" "}
                <span className="text-muted-foreground">
                  ({percentages.strong.toFixed(0)}%)
                </span>
              </span>
            </div>
          )}
          {distribution.moderate > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500 dark:bg-yellow-600" />
              <span>
                Moderate: <strong>{distribution.moderate}</strong>{" "}
                <span className="text-muted-foreground">
                  ({percentages.moderate.toFixed(0)}%)
                </span>
              </span>
            </div>
          )}
          {distribution.weak > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-400 dark:bg-gray-600" />
              <span>
                Weak: <strong>{distribution.weak}</strong>{" "}
                <span className="text-muted-foreground">
                  ({percentages.weak.toFixed(0)}%)
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Insight */}
        {distribution.perfect > 0 && (
          <p className="text-xs text-green-700 dark:text-green-400 pt-2 border-t">
            ✓ You have {distribution.perfect} perfect match
            {distribution.perfect !== 1 ? "es" : ""} - these schemes strongly align
            with your selected conditions
          </p>
        )}
        {distribution.perfect === 0 && distribution.strong > 0 && (
          <p className="text-xs text-sky-700 dark:text-sky-400 pt-2 border-t">
            Your best matches are strong - consider adding more conditions for
            more precise results
          </p>
        )}
        {distribution.perfect === 0 &&
          distribution.strong === 0 &&
          distribution.moderate > 0 && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400 pt-2 border-t">
              Matches are moderate - try different condition combinations for
              better results
            </p>
          )}
      </div>
    </Card>
  );
}
