"use client";

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { ReleaseListItem, ReleaseListItemData, ReleaseListItemSkeleton } from "./ReleaseListItem";
import { Button } from "@/components/ui/button";
import { Plus, History, RefreshCw } from "lucide-react";

/**
 * ReleaseListPanel - Panel displaying all releases for a deliberation
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

interface ReleasesResponse {
  releases: ReleaseListItemData[];
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ReleaseListPanelProps {
  deliberationId: string;
  onSelectRelease?: (release: ReleaseListItemData) => void;
  onCreateRelease?: () => void;
  selectedReleaseId?: string;
  className?: string;
}

export function ReleaseListPanel({
  deliberationId,
  onSelectRelease,
  onCreateRelease,
  selectedReleaseId,
  className,
}: ReleaseListPanelProps) {
  const { data, error, isLoading, mutate } = useSWR<ReleasesResponse>(
    `/api/deliberations/${deliberationId}/releases`,
    fetcher
  );

  const releases = data?.releases ?? [];
  const latestVersion = releases[0]?.version;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Releases
          </h3>
          {data && (
            <span className="text-xs text-slate-400">({data.total})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {onCreateRelease && (
            <Button
              variant="default"
              size="sm"
              onClick={onCreateRelease}
              className="h-7 px-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <>
            <ReleaseListItemSkeleton />
            <ReleaseListItemSkeleton />
            <ReleaseListItemSkeleton />
          </>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-500 mb-2">Failed to load releases</p>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && releases.length === 0 && (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">No releases yet</p>
            {onCreateRelease && (
              <Button variant="outline" size="sm" onClick={onCreateRelease}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Release
              </Button>
            )}
          </div>
        )}

        {!isLoading && !error && releases.map((release, index) => (
          <ReleaseListItem
            key={release.id}
            release={release}
            isLatest={index === 0}
            isSelected={release.id === selectedReleaseId}
            onClick={onSelectRelease}
          />
        ))}
      </div>
    </div>
  );
}
