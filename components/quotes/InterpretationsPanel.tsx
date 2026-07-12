"use client";

/**
 * InterpretationsPanel Component
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Side panel or modal content for viewing and managing interpretations of a quote.
 * - Shows the quote with its source
 * - Lists all interpretations with voting
 * - Allows filtering by framework
 * - Provides ability to add new interpretations
 */

import * as React from "react";
import useSWR, { mutate } from "swr";
import { cn } from "@/lib/utils";
import {
  Quote,
  BookOpen,
  Filter,
  Plus,
  MessageSquare,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QuoteCardData,
  QuoteCard,
} from "./QuoteCard";
import {
  InterpretationCardData,
  InterpretationList,
} from "./InterpretationCard";
import {
  LOCATOR_TYPE_PREFIXES,
} from "@/lib/quotes/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface InterpretationsPanelData {
  interpretations: InterpretationCardData[];
  count: number;
}

// ─────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

// ─────────────────────────────────────────────────────────
// Common Frameworks
// ─────────────────────────────────────────────────────────

const COMMON_FRAMEWORKS = [
  "Marxist",
  "Feminist",
  "Poststructuralist",
  "Phenomenological",
  "Psychoanalytic",
  "Historicist",
  "Deconstructionist",
  "Hermeneutic",
  "Postcolonial",
  "Queer Theory",
  "New Historicism",
  "Formalist",
];

// ─────────────────────────────────────────────────────────
// InterpretationsPanel
// ─────────────────────────────────────────────────────────

export interface InterpretationsPanelProps {
  quote: QuoteCardData;
  currentUserId?: string;
  className?: string;
  onClose?: () => void;
  onAddInterpretation?: (quote: QuoteCardData) => void;
  onStartDeliberation?: (quote: QuoteCardData) => void;
}

export function InterpretationsPanel({
  quote,
  currentUserId,
  className,
  onClose,
  onAddInterpretation,
  onStartDeliberation,
}: InterpretationsPanelProps) {
  const [frameworkFilter, setFrameworkFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"recent" | "score">("score");

  // Build API URL with filters
  const apiUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (frameworkFilter && frameworkFilter !== "all") {
      params.set("framework", frameworkFilter);
    }
    params.set("sortBy", sortBy);
    return `/api/quotes/${quote.id}/interpretations?${params.toString()}`;
  }, [quote.id, frameworkFilter, sortBy]);

  // Fetch interpretations
  const { data, error, isLoading, mutate: refreshInterpretations } = useSWR<InterpretationsPanelData>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Vote handler
  const handleVote = async (interpretationId: string, value: 1 | -1) => {
    try {
      const res = await fetch(
        `/api/quotes/${quote.id}/interpretations/${interpretationId}?action=vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }
      );
      if (!res.ok) throw new Error("Vote failed");
      refreshInterpretations();
    } catch (error) {
      console.error("Vote error:", error);
    }
  };

  // Reply handler (support/challenge)
  const handleReply = (
    interpretation: InterpretationCardData,
    type: "support" | "challenge"
  ) => {
    // This would open a modal to create a new interpretation
    // that supports or challenges the given one
    onAddInterpretation?.(quote);
  };

  // Delete handler
  const handleDelete = async (interpretation: InterpretationCardData) => {
    if (!confirm("Are you sure you want to delete this interpretation?")) return;
    
    try {
      const res = await fetch(
        `/api/quotes/${quote.id}/interpretations/${interpretation.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      refreshInterpretations();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const locatorPrefix = LOCATOR_TYPE_PREFIXES[quote.locatorType] || "";
  const formattedLocator = quote.locator
    ? `${locatorPrefix}${quote.locator}`
    : null;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Interpretations</h2>
          {data && (
            <Badge variant="secondary" className="ml-1">
              {data.count}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refreshInterpretations()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Quote context */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Quote className="h-4 w-4 mt-0.5 text-primary/60 flex-shrink-0" />
              <div className="flex-1">
                <blockquote className="text-sm italic text-foreground">
                  &ldquo;{quote.text}&rdquo;
                </blockquote>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3 w-3" />
                  <span>{quote.source.title}</span>
                  {formattedLocator && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{formattedLocator}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Filters and actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Select
                value={frameworkFilter}
                onValueChange={setFrameworkFilter}
              >
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="All frameworks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All frameworks</SelectItem>
                  {COMMON_FRAMEWORKS.map((fw) => (
                    <SelectItem key={fw} value={fw}>
                      {fw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as "recent" | "score")}
              >
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Top rated</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {onStartDeliberation && !quote.hasDeliberation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStartDeliberation(quote)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Start Discussion
                </Button>
              )}
              {onAddInterpretation && (
                <Button
                  size="sm"
                  onClick={() => onAddInterpretation(quote)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Interpretation
                </Button>
              )}
            </div>
          </div>

          {/* Interpretations list */}
          {error ? (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-sm text-destructive">Failed to load interpretations</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => refreshInterpretations()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <InterpretationList
              interpretations={data?.interpretations || []}
              loading={isLoading}
              currentUserId={currentUserId}
              emptyMessage="No interpretations yet. Be the first to share your reading!"
              onVote={handleVote}
              onReply={handleReply}
              onDelete={handleDelete}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// InterpretationsPanelSkeleton
// ─────────────────────────────────────────────────────────

export function InterpretationsPanelSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      <div className="p-4 space-y-4">
        {/* Quote context */}
        <Skeleton className="h-20 w-full rounded-lg" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40 rounded" />
          <Skeleton className="h-8 w-32 rounded" />
        </div>

        {/* Interpretations */}
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
