// components/issues/IssuesList.tsx
"use client";
import * as React from "react";
import useSWR, { mutate as globalMutate } from "swr";
import IssueDetail from "./IssueDetail";
import { MyIssuesDashboard } from "./MyIssuesDashboard";
import { useBusEffect } from "@/lib/client/useBusEffect";
import { HelpCircle, Shield, AlertCircle, User } from "lucide-react";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

type FilterTab = "all" | "clarifications" | "reviews" | "mine";

export default function IssuesList({
  deliberationId,
  currentUserId,
}: {
  deliberationId: string;
  currentUserId?: string;
}) {
  const [focus, setFocus] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<FilterTab>("all");

  const key = `/api/deliberations/${encodeURIComponent(deliberationId)}/issues?state=all`;
  const { data, isLoading } = useSWR<{ ok: true; issues: any[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });

  useBusEffect(["issues:changed"], (p) => {
    if (p?.deliberationId !== deliberationId) return;
    globalMutate(key);
  });

  // Filter issues based on active tab
  const filteredIssues = React.useMemo(() => {
    const issues = data?.issues ?? [];
    if (activeFilter === "clarifications") {
      return issues.filter((it) => it.kind === "clarification");
    }
    if (activeFilter === "reviews") {
      return issues.filter((it) => it.kind === "community_defense");
    }
    return issues;
  }, [data?.issues, activeFilter]);

  // Count by kind
  const counts = React.useMemo(() => {
    const issues = data?.issues ?? [];
    return {
      all: issues.length,
      clarifications: issues.filter((it) => it.kind === "clarification").length,
      reviews: issues.filter((it) => it.kind === "community_defense").length,
    };
  }, [data?.issues]);

  return (
    <div className="flex flex-2 w-screen h-fit flex-col mt-3">
      {/* Show My Issues dashboard if user clicks that tab */}
      {activeFilter === "mine" && currentUserId ? (
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-200 pb-2">
            <button
              onClick={() => setActiveFilter("all")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-neutral-600 hover:bg-neutral-100"
            >
              <AlertCircle className="h-4 w-4" />
              All Issues
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-100 text-indigo-700 border border-indigo-200"
            >
              <User className="h-4 w-4" />
              My Issues
            </button>
          </div>
          <MyIssuesDashboard deliberationId={deliberationId} currentUserId={currentUserId} />
        </div>
      ) : (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveFilter("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === "all"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              All
              <span className="ml-1 px-2 py-0.5 rounded-full bg-neutral-200 text-xs font-semibold">
                {counts.all}
              </span>
            </button>

        <button
          onClick={() => setActiveFilter("clarifications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFilter === "clarifications"
              ? "bg-sky-100 text-sky-700 border border-sky-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Clarifications
          <span className="ml-1 px-2 py-0.5 rounded-full bg-sky-200 text-xs font-semibold">
            {counts.clarifications}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("reviews")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeFilter === "reviews"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Shield className="h-4 w-4" />
          Pending Reviews
          <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-200 text-xs font-semibold">
            {counts.reviews}
          </span>
        </button>

        {currentUserId && (
          <button
            onClick={() => setActiveFilter("mine")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeFilter === "mine"
                ? "bg-purple-100 text-purple-700 border border-purple-200"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <User className="h-4 w-4" />
            My Issues
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
            <div className="text-xs text-neutral-500">Loading issues...</div>
          </div>
        )}
        {!isLoading && filteredIssues.map((it) => {
          // Determine icon and color based on kind
          const kindConfig = {
            clarification: {
              icon: HelpCircle,
              color: "sky",
              bgColor: "bg-sky-50/70",
              hoverColor: "hover:bg-sky-100",
            },
            community_defense: {
              icon: Shield,
              color: "emerald",
              bgColor: "bg-emerald-50/70",
              hoverColor: "hover:bg-emerald-100",
            },
            default: {
              icon: AlertCircle,
              color: "indigo",
              bgColor: "bg-indigo-50/70",
              hoverColor: "hover:bg-indigo-100",
            },
          };

          const config = kindConfig[it.kind as keyof typeof kindConfig] || kindConfig.default;
          const Icon = config.icon;

          return (
            <div
              key={it.id}
              className={`rounded-lg panel-edge ${config.bgColor} p-4 backdrop-blur ${config.hoverColor} cursor-pointer transition-colors`}
              onClick={() => setFocus(it.id)}
            >
              <div className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-${config.color}-600`} />
                  {it.label}
                </span>
                <div className="flex items-center gap-2">
                  {it.kind && it.kind !== "general" && (
                    <span className={`text-[10px] px-2 py-0.5 rounded border bg-${config.color}-100 border-${config.color}-200 text-${config.color}-800`}>
                      {it.kind.replace("_", " ")}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      it.state === "open"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    {it.state}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-neutral-600 mt-1">
                {it.description?.slice(0, 160) || it.questionText?.slice(0, 160) || "—"}
              </div>
              <div className="text-[10px] text-neutral-500 mt-2 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="font-medium">Created by:</span>
                  {it.createdBy?.username || it.createdBy?.name || `User ${it.createdById}`}
                </span>
                {it.assignee && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Assigned to:</span>
                    {it.assignee.username || it.assignee.name || `User ${it.assigneeId}`}
                  </span>
                )}
                <span>• Links: {it._count?.links ?? it.links?.length ?? 0}</span>
              </div>
            </div>
          );
        })}
        {!isLoading && filteredIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              {activeFilter === "clarifications" ? (
                <HelpCircle className="h-8 w-8 text-neutral-400" />
              ) : activeFilter === "reviews" ? (
                <Shield className="h-8 w-8 text-neutral-400" />
              ) : (
                <AlertCircle className="h-8 w-8 text-neutral-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-1">
              {activeFilter === "clarifications" 
                ? "No clarification requests"
                : activeFilter === "reviews"
                ? "No pending reviews"
                : "No issues yet"}
            </h3>
            <p className="text-xs text-neutral-500 text-center max-w-sm">
              {activeFilter === "clarifications"
                ? "When someone requests clarification on an argument, it will appear here."
                : activeFilter === "reviews"
                ? "Community defense submissions awaiting your review will appear here."
                : "Issues help track questions, reviews, and improvements for this deliberation."}
            </p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {focus && (
        <IssueDetail
          deliberationId={deliberationId}
          issueId={focus}
          onClose={() => setFocus(null)}
        />
      )}
      </>
      )}
    </div>
  );
}
