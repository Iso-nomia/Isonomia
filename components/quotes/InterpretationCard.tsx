"use client";

/**
 * InterpretationCard Components
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Display and interaction components for quote interpretations:
 * - InterpretationCard: Full interpretation with voting
 * - InterpretationCardCompact: Minimal display
 * - InterpretationCardSkeleton: Loading state
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  User,
  MoreHorizontal,
  Edit,
  Trash2,
  Reply,
  AlertTriangle,
  CheckCircle,
  Sparkles,
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
import { formatDistanceToNow } from "date-fns";

// Simple Avatar component since @/components/ui/avatar doesn't exist
function SimpleAvatar({ 
  src, 
  fallback, 
  className 
}: { 
  src?: string | null; 
  fallback: React.ReactNode; 
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
        className
      )}
    >
      {fallback}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface InterpretationAuthor {
  id: string;
  name?: string | null;
  image?: string | null;
}

export interface InterpretationCardData {
  id: string;
  quoteId: string;
  content: string;
  framework?: string;
  author: InterpretationAuthor;
  voteScore: number;
  userVote?: 1 | -1 | null;
  supportsInterpretationId?: string;
  challengesInterpretationId?: string;
  supportedBy?: InterpretationCardData[];
  challengedBy?: InterpretationCardData[];
  createdAt: string | Date;
  updatedAt?: string | Date;
}

// Framework color mapping
const FRAMEWORK_COLORS: Record<string, string> = {
  "Marxist": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Feminist": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Poststructuralist": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Phenomenological": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Psychoanalytic": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Historicist": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Deconstructionist": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Hermeneutic": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

function getFrameworkColor(framework: string): string {
  return FRAMEWORK_COLORS[framework] || "bg-muted text-muted-foreground";
}

// ─────────────────────────────────────────────────────────
// InterpretationCard - Full display with voting
// ─────────────────────────────────────────────────────────

export interface InterpretationCardProps {
  interpretation: InterpretationCardData;
  showQuoteContext?: boolean;
  showRelations?: boolean;
  isOwner?: boolean;
  className?: string;
  onVote?: (interpretationId: string, value: 1 | -1) => void;
  onReply?: (interpretation: InterpretationCardData, type: "support" | "challenge") => void;
  onEdit?: (interpretation: InterpretationCardData) => void;
  onDelete?: (interpretation: InterpretationCardData) => void;
}

export function InterpretationCard({
  interpretation,
  showQuoteContext = false,
  showRelations = true,
  isOwner = false,
  className,
  onVote,
  onReply,
  onEdit,
  onDelete,
}: InterpretationCardProps) {
  const [isVoting, setIsVoting] = React.useState(false);

  const handleVote = async (value: 1 | -1) => {
    if (!onVote || isVoting) return;
    setIsVoting(true);
    try {
      await onVote(interpretation.id, value);
    } finally {
      setIsVoting(false);
    }
  };

  const formattedDate = interpretation.createdAt
    ? formatDistanceToNow(new Date(interpretation.createdAt), { addSuffix: true })
    : null;

  const isSupporting = !!interpretation.supportsInterpretationId;
  const isChallenging = !!interpretation.challengesInterpretationId;

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-4",
        isSupporting && "border-l-4 border-l-green-500",
        isChallenging && "border-l-4 border-l-red-500",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SimpleAvatar
            src={interpretation.author.image}
            fallback={
              interpretation.author.name?.charAt(0) || <User className="h-3 w-3" />
            }
            className="h-7 w-7"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {interpretation.author.name || "Anonymous"}
            </span>
            {formattedDate && (
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
            )}
          </div>
        </div>

        {/* Framework badge + actions */}
        <div className="flex items-center gap-2">
          {interpretation.framework && (
            <Badge
              variant="outline"
              className={cn("text-xs", getFrameworkColor(interpretation.framework))}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {interpretation.framework}
            </Badge>
          )}
          
          {(isOwner || onReply) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onReply && (
                  <>
                    <DropdownMenuItem onClick={() => onReply(interpretation, "support")}>
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Support this interpretation
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReply(interpretation, "challenge")}>
                      <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
                      Challenge this interpretation
                    </DropdownMenuItem>
                  </>
                )}
                {isOwner && onReply && <DropdownMenuSeparator />}
                {isOwner && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(interpretation)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {isOwner && onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(interpretation)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Relation indicator */}
      {(isSupporting || isChallenging) && (
        <div className="mb-2 flex items-center gap-1 text-xs">
          {isSupporting ? (
            <>
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Supports another interpretation</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-red-600 dark:text-red-400">Challenges another interpretation</span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="text-sm text-foreground whitespace-pre-wrap">
        {interpretation.content}
      </div>

      {/* Voting footer */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  interpretation.userVote === 1 && "text-green-600 bg-green-100 dark:bg-green-900/30"
                )}
                disabled={isVoting}
                onClick={() => handleVote(1)}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upvote</TooltipContent>
          </Tooltip>

          <span
            className={cn(
              "min-w-[2rem] text-center text-sm font-medium",
              interpretation.voteScore > 0 && "text-green-600",
              interpretation.voteScore < 0 && "text-red-600"
            )}
          >
            {interpretation.voteScore > 0 ? "+" : ""}
            {interpretation.voteScore}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  interpretation.userVote === -1 && "text-red-600 bg-red-100 dark:bg-red-900/30"
                )}
                disabled={isVoting}
                onClick={() => handleVote(-1)}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Downvote</TooltipContent>
          </Tooltip>
        </div>

        {/* Relation counts */}
        {showRelations && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {interpretation.supportedBy && interpretation.supportedBy.length > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {interpretation.supportedBy.length} supporting
              </span>
            )}
            {interpretation.challengedBy && interpretation.challengedBy.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                {interpretation.challengedBy.length} challenging
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nested supporting/challenging interpretations */}
      {showRelations && interpretation.supportedBy && interpretation.supportedBy.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l-2 border-green-200 pl-3">
          {interpretation.supportedBy.map((child) => (
            <InterpretationCardCompact
              key={child.id}
              interpretation={child}
              type="support"
            />
          ))}
        </div>
      )}

      {showRelations && interpretation.challengedBy && interpretation.challengedBy.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l-2 border-red-200 pl-3">
          {interpretation.challengedBy.map((child) => (
            <InterpretationCardCompact
              key={child.id}
              interpretation={child}
              type="challenge"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// InterpretationCardCompact - Minimal display
// ─────────────────────────────────────────────────────────

export interface InterpretationCardCompactProps {
  interpretation: InterpretationCardData;
  type?: "support" | "challenge";
  className?: string;
  onClick?: (interpretation: InterpretationCardData) => void;
}

export function InterpretationCardCompact({
  interpretation,
  type,
  className,
  onClick,
}: InterpretationCardCompactProps) {
  const truncatedContent = interpretation.content.length > 150
    ? interpretation.content.slice(0, 150) + "..."
    : interpretation.content;

  return (
    <button
      className={cn(
        "w-full text-left rounded-md bg-muted/50 p-2 text-sm transition-colors hover:bg-muted",
        onClick && "cursor-pointer",
        className
      )}
      onClick={() => onClick?.(interpretation)}
    >
      <div className="flex items-center gap-2 mb-1">
        <SimpleAvatar
          src={interpretation.author.image}
          fallback={interpretation.author.name?.charAt(0) || "?"}
          className="h-5 w-5 text-[10px]"
        />
        <span className="text-xs font-medium">
          {interpretation.author.name || "Anonymous"}
        </span>
        {interpretation.framework && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {interpretation.framework}
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {interpretation.voteScore > 0 ? "+" : ""}
          {interpretation.voteScore}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {truncatedContent}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// InterpretationCardSkeleton - Loading state
// ─────────────────────────────────────────────────────────

export interface InterpretationCardSkeletonProps {
  className?: string;
}

export function InterpretationCardSkeleton({
  className,
}: InterpretationCardSkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Voting */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// InterpretationList - List of interpretations
// ─────────────────────────────────────────────────────────

export interface InterpretationListProps {
  interpretations: InterpretationCardData[];
  loading?: boolean;
  emptyMessage?: string;
  currentUserId?: string;
  className?: string;
  onVote?: (interpretationId: string, value: 1 | -1) => void;
  onReply?: (interpretation: InterpretationCardData, type: "support" | "challenge") => void;
  onEdit?: (interpretation: InterpretationCardData) => void;
  onDelete?: (interpretation: InterpretationCardData) => void;
}

export function InterpretationList({
  interpretations,
  loading,
  emptyMessage = "No interpretations yet",
  currentUserId,
  className,
  onVote,
  onReply,
  onEdit,
  onDelete,
}: InterpretationListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <InterpretationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (interpretations.length === 0) {
    return (
      <div className={cn("flex flex-col items-center py-8 text-center", className)}>
        <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {interpretations.map((interpretation) => (
        <InterpretationCard
          key={interpretation.id}
          interpretation={interpretation}
          isOwner={currentUserId === interpretation.author.id}
          onVote={onVote}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
