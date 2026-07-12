// components/discourse/panels/ActivityFeedPanel.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { TrendingUp, RefreshCw } from "lucide-react";
import { ActivityCard, EmptyState, SearchFilter, useSearchFilter } from "../shared";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Polling interval for real-time updates (30 seconds)
const POLLING_INTERVAL = 30000;

interface ActivityFeedPanelProps {
  deliberationId: string;
  userId: string;
}

export function ActivityFeedPanel({ deliberationId, userId }: ActivityFeedPanelProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "week" | "month">("all");

  const { data: activities, isLoading, mutate } = useSWR(
    `/api/deliberations/${deliberationId}/activity-feed?userId=${userId}`,
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  // Update last refresh time when data changes
  React.useEffect(() => {
    if (activities) {
      setLastRefresh(new Date());
    }
  }, [activities]);

  const handleManualRefresh = () => {
    mutate();
  };

  const activitiesArray = activities || [];

  // Apply search and date filters
  const filteredActivities = useSearchFilter(
    activitiesArray,
    searchTerm,
    dateFilter,
    (activity: any) => `${activity.description || ""} ${activity.targetText || ""} ${activity.actorName || ""} ${activity.type || ""}`
  );

  return (
    <section 
      className="space-y-4"
      aria-labelledby="activity-heading"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 id="activity-heading" className="text-sm font-semibold text-slate-700">
            Recent Activity
          </h3>
          <span className="text-xs text-slate-400" aria-hidden="true">
            Auto-refreshes every 30s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="text-xs text-slate-400"
            role="status"
            aria-live="polite"
          >
            Last updated: <time dateTime={lastRefresh.toISOString()}>{lastRefresh.toLocaleTimeString()}</time>
          </span>
          <button 
            onClick={handleManualRefresh}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Refresh activity feed"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* Search and Filter */}
      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        placeholder="Search activity..."
      />

      <div 
        className="space-y-2"
        role="feed"
        aria-label="Activity feed"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div 
            className="text-center py-8 text-slate-500"
            role="status"
            aria-label="Loading activity"
          >
            Loading activity...
          </div>
        ) : filteredActivities.length > 0 ? (
          filteredActivities.map((activity: any, index: number) => (
            <article
              key={activity.id}
              aria-setsize={filteredActivities.length}
              aria-posinset={index + 1}
            >
              <ActivityCard activity={activity} />
            </article>
          ))
        ) : searchTerm || dateFilter !== "all" ? (
          <EmptyState
            icon={TrendingUp}
            title="No matching activity"
            description="Try adjusting your search or filter criteria."
          />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No recent activity"
            description="Activity will appear here as you and others engage in the deliberation."
          />
        )}
      </div>
    </section>
  );
}

