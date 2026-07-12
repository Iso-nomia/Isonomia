/**
 * IdentificationConditionsFilter Component
 * 
 * Main component for filtering schemes by identification conditions.
 * Users select observable patterns and see matching schemes in real-time.
 * 
 * Week 7, Task 7.2: Filter UI Components
 */

"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, HelpCircle } from "lucide-react";
import { ConditionCategory } from "./ConditionCategory";
import { ConditionMatchResults } from "./ConditionMatchResults";
import { ConditionTutorial } from "./ConditionTutorial";
import type { ArgumentScheme } from "@prisma/client";
import {
  identificationConditions,
  getConditionsByCategory,
  getCategoryOrder,
  getSchemesForConditions,
  getTotalConditions,
  type SchemeMatch,
} from "@/lib/schemes/identification-conditions";

interface IdentificationConditionsFilterProps {
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  initialConditions?: string[];
  compactMode?: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function IdentificationConditionsFilter({
  onSchemeSelect,
  initialConditions = [],
  compactMode = false,
}: IdentificationConditionsFilterProps) {
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    initialConditions
  );
  const [showTutorial, setShowTutorial] = useState(false);

  // Fetch all schemes
  const { data: schemes, isLoading } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  // Calculate matches in real-time
  const matches = useMemo(() => {
    if (!schemes) return [];
    return getSchemesForConditions(selectedConditions, schemes);
  }, [selectedConditions, schemes]);

  const toggleCondition = (conditionId: string) => {
    setSelectedConditions((prev) =>
      prev.includes(conditionId)
        ? prev.filter((id) => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const clearAll = () => {
    setSelectedConditions([]);
  };

  const categoryOrder = getCategoryOrder();

  return (
    <div className="space-y-4">
      {/* Tutorial */}
      {showTutorial && (
        <ConditionTutorial onClose={() => setShowTutorial(false)} />
      )}

      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Filter by Identification Conditions
        </h2>
        <p className="text-muted-foreground">
          Select patterns you observe in the argument
        </p>
        <Button
          variant="link"
          size="sm"
          onClick={() => setShowTutorial(!showTutorial)}
          className="mt-2"
        >
          <HelpCircle className="w-4 h-4 mr-1" />
          {showTutorial ? "Hide" : "Show"} Tutorial
        </Button>
      </div>

      {/* Instructions */}
      <Card className="p-4 sidebarv2">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p>
              <strong>How to use:</strong>
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Check the conditions you observe in the argument</li>
              <li>Results update automatically as you select conditions</li>
              <li>Match scores show how well each scheme fits</li>
              <li>Click on examples to see what each condition means</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Selection Summary */}
      {selectedConditions.length > 0 && (
        <Card className="p-4 sidebarv2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                Selected ({selectedConditions.length}):
              </span>
              {selectedConditions.map((conditionId) => {
                const condition = identificationConditions[conditionId];
                if (!condition) return null;

                return (
                  <Badge
                    key={conditionId}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {condition.label}
                    <button
                      onClick={() => toggleCondition(conditionId)}
                      className="ml-1 hover:text-destructive transition-colors"
                      aria-label={`Remove ${condition.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
            >
              Clear All
            </Button>
          </div>

          {/* Match count */}
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            {matches.length === 0 && (
              <p>No schemes match the selected conditions.</p>
            )}
            {matches.length === 1 && (
              <p>
                <strong>1 scheme</strong> matches your selections
              </p>
            )}
            {matches.length > 1 && (
              <p>
                <strong>{matches.length} schemes</strong> match your selections
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="sidebarv2 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Conditions by Category */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">
              Select Conditions ({getTotalConditions()} total)
            </h3>
          </div>

          {categoryOrder.map((category) => {
            const conditions = getConditionsByCategory(category);
            return (
              <ConditionCategory
                key={category}
                category={category}
                conditions={conditions}
                selectedConditions={selectedConditions}
                onToggleCondition={toggleCondition}
                defaultExpanded={category === "source_type" || category === "reasoning_type"}
                compact={compactMode}
              />
            );
          })}
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <h3 className="font-bold">
            Matching Schemes
            {matches.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {matches.length}
              </Badge>
            )}
          </h3>

          {/* Loading state */}
          {isLoading && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading schemes...</p>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && selectedConditions.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Select conditions on the left to see matching schemes
              </p>
            </Card>
          )}

          {/* No matches */}
          {!isLoading && selectedConditions.length > 0 && matches.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No schemes match all selected conditions.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={clearAll}
                className="mt-2"
              >
                Clear selections and try different conditions
              </Button>
            </Card>
          )}

          {/* Enhanced Results Component */}
          {!isLoading && matches.length > 0 && (
            <ConditionMatchResults
              matches={matches}
              onSchemeSelect={onSchemeSelect}
              compact={compactMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
