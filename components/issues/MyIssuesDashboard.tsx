// components/issues/MyIssuesDashboard.tsx
"use client";
import * as React from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { HelpCircle, Shield, AlertCircle, User, Inbox } from "lucide-react";
import IssueDetail from "./IssueDetail";
import { useBusEffect } from "@/lib/client/useBusEffect";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

type DashboardTab = "assigned" | "created" | "pending_reviews" | "pending_clarifications";

export function MyIssuesDashboard({
  deliberationId,
  currentUserId,
}: {
  deliberationId: string;
  currentUserId: string;
}) {
  const [focus, setFocus] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<DashboardTab>("assigned");

  const key = `/api/deliberations/${encodeURIComponent(deliberationId)}/issues?state=all`;
  const { data, isLoading } = useSWR<{ ok: true; issues: any[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });

  // Live refresh on server events
  useBusEffect(["issues:changed"], (p) => {
    if (p?.deliberationId !== deliberationId) return;
    globalMutate(key);
  });

  // Filter issues based on current user's role
  const myIssues = React.useMemo(() => {
    const issues = data?.issues ?? [];
    
    const assigned = issues.filter(
      (it) => it.assigneeId === currentUserId && it.state === "open"
    );
    
    const created = issues.filter(
      (it) => it.createdById === currentUserId
    );
    
    const pendingReviews = issues.filter(
      (it) =>
        it.kind === "community_defense" &&
        it.assigneeId === currentUserId &&
        it.state === "open" &&
        it.ncmStatus === "PENDING"
    );
    
    const pendingClarifications = issues.filter(
      (it) =>
        it.kind === "clarification" &&
        it.assigneeId === currentUserId &&
        it.state === "open" &&
        !it.answerText
    );

    return {
      assigned,
      created,
      pendingReviews,
      pendingClarifications,
    };
  }, [data?.issues, currentUserId]);

  const currentIssues = myIssues[activeTab === "pending_reviews" ? "pendingReviews" : activeTab === "pending_clarifications" ? "pendingClarifications" : activeTab];

  return (
    <div className="flex flex-col w-full h-full">
      {/* Dashboard Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-neutral-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("assigned")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "assigned"
              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <User className="h-4 w-4" />
          Assigned to Me
          <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-200 text-xs font-semibold">
            {myIssues.assigned.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pending_clarifications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "pending_clarifications"
              ? "bg-sky-100 text-sky-700 border border-sky-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Questions to Answer
          {myIssues.pendingClarifications.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-sky-200 text-xs font-semibold">
              {myIssues.pendingClarifications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pending_reviews")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "pending_reviews"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Shield className="h-4 w-4" />
          Defenses to Review
          {myIssues.pendingReviews.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-200 text-xs font-semibold">
              {myIssues.pendingReviews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("created")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "created"
              ? "bg-slate-100 text-slate-700 border border-slate-200"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Created by Me
          <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-200 text-xs font-semibold">
            {myIssues.created.length}
          </span>
        </button>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
            <div className="text-xs text-neutral-500">Loading your issues...</div>
          </div>
        )}

        {!isLoading && currentIssues.map((it) => {
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

        {!isLoading && currentIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-1">
              {activeTab === "assigned"
                ? "No issues assigned to you"
                : activeTab === "pending_clarifications"
                ? "No clarifications to answer"
                : activeTab === "pending_reviews"
                ? "No community defenses to review"
                : "You haven't created any issues"}
            </h3>
            <p className="text-xs text-neutral-500 text-center max-w-sm">
              {activeTab === "assigned"
                ? "Issues requiring your attention will appear here."
                : activeTab === "pending_clarifications"
                ? "When someone asks for clarification on your arguments, you'll see them here."
                : activeTab === "pending_reviews"
                ? "Community defense submissions for your arguments will appear here for review."
                : "Issues you create will be tracked here."}
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
    </div>
  );
}
