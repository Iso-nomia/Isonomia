/**
 * ChainListPanel Component
 * Displays a list of argument chains in a deliberation with expand/collapse
 * 
 * Task 1.8: Create ChainListPanel (list of chains with expand)
 */

"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import {
  Link2,
  ChevronDown,
  ChevronRight,
  Plus,
  Network,
  GitBranch,
  Loader2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  List,
  FileText,
  Sparkles,
  BookOpenText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ArgumentChainThread } from "./ArgumentChainThread";

// ===== Types =====

interface ChainNode {
  id: string;
  argumentId: string;
  role: string | null;
  order: number;
  argument?: {
    id: string;
    text: string;
    createdAt: string;
    conclusion?: {
      id: string;
      text: string;
    };
  };
}

interface ChainEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
}

interface ArgumentChain {
  id: string;
  name: string;
  description?: string | null;
  chainType: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
  createdAt: string;
  updatedAt: string;
  createdBy: string | bigint;
  creator?: {
    id: string | bigint;
    name: string | null;
    image: string | null;
  };
  nodes: ChainNode[];
  edges: ChainEdge[];
  _count?: {
    nodes: number;
    edges: number;
  };
}

interface ChainListResponse {
  ok: boolean;
  chains: ArgumentChain[];
  count: number;
}

interface ChainListPanelProps {
  deliberationId: string;
  
  /** Show create button */
  showCreate?: boolean;
  
  /** Callback when user wants to create a new chain */
  onCreateChain?: () => void;
  
  /** Callback when user clicks on a chain */
  onChainClick?: (chainId: string) => void;
  
  /** Callback when user wants to view chain in graph mode */
  onViewChainGraph?: (chainId: string) => void;
  
  /** Callback when user wants to view chain in thread mode */
  onViewChainThread?: (chainId: string) => void;
  
  /** Callback when user wants to view chain in prose mode */
  onViewChainProse?: (chainId: string) => void;
  
  /** Callback when user wants to view chain in essay mode */
  onViewChainEssay?: (chainId: string) => void;
  
  /** Callback for viewing an argument (View Details) */
  onViewArgument?: (argumentId: string) => void;
  
  /** Callback for preview network action on an argument */
  onPreviewArgument?: (argumentId: string) => void;
  
  /** Callback for reply action on an argument */
  onReplyArgument?: (argumentId: string) => void;
  
  /** Callback for support action on an argument */
  onSupportArgument?: (argumentId: string) => void;
  
  /** Callback for attack action on an argument */
  onAttackArgument?: (argumentId: string) => void;
  
  /** Currently highlighted argument ID */
  currentArgumentId?: string;
  
  /** Compact mode - smaller cards */
  compact?: boolean;
}

// ===== Fetcher =====

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${r.status}`);
    }
    return json;
  });

// ===== Chain Type Config =====

const chainTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  SERIAL: {
    icon: <GitBranch className="w-3.5 h-3.5" />,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Serial",
  },
  CONVERGENT: {
    icon: <Network className="w-3.5 h-3.5" />,
    color: "bg-green-100 text-green-700 border-green-200",
    label: "Convergent",
  },
  DIVERGENT: {
    icon: <Network className="w-3.5 h-3.5 rotate-180" />,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    label: "Divergent",
  },
  TREE: {
    icon: <GitBranch className="w-3.5 h-3.5" />,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Tree",
  },
  GRAPH: {
    icon: <Network className="w-3.5 h-3.5" />,
    color: "bg-slate-100 text-slate-700 border-slate-200",
    label: "Graph",
  },
};

// ===== Main Component =====

export function ChainListPanel({
  deliberationId,
  showCreate = true,
  onCreateChain,
  onChainClick,
  onViewChainGraph,
  onViewChainThread,
  onViewChainProse,
  onViewChainEssay,
  onViewArgument,
  onPreviewArgument,
  onReplyArgument,
  onSupportArgument,
  onAttackArgument,
  currentArgumentId,
  compact = false,
}: ChainListPanelProps) {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  // Fetch chains for deliberation
  const { data, error, isLoading, mutate } = useSWR<ChainListResponse>(
    `/api/deliberations/${deliberationId}/chains`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const chains = data?.chains || [];

  // Toggle chain expansion
  const toggleChain = useCallback((chainId: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading chains...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-600">Failed to load chains</p>
        <Button variant="outline" className="rounded-md" size="sm" onClick={() => mutate()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (chains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
          <Link2 className="w-8 h-8 text-slate-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-800">No Chains Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[300px]">
            Create argument chains to organize related arguments into logical sequences.
          </p>
        </div>
        {showCreate && onCreateChain && (
          <Button onClick={onCreateChain} className="mt-2">
            <Plus className="w-4 h-4 mr-2" />
            Create First Chain
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {chains.length} Chain{chains.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
         <button           
          className="flex h-8 px-2 text-xs gap-2  items-center forumbutton border-indigo-200 bg-white/50 rounded-md"

            onClick={() => mutate()}
            title="Refresh chains"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {showCreate && onCreateChain && (
            <button 
            className="flex h-8 px-2 text-xs gap-2  items-center forumbutton border-indigo-200 bg-white/50 rounded-md"
 
            onClick={onCreateChain}>
              <PlusCircle className="w-4 h-4 " />
            </button>
                      
            
          )}
        </div>
      </div>

      {/* Chain List */}
      <div className="space-y-2">
        {chains.map((chain) => (
          <ChainListItem
            key={chain.id}
            chain={chain}
            expanded={expandedChains.has(chain.id)}
            onToggle={() => toggleChain(chain.id)}
            onViewGraph={() => onViewChainGraph?.(chain.id)}
            onViewThread={() => onViewChainThread?.(chain.id)}
            onViewProse={() => onViewChainProse?.(chain.id)}
            onViewEssay={() => onViewChainEssay?.(chain.id)}
            onViewArgument={onViewArgument}
            onPreviewArgument={onPreviewArgument}
            onReplyArgument={onReplyArgument}
            onSupportArgument={onSupportArgument}
            onAttackArgument={onAttackArgument}
            currentArgumentId={currentArgumentId}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

// ===== Chain List Item =====

interface ChainListItemProps {
  chain: ArgumentChain;
  expanded: boolean;
  onToggle: () => void;
  onViewGraph?: () => void;
  onViewThread?: () => void;
  onViewProse?: () => void;
  onViewEssay?: () => void;
  onViewArgument?: (argumentId: string) => void;
  onPreviewArgument?: (argumentId: string) => void;
  onReplyArgument?: (argumentId: string) => void;
  onSupportArgument?: (argumentId: string) => void;
  onAttackArgument?: (argumentId: string) => void;
  currentArgumentId?: string;
  compact?: boolean;
}

function ChainListItem({
  chain,
  expanded,
  onToggle,
  onViewGraph,
  onViewThread,
  onViewProse,
  onViewEssay,
  onViewArgument,
  onPreviewArgument,
  onReplyArgument,
  onSupportArgument,
  onAttackArgument,
  currentArgumentId,
  compact,
}: ChainListItemProps) {
  const config = chainTypeConfig[chain.chainType] || chainTypeConfig.GRAPH;
  const nodeCount = chain._count?.nodes || chain.nodes?.length || 0;
  const edgeCount = chain._count?.edges || chain.edges?.length || 0;
  const createdDate = new Date(chain.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "border rounded-lg bg-white transition-shadow",
          expanded ? "shadow-md" : "shadow-sm hover:shadow-md"
        )}
      >
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 p-3 text-left",
              "hover:bg-slate-50 transition-colors rounded-t-lg",
              compact ? "p-2" : "p-3"
            )}
          >
            {/* Expand Icon */}
            <div className="shrink-0">
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>

            {/* Chain Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  "font-medium text-slate-800 truncate",
                  compact ? "text-sm" : "text-base"
                )}>
                  {chain.name || "Untitled Chain"}
                </h4>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0 shrink-0", config.color)}
                >
                  {config.icon}
                  <span className="ml-1">{config.label}</span>
                </Badge>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{nodeCount} argument{nodeCount !== 1 ? "s" : ""}</span>
                <span>•</span>
                <span>{edgeCount} connection{edgeCount !== 1 ? "s" : ""}</span>
                <span>•</span>
                <span>{createdDate}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {onViewThread && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-slate-100 hover:bg-slate-200"
                  onClick={onViewThread}
                  title="View as thread"
                >
                  <List className="w-4 h-4" />
                </Button>
              )}
              {onViewGraph && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-slate-100 hover:bg-slate-200"
                  onClick={onViewGraph}
                  title="View as graph"
                >
                  <Network className="w-4 h-4" />
                </Button>
              )}
              {onViewProse && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-slate-100 hover:bg-slate-200"
                  onClick={onViewProse}
                  title="View as brief"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              )}
              {onViewEssay && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-indigo-100 hover:bg-indigo-200"
                  onClick={onViewEssay}
                  title="View as essay"
                >
                  <BookOpenText className="w-4 h-4 text-indigo-600" />
                </Button>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="border-t">
            {chain.description && (
              <p className="px-4 py-2 text-sm text-slate-600 bg-slate-50 border-b">
                {chain.description}
              </p>
            )}
            
            {/* Inline Thread View */}
            <div className="p-2">
              <ArgumentChainThread
                chainId={chain.id}
                initialData={chain as any}
                currentArgumentId={currentArgumentId}
                onViewGraph={onViewGraph}
                onViewArgument={onViewArgument}
                onPreview={onPreviewArgument}
                onReply={onReplyArgument}
                onSupport={onSupportArgument}
                onAttack={onAttackArgument}
                compact={true}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ChainListPanel;
