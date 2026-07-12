/**
 * ChainParticipationBadge Component
 * Shows a badge indicating an argument's participation in chains
 * 
 * Task 1.6: Add ChainParticipationBadge to AIFArgumentsListPro
 */

"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Link2, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

// ===== Types =====

interface ChainMembership {
  chainId: string;
  chainName: string;
  chainDescription?: string | null;
  chainType: string;
  nodeId: string;
  role: string | null;
  nodeOrder: number;
  nodeCount: number;
  edgeCount: number;
  creator: {
    id: string;
    name: string | null;
    image: string | null;
  };
  chainCreatedAt: string;
}

interface ChainMembershipResponse {
  ok: boolean;
  argumentId: string;
  chains: ChainMembership[];
  count: number;
}

interface ChainParticipationBadgeProps {
  argumentId: string;
  
  /** Pre-loaded chain data (skips fetch) */
  initialData?: ChainMembership[];
  
  /** Compact mode - just shows count */
  compact?: boolean;
  
  /** Maximum chains to show in popover before "show more" */
  maxVisible?: number;
  
  /** Callback when user wants to view a chain */
  onViewChain?: (chainId: string) => void;
  
  /** Callback when user wants to view chain in graph mode */
  onViewChainGraph?: (chainId: string) => void;
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

// ===== Role Colors =====

const roleColors: Record<string, string> = {
  PREMISE: "bg-sky-100 text-sky-700",
  EVIDENCE: "bg-teal-100 text-teal-700",
  CONCLUSION: "bg-green-100 text-green-700",
  OBJECTION: "bg-red-100 text-red-700",
  REBUTTAL: "bg-orange-100 text-orange-700",
  QUALIFIER: "bg-purple-100 text-purple-700",
  COMMENT: "bg-gray-100 text-gray-600",
};

// ===== Main Component =====

export function ChainParticipationBadge({
  argumentId,
  initialData,
  compact = false,
  maxVisible = 3,
  onViewChain,
  onViewChainGraph,
}: ChainParticipationBadgeProps) {
  const [showAll, setShowAll] = useState(false);

  // Fetch chain membership if not provided
  const { data, isLoading } = useSWR<ChainMembershipResponse>(
    !initialData ? `/api/arguments/${argumentId}/chains` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const chains = initialData || data?.chains || [];
  const count = chains.length;

  // Don't render if no chains
  if (!isLoading && count === 0) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-400 gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-[10px]">Loading...</span>
      </Badge>
    );
  }

  // Determine visible chains
  const visibleChains = showAll ? chains : chains.slice(0, maxVisible);
  const hasMore = chains.length > maxVisible;

  // Compact mode - just badge with count
  if (compact) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 cursor-pointer hover:bg-indigo-100",
          "transition-colors duration-150"
        )}
        onClick={() => onViewChain?.(chains[0]?.chainId)}
      >
        <Link2 className="w-3 h-3" />
        <span className="text-[10px] font-medium">{count}</span>
      </Badge>
    );
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "bg-indigo-50 text-indigo-700 border-indigo-200 gap-1.5 cursor-pointer",
            "hover:bg-indigo-100 transition-colors duration-150"
          )}
        >
          <Link2 className="w-3 h-3" />
          <span className="text-[10px]">
            {count === 1
              ? `In 1 chain`
              : `In ${count} chains`}
          </span>
          <ChevronDown className="w-3 h-3" />
        </Badge>
      </HoverCardTrigger>

      <HoverCardContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-slate-50">
          <h4 className="text-sm font-medium text-slate-800">
            Chain Participation
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            This argument appears in {count} chain{count !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {visibleChains.map((chain) => (
            <ChainListItem
              key={chain.chainId}
              chain={chain}
              onViewChain={onViewChain}
              onViewChainGraph={onViewChainGraph}
            />
          ))}
        </div>

        {/* Show More/Less */}
        {hasMore && (
          <div className="p-2 border-t bg-slate-50">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show {chains.length - maxVisible} more
                </>
              )}
            </Button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

// ===== Chain List Item =====

interface ChainListItemProps {
  chain: ChainMembership;
  onViewChain?: (chainId: string) => void;
  onViewChainGraph?: (chainId: string) => void;
}

function ChainListItem({ chain, onViewChain, onViewChainGraph }: ChainListItemProps) {
  const roleColor = roleColors[chain.role || "COMMENT"] || roleColors.COMMENT;

  return (
    <div className="p-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Chain Name */}
          <h5 className="text-sm font-medium text-slate-800 truncate">
            {chain.chainName}
          </h5>

          {/* Position Info */}
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={cn("text-[9px] px-1.5 py-0", roleColor)}
            >
              {chain.role || "Node"}
            </Badge>
            <span className="text-[10px] text-slate-500">
              Position {chain.nodeOrder + 1} of {chain.nodeCount}
            </span>
          </div>

          {/* Chain Stats */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
            <span>{chain.nodeCount} arguments</span>
            <span>•</span>
            <span>{chain.edgeCount} connections</span>
            <span>•</span>
            <span className="capitalize">{chain.chainType.toLowerCase()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {onViewChain && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onViewChain(chain.chainId)}
              title="View chain thread"
            >
              <Link2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {onViewChainGraph && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onViewChainGraph(chain.chainId)}
              title="View chain graph"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChainParticipationBadge;
