"use client";

import React from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import Spinner from "@/components/ui/spinner";

type RoomMetrics = {
  ok: boolean;
  roomId: string;
  metrics: {
    schemes: Array<{ key: string; name: string; count: number }>;
    cqStatus: {
      total: number;
      answered: number;
      open: number;
      keys: string[];
    };
    conflictDensity: number;
    dialogueActivity: Record<string, number>;
    argumentCount: number;
    conflictCount: number;
  };
};

/**
 * PlexusRoomMetrics Component
 * 
 * Displays room-level metrics in a hover card for Plexus visualization.
 * Shows:
 * - Top 5 argument schemes used
 * - Critical question status (open/answered)
 * - Conflict density (CA-nodes per argument)
 * - Dialogue activity by move type
 */
export default function PlexusRoomMetrics({ roomId }: { roomId: string }) {
  const { data, error, isLoading } = useSWR<RoomMetrics>(
    `/api/agora/room-metrics?roomId=${roomId}`,
    (url) => fetch(url).then((r) => r.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30s
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="p-4 text-sm text-red-500">
        Failed to load room metrics
      </div>
    );
  }

  const { metrics } = data;

  return (
    <div className="space-y-3 p-4 max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="text-sm font-semibold text-slate-900">Room Metrics</h3>
        <span className="text-xs text-slate-500">{metrics.argumentCount} arguments</span>
      </div>

      {/* Schemes Section */}
      {metrics.schemes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-700">Top Schemes</h4>
          <div className="flex flex-wrap gap-1.5">
            {metrics.schemes.map((scheme) => (
              <Badge
                key={scheme.key}
                variant="outline"
                className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
              >
                {scheme.name} ({scheme.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* CQ Status Section */}
      {metrics.cqStatus.total > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-700">Critical Questions</h4>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-slate-600">
                {metrics.cqStatus.answered} answered
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-600">
                {metrics.cqStatus.open} open
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${
                  metrics.cqStatus.total > 0
                    ? (metrics.cqStatus.answered / metrics.cqStatus.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Conflict Density Section */}
      {metrics.conflictCount > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-700">Conflict Density</h4>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">
              {metrics.conflictCount} conflicts
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${
                metrics.conflictDensity > 1
                  ? "bg-red-50 text-red-700 border-red-200"
                  : metrics.conflictDensity > 0.5
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-green-50 text-green-700 border-green-200"
              }`}
            >
              {metrics.conflictDensity.toFixed(2)} per arg
            </Badge>
          </div>
        </div>
      )}

      {/* Dialogue Activity Section */}
      {Object.keys(metrics.dialogueActivity).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-700">Dialogue Activity</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics.dialogueActivity)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between bg-slate-50 rounded px-2 py-1"
                >
                  <span className="text-xs text-slate-600 capitalize">
                    {type.replace("_", " ")}
                  </span>
                  <span className="text-xs font-medium text-slate-900">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
