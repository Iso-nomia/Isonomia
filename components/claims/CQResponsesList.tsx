//components/claims/CQResponsesList.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import CQResponseCard from "./CQResponseCard";
import {
  Sparkles,
  ListCheck,
  CheckCircle2,
  Clock,
  List,
  AlertCircle,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

type CQResponsesListProps = {
  cqStatusId: string;
  currentUserId?: string;
  canModerate?: boolean;
  onEndorse?: (responseId: string) => void;
};

type TabKey = "canonical" | "approved" | "pending" | "all";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  {
    key: "canonical",
    label: "Canonical",
    icon: ListCheck,
    color: "text-sky-700 border-sky-400 bg-sky-50",
  },
  {
    key: "approved",
    label: "Approved",
    icon: CheckCircle2,
    color: "text-emerald-700 border-emerald-400 bg-emerald-50",
  },
  {
    key: "pending",
    label: "Pending Review",
    icon: Clock,
    color: "text-amber-700 border-amber-400 bg-amber-50",
  },
  {
    key: "all",
    label: "All Responses",
    icon: List,
    color: "text-slate-700 border-slate-400 bg-slate-50",
  },
];

export default function CQResponsesList({
  cqStatusId,
  currentUserId,
  canModerate = false,
  onEndorse,
}: CQResponsesListProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("canonical");

  // Fetch responses based on active tab
  const { data, error, isLoading, mutate } = useSWR<ResponsesData>(
    `/api/cqs/responses?cqStatusId=${cqStatusId}&status=${activeTab}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleApprove = async (responseId: string, setAsCanonical: boolean) => {
    try {
      const res = await fetch(`/api/cqs/responses/${responseId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setAsCanonical }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      // Revalidate all tabs
      await mutate();
      await globalMutate((key) =>
        typeof key === "string" && key.includes("/api/cqs/responses")
      );
      window.dispatchEvent(new CustomEvent("cqs:changed"));
    } catch (err: any) {
      console.error("[CQResponsesList] Approve error:", err);
      alert(err.message || "Failed to approve response");
    }
  };

  const handleReject = async (responseId: string, reason: string) => {
    if (!reason.trim()) {
      alert("Rejection reason is required");
      return;
    }

    try {
      const res = await fetch(`/api/cqs/responses/${responseId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      // Revalidate all tabs
      await mutate();
      await globalMutate((key) =>
        typeof key === "string" && key.includes("/api/cqs/responses")
      );
      window.dispatchEvent(new CustomEvent("cqs:changed"));
    } catch (err: any) {
      console.error("[CQResponsesList] Reject error:", err);
      alert(err.message || "Failed to reject response");
    }
  };

  const handleWithdraw = async (responseId: string) => {
    if (!confirm("Are you sure you want to withdraw this response?")) {
      return;
    }

    try {
      const res = await fetch(`/api/cqs/responses/${responseId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      // Revalidate all tabs
      await mutate();
      await globalMutate((key) =>
        typeof key === "string" && key.includes("/api/cqs/responses")
      );
      window.dispatchEvent(new CustomEvent("cqs:changed"));
    } catch (err: any) {
      console.error("[CQResponsesList] Withdraw error:", err);
      alert(err.message || "Failed to withdraw response");
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Failed to Load Responses
            </p>
            <p className="text-xs text-rose-700 mt-1">
              {error?.message || "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-2 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all whitespace-nowrap
                ${
                  isActive
                    ? `${tab.color} scale-105 shadow-lg`
                    : "border-slate-900/10 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-900/20"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 p-8">
          <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
          <p className="text-sm text-slate-600">Loading responses...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && data && data.responses.length === 0 && (
        <div className="p-8 bg-slate-50 border-2 border-slate-200 rounded-xl text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 mb-3">
            <Filter className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            No {activeTab === "all" ? "" : activeTab} responses yet
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === "pending"
              ? "Pending responses will appear here for review"
              : activeTab === "canonical"
              ? "No canonical response has been selected yet"
              : "Be the first to submit a response to this critical question"}
          </p>
        </div>
      )}

      {/* Responses List */}
      {!isLoading && data && data.responses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {data.count} response{data.count !== 1 ? "s" : ""} found
            </p>
          </div>

          <div className="space-y-3">
            {data.responses.map((response) => (
              <CQResponseCard
                key={response.id}
                response={response}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onApprove={handleApprove}
                onReject={handleReject}
                onWithdraw={handleWithdraw}
                onEndorse={onEndorse}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
