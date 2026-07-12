//components/claims/CQAuthorDashboard.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import useSWR from "swr";
import CQResponseCard from "./CQResponseCard";
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ResponseStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANONICAL" | "SUPERSEDED" | "WITHDRAWN";

type CQResponse = {
  id: string;
  cqStatusId: string;
  contributorId: string;
  groundsText: string;
  evidenceClaimIds: string[];
  sourceUrls: string[];
  responseStatus: ResponseStatus;
  upvotes: number;
  downvotes: number;
  endorsements: Array<{
    id: string;
    userId: string;
    weight: number;
    comment?: string;
  }>;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
};

type ResponsesData = {
  ok: boolean;
  responses: CQResponse[];
  count: number;
};

type CQAuthorDashboardProps = {
  cqStatusId: string;
  currentUserId?: string;
  canModerate?: boolean;
  onApprove?: (responseId: string, setAsCanonical: boolean) => void;
  onReject?: (responseId: string, reason: string) => void;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CQAuthorDashboard({
  cqStatusId,
  currentUserId,
  canModerate = false,
  onApprove,
  onReject,
}: CQAuthorDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch pending responses
  const { data, error, isLoading } = useSWR<ResponsesData>(
    canModerate
      ? `/api/cqs/responses?cqStatusId=${cqStatusId}&status=pending`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000, // Refresh every 30s
    }
  );

  if (!canModerate) {
    return null;
  }

  const pendingCount = data?.count ?? 0;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-400/15 to-yellow-400/15 backdrop-blur-md border border-amber-500/30 shadow-lg">
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent" />

      <div className="relative">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-900/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 shadow-lg">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-amber-900">
                Pending Response Review
              </h3>
              <p className="text-xs text-amber-700">
                {isLoading
                  ? "Loading..."
                  : `${pendingCount} response${pendingCount !== 1 ? "s" : ""} awaiting review`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <div className="px-2 py-1 rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                {pendingCount}
              </div>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-amber-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-amber-700" />
            )}
          </div>
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
            {/* Error State */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-900">
                      Failed to Load Pending Responses
                    </p>
                    <p className="text-xs text-rose-700 mt-1">
                      {error?.message || "Unknown error"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 p-6">
                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                <p className="text-sm text-amber-800">Loading pending responses...</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && pendingCount === 0 && (
              <div className="p-6 bg-white/50 border border-amber-200 rounded-lg text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-3">
                  <Inbox className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm font-semibold text-amber-900">
                  No Pending Responses
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  All responses have been reviewed
                </p>
              </div>
            )}

            {/* Pending Responses */}
            {!isLoading && !error && data && data.responses && data.responses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 uppercase tracking-wide">
                  <Clock className="w-4 h-4" />
                  Awaiting Your Review
                </div>

                {data.responses.map((response) => (
                  <CQResponseCard
                    key={response.id}
                    response={response}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    onApprove={onApprove}
                    onReject={onReject}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
