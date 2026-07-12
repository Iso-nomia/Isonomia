"use client";

/**
 * DDS Phase 3 - Arena Tree View
 * 
 * Visualizes the arena as a tree structure based on address hierarchy.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type ArenaMove = {
  id: string;
  address: string;
  ramification: number[];
  player: "P" | "O";
  isInitial: boolean;
};

type UniversalArena = {
  id: string;
  base: string;
  isUniversal: boolean;
  moves: ArenaMove[];
};

type TreeNode = {
  move: ArenaMove | null;
  address: string;
  children: TreeNode[];
  depth: number;
};

interface ArenaTreeViewProps {
  arena: UniversalArena;
  selectedMoveId?: string | null;
  highlightedMoves?: Set<string>;
  onSelectMove?: (moveId: string | null) => void;
  className?: string;
  maxDisplayDepth?: number;
}

export function ArenaTreeView({
  arena,
  selectedMoveId,
  highlightedMoves,
  onSelectMove,
  className,
  maxDisplayDepth = 5,
}: ArenaTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set(["root"]));
  const [hoveredMove, setHoveredMove] = React.useState<string | null>(null);

  // Build tree structure from moves
  const tree = React.useMemo(() => {
    const root: TreeNode = { move: null, address: "root", children: [], depth: 0 };
    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set("root", root);

    // Sort moves by address depth
    const sortedMoves = [...arena.moves].sort(
      (a, b) => a.address.split(".").length - b.address.split(".").length
    );

    for (const move of sortedMoves) {
      const parts = move.address.split(".");
      const parentAddress = parts.length > 1 ? parts.slice(0, -1).join(".") : "root";

      // Ensure parent exists
      let parent = nodeMap.get(parentAddress);
      if (!parent) {
        // Create virtual parent node
        parent = {
          move: null,
          address: parentAddress,
          children: [],
          depth: parts.length - 1,
        };
        nodeMap.set(parentAddress, parent);

        // Add to its parent
        const grandParentAddress = parts.length > 2 ? parts.slice(0, -2).join(".") : "root";
        const grandParent = nodeMap.get(grandParentAddress) || root;
        grandParent.children.push(parent);
      }

      // Create node for this move
      const node: TreeNode = {
        move,
        address: move.address,
        children: [],
        depth: parts.length,
      };
      nodeMap.set(move.address, node);
      parent.children.push(node);
    }

    // Sort children by address
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => a.address.localeCompare(b.address));
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root;
  }, [arena.moves]);

  const toggleExpanded = (address: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>(["root"]);
    const addAll = (node: TreeNode) => {
      all.add(node.address);
      node.children.forEach(addAll);
    };
    addAll(tree);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set(["root"]));
  };

  return (
    <div className={cn("bg-white rounded-lg border", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-slate-50">
        <div className="text-sm font-medium text-slate-600">Arena Tree</div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs bg-white border rounded hover:bg-slate-50"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs bg-white border rounded hover:bg-slate-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="p-4 overflow-auto max-h-[500px]">
        <TreeNodeComponent
          node={tree}
          expandedNodes={expandedNodes}
          selectedMoveId={selectedMoveId}
          highlightedMoves={highlightedMoves}
          hoveredMove={hoveredMove}
          maxDisplayDepth={maxDisplayDepth}
          onToggle={toggleExpanded}
          onSelect={onSelectMove}
          onHover={setHoveredMove}
          isRoot
        />
      </div>
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  expandedNodes: Set<string>;
  selectedMoveId?: string | null;
  highlightedMoves?: Set<string>;
  hoveredMove: string | null;
  maxDisplayDepth: number;
  onToggle: (address: string) => void;
  onSelect?: (moveId: string | null) => void;
  onHover: (moveId: string | null) => void;
  isRoot?: boolean;
}

function TreeNodeComponent({
  node,
  expandedNodes,
  selectedMoveId,
  highlightedMoves,
  hoveredMove,
  maxDisplayDepth,
  onToggle,
  onSelect,
  onHover,
  isRoot,
}: TreeNodeComponentProps) {
  const isExpanded = expandedNodes.has(node.address);
  const hasChildren = node.children.length > 0;
  const isSelected = node.move?.id === selectedMoveId;
  const isHighlighted = node.move?.id && highlightedMoves?.has(node.move.id);
  const isHovered = node.move?.id === hoveredMove;
  const isTooDeep = node.depth > maxDisplayDepth;

  if (isTooDeep && !isRoot) {
    return null;
  }

  return (
    <div className="select-none">
      {/* Node Content */}
      {!isRoot && (
        <div
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors",
            isSelected && "bg-blue-100 ring-2 ring-blue-400",
            isHighlighted && !isSelected && "bg-amber-50",
            isHovered && !isSelected && "bg-slate-100",
          )}
          onClick={() => onSelect?.(node.move?.id || null)}
          onMouseEnter={() => onHover(node.move?.id || null)}
          onMouseLeave={() => onHover(null)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.address);
              }}
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-5 h-5 flex items-center justify-center text-slate-300">•</span>
          )}

          {/* Move Info */}
          {node.move ? (
            <>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  node.move.player === "P"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-rose-100 text-rose-700"
                )}
              >
                {node.move.player}
              </span>
              <code className="text-sm font-mono">{node.address}</code>
              {node.move.ramification.length > 0 && (
                <span className="text-xs text-slate-500 font-mono">
                  [{node.move.ramification.join(",")}]
                </span>
              )}
              {node.move.isInitial && (
                <span className="text-xs bg-green-100 text-green-700 px-1 rounded">init</span>
              )}
            </>
          ) : (
            <code className="text-sm font-mono text-slate-400">{node.address}</code>
          )}

          {/* Children count badge */}
          {hasChildren && !isExpanded && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 rounded-full">
              {node.children.length}
            </span>
          )}
        </div>
      )}

      {/* Root label */}
      {isRoot && (
        <div className="flex items-center gap-2 py-1 px-2 text-slate-600">
          <button
            onClick={() => onToggle(node.address)}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
          <span className="font-medium">⊢ Root</span>
          <span className="text-xs text-slate-400">({node.children.length} initial moves)</span>
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className={cn("ml-4 border-l-2 border-slate-200 pl-2", isRoot && "ml-2")}>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.address}
              node={child}
              expandedNodes={expandedNodes}
              selectedMoveId={selectedMoveId}
              highlightedMoves={highlightedMoves}
              hoveredMove={hoveredMove}
              maxDisplayDepth={maxDisplayDepth}
              onToggle={onToggle}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ArenaTreeView;
