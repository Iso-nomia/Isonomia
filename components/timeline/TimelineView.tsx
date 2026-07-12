/**
 * Phase 3.4.3: Timeline View Component
 * 
 * Displays a temporal visualization of events (publications, citations, etc.)
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { Calendar, Filter, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, EVENT_LABELS, TimelineEventType } from "@/lib/timeline/types";

interface TimelineViewProps {
  type: "source" | "deliberation" | "stack";
  id: string;
  sourceIds?: string[];
  className?: string;
}

interface TimelineEventData {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description?: string;
  entityType: string;
  entityId: string;
  color?: string;
  icon?: string;
  importance?: number;
}

export function TimelineView({ type, id, sourceIds, className }: TimelineViewProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", type, id, sourceIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", type);
      params.set("id", id);
      if (sourceIds?.length) {
        params.set("sourceIds", sourceIds.join(","));
      }
      const res = await fetch(`/api/timeline?${params}`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    if (selectedTypes.length === 0) return data.events;
    return data.events.filter((e: TimelineEventData) => selectedTypes.includes(e.type));
  }, [data?.events, selectedTypes]);

  // Group events by year
  const eventsByYear = useMemo(() => {
    const groups: Record<number, TimelineEventData[]> = {};
    for (const event of filteredEvents) {
      const year = new Date(event.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(event);
    }
    return groups;
  }, [filteredEvents]);

  const toggleEventType = (eventType: string) => {
    setSelectedTypes((prev) =>
      prev.includes(eventType)
        ? prev.filter((t) => t !== eventType)
        : [...prev, eventType]
    );
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-96 bg-gray-50 rounded-lg", className)}>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Building timeline...
        </div>
      </div>
    );
  }

  if (error || !data?.events) {
    return (
      <div className={cn("flex items-center justify-center h-96 bg-gray-50 rounded-lg", className)}>
        <div className="text-gray-500">Failed to load timeline</div>
      </div>
    );
  }

  if (data.events.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-96 bg-gray-50 rounded-lg", className)}>
        <div className="text-center text-gray-500">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <div>No timeline events found</div>
        </div>
      </div>
    );
  }

  const years = Object.keys(eventsByYear)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={cn("flex gap-6", className)}>
      {/* Filters sidebar */}
      <div className="w-48 shrink-0 border-r pr-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h4>

        <div className="space-y-2 mb-4">
          {Object.entries(data.summary?.byType || {}).map(([eventType, count]) => (
            <label
              key={eventType}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={selectedTypes.length === 0 || selectedTypes.includes(eventType)}
                onCheckedChange={() => toggleEventType(eventType)}
              />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: EVENT_COLORS[eventType as TimelineEventType] || "#6b7280" }}
              />
              <span className="flex-1 truncate">
                {EVENT_LABELS[eventType as TimelineEventType] || eventType}
              </span>
              <span className="text-gray-400 text-xs">{count as number}</span>
            </label>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="text-xs text-gray-500 mb-2">Zoom</div>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setZoomLevel((z) => Math.min(2, z + 0.25))}
              disabled={zoomLevel >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-400 mt-1">{Math.round(zoomLevel * 100)}%</div>
        </div>

        {/* Summary stats */}
        <div className="border-t pt-4 mt-4">
          <div className="text-xs text-gray-500 mb-2">Summary</div>
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Events:</span>
              <span className="font-medium">{data.summary.totalEvents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Years:</span>
              <span className="font-medium">{years.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div
          className="relative min-h-[400px]"
          style={{ transform: `scaleX(${zoomLevel})`, transformOrigin: "left" }}
        >
          {/* Year headers */}
          <div className="flex border-b mb-4 sticky top-0 bg-white z-10">
            {years.map((year) => (
              <div
                key={year}
                className="flex-1 text-center text-sm font-medium py-2 border-r last:border-r-0"
                style={{ minWidth: 180 }}
              >
                {year}
              </div>
            ))}
          </div>

          {/* Timeline track */}
          <div className="relative pt-4">
            {/* Horizontal line */}
            <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200" />

            {/* Events by year */}
            <div className="flex">
              {years.map((year) => (
                <div key={year} className="flex-1 relative" style={{ minWidth: 180 }}>
                  {eventsByYear[year].map((event, index) => (
                    <TimelineEventNode
                      key={event.id}
                      event={event}
                      index={index}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEventNode({
  event,
  index,
}: {
  event: TimelineEventData;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  // Stagger events vertically to avoid overlap
  const topOffset = 40 + (index % 4) * 80;

  const eventColor = event.color || EVENT_COLORS[event.type] || "#6b7280";

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: topOffset }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Connector line to timeline track */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300"
        style={{ top: -topOffset + 32, height: topOffset - 32 }}
      />

      {/* Event dot */}
      <div
        className="w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer transition-transform hover:scale-125"
        style={{ backgroundColor: eventColor }}
      />

      {/* Hover card */}
      {isHovered && (
        <div className="absolute left-1/2 -translate-x-1/2 top-6 z-20 w-64 bg-white rounded-lg shadow-lg p-3 border">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <span>{event.icon}</span>
            {format(new Date(event.date), "MMM d, yyyy")}
          </div>
          <div className="text-sm font-medium line-clamp-2">{event.title}</div>
          {event.description && (
            <div className="text-xs text-gray-600 mt-1 line-clamp-2">
              {event.description}
            </div>
          )}
          <Link
            href={getEventLink(event)}
            className="text-xs text-blue-600 mt-2 block hover:underline"
          >
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}

function getEventLink(event: TimelineEventData): string {
  switch (event.entityType) {
    case "source":
      return `/sources/${event.entityId}`;
    case "deliberation":
      return `/deliberations/${event.entityId}`;
    case "argument":
      return `/arguments/${event.entityId}`;
    case "claim":
      return `/claims/${event.entityId}`;
    case "citation":
      return "#"; // Citations don't have dedicated pages
    default:
      return "#";
  }
}

export default TimelineView;
