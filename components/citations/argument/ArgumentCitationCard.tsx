"use client";

/**
 * ArgumentCitationCard Component
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Card display for argument citations:
 * - Shows citation type, direction (made/received)
 * - Target argument preview
 * - Annotation/context
 * - Links to deliberation
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  ArrowLeft,
  User,
  MessageSquare,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Edit,
} from "lucide-react";
import Link from "next/link";
import { ArgumentCitationBadge } from "./ArgumentCitationBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ArgCitationType,
  ArgumentCitationSummary,
} from "@/lib/citations/argumentCitationTypes";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ArgumentCitationCardProps {
  citation: ArgumentCitationSummary;
  direction: "made" | "received";
  onArgumentClick?: (argumentId: string) => void;
  onEdit?: (citationId: string) => void;
  onDelete?: (citationId: string) => void;
  showActions?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ArgumentCitationCard({
  citation,
  direction,
  onArgumentClick,
  onEdit,
  onDelete,
  showActions = false,
  className,
}: ArgumentCitationCardProps) {
  const targetArgument =
    direction === "made" ? citation.citedArgument : citation.citingArgument;

  if (!targetArgument) {
    return null;
  }

  const DirectionIcon = direction === "made" ? ArrowRight : ArrowLeft;
  const directionLabel = direction === "made" ? "cites" : "cited by";

  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors",
        "dark:border-gray-700 dark:hover:border-gray-600",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Citation type and direction */}
          <div className="flex items-center gap-2 mb-2">
            <ArgumentCitationBadge
              type={citation.citationType as ArgCitationType}
              size="sm"
            />
            <DirectionIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {directionLabel}
            </span>
          </div>

          {/* Target argument */}
          <button
            onClick={() => onArgumentClick?.(targetArgument.id)}
            className="text-left w-full group"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {targetArgument.text}
            </p>
          </button>

          {/* Annotation */}
          {citation.annotation && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="italic line-clamp-2">{citation.annotation}</span>
            </div>
          )}

          {/* Meta info */}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            {targetArgument.deliberationTitle && (
              <>
                <Link
                  href={`/d/${targetArgument.deliberationId}`}
                  className="hover:underline truncate max-w-[200px] flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {targetArgument.deliberationTitle}
                </Link>
                <span>•</span>
              </>
            )}
            <span>
              {formatDistanceToNow(new Date(citation.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        {showActions && (onEdit || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(citation.id)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit annotation
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(citation.id)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete citation
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Compact Card Variant
// ─────────────────────────────────────────────────────────

export interface ArgumentCitationCardCompactProps {
  citation: ArgumentCitationSummary;
  direction: "made" | "received";
  onClick?: () => void;
  className?: string;
}

export function ArgumentCitationCardCompact({
  citation,
  direction,
  onClick,
  className,
}: ArgumentCitationCardCompactProps) {
  const targetArgument =
    direction === "made" ? citation.citedArgument : citation.citingArgument;

  if (!targetArgument) {
    return null;
  }

  const DirectionIcon = direction === "made" ? ArrowRight : ArrowLeft;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-2 rounded border border-gray-200 hover:border-gray-300 transition-colors",
        "flex items-center gap-2 text-left",
        "dark:border-gray-700 dark:hover:border-gray-600",
        className
      )}
    >
      <ArgumentCitationBadge
        type={citation.citationType as ArgCitationType}
        size="xs"
        showLabel={false}
      />
      <DirectionIcon className="w-3 h-3 text-gray-400 shrink-0" />
      <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
        {targetArgument.text}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Citation List Component
// ─────────────────────────────────────────────────────────

export interface ArgumentCitationListProps {
  citations: ArgumentCitationSummary[];
  direction: "made" | "received";
  onArgumentClick?: (argumentId: string) => void;
  onEdit?: (citationId: string) => void;
  onDelete?: (citationId: string) => void;
  showActions?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ArgumentCitationList({
  citations,
  direction,
  onArgumentClick,
  onEdit,
  onDelete,
  showActions = false,
  emptyMessage = "No citations yet",
  className,
}: ArgumentCitationListProps) {
  if (citations.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {citations.map((citation) => (
        <ArgumentCitationCard
          key={citation.id}
          citation={citation}
          direction={direction}
          onArgumentClick={onArgumentClick}
          onEdit={onEdit}
          onDelete={onDelete}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────

export function ArgumentCitationCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="flex gap-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export default ArgumentCitationCard;
