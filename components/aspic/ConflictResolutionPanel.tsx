/**
 * Conflict resolution panel
 * Visualizes preference cycles and provides resolution UI
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  RotateCcw,
  Loader2,
  Info,
} from "lucide-react";

interface PreferenceInCycle {
  id: string;
  preferred: string;
  dispreferred: string;
  weight: number;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  justification?: string;
}

interface Conflict {
  type: "cycle";
  cycle: string[];
  cycleDisplay: string;
  preferences: PreferenceInCycle[];
  severity: "critical";
}

interface Strategy {
  type: string;
  label: string;
  description: string;
  toRemove: string[];
  recommendation?: "recommended" | "neutral" | "not_recommended";
}

interface ConflictResolutionPanelProps {
  deliberationId: string;
  onResolved?: () => void;
  className?: string;
}

export function ConflictResolutionPanel({
  deliberationId,
  onResolved,
  className,
}: ConflictResolutionPanelProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Map<number, string>>(new Map());
  const [manualSelections, setManualSelections] = useState<Map<number, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/aspic/conflicts?deliberationId=${deliberationId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch conflicts");
      }

      const data = await response.json();
      setConflicts(data.conflicts || []);
    } catch (err) {
      console.error("Failed to fetch conflicts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [deliberationId]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  function getStrategiesForConflict(conflict: Conflict): Strategy[] {
    const prefs = conflict.preferences;
    const strategies: Strategy[] = [];

    // Strategy 1: Remove weakest
    const sortedByWeight = [...prefs].sort((a, b) => a.weight - b.weight);
    const weakest = sortedByWeight[0];
    strategies.push({
      type: "remove_weakest",
      label: "Remove Weakest Preference",
      description: `Remove preference with lowest confidence (weight=${weakest.weight.toFixed(2)})`,
      toRemove: [weakest.id],
      recommendation: sortedByWeight[0].weight < (sortedByWeight[1]?.weight ?? 1.0) ? "recommended" : "neutral",
    });

    // Strategy 2: Remove oldest
    const sortedByDate = [...prefs].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const oldest = sortedByDate[0];
    strategies.push({
      type: "remove_oldest",
      label: "Keep Most Recent",
      description: `Remove oldest preference (created ${new Date(oldest.createdAt).toLocaleDateString()})`,
      toRemove: [oldest.id],
      recommendation: "neutral",
    });

    // Strategy 3: Vote-based (if multiple users)
    const userGroups = new Map<string, PreferenceInCycle[]>();
    for (const pref of prefs) {
      if (!userGroups.has(pref.createdBy)) {
        userGroups.set(pref.createdBy, []);
      }
      userGroups.get(pref.createdBy)!.push(pref);
    }

    if (userGroups.size > 1) {
      let minCount = Infinity;
      let minorityUser = "";
      for (const [userId, userPrefs] of userGroups) {
        if (userPrefs.length < minCount) {
          minCount = userPrefs.length;
          minorityUser = userId;
        }
      }

      const minorityPrefs = userGroups.get(minorityUser) ?? [];
      strategies.push({
        type: "vote_based",
        label: "Remove Minority Opinion",
        description: `Remove preferences from user with fewest contributions (${minCount} preference${minCount > 1 ? "s" : ""})`,
        toRemove: minorityPrefs.map(p => p.id),
        recommendation: "neutral",
      });
    }

    // Strategy 4: Manual selection
    strategies.push({
      type: "user_selection",
      label: "Manual Selection",
      description: "Choose which preference(s) to remove manually",
      toRemove: [],
      recommendation: "neutral",
    });

    return strategies;
  }

  async function handleResolve(conflictIndex: number) {
    const conflict = conflicts[conflictIndex];
    const strategy = selectedStrategy.get(conflictIndex);
    
    if (!strategy) {
      setError("Please select a resolution strategy");
      return;
    }

    setResolving(conflictIndex);
    setError(null);

    try {
      let manualPAIds: string[] | undefined;
      
      if (strategy === "user_selection") {
        const selections = manualSelections.get(conflictIndex);
        if (!selections || selections.size === 0) {
          setError("Please select at least one preference to remove");
          setResolving(null);
          return;
        }
        manualPAIds = Array.from(selections);
      }

      const response = await fetch("/api/aspic/conflicts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          conflictIndex,
          strategyType: strategy,
          manualPAIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resolve conflict");
      }

      const data = await response.json();

      // Show success and refresh
      await fetchConflicts();
      onResolved?.();

      // Clear selections for this conflict
      setSelectedStrategy(prev => {
        const newMap = new Map(prev);
        newMap.delete(conflictIndex);
        return newMap;
      });
      setManualSelections(prev => {
        const newMap = new Map(prev);
        newMap.delete(conflictIndex);
        return newMap;
      });
    } catch (err) {
      console.error("Resolution error:", err);
      setError(err instanceof Error ? err.message : "Failed to resolve conflict");
    } finally {
      setResolving(null);
    }
  }

  function toggleManualSelection(conflictIndex: number, paId: string) {
    setManualSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(conflictIndex) ?? new Set();
      
      if (current.has(paId)) {
        current.delete(paId);
      } else {
        current.add(paId);
      }
      
      newMap.set(conflictIndex, current);
      return newMap;
    });
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking for conflicts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && conflicts.length === 0) {
    return (
      <Alert variant="destructive" className={className}>
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load conflicts: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (conflicts.length === 0) {
    return (
      <Alert className={className}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <strong className="text-green-600">No preference conflicts detected.</strong>
          {" "}All preferences are consistent.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>{conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected!</strong>
          <p className="text-sm mt-1">
            Circular preferences violate rationality constraints and must be resolved before evaluation.
          </p>
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {conflicts.map((conflict, index) => {
        const strategies = getStrategiesForConflict(conflict);
        const selected = selectedStrategy.get(index);
        const manuallySelected = manualSelections.get(index) ?? new Set();

        return (
          <Card key={index} className="border-destructive">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="destructive">Cycle</Badge>
                Conflict #{index + 1}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 flex-wrap">
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                  {conflict.cycleDisplay}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preferences in cycle */}
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Involved Preferences:
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {conflict.preferences.map(pref => (
                      <div 
                        key={pref.id} 
                        className="flex items-start justify-between p-3 border rounded text-sm hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2">
                            <span className="truncate">{pref.preferred}</span>
                            <ArrowRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{pref.dispreferred}</span>
                          </div>
                          {pref.justification && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {pref.justification}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {pref.weight.toFixed(2)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(pref.createdAt).toLocaleDateString()}
                          </span>
                          {pref.createdByName && (
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                              {pref.createdByName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Resolution strategies */}
              <div>
                <div className="text-sm font-medium mb-3">Resolution Strategy:</div>
                <RadioGroup
                  value={selected}
                  onValueChange={(value) => 
                    setSelectedStrategy(prev => new Map(prev).set(index, value))
                  }
                >
                  <div className="space-y-3">
                    {strategies.map(strategy => (
                      <div key={strategy.type} className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem 
                            value={strategy.type} 
                            id={`${index}-${strategy.type}`}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={`${index}-${strategy.type}`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <span>{strategy.label}</span>
                              {strategy.recommendation === "recommended" && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Recommended
                                </Badge>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {strategy.description}
                            </p>
                          </div>
                        </div>

                        {/* Manual selection UI */}
                        {strategy.type === "user_selection" && selected === "user_selection" && (
                          <div className="ml-6 mt-2 space-y-2 p-3 border rounded bg-muted/30">
                            <div className="text-xs font-medium">Select preferences to remove:</div>
                            <div className="space-y-2">
                              {conflict.preferences.map(pref => (
                                <div key={pref.id} className="flex items-start space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`${index}-manual-${pref.id}`}
                                    checked={manuallySelected.has(pref.id)}
                                    onChange={() => toggleManualSelection(index, pref.id)}
                                    className="mt-0.5"
                                  />
                                  <label 
                                    htmlFor={`${index}-manual-${pref.id}`}
                                    className="text-xs cursor-pointer flex-1"
                                  >
                                    <span className="font-medium">{pref.preferred}</span>
                                    {" → "}
                                    <span>{pref.dispreferred}</span>
                                    <span className="text-muted-foreground ml-2">
                                      (weight: {pref.weight.toFixed(2)})
                                    </span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <Button
                onClick={() => handleResolve(index)}
                disabled={!selected || resolving === index}
                className="w-full"
              >
                {resolving === index ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Resolve Conflict
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
