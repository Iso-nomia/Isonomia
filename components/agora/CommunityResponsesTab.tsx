// components/agora/CommunityResponsesTab.tsx
"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  CheckCircle2,
  AlertCircle,
  User,
  Award,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import type { MoveType } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

type CommunityResponse = {
  id: string;
  targetType: string;
  targetId: string;
  contributorId: string;
  authorId: string;
  moveType: MoveType;
  content: {
    expression: string;
    scheme?: string;
  };
  status: "APPROVED" | "EXECUTED";
  createdAt: string;
  approvedAt: string | null;
  canonicalMoveId: string | null;
  contributor: {
    id: string;
    username: string;
    image: string | null;
  } | null;
  author: {
    id: string;
    username: string;
    image: string | null;
  } | null;
  isOwnSubmission: boolean;
  canApprove: boolean;
};



export interface CommunityResponsesTabProps {
  targetId: string;
  targetType: "argument" | "claim";
  status?: string; // Comma-separated: "APPROVED,EXECUTED"
  className?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ============================================================================
// MOVE TYPE LABELS
// ============================================================================

const MOVE_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  GROUNDS_RESPONSE: { label: "Grounds", color: "bg-green-100 text-green-800", icon: "🛡️" },
  CLARIFICATION_ANSWER: { label: "Clarification", color: "bg-blue-100 text-blue-800", icon: "💬" },
  CHALLENGE_RESPONSE: { label: "Challenge Response", color: "bg-orange-100 text-orange-800", icon: "⚔️" },
  EVIDENCE_ADDITION: { label: "Evidence", color: "bg-purple-100 text-purple-800", icon: "📊" },
  PREMISE_DEFENSE: { label: "Premise Defense", color: "bg-indigo-100 text-indigo-800", icon: "🏛️" },
  EXCEPTION_REBUTTAL: { label: "Exception Rebuttal", color: "bg-red-100 text-red-800", icon: "🔄" },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CommunityResponsesTab({
  targetId,
  targetType,
  status = "APPROVED,EXECUTED",
  className,
}: CommunityResponsesTabProps) {
  // ─── Fetch Community Responses ──────────────────────────────
  const { data, error, isLoading } = useSWR(
    `/api/non-canonical/by-target?targetId=${targetId}&targetType=${targetType}&status=${status}`,
    fetcher,
    { refreshInterval: 15000 } // Refresh every 15 seconds
  );

  const responses: CommunityResponse[] = data?.moves || [];
  const count = data?.count || 0;

  // ─── Loading State ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-700">Community Responses</h3>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────
  if (error) {
    return (
      <div className={cn("", className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm text-red-900">
            <p className="font-medium">Failed to load community responses</p>
            <p className="text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────────
  if (count === 0) {
    return (
      <div className={cn("", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-700">Community Responses</h3>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No community responses yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Be the first to help defend this {targetType}!
          </p>
        </div>
      </div>
    );
  }

  // ─── Render Community Responses ─────────────────────────────
  return (
    <div className={cn("space-y-0 max-h-[250px] px-3 py-2 overflow-y-auto", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-sky-600 " />
          <h3 className="text-md font-semibold text-slate-900">Community Responses</h3>
          <Badge variant="secondary" className="bg-sky-100 text-sky-800">
            {count}
          </Badge>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg p-2 flex gap-2 text-xs">
        <Award className="w-3 h-3 text-indigo-600 flex-shrink-0 mt-0.5" />
        <p className="text-indigo-900 ">
          These responses were contributed by the community and approved by the original author.
        </p>
      </div>

      {/* Responses List */}
      <div className="space-y-3">
        {responses.map((response) => {
          const moveTypeInfo = MOVE_TYPE_LABELS[response.moveType] || {
            label: response.moveType,
            color: "bg-gray-100 text-gray-800",
            icon: "📝",
          };

          const isExecuted = response.status === "EXECUTED";

          return (
            <div
              key={response.id}
              className={cn(
                "border rounded-lg bg-white shadow-sm px-4 py-3 transition-all",
                isExecuted && "border-green-300 bg-green-50/30",
                response.isOwnSubmission && "ring-2 ring-blue-200"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  {/* Move Type Badge */}
                  <Badge className={cn("text-xs", moveTypeInfo.color)}>
                    {moveTypeInfo.icon} {moveTypeInfo.label}
                  </Badge>

                  {/* Execution Status */}
                  {isExecuted && (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Executed
                    </Badge>
                  )}

                  {/* Own Submission Badge */}
                  {response.isOwnSubmission && (
                    <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-700">
                      Your Contribution
                    </Badge>
                  )}
                </div>
              </div>

              {/* Response Content */}
              <div className="mb-3">
                <p className="text-slate-800 text-sm leading-relaxed">
                  {response.content.expression}
                </p>
                {response.content.scheme && (
                  <p className="text-xs text-slate-600 mt-2">
                    <span className="font-medium">Scheme:</span> {response.content.scheme}
                  </p>
                )}
              </div>

              {/* Footer: Contributor & Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  {/* Contributor */}
                  <div className="flex items-center gap-1.5">
                    {response.contributor?.image ? (
                      <img
                        src={response.contributor.image}
                        alt={response.contributor.username}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                    <span className="font-medium text-slate-700">
                      {response.contributor?.username || "Unknown"}
                    </span>
                  </div>

                  {/* Approved by */}
                  {response.author && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>
                        approved by <span className="font-medium text-slate-700">{response.author.username}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {response.approvedAt
                    ? new Date(response.approvedAt).toLocaleDateString()
                    : new Date(response.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Canonical Link */}
              {isExecuted && response.canonicalMoveId && (
                <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                  ✓ Integrated as canonical move: <code className="font-mono">{response.canonicalMoveId.slice(0, 8)}...</code>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
