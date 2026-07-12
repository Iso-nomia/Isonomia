"use client";

/**
 * ProvenanceTimeline Component
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * Visual timeline of claim history:
 * - Version changes
 * - Attacks/challenges
 * - Defenses
 * - Status changes
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GitCommit,
  Swords,
  Shield,
  Clock,
  User,
  FileEdit,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Merge,
  Split,
  Import,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ClaimTimelineEvent,
  TimelineEventType,
  VersionChangeType,
} from "@/lib/provenance/types";

// ─────────────────────────────────────────────────────────
// Event Type Configuration
// ─────────────────────────────────────────────────────────

const EVENT_ICONS: Record<TimelineEventType, React.ElementType> = {
  version: GitCommit,
  attack: Swords,
  defense: Shield,
  status_change: AlertTriangle,
  imported: Import,
  forked: Split,
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  version: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  attack: "text-red-600 bg-red-100 dark:bg-red-900/30",
  defense: "text-green-600 bg-green-100 dark:bg-green-900/30",
  status_change: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  imported: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  forked: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30",
};

const VERSION_CHANGE_ICONS: Record<VersionChangeType, React.ElementType> = {
  CREATED: GitCommit,
  REFINED: FileEdit,
  STRENGTHENED: ArrowUpCircle,
  WEAKENED: ArrowDownCircle,
  CORRECTED: RotateCcw,
  MERGED: Merge,
  SPLIT: Split,
  IMPORTED: Import,
};

// ─────────────────────────────────────────────────────────
// ProvenanceTimeline Component
// ─────────────────────────────────────────────────────────

export interface ProvenanceTimelineProps {
  events: ClaimTimelineEvent[];
  isLoading?: boolean;
  showVersionDiffs?: boolean;
  onEventClick?: (event: ClaimTimelineEvent) => void;
  maxEvents?: number;
  className?: string;
}

export function ProvenanceTimeline({
  events,
  isLoading = false,
  showVersionDiffs = false,
  onEventClick,
  maxEvents,
  className,
}: ProvenanceTimelineProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (isLoading) {
    return <ProvenanceTimelineSkeleton />;
  }

  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No timeline events yet</p>
      </div>
    );
  }

  const displayEvents =
    maxEvents && !expanded ? events.slice(0, maxEvents) : events;
  const hasMore = maxEvents && events.length > maxEvents;

  return (
    <div className={cn("relative", className)}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {displayEvents.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isFirst={index === 0}
            isLast={index === displayEvents.length - 1 && !hasMore}
            showVersionDiff={showVersionDiffs && event.type === "version"}
            onClick={onEventClick ? () => onEventClick(event) : undefined}
          />
        ))}
      </div>

      {hasMore && !expanded && (
        <div className="ml-8 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="text-muted-foreground"
          >
            Show {events.length - maxEvents} more events
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TimelineEventItem Component
// ─────────────────────────────────────────────────────────

interface TimelineEventItemProps {
  event: ClaimTimelineEvent;
  isFirst?: boolean;
  isLast?: boolean;
  showVersionDiff?: boolean;
  onClick?: () => void;
}

function TimelineEventItem({
  event,
  isFirst = false,
  isLast = false,
  showVersionDiff = false,
  onClick,
}: TimelineEventItemProps) {
  const Icon = getEventIcon(event);
  const colorClass = EVENT_COLORS[event.type];

  return (
    <div
      className={cn(
        "relative pl-10 group",
        onClick && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md"
      )}
      onClick={onClick}
    >
      {/* Event icon */}
      <div
        className={cn(
          "absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center",
          "border-2 border-background z-10",
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Event content */}
      <div className="min-h-[2rem]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium">{event.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {event.actor.name}
              </span>
              <span>•</span>
              <span>{formatEventDate(event.date)}</span>
            </div>
          </div>
          <EventTypeBadge type={event.type} />
        </div>

        {/* Event details */}
        {event.details && (
          <EventDetails
            event={event}
            showVersionDiff={showVersionDiff}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// EventDetails Component
// ─────────────────────────────────────────────────────────

interface EventDetailsProps {
  event: ClaimTimelineEvent;
  showVersionDiff?: boolean;
}

function EventDetails({ event, showVersionDiff }: EventDetailsProps) {
  const details = event.details as Record<string, unknown>;

  if (event.type === "version") {
    return (
      <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
        {Boolean(details.changeReason) && (
          <p className="text-muted-foreground italic mb-1">
            &ldquo;{String(details.changeReason)}&rdquo;
          </p>
        )}
        {showVersionDiff && Boolean(details.text) && (
          <div className="mt-1 p-2 bg-background rounded border text-xs font-mono">
            {String(details.text).substring(0, 200)}
            {String(details.text).length > 200 && "..."}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">
            v{String(details.versionNumber)}
          </Badge>
          <span>{formatChangeType(String(details.changeType))}</span>
        </div>
      </div>
    );
  }

  if (event.type === "attack") {
    return (
      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 rounded text-sm border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs text-red-600 border-red-300">
            {formatAttackType(String(details.attackType))}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {String(details.status)}
          </Badge>
        </div>
        {Boolean(details.argumentText) && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {String(details.argumentText)}
          </p>
        )}
      </div>
    );
  }

  if (event.type === "defense") {
    return (
      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/10 rounded text-sm border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            {formatDefenseType(String(details.defenseType))}
          </Badge>
          {Boolean(details.outcome) && (
            <Badge variant="secondary" className="text-xs">
              {String(details.outcome)}
            </Badge>
          )}
        </div>
        {Boolean(details.argumentText) && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {String(details.argumentText)}
          </p>
        )}
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────
// EventTypeBadge Component
// ─────────────────────────────────────────────────────────

function EventTypeBadge({ type }: { type: TimelineEventType }) {
  const labels: Record<TimelineEventType, string> = {
    version: "Version",
    attack: "Challenge",
    defense: "Defense",
    status_change: "Status",
    imported: "Imported",
    forked: "Forked",
  };

  return (
    <Badge variant="outline" className="text-xs capitalize">
      {labels[type]}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// ProvenanceTimelineSkeleton
// ─────────────────────────────────────────────────────────

export function ProvenanceTimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-10">
          <Skeleton className="absolute left-0 top-0 w-8 h-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ProvenanceTimelineCompact
// ─────────────────────────────────────────────────────────

export interface ProvenanceTimelineCompactProps {
  events: ClaimTimelineEvent[];
  maxEvents?: number;
  className?: string;
}

export function ProvenanceTimelineCompact({
  events,
  maxEvents = 5,
  className,
}: ProvenanceTimelineCompactProps) {
  const displayEvents = events.slice(0, maxEvents);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {displayEvents.map((event) => {
        const Icon = getEventIcon(event);
        const colorClass = EVENT_COLORS[event.type];

        return (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  colorClass
                )}
              >
                <Icon className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <p className="font-medium">{event.description}</p>
                <p className="text-muted-foreground">
                  {event.actor.name} • {formatEventDate(event.date)}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {events.length > maxEvents && (
        <span className="text-xs text-muted-foreground ml-1">
          +{events.length - maxEvents}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function getEventIcon(event: ClaimTimelineEvent): React.ElementType {
  if (event.type === "version") {
    const changeType = (event.details as Record<string, unknown>)?.changeType as VersionChangeType;
    if (changeType && VERSION_CHANGE_ICONS[changeType]) {
      return VERSION_CHANGE_ICONS[changeType];
    }
  }
  return EVENT_ICONS[event.type];
}

function formatEventDate(date: Date | string): string {
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

function formatChangeType(type: string): string {
  return type.toLowerCase().replace("_", " ");
}

function formatAttackType(type: string): string {
  const labels: Record<string, string> = {
    REBUTS: "Rebuttal",
    UNDERCUTS: "Undercut",
    UNDERMINES: "Undermine",
  };
  return labels[type] || type;
}

function formatDefenseType(type: string): string {
  return type.toLowerCase().replace(/_/g, " ");
}

export default ProvenanceTimeline;
