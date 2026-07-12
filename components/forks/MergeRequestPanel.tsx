"use client";

import * as React from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  GitMerge,
  GitPullRequest,
  ChevronRight,
  User,
  MoreHorizontal,
  RefreshCw,
  Plus,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

/**
 * Merge Request Components
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * - MergeStatusBadge: Display merge request status
 * - MergeRequestCard: Single merge request card
 * - MergeRequestListPanel: List of merge requests with tabs
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type MergeStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "APPROVED"
  | "MERGED"
  | "CLOSED"
  | "CONFLICT";

export interface MergeRequestData {
  id: string;
  title: string;
  description: string | null;
  status: MergeStatus;
  sourceDeliberationId: string;
  sourceTitle: string;
  targetDeliberationId: string;
  targetTitle: string;
  claimsToMerge: number;
  argumentsToMerge: number;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

// ─────────────────────────────────────────────────────────
// MergeStatusBadge
// ─────────────────────────────────────────────────────────

const MERGE_STATUS_CONFIG: Record<MergeStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  OPEN: {
    label: "Open",
    icon: GitPullRequest,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
  IN_REVIEW: {
    label: "In Review",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  MERGED: {
    label: "Merged",
    icon: GitMerge,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
  CLOSED: {
    label: "Closed",
    icon: XCircle,
    color: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  CONFLICT: {
    label: "Conflict",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
};

export interface MergeStatusBadgeProps {
  status: MergeStatus;
  size?: "sm" | "md";
  className?: string;
}

export function MergeStatusBadge({
  status,
  size = "md",
  className,
}: MergeStatusBadgeProps) {
  const config = MERGE_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgColor,
        config.color,
        size === "sm" ? "px-1.5 py-0.5 text-xs gap-1" : "px-2 py-1 text-xs gap-1.5",
        className
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{config.label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// MergeRequestCard
// ─────────────────────────────────────────────────────────

export interface MergeRequestCardProps {
  mergeRequest: MergeRequestData;
  direction: "incoming" | "outgoing";
  selected?: boolean;
  onSelect?: (mr: MergeRequestData) => void;
  onApprove?: (mr: MergeRequestData) => void;
  onMerge?: (mr: MergeRequestData) => void;
  onClose?: (mr: MergeRequestData) => void;
  className?: string;
}

export function MergeRequestCard({
  mergeRequest,
  direction,
  selected,
  onSelect,
  onApprove,
  onMerge,
  onClose,
  className,
}: MergeRequestCardProps) {
  const timeAgo = formatDistanceToNow(new Date(mergeRequest.createdAt), {
    addSuffix: true,
  });

  const canApprove = mergeRequest.status === "OPEN" || mergeRequest.status === "IN_REVIEW";
  const canMerge = mergeRequest.status === "APPROVED";
  const canClose = mergeRequest.status !== "MERGED" && mergeRequest.status !== "CLOSED";

  return (
    <div
      className={cn(
        "group flex flex-col gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        selected
          ? "border-primary bg-primary/5"
          : "border-slate-200 dark:border-slate-700",
        className
      )}
      onClick={() => onSelect?.(mergeRequest)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {mergeRequest.title}
            </span>
          </div>
          {mergeRequest.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {mergeRequest.description}
            </p>
          )}
        </div>
        <MergeStatusBadge status={mergeRequest.status} size="sm" />
      </div>

      {/* Direction indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="truncate max-w-[120px]">
          {direction === "incoming"
            ? mergeRequest.sourceTitle
            : "This deliberation"}
        </span>
        <ArrowRight className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[120px]">
          {direction === "incoming"
            ? "This deliberation"
            : mergeRequest.targetTitle}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>{mergeRequest.claimsToMerge} claims</span>
        <span>{mergeRequest.argumentsToMerge} arguments</span>
        {mergeRequest.commentCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {mergeRequest.commentCount}
          </span>
        )}
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {mergeRequest.createdByName || "Unknown"}
        </span>
        <span>{timeAgo}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {canApprove && onApprove && direction === "incoming" && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(mergeRequest);
              }}
              className="h-7 px-2 text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Approve
            </Button>
          )}
          {canMerge && onMerge && direction === "incoming" && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMerge(mergeRequest);
              }}
              className="h-7 px-2 text-xs"
            >
              <GitMerge className="w-3 h-3 mr-1" />
              Merge
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect?.(mergeRequest)}>
              View Details
            </DropdownMenuItem>
            {canClose && onClose && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onClose(mergeRequest)}
                  className="text-red-600 dark:text-red-400"
                >
                  Close Request
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MergeRequestCardSkeleton
// ─────────────────────────────────────────────────────────

export function MergeRequestCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MergeRequestListPanel
// ─────────────────────────────────────────────────────────

interface MergeRequestsResponse {
  mergeRequests: MergeRequestData[];
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface MergeRequestListPanelProps {
  deliberationId: string;
  onSelectMergeRequest?: (mr: MergeRequestData) => void;
  onCreateMergeRequest?: () => void;
  onApproveMergeRequest?: (mr: MergeRequestData) => void;
  onExecuteMerge?: (mr: MergeRequestData) => void;
  onCloseMergeRequest?: (mr: MergeRequestData) => void;
  selectedMergeRequestId?: string;
  className?: string;
}

export function MergeRequestListPanel({
  deliberationId,
  onSelectMergeRequest,
  onCreateMergeRequest,
  onApproveMergeRequest,
  onExecuteMerge,
  onCloseMergeRequest,
  selectedMergeRequestId,
  className,
}: MergeRequestListPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"incoming" | "outgoing">("incoming");

  // Incoming merge requests (where this deliberation is the target)
  const {
    data: incomingData,
    error: incomingError,
    isLoading: incomingLoading,
    mutate: mutateIncoming,
  } = useSWR<MergeRequestsResponse>(
    `/api/deliberations/${deliberationId}/merges`,
    fetcher
  );

  // Outgoing merge requests (where this deliberation is the source)
  const {
    data: outgoingData,
    error: outgoingError,
    isLoading: outgoingLoading,
    mutate: mutateOutgoing,
  } = useSWR<MergeRequestsResponse>(
    `/api/deliberations/${deliberationId}/merges?direction=outgoing`,
    fetcher
  );

  const incomingMerges = incomingData?.mergeRequests ?? [];
  const outgoingMerges = outgoingData?.mergeRequests ?? [];

  const refresh = () => {
    mutateIncoming();
    mutateOutgoing();
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Merge Requests
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {onCreateMergeRequest && (
            <Button
              variant="default"
              size="sm"
              onClick={onCreateMergeRequest}
              className="h-7 px-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "incoming" | "outgoing")}>
        <div className="border-b border-slate-200 dark:border-slate-700">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
            <TabsTrigger
              value="incoming"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2"
            >
              Incoming
              {incomingMerges.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {incomingMerges.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="outgoing"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2"
            >
              Outgoing
              {outgoingMerges.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {outgoingMerges.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Incoming Tab Content */}
        <TabsContent value="incoming" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
          {incomingLoading ? (
            <>
              <MergeRequestCardSkeleton />
              <MergeRequestCardSkeleton />
            </>
          ) : incomingError ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Failed to load merge requests
            </div>
          ) : incomingMerges.length === 0 ? (
            <div className="text-center py-8">
              <GitPullRequest className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No incoming merge requests</p>
            </div>
          ) : (
            incomingMerges.map((mr) => (
              <MergeRequestCard
                key={mr.id}
                mergeRequest={mr}
                direction="incoming"
                selected={mr.id === selectedMergeRequestId}
                onSelect={onSelectMergeRequest}
                onApprove={onApproveMergeRequest}
                onMerge={onExecuteMerge}
                onClose={onCloseMergeRequest}
              />
            ))
          )}
        </TabsContent>

        {/* Outgoing Tab Content */}
        <TabsContent value="outgoing" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
          {outgoingLoading ? (
            <>
              <MergeRequestCardSkeleton />
              <MergeRequestCardSkeleton />
            </>
          ) : outgoingError ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Failed to load merge requests
            </div>
          ) : outgoingMerges.length === 0 ? (
            <div className="text-center py-8">
              <GitPullRequest className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No outgoing merge requests</p>
            </div>
          ) : (
            outgoingMerges.map((mr) => (
              <MergeRequestCard
                key={mr.id}
                mergeRequest={mr}
                direction="outgoing"
                selected={mr.id === selectedMergeRequestId}
                onSelect={onSelectMergeRequest}
                onClose={onCloseMergeRequest}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
