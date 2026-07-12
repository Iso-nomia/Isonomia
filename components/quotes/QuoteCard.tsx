"use client";

/**
 * QuoteCard Components
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Display components for quote nodes:
 * - QuoteCard: Full quote display with source info
 * - QuoteCardCompact: Minimal inline quote display
 * - QuoteCardSkeleton: Loading state
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Quote,
  BookOpen,
  MessageSquare,
  Link2,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LocatorType,
  QuoteUsageType,
  LOCATOR_TYPE_PREFIXES,
  QUOTE_USAGE_LABELS,
  QUOTE_USAGE_COLORS,
  truncateQuote,
  getLanguageName,
} from "@/lib/quotes/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface QuoteCardData {
  id: string;
  text: string;
  locator?: string;
  locatorType: LocatorType;
  context?: string;
  language?: string;
  isTranslation?: boolean;
  source: {
    id: string;
    title: string;
    authors?: string[];
    year?: number;
  };
  createdBy?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  interpretationCount?: number;
  usageCount?: number;
  hasDeliberation?: boolean;
  createdAt?: string | Date;
}

export interface QuoteUsageData {
  usageType: QuoteUsageType;
  annotation?: string;
}

// ─────────────────────────────────────────────────────────
// QuoteCard - Full display
// ─────────────────────────────────────────────────────────

export interface QuoteCardProps {
  quote: QuoteCardData;
  usage?: QuoteUsageData;
  selected?: boolean;
  showSource?: boolean;
  showActions?: boolean;
  showInterpretations?: boolean;
  className?: string;
  onSelect?: (quote: QuoteCardData) => void;
  onViewInterpretations?: (quote: QuoteCardData) => void;
  onEdit?: (quote: QuoteCardData) => void;
  onDelete?: (quote: QuoteCardData) => void;
  onCopy?: (quote: QuoteCardData) => void;
  onLinkTo?: (quote: QuoteCardData) => void;
}

export function QuoteCard({
  quote,
  usage,
  selected,
  showSource = true,
  showActions = true,
  showInterpretations = true,
  className,
  onSelect,
  onViewInterpretations,
  onEdit,
  onDelete,
  onCopy,
  onLinkTo,
}: QuoteCardProps) {
  const locatorPrefix = LOCATOR_TYPE_PREFIXES[quote.locatorType] || "";
  const formattedLocator = quote.locator
    ? `${locatorPrefix}${quote.locator}`
    : null;

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-all",
        selected && "ring-2 ring-primary",
        onSelect && "cursor-pointer hover:border-primary/50",
        className
      )}
      onClick={() => onSelect?.(quote)}
    >
      {/* Usage badge (when used in claims/arguments) */}
      {usage && (
        <div className="absolute -top-2 left-3">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              QUOTE_USAGE_COLORS[usage.usageType]
            )}
          >
            {QUOTE_USAGE_LABELS[usage.usageType]}
          </Badge>
        </div>
      )}

      {/* Quote icon */}
      <div className="absolute -left-2 -top-2 rounded-full bg-muted p-1.5">
        <Quote className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Main quote text */}
      <blockquote className="border-l-2 border-primary/30 pl-4 italic text-foreground">
        &ldquo;{quote.text}&rdquo;
      </blockquote>

      {/* Context (if available) */}
      {quote.context && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          Context: {quote.context}
        </p>
      )}

      {/* Source info */}
      {showSource && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="truncate">{quote.source.title}</span>
          {formattedLocator && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="font-mono text-xs">{formattedLocator}</span>
            </>
          )}
          {quote.source.year && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{quote.source.year}</span>
            </>
          )}
        </div>
      )}

      {/* Language indicator */}
      {quote.language && quote.language !== "en" && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Languages className="h-3 w-3" />
          <span>{getLanguageName(quote.language)}</span>
          {quote.isTranslation && (
            <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
              Translation
            </Badge>
          )}
        </div>
      )}

      {/* Footer with stats and actions */}
      <div className="mt-3 flex items-center justify-between">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {showInterpretations && typeof quote.interpretationCount === "number" && (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onViewInterpretations?.(quote);
              }}
            >
              <MessageSquare className="h-3 w-3" />
              <span>{quote.interpretationCount} interpretations</span>
            </button>
          )}
          {typeof quote.usageCount === "number" && quote.usageCount > 0 && (
            <div className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              <span>Used {quote.usageCount}x</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCopy && (
                <DropdownMenuItem onClick={() => onCopy(quote)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy quote
                </DropdownMenuItem>
              )}
              {onLinkTo && (
                <DropdownMenuItem onClick={() => onLinkTo(quote)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Link to claim/argument
                </DropdownMenuItem>
              )}
              {onViewInterpretations && (
                <DropdownMenuItem onClick={() => onViewInterpretations(quote)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View interpretations
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(quote)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit quote
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(quote)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete quote
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Usage annotation */}
      {usage?.annotation && (
        <div className="mt-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          <span className="font-medium">Note:</span> {usage.annotation}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// QuoteCardCompact - Inline/minimal display
// ─────────────────────────────────────────────────────────

export interface QuoteCardCompactProps {
  quote: QuoteCardData;
  maxLength?: number;
  showSource?: boolean;
  className?: string;
  onClick?: (quote: QuoteCardData) => void;
}

export function QuoteCardCompact({
  quote,
  maxLength = 100,
  showSource = true,
  className,
  onClick,
}: QuoteCardCompactProps) {
  const truncatedText = truncateQuote(quote.text, maxLength);
  const locatorPrefix = LOCATOR_TYPE_PREFIXES[quote.locatorType] || "";
  const formattedLocator = quote.locator
    ? `${locatorPrefix}${quote.locator}`
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
            onClick && "cursor-pointer",
            className
          )}
          onClick={() => onClick?.(quote)}
        >
          <Quote className="h-3 w-3 flex-shrink-0 text-primary/60" />
          <span className="italic truncate max-w-[200px]">&ldquo;{truncatedText}&rdquo;</span>
          {showSource && formattedLocator && (
            <span className="text-xs text-muted-foreground font-mono">
              ({formattedLocator})
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md">
        <div className="space-y-1">
          <p className="italic">&ldquo;{quote.text}&rdquo;</p>
          <p className="text-xs text-muted-foreground">
            — {quote.source.title}
            {formattedLocator && `, ${formattedLocator}`}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────
// QuoteCardSkeleton - Loading state
// ─────────────────────────────────────────────────────────

export interface QuoteCardSkeletonProps {
  className?: string;
}

export function QuoteCardSkeleton({ className }: QuoteCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
    >
      {/* Quote icon placeholder */}
      <div className="absolute -left-2 -top-2">
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>

      {/* Quote text */}
      <div className="space-y-2 pl-4 border-l-2 border-muted">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Source info */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-12" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// QuoteList - List of quotes
// ─────────────────────────────────────────────────────────

export interface QuoteListProps {
  quotes: QuoteCardData[];
  loading?: boolean;
  emptyMessage?: string;
  selectedId?: string;
  showSource?: boolean;
  className?: string;
  onSelect?: (quote: QuoteCardData) => void;
  onViewInterpretations?: (quote: QuoteCardData) => void;
  onEdit?: (quote: QuoteCardData) => void;
  onDelete?: (quote: QuoteCardData) => void;
}

export function QuoteList({
  quotes,
  loading,
  emptyMessage = "No quotes found",
  selectedId,
  showSource = true,
  className,
  onSelect,
  onViewInterpretations,
  onEdit,
  onDelete,
}: QuoteListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className={cn("flex flex-col items-center py-8 text-center", className)}>
        <Quote className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          selected={quote.id === selectedId}
          showSource={showSource}
          onSelect={onSelect}
          onViewInterpretations={onViewInterpretations}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
