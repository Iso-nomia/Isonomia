/**
 * ThreadNode Component
 * Displays a single argument node within the thread view
 * 
 * Task 1.3: Implement ThreadNode (argument preview + edge connector)
 */

"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Network,
  User,
  ArrowDown,
  AlertTriangle,
  Waypoints,
  Lightbulb,
  GitBranch,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ThreadItem, ThreadEdge, getEdgeTypeLabel, getEdgeTypeColor } from "@/lib/chains/chainToThread";

// ===== Role Styling =====

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  PREMISE: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  EVIDENCE: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  CONCLUSION: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  OBJECTION: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  REBUTTAL: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  QUALIFIER: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  COMMENT: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

const roleLabels: Record<string, string> = {
  PREMISE: "Premise",
  EVIDENCE: "Evidence",
  CONCLUSION: "Conclusion",
  OBJECTION: "Objection",
  REBUTTAL: "Rebuttal",
  QUALIFIER: "Qualifier",
  COMMENT: "Comment",
};

// ===== Epistemic Status Styling (Phase 4) =====

const epistemicStatusConfig: Record<string, { 
  icon: React.ReactNode; 
  label: string; 
  bg: string; 
  text: string; 
  border: string;
}> = {
  ASSERTED: { 
    icon: null, // Default - no icon needed
    label: "Asserted", 
    bg: "bg-green-50", 
    text: "text-green-700", 
    border: "border-green-200" 
  },
  HYPOTHETICAL: { 
    icon: <Lightbulb className="w-3 h-3" />, 
    label: "Hypothetical", 
    bg: "bg-amber-50", 
    text: "text-amber-700", 
    border: "border-amber-200" 
  },
  COUNTERFACTUAL: { 
    icon: <GitBranch className="w-3 h-3" />, 
    label: "Counterfactual", 
    bg: "bg-purple-50", 
    text: "text-purple-700", 
    border: "border-purple-200" 
  },
  CONDITIONAL: { 
    icon: <HelpCircle className="w-3 h-3" />, 
    label: "Conditional", 
    bg: "bg-blue-50", 
    text: "text-blue-700", 
    border: "border-blue-200" 
  },
  QUESTIONED: { 
    icon: <HelpCircle className="w-3 h-3" />, 
    label: "Questioned", 
    bg: "bg-gray-50", 
    text: "text-gray-600", 
    border: "border-gray-200" 
  },
  DENIED: { 
    icon: null, 
    label: "Denied", 
    bg: "bg-red-50", 
    text: "text-red-700", 
    border: "border-red-200" 
  },
  SUSPENDED: { 
    icon: null, 
    label: "Suspended", 
    bg: "bg-orange-50", 
    text: "text-orange-600", 
    border: "border-orange-200" 
  },
};

// ===== Edge Connector Component =====

interface EdgeConnectorProps {
  edges: ThreadEdge[];
  direction: "incoming" | "outgoing";
  showLabel?: boolean;
}

function EdgeConnector({ edges, direction, showLabel = true }: EdgeConnectorProps) {
  if (edges.length === 0) return null;

  // For single edge, show simple connector
  if (edges.length === 1) {
    const edge = edges[0];
    const colorClass = getEdgeTypeColor(edge.edgeType);
    
    return (
      <div className="flex items-center justify-center py-1">
        <div className="flex flex-col items-center">
          {direction === "incoming" && (
            <ArrowDown className="w-4 h-4 text-slate-400" />
          )}
          {showLabel && (
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full border",
              colorClass
            )}>
              {getEdgeTypeLabel(edge.edgeType)}
              {edge.strength < 1 && (
                <span className="ml-1 opacity-70">
                  ({Math.round(edge.strength * 100)}%)
                </span>
              )}
            </span>
          )}
          {direction === "outgoing" && (
            <ArrowDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
    );
  }

  // Multiple edges - show branching indicator
  return (
    <div className="flex items-center justify-center py-1 gap-2">
      {edges.map((edge, idx) => {
        const colorClass = getEdgeTypeColor(edge.edgeType);
        return (
          <div key={edge.edgeId} className="flex flex-col items-center">
            <span className={cn(
              "text-[9px] font-medium px-1.5 py-0.5 rounded border",
              colorClass
            )}>
              {getEdgeTypeLabel(edge.edgeType)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===== Main ThreadNode Component =====

interface ThreadNodeProps {
  item: ThreadItem;
  showEdgeConnector?: boolean;
  nextEdges?: ThreadEdge[];
  isFirst?: boolean;
  isLast?: boolean;
  
  // Callbacks - matches ThreadCard from ThreadedDiscussionTab
  onViewArgument?: (argumentId: string) => void;
  onPreview?: (argumentId: string) => void;
  onReply?: (argumentId: string) => void;
  onSupport?: (argumentId: string) => void;
  onAttack?: (argumentId: string) => void;
}

export function ThreadNode({
  item,
  showEdgeConnector = true,
  nextEdges = [],
  isFirst = false,
  isLast = false,
  onViewArgument,
  onPreview,
  onReply,
  onSupport,
  onAttack,
}: ThreadNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const roleStyle = roleColors[item.role] || roleColors.COMMENT;
  const roleLabel = roleLabels[item.role] || item.role;

  // Determine position label
  let positionLabel = "";
  if (item.isRoot && item.position === 0) {
    positionLabel = "ROOT";
  } else if (item.isLeaf && isLast) {
    positionLabel = "CONCLUSION";
  }

  return (
    <div className="relative">
      {/* Position Number */}
      <div className="absolute -left-8 top-3 flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
        {item.position + 1}
      </div>

      {/* Scope Context Indicator */}
      {item.scope && (
        <div 
          className="absolute -left-2 top-0 bottom-0 w-1 rounded-full"
          style={{ backgroundColor: item.scope.color || "#6366f1" }}
          title={`Scope: ${item.scope.assumption}`}
        />
      )}

      {/* Main Card */}
      <div
        className={cn(
          "relative rounded-lg border-2 transition-all duration-200",
          "bg-white shadow-sm hover:shadow-md",
          roleStyle.border,
          item.isCurrent && "ring-2 ring-yellow-400 shadow-lg",
          item.attackingNodes.length > 0 && "border-l-4 border-l-red-400",
          item.scope && "ml-1" // Slight indent for scoped items
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 rounded-t-lg",
          roleStyle.bg
        )}>
          <div className="flex items-center gap-2">
            {/* Role Badge */}
            <Badge 
              variant="outline" 
              className={cn("text-[10px] font-semibold", roleStyle.text, roleStyle.border)}
            >
              {roleLabel}
            </Badge>

            {/* Position Label */}
            {positionLabel && (
              <Badge variant="secondary" className="text-[9px]">
                {positionLabel}
              </Badge>
            )}

            {/* Epistemic Status Badge */}
            {item.epistemicStatus && item.epistemicStatus !== "ASSERTED" && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] font-medium",
                  epistemicStatusConfig[item.epistemicStatus]?.bg,
                  epistemicStatusConfig[item.epistemicStatus]?.text,
                  epistemicStatusConfig[item.epistemicStatus]?.border
                )}
              >
                {epistemicStatusConfig[item.epistemicStatus]?.icon && (
                  <span className="mr-1">{epistemicStatusConfig[item.epistemicStatus]?.icon}</span>
                )}
                {epistemicStatusConfig[item.epistemicStatus]?.label || item.epistemicStatus}
              </Badge>
            )}

            {/* SchemeNet Indicator */}
            {item.hasSchemeNet && (
              <div 
                className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium"
                title={`${item.schemeCount} scheme(s)`}
              >
                <Network className="w-3 h-3" />
                {item.schemeCount}
              </div>
            )}
          </div>

          {/* Node Order */}
          <span className="text-[10px] text-slate-400 font-mono">
            #{item.nodeOrder}
          </span>
        </div>

        {/* Scope Context Banner */}
        {item.scope && (
          <div 
            className="px-3 py-1.5 text-[10px] font-medium border-b flex items-center gap-1.5"
            style={{ 
              backgroundColor: `${item.scope.color || "#6366f1"}10`,
              borderColor: `${item.scope.color || "#6366f1"}30`
            }}
          >
            <span 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.scope.color || "#6366f1" }}
            />
            <span className="text-slate-600">
              {item.scope.scopeType}: <span className="italic">"{item.scope.assumption}"</span>
            </span>
          </div>
        )}

        {/* Content */}
        <div className="px-3 py-3 space-y-2">
          {/* Argument Text */}
          <p className={cn(
            "text-sm text-slate-800",
            isExpanded ? "" : "line-clamp-3"
          )}>
            {item.argumentText}
          </p>

          {/* Expand/Collapse for long text */}
          {item.argumentText.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  Show more
                </>
              )}
            </button>
          )}

          {/* Scheme Info */}
          {item.schemeName && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Scheme:</span>
              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                {item.schemeName}
              </Badge>
            </div>
          )}

          {/* Attack Warning */}
          {item.attackingNodes.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 rounded border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-red-700">
                Attacked by {item.attackingNodes.length} argument{item.attackingNodes.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-b-lg border-t border-slate-100">
          {/* Contributor */}
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500">
              {item.contributor?.name || "Unknown"}
            </span>
          </div>

          {/* Action Buttons - exact copy from ThreadCard in ThreadedDiscussionTab */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onViewArgument?.(item.argumentId)}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View Details
            </button>
            {item.argumentId && onPreview && (
              <button
                onClick={() => onPreview(item.argumentId)}
                className="text-xs text-gray-600 hover:underline flex items-center gap-1"
              >
                <Waypoints className="w-3 h-3" />
                Preview Network
              </button>
            )}
            <button
              onClick={() => onReply?.(item.argumentId)}
              className="text-xs text-gray-600 hover:underline"
            >
              Reply
            </button>
            <button
              onClick={() => onSupport?.(item.argumentId)}
              className="text-xs text-gray-600 hover:underline"
            >
              Support
            </button>
            {/* Only show Attack for arguments - they all have argumentId in chains */}
            {item.argumentId && (
              <button
                onClick={() => onAttack?.(item.argumentId)}
                className="text-xs text-gray-600 hover:underline"
              >
                Attack
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edge Connector to Next Node */}
      {showEdgeConnector && !isLast && nextEdges.length > 0 && (
        <div className="flex justify-center my-1">
          <EdgeConnector edges={nextEdges} direction="outgoing" />
        </div>
      )}

      {/* Vertical Line to Next */}
      {!isLast && (
        <div className="absolute left-1/2 -bottom-4 w-px h-4 bg-slate-300 -translate-x-1/2" />
      )}
    </div>
  );
}

// ===== Orphan Node Display =====

interface OrphanNodeProps {
  item: ThreadItem;
  onViewArgument?: (argumentId: string) => void;
}

export function OrphanNode({ item, onViewArgument }: OrphanNodeProps) {
  const roleStyle = roleColors[item.role] || roleColors.COMMENT;

  return (
    <div className={cn(
      "rounded-lg border border-dashed p-3",
      "bg-slate-50",
      roleStyle.border
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-600">
              Disconnected
            </Badge>
            {item.schemeName && (
              <span className="text-[10px] text-slate-500">{item.schemeName}</span>
            )}
          </div>
          <p className="text-xs text-slate-600 line-clamp-2">
            {item.argumentText}
          </p>
        </div>
        {onViewArgument && (
          <button
            className="text-xs text-indigo-600 hover:underline font-medium shrink-0"
            onClick={() => onViewArgument(item.argumentId)}
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

export default ThreadNode;
