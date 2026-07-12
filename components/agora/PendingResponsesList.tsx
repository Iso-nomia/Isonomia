// components/agora/PendingResponsesList.tsx
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

// ============================================================================
// TYPES
// ============================================================================

type PendingMove = {
  id: string;
  targetType: string;
  targetId: string;
  targetMoveId: string | null;
  contributorId: string;
  moveType: string;
  content: {
    expression: string;
    scheme?: string;
  };
  createdAt: string;
  contributor: {
    id: string;
    username: string;
    image: string | null;
  } | null;
};

export interface PendingResponsesListProps {
  deliberationId: string;
  onResponseHandled?: () => void; // Callback when response is approved/rejected
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

const MOVE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  GROUNDS_RESPONSE: { label: "Grounds", color: "bg-green-100 text-green-800" },
  CLARIFICATION_ANSWER: { label: "Clarification", color: "bg-blue-100 text-blue-800" },
  CHALLENGE_RESPONSE: { label: "Challenge Response", color: "bg-orange-100 text-orange-800" },
  EVIDENCE_ADDITION: { label: "Evidence", color: "bg-purple-100 text-purple-800" },
  PREMISE_DEFENSE: { label: "Premise Defense", color: "bg-indigo-100 text-indigo-800" },
  EXCEPTION_REBUTTAL: { label: "Exception Rebuttal", color: "bg-red-100 text-red-800" },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PendingResponsesList({
  deliberationId,
  onResponseHandled,
  className,
}: PendingResponsesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ─── Fetch Pending Moves ────────────────────────────────────
  const { data, error, isLoading, mutate } = useSWR(
    `/api/non-canonical/pending?deliberationId=${deliberationId}`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  const pendingMoves: PendingMove[] = data?.moves || [];
  const pendingCount = data?.pendingCount || 0;

  // ─── Handle Approve ─────────────────────────────────────────
  const handleApprove = async (ncmId: string, executeImmediately: boolean) => {
    setProcessingId(ncmId);

    try {
      const response = await fetch("/api/non-canonical/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncmId, executeImmediately }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to approve response");
      }

      // Refresh the list
      await mutate();
      onResponseHandled?.();
    } catch (error: any) {
      console.error("[PendingResponsesList] Approve error:", error);
      alert(error.message || "Failed to approve response");
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Handle Reject ──────────────────────────────────────────
  const handleReject = async (ncmId: string) => {
    const reason = prompt("Optional: Provide a reason for rejection");
    
    setProcessingId(ncmId);

    try {
      const response = await fetch("/api/non-canonical/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncmId, reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reject response");
      }

      // Refresh the list
      await mutate();
      onResponseHandled?.();
    } catch (error: any) {
      console.error("[PendingResponsesList] Reject error:", error);
      alert(error.message || "Failed to reject response");
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-700">Pending Community Responses</h3>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-32" />
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
            <p className="font-medium">Failed to load pending responses</p>
            <p className="text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────────
  if (pendingCount === 0) {
    return (
      <div className={cn("", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-700">Pending Community Responses</h3>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No pending responses</p>
          <p className="text-sm text-slate-500 mt-1">
            Community contributions will appear here for your review
          </p>
        </div>
      </div>
    );
  }

  // ─── Render Pending Moves ───────────────────────────────────
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-slate-700">Pending Community Responses</h3>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {pendingCount}
          </Badge>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {pendingMoves.map((move) => {
          const isExpanded = expandedId === move.id;
          const isProcessing = processingId === move.id;
          const moveTypeInfo = MOVE_TYPE_LABELS[move.moveType] || {
            label: move.moveType,
            color: "bg-gray-100 text-gray-800",
          };

          return (
            <div
              key={move.id}
              className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Move Type Badge */}
                    <Badge className={cn("mb-2", moveTypeInfo.color)}>
                      {moveTypeInfo.label}
                    </Badge>

                    {/* Contributor Info */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      {move.contributor?.image ? (
                        <img
                          src={move.contributor.image}
                          alt={move.contributor.username}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                      <span className="font-medium">{move.contributor?.username || "Unknown"}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">
                        {new Date(move.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Expression Preview */}
                    <div className="mt-2">
                      <p className={cn(
                        "text-slate-700",
                        !isExpanded && "line-clamp-2"
                      )}>
                        {move.content.expression}
                      </p>
                      {move.content.scheme && (
                        <p className="text-xs text-slate-500 mt-1">
                          Scheme: <span className="font-medium">{move.content.scheme}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : move.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Action Buttons */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(move.id, true)}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Approve & Execute
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(move.id, false)}
                      disabled={isProcessing}
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      Approve Only
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(move.id)}
                      disabled={isProcessing}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
