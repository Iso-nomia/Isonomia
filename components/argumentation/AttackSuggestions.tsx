"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Target,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import type { AttackSuggestion } from "@/app/server/services/ArgumentGenerationService";
import { Button } from "../ui/button";

// ============================================================================
// Types
// ============================================================================

type SortOption = "strategic" | "strength" | "difficulty" | "burden";
type FilterOption = "all" | "REBUTS" | "UNDERCUTS" | "UNDERMINES";

interface AttackSuggestionsProps {
  targetClaimId: string;
  targetArgumentId?: string;
  userId: string;
  onAttackSelect: (suggestion: AttackSuggestion) => void;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function AttackSuggestions({
  targetClaimId,
  targetArgumentId,
  userId,
  onAttackSelect,
  className = "",
}: AttackSuggestionsProps) {
  // State
  const [suggestions, setSuggestions] = useState<AttackSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("strategic");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [selectedSuggestion, setSelectedSuggestion] = useState<AttackSuggestion | null>(null);

  // Load suggestions on mount
  useEffect(() => {
    if (userId) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetClaimId, targetArgumentId, userId]);

  async function loadSuggestions() {
    if (!userId) {
      console.error("[AttackSuggestions] Missing userId:", { userId, targetClaimId, targetArgumentId });
      setError("User ID is required");
      return;
    }

    console.log("[AttackSuggestions] Loading suggestions with:", { userId, targetClaimId, targetArgumentId });
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/arguments/suggest-attacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetClaimId,
          targetArgumentId,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load attack suggestions");
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Sorting and filtering
  const processedSuggestions = useMemo(() => {
    let filtered = suggestions;

    // Filter by attack type
    if (filterBy !== "all") {
      filtered = filtered.filter((s) => s.attackType === filterBy);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "strategic":
          return b.strategicValue - a.strategicValue;
        case "strength":
          return b.strengthScore - a.strengthScore;
        case "difficulty":
          return a.difficultyScore - b.difficultyScore; // Lower difficulty first
        case "burden":
          // Proponent burden first (easier)
          if (a.burdenOfProof === "proponent" && b.burdenOfProof === "challenger") {
            return -1;
          }
          if (a.burdenOfProof === "challenger" && b.burdenOfProof === "proponent") {
            return 1;
          }
          return b.strategicValue - a.strategicValue;
        default:
          return 0;
      }
    });

    return sorted;
  }, [suggestions, sortBy, filterBy]);

  // Group by attack type for tabs
  const groupedSuggestions = useMemo(() => {
    return {
      all: processedSuggestions,
      REBUTS: processedSuggestions.filter((s) => s.attackType === "REBUTS"),
      UNDERCUTS: processedSuggestions.filter((s) => s.attackType === "UNDERCUTS"),
      UNDERMINES: processedSuggestions.filter((s) => s.attackType === "UNDERMINES"),
    };
  }, [processedSuggestions]);

  // Render
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadSuggestions} />;
  }

  if (suggestions.length === 0) {
    return <EmptyState targetClaimId={targetClaimId} />;
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Attack Suggestions
              </CardTitle>
             
            </div>
            <div className="flex items-center gap-2">
              {/* Sort selector */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px] flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Strategic Value
                    </div>
                  </SelectItem>
                  <SelectItem value="strength">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Attack Strength
                    </div>
                  </SelectItem>
                  <SelectItem value="difficulty">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Easiest First
                    </div>
                  </SelectItem>
                  <SelectItem value="burden">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Burden Advantage
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
    
              {/* Refresh button */}
              {/* <Button
                
                onClick={loadSuggestions}
              >
                <RefreshCw className=" h-4 w-4" />
              </Button> */}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All ({groupedSuggestions.all.length})
              </TabsTrigger>
              <TabsTrigger value="REBUTS">
                Rebut ({groupedSuggestions.REBUTS.length})
              </TabsTrigger>
              <TabsTrigger value="UNDERCUTS">
                Undercut ({groupedSuggestions.UNDERCUTS.length})
              </TabsTrigger>
              <TabsTrigger value="UNDERMINES">
                Undermine ({groupedSuggestions.UNDERMINES.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filterBy} className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {processedSuggestions.map((suggestion, idx) => (
                    <AttackSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      rank={idx + 1}
                      isSelected={selectedSuggestion?.id === suggestion.id}
                      onSelect={() => {
                        setSelectedSuggestion(suggestion);
                        onAttackSelect(suggestion);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AttackSuggestionCard
// ============================================================================

interface AttackSuggestionCardProps {
  suggestion: AttackSuggestion;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

function AttackSuggestionCard({
  suggestion,
  rank,
  isSelected,
  onSelect,
}: AttackSuggestionCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-sky-500" : ""
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Rank badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                #{rank}
              </Badge>
              <AttackTypeBadge type={suggestion.attackType} />
              <TargetScopeBadge scope={suggestion.targetScope} />
            </div>

            {/* Critical question */}
            <CardTitle className="text-base font-semibold">
              {(suggestion.cq as any).question || (suggestion.cq as any).text || "Critical Question"}
            </CardTitle>
          </div>

          {/* Score indicators */}
          <div className="flex flex-col items-end gap-1 ml-4">
            <ScoreIndicator
              label="Strategic"
              score={suggestion.strategicValue}
              icon={<TrendingUp className="h-3 w-3" />}
            />
            <ScoreIndicator
              label="Strength"
              score={suggestion.strengthScore}
              icon={<Zap className="h-3 w-3" />}
            />
            <ScoreIndicator
              label="Difficulty"
              score={100 - suggestion.difficultyScore}
              icon={<Shield className="h-3 w-3" />}
              invert
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Burden of proof indicator */}
        <BurdenOfProofIndicator
          burden={suggestion.burdenOfProof}
          requiresEvidence={suggestion.requiresEvidence}
        />

        {/* Reasoning */}
        <div className="text-sm text-muted-foreground">
          {suggestion.reasoning}
        </div>

        {/* Example attacks preview */}
        {suggestion.exampleAttacks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Example attacks:
            </div>
            <div className="space-y-1">
              {suggestion.exampleAttacks.slice(0, 2).map((example, idx) => (
                <div
                  key={idx}
                  className="text-sm italic text-muted-foreground border-l-2 border-muted pl-3"
                >
                  {example}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence requirements preview */}
        {suggestion.evidenceTypes.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              Requires: {suggestion.evidenceTypes.slice(0, 2).join(", ")}
              {suggestion.evidenceTypes.length > 2 && ` +${suggestion.evidenceTypes.length - 2} more`}
            </span>
          </div>
        )}

        {/* Select button */}
        <button
          className={"w-full flex btnv2--ghost text-sm text-center items-center py-3 px-4 rounded-lg "}
        >
          Use This Attack
        </button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Supporting Components
// ============================================================================

function AttackTypeBadge({ type }: { type: string }) {
  const config = {
    REBUTS: { label: "Rebut", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" },
    UNDERCUTS: { label: "Undercut", className: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100" },
    UNDERMINES: { label: "Undermine", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" },
  };

  const { label, className } = config[type as keyof typeof config] || config.REBUTS;

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

function TargetScopeBadge({ scope }: { scope: string }) {
  const config = {
    conclusion: { label: "→ Conclusion", className: "bg-red-100 text-red-800" },
    inference: { label: "→ Inference", className: "bg-amber-100 text-amber-800" },
    premise: { label: "→ Premise", className: "bg-sky-100 text-sky-800" },
  };

  const { label, className } = config[scope as keyof typeof config] || config.conclusion;

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

interface ScoreIndicatorProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  invert?: boolean;
}

function ScoreIndicator({ label, score, icon, invert = false }: ScoreIndicatorProps) {
  const displayScore = invert ? 100 - score : score;
  const color =
    displayScore >= 70
      ? "text-green-600"
      : displayScore >= 40
      ? "text-amber-600"
      : "text-red-600";

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-1 text-xs cursor-help">
          {icon}
          <span className={`font-medium ${color}`}>{Math.round(displayScore)}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="left" className="w-48">
        <div className="space-y-1">
          <div className="text-xs font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">
            {label === "Strategic" &&
              "Impact on deliberation outcome"}
            {label === "Strength" &&
              "Dialectical power of attack"}
            {label === "Difficulty" &&
              "Ease of execution for you"}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function BurdenOfProofIndicator({
  burden,
  requiresEvidence,
}: {
  burden: string;
  requiresEvidence: boolean;
}) {
  if (burden === "proponent" || burden === "PROPONENT") {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <div>
          <div className="font-medium text-green-900">Burden Advantage</div>
          <div className="text-green-700">
            Just asking shifts burden back to original arguer
          </div>
        </div>
      </div>
    );
  }

  if (!requiresEvidence) {
    return (
      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <div>
          <div className="font-medium text-amber-900">Moderate Difficulty</div>
          <div className="text-amber-700">
            Some evidence needed, but bar is not high
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <div>
        <div className="font-medium text-red-900">High Difficulty</div>
        <div className="text-red-700">
          You bear burden of proof and must provide strong evidence
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading & Error States
// ============================================================================

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg font-medium mb-2">Failed to load suggestions</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4 py-2"
        >
          Try Again
        </button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ targetClaimId }: { targetClaimId: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">No attacks available</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          The target claim doesn&apos;t have any structured arguments yet, so we can&apos;t suggest specific
          attacks. Try a general rebuttal instead.
        </p>
      </CardContent>
    </Card>
  );
}
