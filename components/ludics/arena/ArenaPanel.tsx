"use client";

/**
 * DDS Phase 3 - Arena Panel
 * 
 * Main panel for viewing and interacting with Universal Arenas.
 * Based on Faggian & Hyland Definition 3.1.
 */

import * as React from "react";
import useSWR from "swr";
import { ArenaTreeView } from "./ArenaTreeView";
import { PositionExplorer } from "./PositionExplorer";
import { PositionDetailPanel } from "./PositionDetailPanel";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  delocalizationAddress?: string;
  moves: ArenaMove[];
  deliberationId?: string;
};

type LegalPosition = {
  id: string;
  arenaId: string;
  sequence: ArenaMove[];
  currentPlayer: "P" | "O";
  isTerminal: boolean;
  pView?: ArenaMove[];
  oView?: ArenaMove[];
};

type ViewMode = "tree" | "list" | "stats";

interface ArenaPanelProps {
  deliberationId: string;
  arenaId?: string;
  selectedBehaviourId?: string;
  className?: string;
  onArenaChange?: (arena: UniversalArena | null) => void;
  /** Called when user selects an arena */
  onArenaSelect?: (arenaId: string) => void;
  /** Currently selected arena ID (for highlighting) */
  selectedArenaId?: string | null;
}

export function ArenaPanel({
  deliberationId,
  arenaId,
  selectedBehaviourId,
  className,
  onArenaChange,
  onArenaSelect,
  selectedArenaId,
}: ArenaPanelProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("tree");
  const [selectedPosition, setSelectedPosition] = React.useState<LegalPosition | null>(null);
  const [selectedMoveId, setSelectedMoveId] = React.useState<string | null>(null);
  const [arenaConfig, setArenaConfig] = React.useState({
    maxDepth: 4,
    maxRamification: 3,
  });
  const [isCreating, setIsCreating] = React.useState(false);

  // Fetch arena if arenaId provided
  const { data: arenaData, mutate: refetchArena } = useSWR(
    arenaId ? `/api/ludics/dds/arena?arenaId=${arenaId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const arena: UniversalArena | null = arenaData?.ok ? arenaData.arena : null;

  // Notify parent of arena changes
  React.useEffect(() => {
    onArenaChange?.(arena);
    if (arena?.id) {
      onArenaSelect?.(arena.id);
    }
  }, [arena, onArenaChange, onArenaSelect]);

  // Create new arena
  const createArena = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/ludics/dds/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          behaviourId: selectedBehaviourId,
          maxDepth: arenaConfig.maxDepth,
          maxRamification: arenaConfig.maxRamification,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        refetchArena();
      }
    } catch (err) {
      console.error("Failed to create arena:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // Compute stats
  const stats = React.useMemo(() => {
    if (!arena) return null;
    const pMoves = arena.moves.filter((m) => m.player === "P").length;
    const oMoves = arena.moves.filter((m) => m.player === "O").length;
    const maxDepth = Math.max(...arena.moves.map((m) => m.address.split(".").length), 0);
    const avgRamification = arena.moves.length > 0
      ? arena.moves.reduce((sum, m) => sum + m.ramification.length, 0) / arena.moves.length
      : 0;

    return { pMoves, oMoves, maxDepth, avgRamification, total: arena.moves.length };
  }, [arena]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Arena Info Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="text-xl">⊢</span>
              Universal Arena
            </h3>
            {arena ? (
              <div className="text-sm text-slate-600 mt-1">
                Base: <code className="bg-white px-1 rounded">{arena.base || "⊢<>"}</code>
                {" | "}
                Moves: <span className="font-medium">{arena.moves.length}</span>
                {" | "}
                {arena.isUniversal ? (
                  <span className="text-green-600">Universal</span>
                ) : (
                  <span className="text-amber-600">Atomic ({arena.delocalizationAddress})</span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 mt-1">No arena loaded</div>
            )}
          </div>

          {/* Arena Creation Controls */}
          {!arena && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-600">Depth:</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={arenaConfig.maxDepth}
                  onChange={(e) =>
                    setArenaConfig((c) => ({ ...c, maxDepth: parseInt(e.target.value) || 4 }))
                  }
                  className="w-14 px-2 py-1 border rounded text-center"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-600">Ram:</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={arenaConfig.maxRamification}
                  onChange={(e) =>
                    setArenaConfig((c) => ({ ...c, maxRamification: parseInt(e.target.value) || 3 }))
                  }
                  className="w-14 px-2 py-1 border rounded text-center"
                />
              </div>
              <button
                onClick={createArena}
                disabled={isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreating ? "Creating..." : "Create Arena"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="Total Moves" value={stats.total} color="slate" />
          <StatCard label="P Moves" value={stats.pMoves} color="blue" />
          <StatCard label="O Moves" value={stats.oMoves} color="rose" />
          <StatCard label="Max Depth" value={stats.maxDepth} color="purple" />
          <StatCard label="Avg Ram" value={stats.avgRamification.toFixed(1)} color="amber" />
        </div>
      )}

      {/* View Mode Tabs */}
      {arena && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {(["tree", "list", "stats"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === mode
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {mode === "tree" ? "🌲 Tree" : mode === "list" ? "📋 List" : "📊 Stats"}
            </button>
          ))}
        </div>
      )}

      {/* Arena Visualization */}
      {arena && viewMode === "tree" && (
        <ArenaTreeView
          arena={arena}
          selectedMoveId={selectedMoveId}
          onSelectMove={setSelectedMoveId}
        />
      )}

      {arena && viewMode === "list" && (
        <div className="bg-white rounded-lg border p-4 max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2">Address</th>
                <th className="text-left p-2">Player</th>
                <th className="text-left p-2">Ramification</th>
                <th className="text-left p-2">Initial</th>
              </tr>
            </thead>
            <tbody>
              {arena.moves.map((move) => (
                <tr
                  key={move.id}
                  onClick={() => setSelectedMoveId(move.id)}
                  className={cn(
                    "cursor-pointer hover:bg-slate-50 border-b",
                    selectedMoveId === move.id && "bg-blue-50"
                  )}
                >
                  <td className="p-2 font-mono">{move.address}</td>
                  <td className="p-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        move.player === "P" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                      )}
                    >
                      {move.player}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-slate-600">
                    [{move.ramification.join(", ")}]
                  </td>
                  <td className="p-2">{move.isInitial ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {arena && viewMode === "stats" && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">Arena Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h5 className="text-sm text-slate-500 mb-2">Move Distribution by Depth</h5>
              <DepthDistribution moves={arena.moves} />
            </div>
            <div>
              <h5 className="text-sm text-slate-500 mb-2">Ramification Distribution</h5>
              <RamificationDistribution moves={arena.moves} />
            </div>
          </div>
        </div>
      )}

      {/* Position Explorer */}
      {arena && (
        <div className="border-t pt-4">
          <PositionExplorer
            arena={arena}
            onSelectPosition={setSelectedPosition}
          />
        </div>
      )}

      {/* Selected Position Details */}
      {selectedPosition && arena && (
        <PositionDetailPanel position={selectedPosition} arena={arena} />
      )}
    </div>
  );
}

// Helper Components

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "slate" | "blue" | "rose" | "purple" | "amber";
}) {
  const colorClasses = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={cn("rounded-lg p-3 text-center", colorClasses[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function DepthDistribution({ moves }: { moves: ArenaMove[] }) {
  const distribution = React.useMemo(() => {
    const counts: Record<number, number> = {};
    moves.forEach((m) => {
      const depth = m.address.split(".").length;
      counts[depth] = (counts[depth] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([d, c]) => ({ depth: parseInt(d), count: c }))
      .sort((a, b) => a.depth - b.depth);
  }, [moves]);

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-1">
      {distribution.map(({ depth, count }) => (
        <div key={depth} className="flex items-center gap-2">
          <span className="text-xs w-8">d={depth}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded"
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

function RamificationDistribution({ moves }: { moves: ArenaMove[] }) {
  const distribution = React.useMemo(() => {
    const counts: Record<number, number> = {};
    moves.forEach((m) => {
      const ram = m.ramification.length;
      counts[ram] = (counts[ram] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([r, c]) => ({ ram: parseInt(r), count: c }))
      .sort((a, b) => a.ram - b.ram);
  }, [moves]);

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-1">
      {distribution.map(({ ram, count }) => (
        <div key={ram} className="flex items-center gap-2">
          <span className="text-xs w-12">ram={ram}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded"
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default ArenaPanel;
