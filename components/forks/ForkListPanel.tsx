"use client";

import * as React from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ForkBadge, ForkType, FORK_TYPE_CONFIG } from "./ForkBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitFork,
  ChevronRight,
  User,
  MoreHorizontal,
  RefreshCw,
  Plus,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Fork List Components
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * - ForkListItem: Single fork row
 * - ForkListItemSkeleton: Loading state
 * - ForkListPanel: List of forks with SWR
 * - ForkTreeView: Hierarchical tree view of forks
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ForkListItemData {
  id: string;
  title: string;
  forkType: ForkType;
  forkReason: string | null;
  claimCount: number;
  argumentCount: number;
  createdById: string;
  createdByName?: string;
  createdAt: string;
}

export interface ForkTreeNode {
  id: string;
  title: string;
  forkType: ForkType | null;
  forkReason: string | null;
  claimCount: number;
  argumentCount: number;
  createdAt: string;
  createdByName?: string;
  children: ForkTreeNode[];
}

// ─────────────────────────────────────────────────────────
// ForkListItem
// ─────────────────────────────────────────────────────────

export interface ForkListItemProps {
  fork: ForkListItemData;
  selected?: boolean;
  onSelect?: (fork: ForkListItemData) => void;
  onOpen?: (fork: ForkListItemData) => void;
  className?: string;
}

export function ForkListItem({
  fork,
  selected,
  onSelect,
  onOpen,
  className,
}: ForkListItemProps) {
  const timeAgo = formatDistanceToNow(new Date(fork.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        selected
          ? "border-primary bg-primary/5"
          : "border-slate-200 dark:border-slate-700",
        className
      )}
      onClick={() => onSelect?.(fork)}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
          FORK_TYPE_CONFIG[fork.forkType].bgColor
        )}
      >
        <GitFork
          className={cn("w-4 h-4", FORK_TYPE_CONFIG[fork.forkType].color)}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {fork.title}
          </span>
          <ForkBadge type={fork.forkType} size="sm" showLabel={false} />
        </div>

        {fork.forkReason && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            {fork.forkReason}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
          <span>{fork.claimCount} claims</span>
          <span>{fork.argumentCount} arguments</span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {fork.createdByName || "Unknown"}
          </span>
          <span>{timeAgo}</span>
        </div>
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
          <DropdownMenuItem onClick={() => onOpen?.(fork)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Fork
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ForkListItemSkeleton
// ─────────────────────────────────────────────────────────

export function ForkListItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ForkListPanel
// ─────────────────────────────────────────────────────────

interface ForksResponse {
  forks: ForkListItemData[];
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ForkListPanelProps {
  deliberationId: string;
  onSelectFork?: (fork: ForkListItemData) => void;
  onOpenFork?: (fork: ForkListItemData) => void;
  onCreateFork?: () => void;
  selectedForkId?: string;
  className?: string;
}

export function ForkListPanel({
  deliberationId,
  onSelectFork,
  onOpenFork,
  onCreateFork,
  selectedForkId,
  className,
}: ForkListPanelProps) {
  const { data, error, isLoading, mutate } = useSWR<ForksResponse>(
    `/api/deliberations/${deliberationId}/fork`,
    fetcher
  );

  const forks = data?.forks ?? [];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Forks
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
          {onCreateFork && (
            <Button
              variant="default"
              size="sm"
              onClick={onCreateFork}
              className="h-7 px-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Fork
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <>
            <ForkListItemSkeleton />
            <ForkListItemSkeleton />
            <ForkListItemSkeleton />
          </>
        ) : error ? (
          <div className="text-center py-8 text-sm text-slate-500">
            Failed to load forks
          </div>
        ) : forks.length === 0 ? (
          <div className="text-center py-8">
            <GitFork className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No forks yet</p>
            {onCreateFork && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateFork}
                className="mt-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Fork
              </Button>
            )}
          </div>
        ) : (
          forks.map((fork) => (
            <ForkListItem
              key={fork.id}
              fork={fork}
              selected={fork.id === selectedForkId}
              onSelect={onSelectFork}
              onOpen={onOpenFork}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ForkTreeNode Component
// ─────────────────────────────────────────────────────────

interface ForkTreeNodeItemProps {
  node: ForkTreeNode;
  level: number;
  onSelect?: (node: ForkTreeNode) => void;
  selectedId?: string;
}

function ForkTreeNodeItem({
  node,
  level,
  onSelect,
  selectedId,
}: ForkTreeNodeItemProps) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect?.(node)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-4 h-4 flex items-center justify-center"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                !expanded && "-rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}

        <GitFork
          className={cn(
            "w-3.5 h-3.5",
            node.forkType
              ? FORK_TYPE_CONFIG[node.forkType].color
              : "text-slate-400"
          )}
        />

        <span className="text-sm truncate flex-1">{node.title}</span>

        {node.forkType && (
          <ForkBadge type={node.forkType} size="sm" showLabel={false} />
        )}

        <span className="text-xs text-slate-400">{node.claimCount} claims</span>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <ForkTreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ForkTreeView
// ─────────────────────────────────────────────────────────

interface ForkTreeResponse {
  tree: ForkTreeNode;
}

export interface ForkTreeViewProps {
  deliberationId: string;
  onSelectNode?: (node: ForkTreeNode) => void;
  selectedId?: string;
  className?: string;
}

export function ForkTreeView({
  deliberationId,
  onSelectNode,
  selectedId,
  className,
}: ForkTreeViewProps) {
  const { data, error, isLoading, mutate } = useSWR<ForkTreeResponse>(
    `/api/deliberations/${deliberationId}/fork?tree=true`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-2 p-3", className)}>
        <ForkListItemSkeleton />
        <ForkListItemSkeleton />
      </div>
    );
  }

  if (error || !data?.tree) {
    return (
      <div className={cn("text-center py-8 text-sm text-slate-500", className)}>
        Failed to load fork tree
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Fork Tree
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          className="h-7 w-7 p-0"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tree */}
      <div className="p-2">
        <ForkTreeNodeItem
          node={data.tree}
          level={0}
          onSelect={onSelectNode}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}
