//components/claims/CQActivityFeed.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import useSWR from "swr";
import {
  Send,
  CheckCircle2,
  Ban,
  Trash2,
  Award,
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronDown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CQAction =
  | "RESPONSE_SUBMITTED"
  | "RESPONSE_APPROVED"
  | "RESPONSE_REJECTED"
  | "RESPONSE_WITHDRAWN"
  | "CANONICAL_SELECTED"
  | "ENDORSEMENT_ADDED";

type CQActivityLogEntry = {
  id: string;
  cqStatusId: string;
  action: CQAction;
  actorId: string;
  metadata?: Record<string, any>;
  createdAt: string;
};

type ActivityData = {
  ok: boolean;
  activities: CQActivityLogEntry[];
  total: number;
  hasMore: boolean;
};

type CQActivityFeedProps = {
  cqStatusId: string;
  limit?: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const actionConfig: Record<
  CQAction,
  {
    label: string;
    icon: React.ElementType;
    color: string;
  }
> = {
  RESPONSE_SUBMITTED: {
    label: "submitted a response",
    icon: Send,
    color: "text-sky-700 bg-sky-50",
  },
  RESPONSE_APPROVED: {
    label: "approved a response",
    icon: CheckCircle2,
    color: "text-emerald-700 bg-emerald-50",
  },
  RESPONSE_REJECTED: {
    label: "rejected a response",
    icon: Ban,
    color: "text-rose-700 bg-rose-50",
  },
  RESPONSE_WITHDRAWN: {
    label: "withdrew a response",
    icon: Trash2,
    color: "text-slate-700 bg-slate-50",
  },
  CANONICAL_SELECTED: {
    label: "selected a canonical answer",
    icon: Sparkles,
    color: "text-sky-700 bg-sky-50",
  },
  ENDORSEMENT_ADDED: {
    label: "endorsed a response",
    icon: Award,
    color: "text-amber-700 bg-amber-50",
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function CQActivityFeed({
  cqStatusId,
  limit = 20,
}: CQActivityFeedProps) {
  const [offset, setOffset] = useState(0);

  const { data, error, isLoading } = useSWR<ActivityData>(
    `/api/cqs/activity?cqStatusId=${cqStatusId}&limit=${limit}&offset=${offset}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleLoadMore = () => {
    if (data?.hasMore) {
      setOffset(offset + limit);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Failed to Load Activity
            </p>
            <p className="text-xs text-rose-700 mt-1">
              {error?.message || "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && offset === 0) {
    return (
      <div className="flex items-center justify-center gap-3 p-8">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">Loading activity...</p>
      </div>
    );
  }

  if (!data || !data.activities || data.activities.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 mb-3">
          <Clock className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No Activity Yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Activity will appear here as responses are submitted and reviewed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Activity Timeline</h4>
        <span className="text-xs text-slate-500">{data.total} total events</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-3">
          {data.activities.map((activity, idx) => {
            const config = actionConfig[activity.action];
            const Icon = config.icon;

            return (
              <div key={activity.id} className="relative flex gap-3">
                {/* Icon */}
                <div
                  className={`
                    relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md
                    ${config.color}
                  `}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-3">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">
                        {activity.metadata?.actorName || activity.actorId}
                      </span>{" "}
                      {config.label}
                    </p>

                    {/* Metadata */}
                    {activity.metadata && (
                      <div className="mt-2 space-y-1">
                        {activity.action === "RESPONSE_REJECTED" &&
                          activity.metadata.reason && (
                            <p className="text-xs text-slate-600 italic">
                              Reason: {activity.metadata.reason}
                            </p>
                          )}
                        {activity.action === "CANONICAL_SELECTED" &&
                          activity.metadata.previousCanonicalId && (
                            <p className="text-xs text-slate-600">
                              Superseded previous canonical response
                            </p>
                          )}
                        {activity.action === "RESPONSE_SUBMITTED" &&
                          (activity.metadata.evidenceCount > 0 ||
                            activity.metadata.sourceCount > 0) && (
                            <p className="text-xs text-slate-600">
                              {activity.metadata.evidenceCount > 0 &&
                                `${activity.metadata.evidenceCount} evidence claim${
                                  activity.metadata.evidenceCount !== 1 ? "s" : ""
                                }`}
                              {activity.metadata.evidenceCount > 0 &&
                                activity.metadata.sourceCount > 0 &&
                                ", "}
                              {activity.metadata.sourceCount > 0 &&
                                `${activity.metadata.sourceCount} source${
                                  activity.metadata.sourceCount !== 1 ? "s" : ""
                                }`}
                            </p>
                          )}
                        {activity.action === "ENDORSEMENT_ADDED" &&
                          activity.metadata.weight && (
                            <p className="text-xs text-slate-600">
                              Weight: {activity.metadata.weight}
                            </p>
                          )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-slate-500 mt-2">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load More */}
      {data.hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={handleLoadMore}
            disabled={isLoading}
            variant="outline"
            className="bg-slate-900/5 backdrop-blur-md border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Load More
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
