// components/sources/ProvenanceChain.tsx
// Phase 3.3: Evidence Provenance Chain Visualization
// Shows how a source has flowed through the platform

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Download,
  Upload,
  MessageSquare,
  GitFork,
  Share2,
  FileOutput,
  Layers,
  ArrowRight,
  Circle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProvenanceEvent {
  id: string;
  eventType: string;
  actorId: string;
  actorName: string | null;
  fromType: string | null;
  fromId: string | null;
  fromName: string | null;
  toType: string | null;
  toId: string | null;
  toName: string | null;
  metadata: unknown;
  createdAt: string;
}

interface TimelineNode {
  id: string;
  type: "event" | "context";
  eventType?: string;
  label: string;
  timestamp: string;
  actorName?: string | null;
  contextType?: string;
  contextId?: string;
  contextName?: string | null;
}

interface ProvenanceSummary {
  totalEvents: number;
  firstImport: string | null;
  latestActivity: string | null;
  uniqueActors: number;
  eventTypeCounts: Record<string, number>;
  eventTypeLabels: Record<string, string>;
}

interface ProvenanceData {
  source: {
    id: string;
    title: string | null;
    kind: string;
    authors: unknown;
    year: number | null;
    doi: string | null;
    url: string | null;
    createdAt: string;
  };
  events: ProvenanceEvent[];
  summary: ProvenanceSummary;
  timeline: TimelineNode[];
}

interface ProvenanceChainProps {
  sourceId: string;
  variant?: "timeline" | "compact" | "graph";
  maxEvents?: number;
  className?: string;
}

const eventIcons: Record<string, React.ElementType> = {
  imported: Download,
  cited: MessageSquare,
  lifted_to_stack: Upload,
  imported_from_stack: Layers,
  forked: GitFork,
  shared: Share2,
  exported: FileOutput,
};

const eventColors: Record<string, string> = {
  imported: "bg-blue-100 text-blue-700 border-blue-300",
  cited: "bg-green-100 text-green-700 border-green-300",
  lifted_to_stack: "bg-purple-100 text-purple-700 border-purple-300",
  imported_from_stack: "bg-indigo-100 text-indigo-700 border-indigo-300",
  forked: "bg-orange-100 text-orange-700 border-orange-300",
  shared: "bg-pink-100 text-pink-700 border-pink-300",
  exported: "bg-gray-100 text-gray-700 border-gray-300",
};

function EventIcon({ eventType }: { eventType: string }) {
  const Icon = eventIcons[eventType] || Circle;
  return <Icon className="h-4 w-4" />;
}

function getContextLink(contextType: string, contextId: string): string | null {
  switch (contextType) {
    case "stack":
      return `/stacks/${contextId}`;
    case "deliberation":
      return `/deliberations/${contextId}`;
    case "argument":
      return `/arguments/${contextId}`;
    default:
      return null;
  }
}

function TimelineEvent({ event }: { event: ProvenanceEvent }) {
  const Icon = eventIcons[event.eventType] || Circle;
  const colorClass = eventColors[event.eventType] || "bg-gray-100 text-gray-700 border-gray-300";
  const toLink = event.toType && event.toId ? getContextLink(event.toType, event.toId) : null;

  return (
    <div className="flex gap-3">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={cn("p-2 rounded-full border", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px h-full bg-gray-200 mt-2" />
      </div>

      {/* Event content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", colorClass)}>
            {event.eventType.replace(/_/g, " ")}
          </Badge>
          {event.actorName && (
            <span className="text-sm text-gray-600">by {event.actorName}</span>
          )}
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* From/To context */}
        <div className="mt-2 flex items-center gap-2 text-sm">
          {event.fromName && (
            <>
              <span className="text-gray-500">{event.fromType}:</span>
              <span className="font-medium">{event.fromName}</span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
            </>
          )}
          {event.toName && toLink ? (
            <Link
              href={toLink}
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              <span className="font-medium">{event.toName}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : event.toName ? (
            <span className="font-medium">{event.toName}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactView({ events, summary }: { events: ProvenanceEvent[]; summary: ProvenanceSummary }) {
  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Events:</span>
          <span className="font-semibold">{summary.totalEvents}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Contributors:</span>
          <span className="font-semibold">{summary.uniqueActors}</span>
        </div>
        {summary.firstImport && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">First imported:</span>
            <span className="text-sm">
              {formatDistanceToNow(new Date(summary.firstImport), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Event type breakdown */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(summary.eventTypeCounts).map(([type, count]) => (
          <TooltipProvider key={type}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn("flex items-center gap-1", eventColors[type] || "bg-gray-100")}
                >
                  <EventIcon eventType={type} />
                  <span>{count}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {summary.eventTypeLabels[type] || type}: {count}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* Recent events preview */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Recent Activity</h4>
        {events.slice(0, 3).map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
          >
            <EventIcon eventType={event.eventType} />
            <span className="flex-1">
              {event.actorName ? `${event.actorName} ` : ""}
              {event.eventType.replace(/_/g, " ")}
              {event.toName && ` → ${event.toName}`}
            </span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProvenanceChain({
  sourceId,
  variant = "timeline",
  maxEvents = 20,
  className,
}: ProvenanceChainProps) {
  const { data, isLoading, error } = useQuery<ProvenanceData>({
    queryKey: ["source-provenance", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/sources/${sourceId}/provenance`);
      if (!res.ok) throw new Error("Failed to fetch provenance");
      return res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitFork className="h-4 w-4" />
            Evidence Provenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No provenance history recorded for this source yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayEvents = data.events.slice(0, maxEvents);

  if (variant === "compact") {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitFork className="h-4 w-4" />
            Evidence Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CompactView events={displayEvents} summary={data.summary} />
        </CardContent>
      </Card>
    );
  }

  // Timeline variant (default)
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitFork className="h-4 w-4" />
            Evidence Provenance Chain
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{data.summary.totalEvents} events</span>
            <span>•</span>
            <span>{data.summary.uniqueActors} contributors</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Event type legend */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {Object.entries(data.summary.eventTypeCounts).map(([type, count]) => (
            <Badge
              key={type}
              variant="outline"
              className={cn("text-xs flex items-center gap-1", eventColors[type] || "bg-gray-100")}
            >
              <EventIcon eventType={type} />
              <span>{data.summary.eventTypeLabels[type] || type}</span>
              <span className="opacity-60">({count})</span>
            </Badge>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {displayEvents.map((event) => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>

        {data.events.length > maxEvents && (
          <div className="text-center pt-4 border-t mt-4">
            <Button variant="outline" size="sm">
              View all {data.events.length} events
            </Button>
          </div>
        )}

        {/* Origin info */}
        {data.summary.firstImport && (
          <div className="mt-6 pt-4 border-t text-sm text-gray-500">
            <p>
              First imported to platform{" "}
              {format(new Date(data.summary.firstImport), "MMMM d, yyyy")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProvenanceChain;
