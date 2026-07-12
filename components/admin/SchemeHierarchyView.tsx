// components/admin/SchemeHierarchyView.tsx
// Phase 6D: Tree visualization for scheme hierarchies and clustering
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, ChevronRight, Network, Filter, RefreshCw } from "lucide-react";

type Scheme = {
  id: string;
  key: string;
  name: string;
  summary: string;
  parentSchemeId: string | null;
  clusterTag: string | null;
  cq: any;
};

type TreeNode = {
  scheme: Scheme;
  children: TreeNode[];
  depth: number;
  ownCQCount: number;
  inheritedCQCount: number;
};

export default function SchemeHierarchyView() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [clusterFilter, setClusterFilter] = useState<string>("");
  const [showOnlyRoots, setShowOnlyRoots] = useState(false);

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schemes");
      if (!res.ok) throw new Error("Failed to fetch schemes");
      const data = await res.json();
      setSchemes(data.items || data.schemes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (schemes: Scheme[]): TreeNode[] => {
    // Filter by cluster if specified
    let filtered = schemes;
    if (clusterFilter) {
      filtered = schemes.filter(s => 
        s.clusterTag?.toLowerCase().includes(clusterFilter.toLowerCase())
      );
    }

    // Build a map of scheme id to scheme
    const schemeMap = new Map(filtered.map(s => [s.id, s]));

    // Build tree starting from roots
    const roots: TreeNode[] = [];
    const visited = new Set<string>();

    const buildNode = (scheme: Scheme, depth: number): TreeNode => {
      visited.add(scheme.id);

      // Count CQs
      const ownCQCount = Array.isArray(scheme.cq) ? scheme.cq.length : 0;

      // Find children
      const children = filtered
        .filter(s => s.parentSchemeId === scheme.id && !visited.has(s.id))
        .map(child => buildNode(child, depth + 1));

      // Phase 3 step 13: inheritance is unconditional whenever a parent edge
      // exists; the per-row opt-out (`inheritCQs`) has been retired. The actual
      // count is computed server-side in /api/schemes (totalCQCount).
      const inheritedCQCount = scheme.parentSchemeId ? 0 : 0;

      return {
        scheme,
        children,
        depth,
        ownCQCount,
        inheritedCQCount,
      };
    };

    // Find all root schemes (no parent or parent not in filtered set)
    const rootSchemes = filtered.filter(s => 
      !s.parentSchemeId || !schemeMap.has(s.parentSchemeId)
    );

    // Build tree from each root
    rootSchemes.forEach(root => {
      if (!visited.has(root.id)) {
        roots.push(buildNode(root, 0));
      }
    });

    return roots;
  };

  const toggleNode = (schemeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(schemeId)) {
        next.delete(schemeId);
      } else {
        next.add(schemeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNodes(new Set(schemes.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const renderTree = (nodes: TreeNode[]) => {
    return (
      <div className="space-y-1">
        {nodes.map(node => (
          <TreeNodeComponent
            key={node.scheme.id}
            node={node}
            expanded={expandedNodes.has(node.scheme.id)}
            onToggle={() => toggleNode(node.scheme.id)}
          />
        ))}
      </div>
    );
  };

  const TreeNodeComponent = ({ 
    node, 
    expanded, 
    onToggle 
  }: { 
    node: TreeNode; 
    expanded: boolean; 
    onToggle: () => void;
  }) => {
    const hasChildren = node.children.length > 0;
    const indentStyle = { paddingLeft: `${node.depth * 24}px` };

    return (
      <div>
        <div
          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer group"
          style={indentStyle}
        >
          {/* Expand/collapse icon */}
          <button
            onClick={onToggle}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded"
            disabled={!hasChildren}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-600" />
              )
            ) : (
              <span className="w-4 h-4" />
            )}
          </button>

          {/* Depth indicator */}
          {node.depth === 0 ? (
            <span className="text-purple-600 font-bold text-sm">●</span>
          ) : (
            <span
              className="flex  text-slate-600 font-medium items-center text-sm"
              style={{ paddingLeft: `${node.depth * 24}px` }}
            >
              ↳
            </span>
          )}

          {/* Scheme info */}
          <div className="flex-1 flex items-center pt-1.5 gap-2">
            <span className="font-medium text-sm">{node.scheme.name}</span>
            <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {node.scheme.key}
            </code>

            {/* CQ counts */}
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">
                {node.ownCQCount} CQ{node.ownCQCount !== 1 ? "s" : ""}
              </Badge>
              {node.scheme.parentSchemeId && (
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">
                  +inherited
                </Badge>
              )}
            </div>

            {/* Cluster tag */}
            {node.scheme.clusterTag && (
              <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700">
                {node.scheme.clusterTag}
              </Badge>
            )}

            {/* Child count */}
            {hasChildren && (
              <span className="text-xs text-slate-500">
                ({node.children.length} child{node.children.length !== 1 ? "ren" : ""})
              </span>
            )}
          </div>
        </div>

        {/* Children */}
        {expanded && hasChildren && renderTree(node.children)}
      </div>
    );
  };

  const tree = buildTree(schemes);

  // Get unique cluster tags
  const clusterTags = Array.from(
    new Set(schemes.map(s => s.clusterTag).filter(Boolean))
  );

  const rootCount = schemes.filter(s => !s.parentSchemeId).length;
  const childCount = schemes.filter(s => s.parentSchemeId).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Loading scheme hierarchy...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-600">
            <p className="font-medium">Error loading schemes</p>
            <p className="text-sm mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSchemes}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-600" />
              Scheme Hierarchy
            </CardTitle>
            <CardDescription>
              Argumentation scheme families and parent-child relationships (Phase 6: Macagno & Walton)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchemes}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg border">
          <div>
            <div className="text-xs text-slate-500">Total Schemes</div>
            <div className="text-2xl font-bold text-slate-700">{schemes.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Root Schemes</div>
            <div className="text-2xl font-bold text-purple-600">{rootCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Child Schemes</div>
            <div className="text-2xl font-bold text-indigo-600">{childCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cluster Families</div>
            <div className="text-2xl font-bold text-sky-600">{clusterTags.length}</div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex items-end gap-4 p-3 border rounded-lg">
          <div className="flex-1">
            <Label htmlFor="clusterFilter" className="text-xs">
              <Filter className="h-3 w-3 inline mr-1" />
              Filter by Cluster
            </Label>
            <Input
              id="clusterFilter"
              placeholder="e.g., practical_reasoning_family"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="mt-1"
              list="cluster-options"
            />
            <datalist id="cluster-options">
              {clusterTags.map(tag => (
                <option key={tag || ""} value={tag || ""} />
              ))}
            </datalist>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
            >
              Collapse All
            </Button>
          </div>
        </div>

        {/* Tree View */}
        <div className="border rounded-lg p-4 bg-white max-h-[600px] overflow-y-auto">
          {tree.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Network className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No schemes found</p>
              {clusterFilter && (
                <p className="text-sm mt-1">Try clearing the cluster filter</p>
              )}
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex gap-6 mb-4 pb-3 border-b text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-600 font-bold">●</span>
                  <span>Root Scheme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">↳</span>
                  <span>Child Scheme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">
                    +inherited
                  </Badge>
                  <span>Inherits parent CQs</span>
                </div>
              </div>

              {/* Tree */}
              {renderTree(tree)}
            </>
          )}
        </div>

        {/* Cluster Summary */}
        {clusterTags.length > 0 && !clusterFilter && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Cluster Families</h4>
            <div className="flex flex-wrap gap-2">
              {clusterTags.map(tag => {
                const count = schemes.filter(s => s.clusterTag === tag).length;
                return (
                  <button
                    key={tag}
                    onClick={() => setClusterFilter(tag!)}
                    className="px-3 py-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-md border border-sky-200 transition-colors"
                  >
                    {tag} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
