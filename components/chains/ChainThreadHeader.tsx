/**
 * ChainThreadHeader Component
 * Displays chain name, stats, and action buttons
 * 
 * Task 1.2: Implement ChainThreadHeader (name, stats, actions)
 */

"use client";

import React from "react";
import {
  Link2,
  BarChart3,
  Download,
  Settings,
  GitBranch,
  AlertTriangle,
  User,
  Calendar,
  ExternalLink,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChainThread } from "@/lib/chains/chainToThread";

interface ChainThreadHeaderProps {
  thread: ChainThread;
  onViewGraph?: () => void;
  onExport?: (format: "json" | "markdown" | "aif") => void;
  onSettings?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

const chainTypeLabels: Record<string, string> = {
  SERIAL: "Serial",
  CONVERGENT: "Convergent",
  DIVERGENT: "Divergent",
  TREE: "Tree",
  GRAPH: "Graph",
};

const chainTypeColors: Record<string, string> = {
  SERIAL: "bg-blue-100 text-blue-700 border-blue-200",
  CONVERGENT: "bg-green-100 text-green-700 border-green-200",
  DIVERGENT: "bg-purple-100 text-purple-700 border-purple-200",
  TREE: "bg-amber-100 text-amber-700 border-amber-200",
  GRAPH: "bg-rose-100 text-rose-700 border-rose-200",
};

export function ChainThreadHeader({
  thread,
  onViewGraph,
  onExport,
  onSettings,
  showActions = true,
  compact = false,
}: ChainThreadHeaderProps) {
  const typeLabel = chainTypeLabels[thread.chainType] || thread.chainType;
  const typeColor = chainTypeColors[thread.chainType] || "bg-gray-100 text-gray-700 border-gray-200";

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-500" />
          <span className="font-medium text-sm text-slate-800 truncate max-w-[200px]">
            {thread.chainName}
          </span>
          <span className="text-xs text-slate-500">
            {thread.nodeCount} nodes
          </span>
        </div>
        {showActions && onViewGraph && (
          <Button variant="ghost" size="sm" onClick={onViewGraph} className="h-7 px-2">
            <BarChart3 className="w-3.5 h-3.5" />
          </Button>
          
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4 border-b border-slate-200">
      {/* Title Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Link2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {thread.chainName}
            </h2>
            {thread.chainDescription && (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                {thread.chainDescription}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex items-center gap-2">
            {onViewGraph && (
            //   <Button variant="outline" size="sm" onClick={onViewGraph}>
            //     <BarChart3 className="w-4 h-4 mr-1.5" />
            //     View Graph
            //   </Button>
               <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-12 p-0 rounded-md bg-white hover:bg-slate-100"
                  onClick={onViewGraph}
                  title="View as graph"
                >
                  <Network className="w-5 h-5 p-0" />
                </Button>
              
            )}
            
            {onExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExport("json")}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport("markdown")}>
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onExport("aif")}>
                    Export as AIF (JSON-LD)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onSettings && (
              <Button variant="ghost" size="sm" onClick={onSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Chain Type Badge */}
        <Badge variant="outline" className={`${typeColor} border`}>
          <GitBranch className="w-3 h-3 mr-1" />
          {typeLabel}
        </Badge>

        {/* Node Count */}
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="font-medium">{thread.nodeCount}</span>
          <span className="text-slate-400">arguments</span>
        </div>

        {/* Edge Count */}
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="font-medium">{thread.edgeCount}</span>
          <span className="text-slate-400">connections</span>
        </div>

        {/* Depth */}
        {thread.maxDepth > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <span className="font-medium">{thread.maxDepth + 1}</span>
            <span className="text-slate-400">levels deep</span>
          </div>
        )}

        {/* Warning: Circular Dependency */}
        {thread.hasCircularDependency && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Circular dependency detected
          </Badge>
        )}

        {/* Warning: Orphan Nodes */}
        {thread.orphans.length > 0 && (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
            {thread.orphans.length} disconnected
          </Badge>
        )}
      </div>

      {/* Creator Info */}
      {thread.creator && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <User className="w-3.5 h-3.5" />
          <span>Created by</span>
          <span className="font-medium text-slate-700">
            {thread.creator.name || "Unknown"}
          </span>
        </div>
      )}
    </div>
  );
}

export default ChainThreadHeader;
