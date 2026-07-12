// components/aif/DialogueAwareGraphPanel.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { DialogueControls, type DialogueControlState, type DialogueMoveFilter } from "./DialogueControls";
import { CommitmentStorePanel } from "./CommitmentStorePanel";
import { InlineCommitmentCount } from "./CommitmentBadge";
import { enrichNodesWithCommitments } from "@/lib/aif/commitment-helpers";
import type { AifGraphWithDialogue, AifNodeWithDialogue, DialogueAwareEdge } from "@/types/aif-dialogue";

/**
 * DialogueAwareGraphPanel Component
 * 
 * Container component that integrates dialogue visualization with existing AIF graph displays.
 * Provides progressive enhancement: standard AIF graph with opt-in dialogue layer.
 * 
 * Features:
 * - Toggle dialogue layer visibility (DM-nodes and dialogue-aware edges)
 * - Filter dialogue moves (protocol only, structural only, all)
 * - Filter by participant
 * - Display commitment stores
 * - Render existing graph visualization with dialogue enhancements
 * 
 * Architecture:
 * - Fetches graph data from /api/aif/graph-with-dialogue
 * - Passes filtered nodes/edges to existing graph renderer (AFLens, BipolarLens, etc.)
 * - Non-invasive: Existing visualizations work unchanged when dialogue layer is OFF
 * 
 * Usage:
 * ```tsx
 * <DialogueAwareGraphPanel 
 *   deliberationId="abc123"
 *   renderGraph={(nodes, edges) => <YourGraphComponent nodes={nodes} edges={edges} />}
 * />
 * ```
 */

interface DialogueAwareGraphPanelProps {
  /** Deliberation ID to visualize */
  deliberationId: string;
  
  /** Custom graph renderer (receives filtered nodes and edges) */
  renderGraph?: (nodes: AifNodeWithDialogue[], edges: DialogueAwareEdge[]) => React.ReactNode;
  
  /** Show commitment store panel */
  showCommitmentStore?: boolean;
  
  /** Show advanced filters (participant, time range) */
  showAdvancedFilters?: boolean;
  
  /** Initial dialogue control state */
  initialState?: Partial<DialogueControlState>;
  
  /** Initial dialogue layer visibility */
  initialShowDialogue?: boolean;
  
  /** Dialogue move ID to highlight (for navigation from badges) */
  highlightMoveId?: string | null;
  
  /** Additional CSS classes */
  className?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildGraphUrl(
  deliberationId: string,
  state: DialogueControlState
): string {
  const params = new URLSearchParams({
    deliberationId
  });

  if (state.showDialogue) {
    params.set("includeDialogue", "true");
    params.set("includeMoves", state.moveFilter);
    
    if (state.participantFilter) {
      params.set("participantFilter", state.participantFilter);
    }
    
    if (state.timeRange) {
      params.set("timeRange", JSON.stringify({
        start: state.timeRange.start.toISOString(),
        end: state.timeRange.end.toISOString()
      }));
    }
  }

  return `/api/aif/graph-with-dialogue?${params.toString()}`;
}

/**
 * Default graph renderer using simple node/edge display
 * Replace with AFLens, D3 visualization, or custom renderer
 */
function DefaultGraphRenderer({
  nodes,
  edges
}: {
  nodes: any[]; // Accepts enriched nodes with commitment indicators
  edges: DialogueAwareEdge[];
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div>
        <h4 className="text-sm font-semibold mb-2">Nodes ({nodes.length})</h4>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {nodes.slice(0, 10).map((node: any) => (
            <div key={node.id} className="text-xs p-2 bg-white rounded border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <span className="font-mono text-gray-500">{node.dialogueMove?.type}</span>
                  {" "}
                  {node.text?.substring(0, 50) || node.id}
                  {node.dialogueMetadata && (
                    <span className="ml-2 text-blue-600">
                      [via {node.dialogueMetadata.locution}]
                    </span>
                  )}
                </div>
                {node.commitmentIndicator && (
                  <InlineCommitmentCount 
                    count={node.commitmentIndicator.participantCount}
                    isActive={node.commitmentIndicator.totalActive > 0}
                  />
                )}
              </div>
            </div>
          ))}
          {nodes.length > 10 && (
            <div className="text-xs text-gray-500 p-2">
              ... and {nodes.length - 10} more
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Edges ({edges.length})</h4>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {edges.slice(0, 10).map((edge, idx) => (
            <div key={`${edge.id || idx}`} className="text-xs p-2 bg-white rounded border">
              <span className={`font-mono ${
                edge.edgeType === 'supports' ? 'text-green-600' :
                edge.edgeType === 'conflict' ? 'text-red-600' :
                edge.edgeType === 'inference' ? 'text-blue-600' :
                'text-gray-500'
              }`}>
                {edge.edgeType}
              </span>
              {" "}
              {edge.source} → {edge.target}
              {edge.causedByDialogueMoveId && (
                <span className="ml-2 text-purple-600 text-[10px]">[dialogue provenance]</span>
              )}
            </div>
          ))}
          {edges.length > 10 && (
            <div className="text-xs text-gray-500 p-2">
              ... and {edges.length - 10} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DialogueAwareGraphPanel({
  deliberationId,
  renderGraph,
  showCommitmentStore = false,
  showAdvancedFilters = true,
  initialState,
  initialShowDialogue,
  highlightMoveId,
  className = ""
}: DialogueAwareGraphPanelProps) {
  const [controlState, setControlState] = useState<DialogueControlState>({
    showDialogue: initialShowDialogue ?? initialState?.showDialogue ?? false,
    moveFilter: initialState?.moveFilter ?? "all",
    participantFilter: initialState?.participantFilter ?? null,
    timeRange: initialState?.timeRange ?? null
  });

  // Fetch graph data with current filters
  const graphUrl = buildGraphUrl(deliberationId, controlState);
  const { data, error, isLoading, mutate } = useSWR<AifGraphWithDialogue>(
    graphUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  // Fetch commitment stores when dialogue is enabled
  const commitmentUrl = controlState.showDialogue 
    ? `/api/aif/dialogue/${deliberationId}/commitments${controlState.participantFilter ? `?participantId=${controlState.participantFilter}` : ""}`
    : null;
  const { data: commitmentData, error: commitmentError, isLoading: commitmentLoading, mutate: commitmentMutate } = useSWR(
    commitmentUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  // Enrich nodes with commitment indicators
  const enrichedNodes = useMemo(() => {
    if (!data?.nodes || !commitmentData) {
      return data?.nodes || [];
    }
    return enrichNodesWithCommitments(data.nodes, commitmentData);
  }, [data?.nodes, commitmentData]);

  // Scroll/highlight effect when highlightMoveId changes
  useEffect(() => {
    if (highlightMoveId && data && data.dialogueMoves) {
      // Find the dialogue move in the data
      const moveNode = data.dialogueMoves.find(m => m.id === highlightMoveId);
      
      if (moveNode) {
        console.log("Highlighting dialogue move:", highlightMoveId);
        // TODO: Implement actual scrolling/highlighting in graph renderer
        // This could involve:
        // 1. Finding the node element in the DOM
        // 2. Scrolling it into view
        // 3. Adding a highlight class/animation
        // For now, just log it
      }
    }
  }, [highlightMoveId, data]);

  // Extract participants from dialogue moves
  const participants = data?.dialogueMoves
    ? Array.from(
        new Map(
          data.dialogueMoves
            .filter(m => m.author)
            .map(m => [m.author!.id, { id: m.author!.id, name: m.author!.displayName || m.author!.username || "Unknown" }])
        ).values()
      )
    : [];

  // Handle control state changes (refetch graph)
  const handleControlChange = (newState: DialogueControlState) => {
    setControlState(newState);
    mutate(); // Trigger SWR revalidation
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600 p-4 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4" />
            <div className="text-sm">
              Failed to load graph: {error.message || "Unknown error"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Control Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Dialogue Visualization</CardTitle>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DialogueControls
            state={controlState}
            onChange={handleControlChange}
            participants={participants}
            showAdvancedFilters={showAdvancedFilters}
          />
          
          {/* Statistics */}
          {data && controlState.showDialogue && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>
                  <strong>{data.nodes?.length || 0}</strong> nodes
                </span>
                <span>•</span>
                <span>
                  <strong>{data.edges?.length || 0}</strong> edges
                </span>
                <span>•</span>
                <span>
                  <strong>{data.dialogueMoves?.length || 0}</strong> moves
                </span>
                {data.metadata && data.metadata.dmNodeCount && data.metadata.dmNodeCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600">
                      <strong>{data.metadata.dmNodeCount}</strong> DM-nodes
                    </span>
                  </>
                )}
              </div>
              
              {/* Edge type breakdown */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-600">
                  <strong>{data.edges?.filter(e => e.edgeType === 'supports').length || 0}</strong> support
                </span>
                <span className="text-red-600">
                  <strong>{data.edges?.filter(e => e.edgeType === 'conflict').length || 0}</strong> attack
                </span>
                <span className="text-blue-600">
                  <strong>{data.edges?.filter(e => e.edgeType === 'inference').length || 0}</strong> inference
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graph Visualization */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : data && data.nodes && data.edges ? (
            renderGraph ? (
              renderGraph(enrichedNodes, data.edges)
            ) : (
              <div className="p-4">
                <DefaultGraphRenderer nodes={enrichedNodes} edges={data.edges} />
              </div>
            )
          ) : (
            <div className="text-center py-12 text-gray-500">
              No graph data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commitment Store Panel (only shown when dialogue layer is active) */}
      {showCommitmentStore && controlState.showDialogue && (
        <>
          {commitmentLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading commitment stores...</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {commitmentError && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to load commitment stores</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {commitmentData && Array.isArray(commitmentData) && commitmentData.length > 0 && (
            <CommitmentStorePanel
              stores={commitmentData}
              deliberationId={deliberationId}
              onClaimClick={(claimId) => {
                console.log("Clicked claim:", claimId);
                // TODO: Navigate to claim in graph or open claim detail
              }}
              onRefresh={() => commitmentMutate()}
              showTimeline={false}
            />
          )}
          
          {commitmentData && Array.isArray(commitmentData) && commitmentData.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Commitment Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  No commitments found. Participants haven&apos;t made any ASSERT, CONCEDE, or THEREFORE moves yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
