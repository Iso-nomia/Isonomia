"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { VersionBadge } from "./VersionBadge";
import { FileText, MessageSquare, Shield, ChevronRight } from "lucide-react";

/**
 * ReleaseListItem - Display a single release in a list
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

export interface ReleaseListItemData {
  id: string;
  version: string;
  title: string | null;
  description: string | null;
  claimsCount: number;
  argumentsCount: number;
  defendedCount: number;
  citationUri: string;
  createdAt: Date | string;
  createdByName: string;
}

export interface ReleaseListItemProps {
  release: ReleaseListItemData;
  isLatest?: boolean;
  isSelected?: boolean;
  onClick?: (release: ReleaseListItemData) => void;
  className?: string;
}

export function ReleaseListItem({
  release,
  isLatest = false,
  isSelected = false,
  onClick,
  className,
}: ReleaseListItemProps) {
  const createdAt = typeof release.createdAt === "string" 
    ? new Date(release.createdAt) 
    : release.createdAt;

  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });

  return (
    <button
      type="button"
      onClick={() => onClick?.(release)}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg border transition-all",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        isSelected
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
          : "border-slate-200 dark:border-slate-700",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left side - version and title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <VersionBadge 
              version={release.version} 
              isLatest={isLatest}
              size="md"
            />
            {release.title && (
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {release.title}
              </span>
            )}
          </div>
          
          {release.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
              {release.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {release.claimsCount} claims
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {release.argumentsCount} args
            </span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500" />
              {release.defendedCount} defended
            </span>
          </div>
        </div>

        {/* Right side - meta and arrow */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-slate-400">{timeAgo}</span>
          <span className="text-[10px] text-slate-400">{release.createdByName}</span>
          <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
        </div>
      </div>
    </button>
  );
}

/**
 * ReleaseListItemSkeleton - Loading state
 */
export function ReleaseListItemSkeleton() {
  return (
    <div className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
}
