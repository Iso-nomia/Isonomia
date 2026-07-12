"use client";

/**
 * VersionCard Component
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * Displays claim version history:
 * - Version number and change type
 * - Author and timestamp
 * - Change reason/rationale
 * - Version comparison (diff)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GitCommit,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  FileEdit,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Merge,
  Split,
  Import,
  ExternalLink,
  Diff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { VersionChangeType } from "@prisma/client";
import type { ClaimVersionSummary } from "@/lib/provenance/types";

// ─────────────────────────────────────────────────────────
// Change Type Configuration
// ─────────────────────────────────────────────────────────

const CHANGE_TYPE_CONFIG: Record<
  VersionChangeType,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    icon: React.ElementType;
  }
> = {
  CREATED: {
    label: "Created",
    description: "Initial version of the claim",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: GitCommit,
  },
  REFINED: {
    label: "Refined",
    description: "Clarified or improved wording",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: FileEdit,
  },
  STRENGTHENED: {
    label: "Strengthened",
    description: "Made more assertive or confident",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: ArrowUpCircle,
  },
  WEAKENED: {
    label: "Weakened",
    description: "Made more tentative or qualified",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: ArrowDownCircle,
  },
  CORRECTED: {
    label: "Corrected",
    description: "Fixed an error or mistake",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: RotateCcw,
  },
  MERGED: {
    label: "Merged",
    description: "Combined from multiple claims",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    icon: Merge,
  },
  SPLIT: {
    label: "Split",
    description: "Derived from a larger claim",
    color: "text-cyan-600",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    icon: Split,
  },
  IMPORTED: {
    label: "Imported",
    description: "Imported from another source",
    color: "text-rose-600",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    icon: Import,
  },
};

// ─────────────────────────────────────────────────────────
// VersionCard Component
// ─────────────────────────────────────────────────────────

export interface VersionCardProps {
  version: ClaimVersionSummary;
  isCurrentVersion?: boolean;
  showFullText?: boolean;
  onViewDetails?: (versionId: string) => void;
  onCompareWith?: (versionId: string) => void;
  onRevert?: (versionId: string) => void;
  className?: string;
}

export function VersionCard({
  version,
  isCurrentVersion = false,
  showFullText = false,
  onViewDetails,
  onCompareWith,
  onRevert,
  className,
}: VersionCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const config = CHANGE_TYPE_CONFIG[version.changeType];
  const Icon = config.icon;
  // `sourceIds` is not part of ClaimVersionSummary but may be present on
  // richer runtime payloads; read it defensively without widening the type.
  const sourceIds = (version as { sourceIds?: string[] }).sourceIds;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        isCurrentVersion && "border-primary border-2",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Version icon and info */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  config.bgColor
                )}
              >
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Version {version.versionNumber}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", config.color)}
                  >
                    {config.label}
                  </Badge>
                  {isCurrentVersion && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>

                <CardDescription className="text-xs">
                  {config.description}
                </CardDescription>
              </div>
            </div>

            {/* Expand button */}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Author and date */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {version.authorName || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(version.createdAt)}
            </span>
          </div>
        </CardHeader>

        {/* Expanded content */}
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 border-t">
            <div className="space-y-3 mt-3">
              {/* Change reason */}
              {version.changeReason && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Reason for change
                  </h4>
                  <p className="text-sm bg-muted/50 p-2 rounded-md italic">
                    &ldquo;{version.changeReason}&rdquo;
                  </p>
                </div>
              )}

              {/* Version text preview */}
              {version.text && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Claim text
                  </h4>
                  <p
                    className={cn(
                      "text-sm bg-muted/50 p-2 rounded-md font-mono",
                      !showFullText && "line-clamp-3"
                    )}
                  >
                    {version.text}
                  </p>
                </div>
              )}

              {/* Source references */}
              {sourceIds && sourceIds.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Sources ({sourceIds.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {sourceIds.slice(0, 5).map((sourceId: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        <ExternalLink className="h-2.5 w-2.5 mr-1" />
                        Source {index + 1}
                      </Badge>
                    ))}
                    {sourceIds.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{sourceIds.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                {onViewDetails && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(version.id)}
                    className="text-xs"
                  >
                    View Details
                  </Button>
                )}
                {onCompareWith && !isCurrentVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCompareWith(version.id)}
                    className="text-xs"
                  >
                    <Diff className="h-3 w-3 mr-1" />
                    Compare
                  </Button>
                )}
                {onRevert && !isCurrentVersion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevert(version.id)}
                    className="text-xs text-amber-600 hover:text-amber-700"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Revert to this
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// VersionList Component
// ─────────────────────────────────────────────────────────

export interface VersionListProps {
  versions: ClaimVersionSummary[];
  currentVersionId?: string;
  isLoading?: boolean;
  maxVersions?: number;
  onViewDetails?: (versionId: string) => void;
  onCompareWith?: (versionId: string) => void;
  onRevert?: (versionId: string) => void;
  className?: string;
}

export function VersionList({
  versions,
  currentVersionId,
  isLoading = false,
  maxVersions,
  onViewDetails,
  onCompareWith,
  onRevert,
  className,
}: VersionListProps) {
  const [showAll, setShowAll] = React.useState(false);

  if (isLoading) {
    return <VersionListSkeleton />;
  }

  if (versions.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <GitCommit className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No version history</p>
      </div>
    );
  }

  const displayVersions =
    maxVersions && !showAll ? versions.slice(0, maxVersions) : versions;
  const hasMore = maxVersions && versions.length > maxVersions;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Version count header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <GitCommit className="h-4 w-4" />
          Version History ({versions.length})
        </h3>
      </div>

      {/* Version cards */}
      <div className="space-y-2">
        {displayVersions.map((version) => (
          <VersionCard
            key={version.id}
            version={version}
            isCurrentVersion={version.id === currentVersionId}
            onViewDetails={onViewDetails}
            onCompareWith={onCompareWith}
            onRevert={onRevert}
          />
        ))}
      </div>

      {/* Show more button */}
      {hasMore && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          className="w-full text-muted-foreground"
        >
          Show {versions.length - maxVersions} more versions
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VersionBadge Component
// ─────────────────────────────────────────────────────────

export interface VersionBadgeProps {
  versionNumber: number;
  changeType: VersionChangeType;
  className?: string;
}

export function VersionBadge({
  versionNumber,
  changeType,
  className,
}: VersionBadgeProps) {
  const config = CHANGE_TYPE_CONFIG[changeType];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs gap-1",
        config.color,
        config.bgColor,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      v{versionNumber}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// VersionCompare Component
// ─────────────────────────────────────────────────────────

export interface VersionCompareProps {
  versionA: ClaimVersionSummary;
  versionB: ClaimVersionSummary;
  className?: string;
}

export function VersionCompare({
  versionA,
  versionB,
  className,
}: VersionCompareProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      {/* Version A */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <VersionBadge
            versionNumber={versionA.versionNumber}
            changeType={versionA.changeType}
          />
          <span className="text-xs text-muted-foreground">
            {formatDate(versionA.createdAt)}
          </span>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-200 dark:border-red-800">
          <p className="text-sm font-mono">{versionA.text}</p>
        </div>
      </div>

      {/* Version B */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <VersionBadge
            versionNumber={versionB.versionNumber}
            changeType={versionB.changeType}
          />
          <span className="text-xs text-muted-foreground">
            {formatDate(versionB.createdAt)}
          </span>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-md border border-green-200 dark:border-green-800">
          <p className="text-sm font-mono">{versionB.text}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VersionListSkeleton
// ─────────────────────────────────────────────────────────

export function VersionListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-4 w-40 mt-3" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? "just now" : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return d.toLocaleDateString();
}

export default VersionCard;
