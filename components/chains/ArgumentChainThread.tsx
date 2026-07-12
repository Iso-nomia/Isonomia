/**
 * ArgumentChainThread Component
 * A linear, scrollable representation of an argument chain
 * 
 * Task 1.1: Create ArgumentChainThread component shell
 * 
 * This component provides an alternative to the graph-based ReactFlow canvas,
 * displaying chains as a vertical thread that's easier to read and navigate.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Link2Off,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { ChainThreadHeader } from "./ChainThreadHeader";
import { ThreadNode, OrphanNode } from "./ThreadNode";
import { chainToThread, ChainThread, getEdgeTypeBetween } from "@/lib/chains/chainToThread";
import { ArgumentChainWithRelations } from "@/lib/types/argumentChain";

// ===== Types =====

interface ArgumentChainThreadProps {
  /** Chain ID to load and display */
  chainId: string;
  
  /** Optional: Pre-loaded chain data (skips fetch) */
  initialData?: ArgumentChainWithRelations;
  
  /** Optional: Highlight this argument as "current" */
  currentArgumentId?: string;
  
  /** Show header with title and actions */
  showHeader?: boolean;
  
  /** Show orphan/disconnected nodes section */
  showOrphans?: boolean;
  
  /** Compact mode for embedding */
  compact?: boolean;
  
  /** Maximum height before scrolling */
  maxHeight?: string;
  
  // Callbacks - matches ThreadCard from ThreadedDiscussionTab
  onViewGraph?: (chainId: string) => void;
  onExport?: (chainId: string, format: "json" | "markdown" | "aif") => void;
  onSettings?: (chainId: string) => void;
  onViewArgument?: (argumentId: string) => void;
  onPreview?: (argumentId: string) => void;
  onReply?: (argumentId: string) => void;
  onSupport?: (argumentId: string) => void;
  onAttack?: (argumentId: string) => void;
}

// ===== Fetcher =====

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${r.status}`);
    }
    // Extract chain from response wrapper
    return json.chain || json;
  });

// ===== Main Component =====

export function ArgumentChainThread({
  chainId,
  initialData,
  currentArgumentId,
  showHeader = true,
  showOrphans = true,
  compact = false,
  maxHeight = "600px",
  onViewGraph,
  onExport,
  onSettings,
  onViewArgument,
  onPreview,
  onReply,
  onSupport,
  onAttack,
}: ArgumentChainThreadProps) {
  const [thread, setThread] = useState<ChainThread | null>(null);
  const [showAllOrphans, setShowAllOrphans] = useState(false);

  // Fetch chain data if not provided
  const {
    data: fetchedChain,
    error,
    isLoading,
    mutate,
  } = useSWR<ArgumentChainWithRelations>(
    !initialData ? `/api/argument-chains/${chainId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  // Use provided data or fetched data
  const chainData = initialData || fetchedChain;

  // Convert chain to thread format when data changes
  useEffect(() => {
    if (chainData) {
      const threadData = chainToThread(chainData, currentArgumentId);
      setThread(threadData);
    }
  }, [chainData, currentArgumentId]);

  // Handlers
  const handleViewGraph = useCallback(() => {
    if (onViewGraph) onViewGraph(chainId);
  }, [chainId, onViewGraph]);

  const handleExport = useCallback(
    (format: "json" | "markdown" | "aif") => {
      if (onExport) onExport(chainId, format);
    },
    [chainId, onExport]
  );

  const handleSettings = useCallback(() => {
    if (onSettings) onSettings(chainId);
  }, [chainId, onSettings]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading chain...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load argument chain: {error.message}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Link2Off className="w-8 h-8 mb-2" />
        <p className="text-sm">No chain data available</p>
      </div>
    );
  }

  // Empty chain state
  if (thread.items.length === 0 && thread.orphans.length === 0) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <ChainThreadHeader
            thread={thread}
            onViewGraph={onViewGraph ? handleViewGraph : undefined}
            onExport={onExport ? handleExport : undefined}
            onSettings={onSettings ? handleSettings : undefined}
            compact={compact}
          />
        )}
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <Link2Off className="w-8 h-8 mb-2" />
          <p className="text-sm">This chain has no arguments yet</p>
        </div>
      </div>
    );
  }

  // Determine orphans to show
  const visibleOrphans = showAllOrphans ? thread.orphans : thread.orphans.slice(0, 3);
  const hasMoreOrphans = thread.orphans.length > 3;

  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {/* Header */}
      {showHeader && (
        <ChainThreadHeader
          thread={thread}
          onViewGraph={onViewGraph ? handleViewGraph : undefined}
          onExport={onExport ? handleExport : undefined}
          onSettings={onSettings ? handleSettings : undefined}
          compact={compact}
        />
      )}

      {/* Thread Body */}
      <div
        className={cn(
          "relative pl-10 space-y-4",
          maxHeight && "overflow-y-auto"
        )}
        style={{ maxHeight: maxHeight || undefined }}
      >
        {/* Main Thread Items */}
        {thread.items.map((item, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === thread.items.length - 1;
          
          // Get edges to next node
          const nextEdges = !isLast
            ? item.outgoingEdges.filter(
                (e) => e.connectedNodeId === thread.items[idx + 1]?.nodeId
              )
            : [];

          return (
            <ThreadNode
              key={item.nodeId}
              item={item}
              isFirst={isFirst}
              isLast={isLast}
              nextEdges={nextEdges}
              showEdgeConnector={!isLast}
              onViewArgument={onViewArgument}
              onPreview={onPreview}
              onReply={onReply}
              onSupport={onSupport}
              onAttack={onAttack}
            />
          );
        })}
      </div>

      {/* Orphan Nodes Section */}
      {showOrphans && thread.orphans.length > 0 && (
        <div className="mt-6 pt-4 border-t border-dashed border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-600">
              Disconnected Arguments ({thread.orphans.length})
            </h3>
            {hasMoreOrphans && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllOrphans(!showAllOrphans)}
                className="h-7 text-xs"
              >
                {showAllOrphans ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show all ({thread.orphans.length})
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {visibleOrphans.map((item) => (
              <OrphanNode
                key={item.nodeId}
                item={item}
                onViewArgument={onViewArgument}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chain Analysis Summary (Footer) */}
      {!compact && thread.items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Chain depth: {thread.maxDepth + 1} level{thread.maxDepth > 0 ? "s" : ""}
            </span>
            <span>
              {thread.rootNodeIds.length} root{thread.rootNodeIds.length !== 1 ? "s" : ""} →{" "}
              {thread.leafNodeIds.length} conclusion{thread.leafNodeIds.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArgumentChainThread;
