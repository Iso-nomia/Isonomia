// components/sources/ArchiveBadge.tsx
// Phase 3.1: Source Archive Status Badge

"use client";

import React from "react";
import {
  Archive,
  Cloud,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Define type locally to avoid Prisma client cache issues
export type ArchiveStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "archived"
  | "failed"
  | "exists";

interface ArchiveBadgeProps {
  status: ArchiveStatus;
  archiveUrl?: string | null;
  archivedAt?: Date | string | null;
  onRequestArchive?: () => void;
  loading?: boolean;
  compact?: boolean;
}

const statusConfig: Record<
  ArchiveStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    color: string;
    hoverColor: string;
  }
> = {
  none: {
    icon: Cloud,
    label: "Not archived",
    description: "This source has no archive backup",
    color: "text-muted-foreground/50",
    hoverColor: "hover:text-muted-foreground",
  },
  pending: {
    icon: Loader2,
    label: "Pending",
    description: "Archive request submitted",
    color: "text-blue-500",
    hoverColor: "hover:text-blue-600",
  },
  in_progress: {
    icon: Loader2,
    label: "Archiving",
    description: "Archive is being created",
    color: "text-blue-500",
    hoverColor: "hover:text-blue-600",
  },
  archived: {
    icon: Archive,
    label: "Archived",
    description: "Source is safely archived",
    color: "text-green-500",
    hoverColor: "hover:text-green-600",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    description: "Archive request failed",
    color: "text-red-500",
    hoverColor: "hover:text-red-600",
  },
  exists: {
    icon: Archive,
    label: "Archived",
    description: "Found existing archive",
    color: "text-green-500",
    hoverColor: "hover:text-green-600",
  },
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ArchiveBadge({
  status,
  archiveUrl,
  archivedAt,
  onRequestArchive,
  loading = false,
  compact = false,
}: ArchiveBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isArchived = status === "archived" || status === "exists";
  const isPending = status === "pending" || status === "in_progress" || loading;

  // Determine the action to show
  const showLoading = isPending;
  const showArchiveLink = isArchived && archiveUrl;
  const canRequestArchive = !isArchived && !isPending && onRequestArchive;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showArchiveLink && archiveUrl) {
      window.open(archiveUrl, "_blank", "noopener,noreferrer");
    } else if (canRequestArchive) {
      onRequestArchive();
    }
  };

  const badge = (
    <button
      onClick={handleClick}
      disabled={showLoading || (!showArchiveLink && !canRequestArchive)}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors",
        config.color,
        config.hoverColor,
        (showArchiveLink || canRequestArchive) && "cursor-pointer",
        showLoading && "cursor-wait",
        !showArchiveLink && !canRequestArchive && !showLoading && "cursor-default"
      )}
    >
      {showLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {showArchiveLink && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
    </button>
  );

  const getTooltipContent = () => {
    if (showLoading) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            <span className="font-medium text-sm">Archiving...</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Saving to Wayback Machine
          </p>
        </div>
      );
    }

    if (showArchiveLink) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Archive className="h-3.5 w-3.5 text-green-500" />
            <span className="font-medium text-sm">Archived</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Click to view archived version
          </p>
          {archivedAt && (
            <p className="text-xs text-muted-foreground">
              Archived on {formatDate(archivedAt)}
            </p>
          )}
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="font-medium text-sm">Archive Failed</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {canRequestArchive ? "Click to retry" : "Archive request failed"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-sm">Not Archived</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {canRequestArchive 
            ? "Click to save to Wayback Machine" 
            : "No archive available"}
        </p>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent sideOffset={2} side="right" className=" bg-white border border-indigo-200 max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ArchiveBadge;
