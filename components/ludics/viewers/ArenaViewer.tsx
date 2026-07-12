"use client";

/**
 * Phase 6 - Arena Viewer Component
 * 
 * Enhanced viewer for ludic arenas with:
 * - Position coloring by polarity
 * - Current path highlighting
 * - Available moves indication
 * - Interactive position selection
 * 
 * Integrates with Phase 5 API endpoints.
 */

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

type LudicAddress = number[];

interface ArenaMove {
  id: string;
  address: string;
  ramification: number[];
  player: "P" | "O";
  isInitial: boolean;
  content?: string;
}

interface ArenaPosition {
  address: LudicAddress;
  polarity: "+" | "-";
  player: "P" | "O";
  content?: string;
  children: ArenaPosition[];
  isHighlighted?: boolean;
  isOnPath?: boolean;
  isAvailable?: boolean;
  strength?: number;
}

interface DialogueAct {
  polarity: "+" | "-";
  focus: LudicAddress;
  ramification: LudicAddress[];
  expression: string;
  moveType?: string;
}

interface Arena {
  id: string;
  base: string;
  moves: ArenaMove[];
  deliberationId?: string;
  isUniversal?: boolean;
}

export interface ArenaViewerProps {
  /** Arena to display */
  arena?: Arena | null;
  /** Arena ID to fetch */
  arenaId?: string;
  /** Current path to highlight (accepts DialogueAct[] or move history array) */
  currentPath?: Array<DialogueAct | { address: string; player?: string }>;
  /** Positions to highlight */
  highlightedPositions?: LudicAddress[];
  /** Available moves to indicate */
  availableMoves?: LudicAddress[];
  /** Callback when position is clicked */
  onPositionClick?: (address: LudicAddress) => void;
  /** Show strength heat map overlay */
  showStrength?: boolean;
  /** Position strength data */
  strengthData?: Map<string, number>;
  /** View mode */
  mode?: "tree" | "flat" | "compact";
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ============================================================================
// HELPERS
// ============================================================================

function addressToKey(address: LudicAddress | string | undefined): string {
  if (address === undefined || address === null) return "∅";
  if (typeof address === "string") {
    return address === "" ? "∅" : address;
  }
  if (Array.isArray(address)) {
    return address.length === 0 ? "∅" : `[${address.join(",")}]`;
  }
  return String(address);
}

function keyToAddress(key: string): LudicAddress {
  const inner = key.slice(1, -1);
  if (!inner) return [];
  return inner.split(",").map(Number);
}

function parseAddressString(str: string): LudicAddress {
  if (!str || str === "⊢<>") return [];
  // Handle "ξ.0.1.2" format
  const parts = str.replace(/^ξ\.?/, "").split(".").filter(Boolean);
  return parts.map(Number);
}

function addressEquals(a: LudicAddress, b: LudicAddress): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function getPolarityFromDepth(depth: number): "+" | "-" {
  return depth % 2 === 0 ? "+" : "-";
}

function getPlayerFromPolarity(polarity: "+" | "-"): "P" | "O" {
  return polarity === "+" ? "P" : "O";
}

// ============================================================================
// BUILD TREE FROM MOVES
// ============================================================================

function buildPositionTree(
  moves: ArenaMove[],
  highlightedPositions: Set<string>,
  pathPositions: Set<string>,
  availableSet: Set<string>,
  strengthData?: Map<string, number>
): ArenaPosition {
  // Root position
  const root: ArenaPosition = {
    address: [],
    polarity: "+",
    player: "P",
    content: "Root",
    children: [],
    isHighlighted: highlightedPositions.has("[]"),
    isOnPath: pathPositions.has("[]"),
    isAvailable: availableSet.has("[]"),
    strength: strengthData?.get("[]"),
  };

  // Build map of positions
  const positionMap = new Map<string, ArenaPosition>();
  positionMap.set("[]", root);

  // Sort moves by address depth
  const sortedMoves = [...moves].sort(
    (a, b) => parseAddressString(a.address).length - parseAddressString(b.address).length
  );

  for (const move of sortedMoves) {
    const address = parseAddressString(move.address);
    const key = addressToKey(address);

    if (positionMap.has(key)) continue;

    const depth = address.length;
    const polarity = getPolarityFromDepth(depth);
    const player = getPlayerFromPolarity(polarity);

    const position: ArenaPosition = {
      address,
      polarity,
      player,
      content: move.content || `Move ${key}`,
      children: [],
      isHighlighted: highlightedPositions.has(key),
      isOnPath: pathPositions.has(key),
      isAvailable: availableSet.has(key),
      strength: strengthData?.get(key),
    };

    positionMap.set(key, position);

    // Find parent and attach
    const parentAddress = address.slice(0, -1);
    const parentKey = addressToKey(parentAddress);
    const parent = positionMap.get(parentKey) || root;
    parent.children.push(position);
  }

  return root;
}

// ============================================================================
// POSITION NODE COMPONENT
// ============================================================================

interface PositionNodeProps {
  position: ArenaPosition;
  onPositionClick?: (address: LudicAddress) => void;
  showStrength?: boolean;
  depth?: number;
}

function PositionNode({
  position,
  onPositionClick,
  showStrength,
  depth = 0,
}: PositionNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(depth < 3);
  const hasChildren = position.children.length > 0;

  // Color based on polarity
  const polarityColor = position.polarity === "+"
    ? "bg-blue-100 border-blue-300 text-blue-800"
    : "bg-orange-100 border-orange-300 text-orange-800";

  // Highlight styles
  const highlightStyle = position.isOnPath
    ? "ring-2 ring-green-500 ring-offset-1"
    : position.isHighlighted
    ? "ring-2 ring-yellow-500 ring-offset-1"
    : "";

  // Available move indicator
  const availableStyle = position.isAvailable
    ? "animate-pulse border-dashed border-2"
    : "";

  // Strength color (if showing heat map)
  const strengthStyle = showStrength && position.strength !== undefined
    ? { backgroundColor: `rgba(255, 0, 0, ${position.strength * 0.5})` }
    : {};

  return (
    <div className="pl-4">
      <div className="flex items-center gap-2 py-1">
        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-700"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}

        {/* Position node */}
        <button
          onClick={() => onPositionClick?.(position.address)}
          className={cn(
            "px-2 py-1 rounded border text-sm font-mono",
            "hover:shadow-md transition-all cursor-pointer",
            polarityColor,
            highlightStyle,
            availableStyle
          )}
          style={strengthStyle}
          title={`Address: ${addressToKey(position.address)}\nPolarity: ${position.polarity}\nPlayer: ${position.player}`}
        >
          <span className="font-bold mr-1">
            {position.polarity === "+" ? "⊕" : "⊖"}
          </span>
          {addressToKey(position.address)}
        </button>

        {/* Player badge */}
        <span
          className={cn(
            "text-xs px-1 rounded",
            position.player === "P" ? "bg-blue-200" : "bg-orange-200"
          )}
        >
          {position.player}
        </span>

        {/* Strength indicator */}
        {showStrength && position.strength !== undefined && (
          <span className="text-xs text-slate-500">
            ({(position.strength * 100).toFixed(0)}%)
          </span>
        )}

        {/* Content preview */}
        {position.content && (
          <span className="text-xs text-slate-500 truncate max-w-[200px]">
            {position.content}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="border-l border-slate-200 ml-2">
          {position.children.map((child, i) => (
            <PositionNode
              key={addressToKey(child.address)}
              position={child}
              onPositionClick={onPositionClick}
              showStrength={showStrength}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FLAT VIEW COMPONENT
// ============================================================================

interface FlatViewProps {
  positions: ArenaPosition[];
  onPositionClick?: (address: LudicAddress) => void;
  showStrength?: boolean;
}

function FlatView({ positions, onPositionClick, showStrength }: FlatViewProps) {
  // Flatten tree
  const flatList: ArenaPosition[] = [];
  function flatten(pos: ArenaPosition) {
    flatList.push(pos);
    pos.children.forEach(flatten);
  }
  positions.forEach(flatten);

  return (
    <div className="space-y-1 p-2">
      {flatList.map((pos) => (
        <div
          key={addressToKey(pos.address)}
          className={cn(
            "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-slate-50",
            pos.isOnPath && "bg-green-50",
            pos.isHighlighted && "bg-yellow-50",
            pos.isAvailable && "border border-dashed border-green-500"
          )}
          onClick={() => onPositionClick?.(pos.address)}
        >
          <span
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              pos.polarity === "+" ? "bg-blue-200 text-blue-800" : "bg-orange-200 text-orange-800"
            )}
          >
            {pos.polarity === "+" ? "+" : "-"}
          </span>
          <code className="text-sm">{addressToKey(pos.address)}</code>
          <span className="text-xs text-slate-500">{pos.player}</span>
          {showStrength && pos.strength !== undefined && (
            <span className="text-xs text-slate-400">
              {(pos.strength * 100).toFixed(0)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ArenaViewer({
  arena: propArena,
  arenaId,
  currentPath,
  highlightedPositions,
  availableMoves,
  onPositionClick,
  showStrength = false,
  strengthData,
  mode = "tree",
  className,
}: ArenaViewerProps) {
  // Fetch arena if arenaId provided and no arena prop
  const { data: fetchedArenaData, isLoading } = useSWR(
    arenaId && !propArena ? `/api/ludics/arenas/${arenaId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const arena = propArena || (fetchedArenaData?.ok ? fetchedArenaData.arena : null);

  // Build sets for quick lookup
  const highlightedSet = React.useMemo(() => {
    const set = new Set<string>();
    highlightedPositions?.forEach((addr) => set.add(addressToKey(addr)));
    return set;
  }, [highlightedPositions]);

  const pathSet = React.useMemo(() => {
    const set = new Set<string>();
    currentPath?.forEach((act: any) => {
      // Handle both DialogueAct (focus) and move history (address) formats
      const addr = act.focus ?? act.address;
      if (addr !== undefined) {
        set.add(addressToKey(addr));
      }
    });
    return set;
  }, [currentPath]);

  const availableSet = React.useMemo(() => {
    const set = new Set<string>();
    availableMoves?.forEach((addr) => set.add(addressToKey(addr)));
    return set;
  }, [availableMoves]);

  const strengthMap = React.useMemo(() => {
    return strengthData || new Map<string, number>();
  }, [strengthData]);

  // Build position tree
  const positionTree = React.useMemo(() => {
    if (!arena?.moves) return null;
    return buildPositionTree(
      arena.moves,
      highlightedSet,
      pathSet,
      availableSet,
      strengthMap
    );
  }, [arena?.moves, highlightedSet, pathSet, availableSet, strengthMap]);

  // Stats
  const stats = React.useMemo(() => {
    if (!arena?.moves) return null;
    const pMoves = arena.moves.filter((m: ArenaMove) => m.player === "P").length;
    const oMoves = arena.moves.filter((m: ArenaMove) => m.player === "O").length;
    return {
      total: arena.moves.length,
      pMoves,
      oMoves,
      pathLength: currentPath?.length || 0,
      highlighted: highlightedPositions?.length || 0,
      available: availableMoves?.length || 0,
    };
  }, [arena?.moves, currentPath, highlightedPositions, availableMoves]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        Loading arena...
      </div>
    );
  }

  // No arena
  if (!arena) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        No arena data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⊢</span>
            <span className="font-bold">Arena Viewer</span>
            {arena.id && (
              <code className="text-xs bg-white px-1 rounded">{arena.id.slice(0, 8)}...</code>
            )}
          </div>
          {stats && (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>
                <span className="font-medium text-blue-600">{stats.pMoves}</span> P
              </span>
              <span>
                <span className="font-medium text-orange-600">{stats.oMoves}</span> O
              </span>
              <span>
                <span className="font-medium">{stats.total}</span> total
              </span>
              {stats.pathLength > 0 && (
                <span className="text-green-600">
                  Path: {stats.pathLength}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200" /> Positive (+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-200" /> Negative (-)
          </span>
          {currentPath && currentPath.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded ring-2 ring-green-500" /> On path
            </span>
          )}
          {availableMoves && availableMoves.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border-2 border-dashed border-green-500" /> Available
            </span>
          )}
        </div>
      </div>

      {/* Tree/Flat View */}
      <div className="border rounded-lg bg-white overflow-auto max-h-[500px]">
        {mode === "tree" && positionTree && (
          <PositionNode
            position={positionTree}
            onPositionClick={onPositionClick}
            showStrength={showStrength}
          />
        )}
        {mode === "flat" && positionTree && (
          <FlatView
            positions={[positionTree]}
            onPositionClick={onPositionClick}
            showStrength={showStrength}
          />
        )}
      </div>
    </div>
  );
}

export default ArenaViewer;
