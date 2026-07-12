"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Edit2, ChevronDown, ChevronRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SCOPE_TYPE_CONFIG,
  EPISTEMIC_STATUS_CONFIG,
  type ScopeType,
  type EpistemicStatus,
} from "@/lib/types/argumentChain";
import { EpistemicStatusBadge } from "./EpistemicStatusBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Scope {
  id: string;
  scopeType: ScopeType;
  assumption: string;
  description?: string;
  color?: string;
  nodeCount: number;
  parentScopeId?: string;
}

interface ScopesPanelProps {
  scopes: Scope[];
  nodes: any[];
  activeScope?: string | null;
  onCreateScope: () => void;
  onEditScope?: (scope: Scope) => void;
  onDeleteScope: (scopeId: string) => void;
  onAssignNodeToScope: (nodeId: string, scopeId: string | null, epistemicStatus?: string) => void;
  onEnterMode?: (scope: Scope) => void;
  onExitMode?: () => void;
  onHighlightNode: (nodeId: string) => void;
  onClose: () => void;
}

export function ScopesPanel({
  scopes,
  nodes,
  activeScope,
  onCreateScope,
  onEditScope,
  onDeleteScope,
  onAssignNodeToScope,
  onEnterMode,
  onExitMode,
  onHighlightNode,
  onClose,
}: ScopesPanelProps) {
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());
  const [assigningNode, setAssigningNode] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ scopeId: string; assumption: string; nodeCount: number } | null>(null);

  const toggleScope = (scopeId: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeId)) {
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return next;
    });
  };

  // Get nodes in a scope
  const getNodesInScope = (scopeId: string) => {
    return nodes.filter((n) => n.data.scopeId === scopeId);
  };

  // Get unassigned nodes (not in any scope)
  const unassignedNodes = nodes.filter((n) => !n.data.scopeId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-amber-50">
        <div>
          <h3 className="font-semibold text-gray-800">Hypothetical Scopes</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Group arguments by shared assumptions
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-amber-100 transition-colors"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Create Scope Button */}
      <div className="p-3 border-b">
        <button
          onClick={onCreateScope}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <Plus size={16} />
          Create New Scope
        </button>
      </div>

      {/* Scopes List */}
      <div className="flex-1 overflow-y-auto">
        {scopes.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-2xl">💡</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">No scopes created yet</p>
            <p className="text-xs text-gray-500">
              Create a scope to group hypothetical or counterfactual arguments
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {scopes.map((scope) => {
              const config = SCOPE_TYPE_CONFIG[scope.scopeType];
              const color = scope.color || config.color;
              const isExpanded = expandedScopes.has(scope.id);
              const scopeNodes = getNodesInScope(scope.id);
              const isActive = activeScope === scope.id;

              return (
                <div
                  key={scope.id}
                  className={`rounded-lg border overflow-hidden transition-all ${isActive ? "ring-2 shadow-md" : ""}`}
                  style={{ 
                    borderColor: isActive ? color : `${color}60`,
                    ...(isActive && { ringColor: `${color}60` }),
                  }}
                >
                  {/* Active Mode Banner */}
                  {isActive && (
                    <div
                      className="px-3 py-1.5 flex items-center justify-between"
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <Sparkles size={12} />
                        ACTIVE MODE
                      </span>
                      {onExitMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onExitMode();
                          }}
                          className="text-xs text-white/80 hover:text-white"
                        >
                          Exit
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Scope Header */}
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer"
                    style={{ backgroundColor: `${color}15` }}
                    onClick={() => toggleScope(scope.id)}
                  >
                    <button className="p-0.5">
                      {isExpanded ? (
                        <ChevronDown size={14} style={{ color }} />
                      ) : (
                        <ChevronRight size={14} style={{ color }} />
                      )}
                    </button>
                    <span className="text-lg">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color }}
                        title={scope.assumption}
                      >
                        {scope.assumption}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {config.label} • {scopeNodes.length} nodes
                      </p>
                    </div>
                    {/* Enter Mode Button */}
                    {onEnterMode && !isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEnterMode(scope);
                        }}
                        className="p-1 rounded hover:bg-amber-100 text-gray-400 hover:text-amber-600 transition-colors"
                        title="Enter Hypothetical Mode"
                      >
                        <Sparkles size={14} />
                      </button>
                    )}
                    {onEditScope && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditScope(scope);
                        }}
                        className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({
                          scopeId: scope.id,
                          assumption: scope.assumption,
                          nodeCount: scopeNodes.length,
                        });
                      }}
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Scope Content */}
                  {isExpanded && (
                    <div className="p-2 space-y-1 bg-white">
                      {scopeNodes.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">
                          No nodes in this scope
                        </p>
                      ) : (
                        scopeNodes.map((node) => (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            onClick={() => onHighlightNode(node.id)}
                          >
                            <EpistemicStatusBadge
                              status={node.data.epistemicStatus || "HYPOTHETICAL"}
                              size="sm"
                              showLabel={false}
                            />
                            <span className="flex-1 text-xs text-gray-700 truncate">
                              {node.data.argument?.conclusion?.text ||
                                node.data.argument?.text?.substring(0, 50) ||
                                "Untitled"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAssignNodeToScope(node.id, null);
                              }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400"
                              title="Remove from scope"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                      
                      {/* Add node to scope button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full mt-1 flex items-center justify-center gap-1 p-1.5 text-xs text-gray-500 border border-dashed rounded hover:bg-gray-50 transition-colors">
                            <Plus size={12} />
                            Add node to scope
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto">
                          <DropdownMenuLabel className="text-xs">
                            Select a node
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {unassignedNodes.length === 0 ? (
                            <div className="p-2 text-xs text-gray-500">
                              All nodes are assigned
                            </div>
                          ) : (
                            unassignedNodes.map((node) => (
                              <DropdownMenuItem
                                key={node.id}
                                onClick={() => onAssignNodeToScope(node.id, scope.id)}
                                className="text-xs cursor-pointer"
                              >
                                {node.data.argument?.conclusion?.text ||
                                  node.data.argument?.text?.substring(0, 40) ||
                                  "Untitled"}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned Nodes Section */}
        {unassignedNodes.length > 0 && (
          <div className="p-2 border-t">
            <h4 className="text-xs font-medium text-gray-500 px-2 py-1">
              Unassigned Nodes ({unassignedNodes.length})
            </h4>
            <div className="space-y-1">
              {unassignedNodes.slice(0, 5).map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50"
                >
                  <span className="text-xs text-gray-600 flex-1 truncate">
                    {node.data.argument?.conclusion?.text ||
                      node.data.argument?.text?.substring(0, 40) ||
                      "Untitled"}
                  </span>
                  {scopes.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-gray-200 text-gray-400">
                          <Plus size={12} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel className="text-xs">
                          Assign to scope
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {scopes.map((scope) => {
                          const config = SCOPE_TYPE_CONFIG[scope.scopeType];
                          return (
                            <DropdownMenuItem
                              key={scope.id}
                              onClick={() => onAssignNodeToScope(node.id, scope.id)}
                              className="text-xs cursor-pointer gap-2"
                            >
                              <span>{config.icon}</span>
                              <span className="truncate max-w-[150px]">
                                {scope.assumption}
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
              {unassignedNodes.length > 5 && (
                <p className="text-xs text-gray-400 px-2">
                  +{unassignedNodes.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t bg-gray-50">
        <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
          Scope Types
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(SCOPE_TYPE_CONFIG) as ScopeType[]).map((type) => {
            const config = SCOPE_TYPE_CONFIG[type];
            return (
              <TooltipProvider key={type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{config.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scope?</DialogTitle>
            <DialogDescription>
              This will delete the scope &quot;{deleteConfirm?.assumption}&quot;.
              {deleteConfirm?.nodeCount && deleteConfirm.nodeCount > 0 && (
                <>
                  <br />
                  <br />
                  The {deleteConfirm.nodeCount} node(s) in this scope will be
                  moved back to the main chain with ASSERTED status.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  onDeleteScope(deleteConfirm.scopeId);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ScopesPanel;
