/**
 * ThreadedDiscussionTab Component
 * 
 * Reddit/forum-style threaded view for deliberation discussions.
 * Combines propositions, claims, and arguments into unified discussion threads
 * with rich metadata, filtering, and quick actions.
 * 
 * Based on patterns from:
 * - app/deliberation/[id]/dialoguetimeline/page.tsx (threading logic)
 * - components/agora/DebateSheetReader.tsx (metadata badges, filters)
 * - components/discussion/DiscussionView.tsx (forum structure)
 * 
 * Part of DeepDivePanel V3 migration - Option A Implementation
 */

"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { toast } from "sonner";
import { BaseTabProps } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MessageSquare,
  TrendingUp,
  Network,
  Filter,
  Download,
  RefreshCw,
  User,
  Clock,
  ChevronRight,
  Waypoints,
  Scale,
  FileText,
  BarChart3,
  Calendar,
  X,
} from "lucide-react";
import { SchemeBadge } from "@/components/aif/SchemeBadge";
import { CQStatusIndicator } from "@/components/aif/CQStatusIndicator";
import { AttackBadge } from "@/components/aif/AttackBadge";
import { PreferenceBadge } from "@/components/aif/PreferenceBadge";
import { ArgumentCardV2 } from "@/components/arguments/ArgumentCardV2";
import { SupportBar } from "@/components/evidence/SupportBar";
import { MiniNeighborhoodPreview } from "@/components/aif/MiniNeighborhoodPreview";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import { AIFArgumentWithSchemeComposer } from "@/components/arguments/AIFArgumentWithSchemeComposer";
import { AttackSuggestions } from "@/components/argumentation/AttackSuggestions";
import { AttackArgumentWizard } from "@/components/argumentation/AttackArgumentWizard";
import type { AttackSuggestion } from "@/app/server/services/ArgumentGenerationService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeliberationTab } from "../hooks/useDeliberationState";
import { useConfidenceOptional } from "@/components/agora/useConfidence";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

/** Fallback confidence accrual mode when no <ConfidenceProvider> is in scope. */
const DEFAULT_CONFIDENCE_MODE: "min" | "product" | "logodds" = "logodds";

/**
 * Unified thread node representing any discussion element
 */
interface ThreadNode {
  id: string;
  type: "proposition" | "claim" | "argument" | "dialogue_move";
  text: string;
  authorId: string;
  authorName?: string;
  timestamp: string;

  // Parent-child relationships
  parentId?: string | null;
  targetId?: string | null;
  targetType?: string | null;

  // Metadata
  argumentId?: string;
  claimId?: string;
  schemeKey?: string;
  schemeName?: string;
  cqRequired?: number;
  cqSatisfied?: number;
  confidence?: number;
  attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
  preferences?: { preferredBy: number; dispreferredBy: number };

  // Thread state
  responses?: ThreadNode[];
  isExpanded?: boolean;
  depth?: number;
}

/**
 * Props for ThreadedDiscussionTab
 */
export interface ThreadedDiscussionTabProps extends BaseTabProps {
  /** Current user ID for actions */
  currentUserId?: string;
  
  /** Callback to switch main panel tabs (for quick action buttons) */
  onTabChange?: (tab: DeliberationTab) => void;
}

/**
 * Group items into threads based on reply/target relationships
 */
function buildThreadHierarchy(items: ThreadNode[]): ThreadNode[] {
  const nodeMap = new Map<string, ThreadNode>(items.map((n) => [n.id, { ...n, responses: [], depth: 0 }]));
  const roots: ThreadNode[] = [];

  // First pass: identify roots and build parent-child links
  for (const node of nodeMap.values()) {
    const parentKey = node.parentId || node.targetId;
    if (!parentKey || !nodeMap.has(parentKey)) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(parentKey)!;
      parent.responses = parent.responses || [];
      parent.responses.push(node);
      node.depth = (parent.depth || 0) + 1;
    }
  }

  // Sort roots by timestamp (newest first by default)
  roots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Recursively sort responses
  const sortResponses = (node: ThreadNode) => {
    if (node.responses && node.responses.length > 0) {
      node.responses.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      node.responses.forEach(sortResponses);
    }
  };
  roots.forEach(sortResponses);

  return roots;
}

/**
 * DiscussionAnalytics Component - Analytics dashboard for thread discussions
 */
function DiscussionAnalytics({ 
  threads, 
  allNodes, 
  userNames 
}: { 
  threads: ThreadNode[]; 
  allNodes: ThreadNode[]; 
  userNames: Map<string, string>;
}) {
  const analytics = useMemo(() => {
    // Type distribution
    const typeCounts = { proposition: 0, claim: 0, argument: 0 };
    allNodes.forEach(node => {
      if (node.type in typeCounts) typeCounts[node.type as keyof typeof typeCounts]++;
    });

    // Participation metrics
    const userPosts = new Map<string, number>();
    allNodes.forEach(node => {
      userPosts.set(node.authorId, (userPosts.get(node.authorId) || 0) + 1);
    });
    const topContributors = Array.from(userPosts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Scheme usage
    const schemeCounts = new Map<string, number>();
    allNodes.forEach(node => {
      if (node.schemeName) {
        schemeCounts.set(node.schemeName, (schemeCounts.get(node.schemeName) || 0) + 1);
      }
    });
    const topSchemes = Array.from(schemeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Thread depth analysis
    const calculateDepth = (node: ThreadNode, currentDepth = 0): number => {
      if (!node.responses || node.responses.length === 0) return currentDepth;
      return Math.max(...node.responses.map(r => calculateDepth(r, currentDepth + 1)));
    };
    const depths = threads.map(t => calculateDepth(t));
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

    // Engagement metrics
    const nodesWithResponses = allNodes.filter(n => n.responses && n.responses.length > 0);
    const totalResponses = nodesWithResponses.reduce((sum, n) => sum + (n.responses?.length || 0), 0);
    const avgResponsesPerPost = allNodes.length > 0 ? totalResponses / allNodes.length : 0;

    // Activity over time (by day)
    const activityByDay = new Map<string, number>();
    allNodes.forEach(node => {
      const date = new Date(node.timestamp).toISOString().split('T')[0];
      activityByDay.set(date, (activityByDay.get(date) || 0) + 1);
    });
    const activityData = Array.from(activityByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      typeCounts,
      topContributors,
      topSchemes,
      maxDepth,
      avgDepth,
      avgResponsesPerPost,
      activityData,
      totalNodes: allNodes.length,
      totalThreads: threads.length,
    };
  }, [threads, allNodes]);

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="panelv2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{analytics.totalNodes}</div>
            <div className="text-xs text-gray-600">Total Items</div>
          </CardContent>
        </Card>
        <Card className="panelv2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-sky-600">{analytics.totalThreads}</div>
            <div className="text-xs text-gray-600">Root Threads</div>
          </CardContent>
        </Card>
        <Card className="panelv2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{analytics.maxDepth}</div>
            <div className="text-xs text-gray-600">Max Depth</div>
          </CardContent>
        </Card>
        <Card className="panelv2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{analytics.avgResponsesPerPost.toFixed(1)}</div>
            <div className="text-xs text-gray-600">Avg Responses/Post</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Type Distribution */}
        <Card className="panelv2">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Type Distribution</h3>
            <div className="space-y-3">
              {Object.entries(analytics.typeCounts).map(([type, count]) => {
                const percentage = analytics.totalNodes > 0 ? (count / analytics.totalNodes) * 100 : 0;
                const colors = {
                  proposition: 'bg-sky-500',
                  claim: 'bg-purple-500',
                  argument: 'bg-green-500',
                };
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{type}</span>
                      <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors[type as keyof typeof colors]} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Contributors */}
        <Card className="panelv2">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Contributors</h3>
            <div className="space-y-3">
              {analytics.topContributors.map(([userId, count], idx) => {
                const name = userNames.get(userId) || `User ${userId.slice(0, 8)}`;
                const percentage = analytics.totalNodes > 0 ? (count / analytics.totalNodes) * 100 : 0;
                return (
                  <div key={userId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="text-indigo-600 font-bold">#{idx + 1}</span>
                        {name}
                      </span>
                      <span className="font-medium">{count} posts</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Scheme Usage */}
        {analytics.topSchemes.length > 0 && (
          <Card className="panelv2">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top Argumentation Schemes</h3>
              <div className="space-y-2">
                {analytics.topSchemes.map(([scheme, count]) => (
                  <div key={scheme} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                    <span className="font-medium truncate flex-1 mr-2">{scheme}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Thread Depth */}
        <Card className="panelv2">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Thread Depth Analysis</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium">Maximum Depth</span>
                <span className="text-2xl font-bold text-purple-600">{analytics.maxDepth}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-sky-50 rounded-lg">
                <span className="text-sm font-medium">Average Depth</span>
                <span className="text-2xl font-bold text-sky-600">{analytics.avgDepth.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        {analytics.activityData.length > 0 && (
          <Card className="panelv2 lg:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Activity Over Time</h3>
              <div className="flex items-end gap-1 h-32">
                {analytics.activityData.map(({ date, count }) => {
                  const maxCount = Math.max(...analytics.activityData.map(d => d.count));
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div 
                      key={date} 
                      className="flex-1 bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors relative group"
                      style={{ height: `${height}%` }}
                      title={`${date}: ${count} items`}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {date}: {count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center">
                {analytics.activityData.length > 0 && (
                  <>
                    {new Date(analytics.activityData[0].date).toLocaleDateString()} - {' '}
                    {new Date(analytics.activityData[analytics.activityData.length - 1].date).toLocaleDateString()}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * ThreadCard Component - Renders a single thread with nested responses
 */
function ThreadCard({
  node,
  isExpanded,
  onToggle,
  onNodeClick,
  onPreview,
  onReply,
  onSupport,
  onAttack,
  depth = 0,
  userNames,
  aifMetadata,
  supportByClaim,
  deliberationId,
  confidenceMode,
}: {
  node: ThreadNode;
  isExpanded: boolean;
  onToggle: () => void;
  onNodeClick: (node: ThreadNode) => void;
  onPreview: (nodeId: string) => void;
  onReply: (node: ThreadNode) => void;
  onSupport: (node: ThreadNode) => void;
  onAttack: (node: ThreadNode) => void;
  depth?: number;
  userNames: Map<string, string>;
  aifMetadata: Map<string, any>;
  supportByClaim: Map<string, { score: number; accepted: boolean }>;
  deliberationId: string;
  confidenceMode: "min" | "product" | "logodds";
}) {
  const timestamp = new Date(node.timestamp);
  const hasResponses = node.responses && node.responses.length > 0;
  const authorName = node.authorName || userNames.get(node.authorId) || `User ${node.authorId?.slice(0, 8)}`;

  // Get AIF metadata if available
  const aif = node.argumentId ? aifMetadata.get(node.argumentId) : null;

  // Computed evidential support for this argument's conclusion claim (same
  // source as DebateSheetReader's SupportBar — attack/CQ/mode-aware accrual).
  const claimSupport = node.claimId ? supportByClaim.get(node.claimId) : undefined;

  // Calculate indent based on depth (max 3 levels)
  const indent = Math.min(depth, 3) * 2; // 2rem per level

  return (
    <div className="thread-card" style={{ marginLeft: depth > 0 ? `${indent}rem` : 0 }}>
      <Card className={`sidebarv2 group-hover:shadow-md transition-shadow ${depth === 0 ? "border-l-4 border-l-indigo-500" : ""}`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-1">
              {/* Type icon */}
              <div className={`p-2 rounded-lg ${
                node.type === "proposition" ? "bg-sky-500" :
                node.type === "claim" ? "bg-indigo-500" :
                node.type === "argument" ? "bg-purple-500" :
                "bg-gray-500"
              } text-white`}>
                <MessageSquare className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {node.type}
                  </span>
                  {depth > 0 && (
                    <span className="text-xs text-gray-400">→ Reply</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  <span>{authorName}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{format(timestamp, "MMM d, yyyy 'at' h:mm a")}</span>
                  {hasResponses && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">
                        {node.responses!.length} {node.responses!.length === 1 ? "response" : "responses"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {hasResponses && (
                <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="mb-3">
            <p className="text-sm text-gray-800 font-medium leading-relaxed">
              {node.text}
            </p>
          </div>

          {/* Metadata badges */}
          {(aif || node.confidence != null || claimSupport) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {aif?.scheme && (
                <SchemeBadge schemeKey={aif.scheme.key} schemeName={aif.scheme.name} />
              )}
              {aif?.cq && (
                <CQStatusIndicator required={aif.cq.required} satisfied={aif.cq.satisfied} />
              )}
              {aif?.attacks && (
                <AttackBadge attacks={aif.attacks} />
              )}
              {aif?.preferences && (
                <PreferenceBadge
                  preferredBy={aif.preferences.preferredBy}
                  dispreferredBy={aif.preferences.dispreferredBy}
                />
              )}
              {claimSupport?.accepted && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                  Accepted
                </span>
              )}
              {node.confidence != null && (
                <Badge variant="secondary" className="text-xs" title="Author-supplied confidence prior (time-decayed); distinct from computed support">
                  Confidence: {(node.confidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          )}

          {/* Computed evidential support (attack/CQ/mode-aware accrual on the
              conclusion claim — same source as the debate sheet's SupportBar) */}
          {claimSupport && node.claimId && (
            <div className="mb-3">
              <SupportBar
                value={claimSupport.score}
                mode={confidenceMode}
                claimId={node.claimId}
                deliberationId={deliberationId}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNodeClick(node)}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View Details
            </button>
            {node.argumentId && (
              <button
                onClick={() => onPreview(node.id)}
                className="text-xs text-gray-600 hover:underline flex items-center gap-1"
              >
                <Waypoints className="w-3 h-3" />
                Preview Network
              </button>
            )}
            <button 
              onClick={() => onReply(node)}
              className="text-xs text-gray-600 hover:underline"
            >
              Comment
            </button>
            {/* <button 
              onClick={() => onSupport(node)}
              className="text-xs text-gray-600 hover:underline"
            >
              Support
            </button> */}
            {/* Only show Attack for arguments with conclusion claims */}
            {node.argumentId && node.claimId && (
              <button 
                onClick={() => onAttack(node)}
                className="text-xs text-gray-600 hover:underline"
              >
                Attack
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nested responses */}
      {isExpanded && hasResponses && (
        <div className="mt-3 space-y-3">
          {node.responses!.map((response) => (
            <ThreadCard
              key={response.id}
              node={response}
              isExpanded={true} // Auto-expand nested responses (can make configurable)
              onToggle={() => {}} // Nested responses don't collapse individually
              onNodeClick={onNodeClick}
              onPreview={onPreview}
              onReply={onReply}
              onSupport={onSupport}
              onAttack={onAttack}
              depth={depth + 1}
              userNames={userNames}
              aifMetadata={aifMetadata}
              supportByClaim={supportByClaim}
              deliberationId={deliberationId}
              confidenceMode={confidenceMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Statistics Summary Component
 */
function ThreadStats({ threads, totalItems }: { threads: ThreadNode[]; totalItems: number }) {
  const stats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    const countTypes = (node: ThreadNode) => {
      typeCount[node.type] = (typeCount[node.type] || 0) + 1;
      node.responses?.forEach(countTypes);
    };
    threads.forEach(countTypes);

    return {
      threads: threads.length,
      totalItems,
      byType: typeCount,
    };
  }, [threads, totalItems]);

  return (
    <div className="flex flex-wrap gap-3 ">
      <Card className="surfacev2  panel-edge px-5 py-1">
        <CardContent className="flex flex-col w-full items-center p-1">
          <div className="text-lg font-bold text-gray-900">{stats.threads}</div>
          <div className="text-xs text-gray-500">Threads</div>
        </CardContent>
      </Card>
      <Card className="surfacev2 panel-edge  px-5 py-1">
        <CardContent className="flex flex-col w-full items-center p-1">
          <div className="text-lg font-bold text-gray-900">{stats.totalItems}</div>
          <div className="text-xs text-gray-500">Total Items</div>
        </CardContent>
      </Card>
      <Card className="surfacev2 panel-edge  px-5 py-1">
        <CardContent className="flex flex-col w-full items-center p-1">
          <div className="text-lg font-bold text-gray-900">{stats.byType.argument || 0}</div>
          <div className="text-xs text-gray-500">Arguments</div>
        </CardContent>
      </Card>
      <Card className="surfacev2 panel-edge  px-5 py-1">
        <CardContent className="flex flex-col w-full items-center p-1">
          <div className="text-lg font-bold text-gray-900">{stats.byType.proposition || 0}</div>
          <div className="text-xs text-gray-500">Propositions</div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main ThreadedDiscussionTab Component
 */
export function ThreadedDiscussionTab({
  deliberationId,
  currentUserId,
  onTabChange,
  className,
}: ThreadedDiscussionTabProps) {
  // Respect the global confidence toggle when a <ConfidenceProvider> is in
  // scope (e.g. inside DeepDivePanelV2), so the discussion tab and debate sheet
  // share the same accrual mode; fall back to the default otherwise.
  const confidenceCtx = useConfidenceOptional();
  const confidenceMode = confidenceCtx?.mode ?? DEFAULT_CONFIDENCE_MODE;

  const [viewMode, setViewMode] = useState<"timeline" | "analytics">("timeline");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterScheme, setFilterScheme] = useState<string | null>(null);
  const [filterOpenCQs, setFilterOpenCQs] = useState(false);
  const [sortOrder, setSortOrder] = useState<"chrono" | "support" | "activity">("chrono");
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });

  // Modal state
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [expandModalOpen, setExpandModalOpen] = useState(false);
  const [expandNodeId, setExpandNodeId] = useState<string | null>(null);
  const [expandArgumentId, setExpandArgumentId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ThreadNode | null>(null);
  
  // Action modal state
  const [replyMode, setReplyMode] = useState(false);
  const [supportMode, setSupportMode] = useState(false);
  const [attackMode, setAttackMode] = useState(false);
  const [actionTarget, setActionTarget] = useState<ThreadNode | null>(null);
  
  // Attack flow state
  const [selectedAttack, setSelectedAttack] = useState<AttackSuggestion | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Fetch unified discussion items from new API endpoint
  const { data: discussionData, error, mutate, isLoading } = useSWR(
    `/api/deliberations/${deliberationId}/discussion-items?limit=200&includeMetadata=true&includeAuthors=true`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  // Fetch full argument data when modal is open (for premises, schemes, etc.)
  const { data: expandArgumentData, mutate: mutateExpandArgument } = useSWR(
    expandArgumentId ? `/api/arguments/${expandArgumentId}/aif` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Extract items and authors from unified response
  const items = discussionData?.items || [];
  const authors = discussionData?.authors || [];

  // Build user names map from authors
  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    authors.forEach((u: any) => {
      const displayName = u.name || u.username || `User ${u.id.slice(0, 8)}`;
      map.set(u.id, displayName);
    });
    return map;
  }, [authors]);

  // Build AIF metadata lookup (for arguments only)
  const aifMetadata = useMemo(() => {
    const map = new Map<string, any>();
    items
      .filter((item: any) => item.type === "argument")
      .forEach((item: any) => {
        // Store relevant AIF metadata
        map.set(item.argumentId, {
          schemeKey: item.schemeKey,
          schemeName: item.schemeName,
          cqRequired: item.cqRequired,
          cqSatisfied: item.cqSatisfied,
          confidence: item.confidence,
          attacks: item.attacks,
          metadata: item.metadata,
        });
      });
    return map;
  }, [items]);

  // Convert API items to ThreadNode format
  const allNodes = useMemo((): ThreadNode[] => {
    return items.map((item: any) => ({
      id: item.id,
      type: item.type,
      text: item.text,
      authorId: item.authorId,
      timestamp: item.timestamp,
      parentId: item.parentId,
      targetId: item.targetId,
      targetType: item.targetType,
      // Additional fields based on type
      ...(item.type === "argument" && {
        argumentId: item.argumentId,
        claimId: item.claimId,
        schemeKey: item.schemeKey,
        schemeName: item.schemeName,
        cqRequired: item.cqRequired,
        cqSatisfied: item.cqSatisfied,
        confidence: item.confidence,
        attacks: item.attacks,
        preferences: item.preferences,
      }),
      ...(item.type === "claim" && {
        claimId: item.claimId,
      }),
    }));
  }, [items]);

  // Computed evidential support (attack/CQ/mode-aware accrual) for the
  // conclusion claims of argument nodes — the same endpoint DebateSheetReader
  // uses, so the discussion tab and debate sheet report the same "support".
  const supportClaimIds = useMemo(() => {
    const ids = new Set<string>();
    allNodes.forEach((n) => {
      if (n.type === "argument" && n.claimId) ids.add(n.claimId);
    });
    return Array.from(ids);
  }, [allNodes]);

  const { data: scoreData } = useSWR(
    supportClaimIds.length
      ? `/api/evidential/score?deliberationId=${deliberationId}&mode=${confidenceMode}&ids=${supportClaimIds.join(",")}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const supportByClaim = useMemo(() => {
    const map = new Map<string, { score: number; accepted: boolean }>();
    const rows = scoreData?.items ?? [];
    for (const row of rows) {
      if (row?.id == null) continue;
      const score = typeof row.score === "number" ? row.score : row.bel ?? null;
      if (score == null) continue;
      map.set(row.id, { score, accepted: !!row.accepted });
    }
    return map;
  }, [scoreData]);

  // Apply filters
  const filteredNodes = useMemo(() => {
    let filtered = [...allNodes];

    if (filterType) {
      filtered = filtered.filter((n) => n.type === filterType);
    }

    if (filterScheme) {
      filtered = filtered.filter((n) => n.schemeKey === filterScheme);
    }

    if (filterOpenCQs) {
      filtered = filtered.filter((n) => {
        return n.cqRequired && n.cqSatisfied != null && n.cqSatisfied < n.cqRequired;
      });
    }

    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter((n) => {
        const nodeDate = new Date(n.timestamp);
        if (dateRange.start && nodeDate < new Date(dateRange.start)) return false;
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          if (nodeDate > endDate) return false;
        }
        return true;
      });
    }

    return filtered;
  }, [allNodes, filterType, filterScheme, filterOpenCQs, dateRange]);

  // Build thread hierarchy
  const threads = useMemo(() => {
    const hierarchy = buildThreadHierarchy(filteredNodes);

    // Apply sorting
    if (sortOrder === "support") {
      const supportOf = (n: ThreadNode) =>
        (n.claimId ? supportByClaim.get(n.claimId)?.score : undefined) ?? n.confidence ?? 0;
      hierarchy.sort((a, b) => supportOf(b) - supportOf(a));
    } else if (sortOrder === "activity") {
      // Sort by number of responses
      hierarchy.sort((a, b) => (b.responses?.length || 0) - (a.responses?.length || 0));
    }
    // "chrono" is already applied in buildThreadHierarchy

    return hierarchy;
  }, [filteredNodes, sortOrder, supportByClaim]);

  // Get unique schemes for filter
  const availableSchemes = useMemo(() => {
    const schemes = new Set<string>();
    allNodes.forEach((n) => {
      if (n.schemeKey) schemes.add(n.schemeKey);
    });
    return Array.from(schemes).sort();
  }, [allNodes]);

  // Toggle thread expansion
  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  // Handle node click - open ArgumentCardV2 modal for arguments
  const handleNodeClick = (node: ThreadNode) => {
    if (!node.argumentId) return;
    setExpandNodeId(node.id);
    setExpandArgumentId(node.argumentId);
    setSelectedNode(node);
    setExpandModalOpen(true);
  };

  // Handle preview
  const handlePreview = (nodeId: string) => {
    setPreviewNodeId(nodeId);
    setPreviewModalOpen(true);
  };
  
  // Handle reply action - open PropositionComposerPro
  const handleReply = (node: ThreadNode) => {
    setActionTarget(node);
    setReplyMode(true);
  };
  
  // Handle support action - open AIFArgumentWithSchemeComposer
  const handleSupport = (node: ThreadNode) => {
    if (!node.claimId && !node.argumentId) {
      toast.error("Cannot support this item - no claim or argument ID found");
      return;
    }
    setActionTarget(node);
    setSupportMode(true);
  };
  
  // Handle attack action - open AttackSuggestions dialog
  const handleAttack = (node: ThreadNode) => {
    if (!node.argumentId) {
      toast.error("Can only attack arguments");
      return;
    }
    
    if (!node.claimId) {
      toast.error("Argument missing conclusion claim");
      return;
    }
    
    if (!currentUserId) {
      toast.error("Please sign in to create attacks");
      return;
    }
    
    setActionTarget(node);
    setAttackMode(true);
  };
  
  // Close composer modals and refresh data
  const handleComposerSuccess = () => {
    setReplyMode(false);
    setSupportMode(false);
    setAttackMode(false);
    setWizardOpen(false);
    setActionTarget(null);
    setSelectedAttack(null);
    mutate(); // Refresh discussion items
    toast.success("Successfully posted!");
  };

  // Fetch neighborhood for preview
  const previewedArgumentId = useMemo(() => {
    if (!previewNodeId) return null;
    const node = allNodes.find((n) => n.id === previewNodeId);
    return node?.argumentId || null;
  }, [previewNodeId, allNodes]);

  const { data: neighborhoodData, error: neighborhoodError, isLoading: neighborhoodLoading } = useSWR(
    previewedArgumentId ? `/api/arguments/${previewedArgumentId}/aif-neighborhood?depth=1` : null,
    fetcher
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="text-sm text-gray-500">Loading discussion items...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">Failed to load discussion items</h3>
              <p className="text-sm text-red-700 mb-3">
                {error.message || "An unexpected error occurred while fetching the discussion data."}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => mutate()}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!discussionData || items.length === 0) {
    return (
      <div className={className}>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 m-4 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-slate-400 mx-auto w-16 h-16 flex items-center justify-center">
              <MessageSquare className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-slate-700">No discussion items yet</h3>
            <p className="text-sm text-slate-500">
              Be the first to contribute by creating a proposition, claim, or argument in this deliberation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Overview Bar */}
      <div className=" z-10 bg-white/50 backdrop-blur-md border-b border-slate-200 p-3 rounded-lg mb-4">
        <div className="flex items-center justify-between mb-3">
          <ThreadStats threads={threads} totalItems={allNodes.length} />

          <div className="flex items-center gap-2">
            {/* Quick action launchers to other tabs */}
            <Button 
               className="surfacev2 border-none h-full  text-md"
              title="View Argument Map"
              onClick={() => onTabChange?.("arguments")}
            >
              <Network className="w-4 h-4 mr-1" />
              Map
            </Button>
            <Button 
                           className="surfacev2 border-none h-full  text-md"

              title="View Ludics"
              onClick={() => onTabChange?.("ludics")}
            >
              <Scale className="w-4 h-4 mr-1" />
              Ludics
            </Button>
            <Button 
                           className="surfacev2 border-none h-full  text-md"

              title="View Analytics"
              onClick={() => onTabChange?.("analytics")}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </Button>
            <Button 
                           className="surfacev2 border-none h-full  text-md"

              onClick={() => mutate()}
              title="Refresh discussion items"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button               className="surfacev2 border-none h-full  text-md "
  title="Export discussion">
                
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          
          <select
            className="menuv2--lite text-sm rounded-lg px-3 py-1.5"
            value={filterType || ""}
            onChange={(e) => setFilterType(e.target.value || null)}
          >
            <option value="">All types</option>
            <option value="proposition">Propositions</option>
            <option value="claim">Claims</option>
            <option value="argument">Arguments</option>
          </select>

          <select
            className="menuv2--lite text-sm rounded-lg px-3 py-1.5"
            value={filterScheme || ""}
            onChange={(e) => setFilterScheme(e.target.value || null)}
          >
            <option value="">All schemes</option>
            {availableSchemes.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <label className="text-xs inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterOpenCQs}
              onChange={(e) => setFilterOpenCQs(e.target.checked)}
            />
            Open CQs only
          </label>

          <select
            className="menuv2--lite text-sm rounded-lg px-3 py-1.5 ml-auto"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
          >
            <option value="chrono">Chronological</option>
            <option value="support">By Support</option>
            <option value="activity">Most Active</option>
          </select>

          {(filterType || filterScheme || filterOpenCQs) && (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => {
                setFilterType(null);
                setFilterScheme(null);
                setFilterOpenCQs(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
        <TabsList className="font-normal tracking-wide">
          <TabsTrigger value="timeline">
            <MessageSquare className="w-4 h-4 mr-2" />
            Discussion
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {threads.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No discussion items found</p>
                <p className="text-xs text-gray-400 mt-2">
                  {allNodes.length > 0
                    ? "Try adjusting your filters"
                    : "Be the first to start the discussion!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                node={thread}
                isExpanded={expandedThreads.has(thread.id)}
                onToggle={() => toggleThread(thread.id)}
                onNodeClick={handleNodeClick}
                onPreview={handlePreview}
                onReply={handleReply}
                onSupport={handleSupport}
                onAttack={handleAttack}
                userNames={userNames}
                aifMetadata={aifMetadata}
                supportByClaim={supportByClaim}
                deliberationId={deliberationId}
                confidenceMode={confidenceMode}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <DiscussionAnalytics 
            threads={threads} 
            allNodes={allNodes} 
            userNames={userNames}
          />
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-[750px] bg-white/15 backdrop-blur-md border-2 border-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="tracking-wide font-medium">AIF Neighborhood Preview</DialogTitle>
          </DialogHeader>
          <div className="py-0">
            <MiniNeighborhoodPreview
              data={neighborhoodData}
              loading={neighborhoodLoading}
              error={neighborhoodError}
              maxWidth={700}
              maxHeight={400}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Argument Details Modal (ArgumentCardV2) */}
      {expandModalOpen && expandNodeId && (() => {
        const node = allNodes.find((n) => n.id === expandNodeId);
        if (!node?.argumentId) return null;

        // Use fetched AIF data if available, fallback to basic item data
        const argData = items.find((item: any) => item.argumentId === node.argumentId);
        const aifData = expandArgumentData?.ok ? expandArgumentData : null;
        
        if (!argData && !aifData) return null;

        return (
          <Dialog open={expandModalOpen} onOpenChange={(open) => {
            if (!open) {
              setExpandModalOpen(false);
              setExpandArgumentId(null);
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Argument Details</DialogTitle>
              </DialogHeader>
              <ArgumentCardV2
                deliberationId={deliberationId}
                authorId={currentUserId || ""}
                id={aifData?.id || argData?.argumentId || node.argumentId}
                conclusion={{
                  id: aifData?.aif?.conclusion?.id || argData?.claimId || node.argumentId,
                  text: aifData?.aif?.conclusion?.text || argData?.text || "Untitled claim"
                }}
                premises={aifData?.aif?.premises || []}
                schemeKey={aifData?.aif?.scheme?.key || argData?.schemeKey}
                schemeName={aifData?.aif?.scheme?.name || argData?.schemeName}
                schemes={aifData?.aif?.schemes?.map((s: any) => ({
                  schemeId: s.id,
                  schemeKey: s.key,
                  schemeName: s.name,
                  confidence: s.confidence || 1.0,
                  isPrimary: s.isPrimary || false,
                }))}
                provenance={aifData?.provenance}
                onAnyChange={() => {
                  mutate();
                  mutateExpandArgument();
                }}
              />
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Reply Composer Modal */}
      {replyMode && actionTarget && (
        <Dialog open={replyMode} onOpenChange={(open) => !open && setReplyMode(false)}>
          <DialogContent className="max-w-3xl max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Reply to {actionTarget.type}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Replying to: {actionTarget.text.slice(0, 100)}...
              </p>
            </DialogHeader>
            <PropositionComposerPro
              deliberationId={deliberationId}
              replyTarget={
                actionTarget.type === "proposition"
                  ? { kind: "proposition", id: actionTarget.id }
                  : actionTarget.claimId
                  ? { kind: "claim", id: actionTarget.claimId }
                  : actionTarget.argumentId
                  ? { kind: "argument", id: actionTarget.argumentId }
                  : undefined
              }
              onPosted={handleComposerSuccess}
              placeholder="Write your reply..."
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Support Composer Modal */}
      {supportMode && actionTarget && (
        <Dialog open={supportMode} onOpenChange={(open) => !open && setSupportMode(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Create Supporting Argument
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Supporting: {actionTarget.text.slice(0, 100)}...
              </p>
            </DialogHeader>
            <AIFArgumentWithSchemeComposer
              deliberationId={deliberationId}
              authorId={currentUserId || ""}
              conclusionClaim={
                actionTarget.claimId
                  ? { id: actionTarget.claimId, text: actionTarget.text }
                  : null
              }
              onCreated={handleComposerSuccess}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Attack Suggestions Dialog */}
      {attackMode && actionTarget && actionTarget.argumentId && actionTarget.claimId && !wizardOpen && (
        <Dialog 
          open={attackMode && !wizardOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setAttackMode(false);
              setActionTarget(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Strategic Attack</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Attacking: {actionTarget.text.slice(0, 100)}...
              </p>
            </DialogHeader>
            {currentUserId && (
              <AttackSuggestions
                targetClaimId={actionTarget.claimId}
                targetArgumentId={actionTarget.argumentId}
                userId={currentUserId}
                onAttackSelect={(suggestion) => {
                  console.log("[ThreadedDiscussionTab] Attack selected:", suggestion);
                  setSelectedAttack(suggestion);
                  setWizardOpen(true);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Attack Construction Wizard Dialog */}
      {wizardOpen && actionTarget && actionTarget.argumentId && actionTarget.claimId && selectedAttack && (
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-6xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Construct Attack</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Attacking: {actionTarget.text.slice(0, 100)}...
              </p>
            </DialogHeader>
            {currentUserId && (
              <AttackArgumentWizard
                suggestion={selectedAttack}
                targetArgumentId={actionTarget.argumentId}
                targetClaimId={actionTarget.claimId}
                deliberationId={deliberationId}
                currentUserId={currentUserId}
                onComplete={(attackClaimId) => {
                  console.log("[ThreadedDiscussionTab] Attack completed, claim ID:", attackClaimId);
                  handleComposerSuccess();
                }}
                onCancel={() => {
                  setWizardOpen(false);
                  setSelectedAttack(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
