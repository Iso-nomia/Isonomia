"use client";

/**
 * DDS Phase 3 - Position Explorer
 * 
 * Explores and displays legal positions in an arena.
 */

import * as React from "react";
import useSWR from "swr";
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
  moves: ArenaMove[];
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

interface PositionExplorerProps {
  arena: UniversalArena;
  onSelectPosition?: (position: LegalPosition | null) => void;
  maxDepth?: number;
  className?: string;
}

export function PositionExplorer({
  arena,
  onSelectPosition,
  maxDepth = 4,
  className,
}: PositionExplorerProps) {
  const [selectedDepth, setSelectedDepth] = React.useState(2);
  const [positions, setPositions] = React.useState<LegalPosition[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPosition, setCurrentPosition] = React.useState<LegalPosition | null>(null);
  const [availableMoves, setAvailableMoves] = React.useState<ArenaMove[]>([]);

  // Initialize with empty position
  React.useEffect(() => {
    const emptyPosition: LegalPosition = {
      id: "empty",
      arenaId: arena.id,
      sequence: [],
      currentPlayer: "P",
      isTerminal: false,
    };
    setCurrentPosition(emptyPosition);
    
    // Get initial moves (moves with depth 1)
    const initialMoves = arena.moves.filter((m) => !m.address.includes("."));
    setAvailableMoves(initialMoves);
  }, [arena]);

  // Enumerate positions up to depth
  const enumeratePositions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ludics/dds/arena/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arenaId: arena.id,
          maxDepth: selectedDepth,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error("Failed to enumerate positions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Make a move from current position
  const makeMove = async (move: ArenaMove) => {
    if (!currentPosition) return;

    const newSequence = [...currentPosition.sequence, move];
    const newPlayer = move.player === "P" ? "O" : "P";

    // Find available moves for new position
    const newAvailable = arena.moves.filter((m) => {
      // Must be opposite player
      if (m.player !== newPlayer) return false;
      
      // Check if enabled by the move just played
      // Simplified: check if address is a child of any address in sequence
      const isEnabled = newSequence.some((seqMove) => {
        return m.address.startsWith(seqMove.address + ".") || 
               seqMove.ramification.some((r) => m.address === `${seqMove.address}.${r}`);
      });
      
      // Or is initial
      return isEnabled || !m.address.includes(".");
    });

    // Check if already visited this address
    const visitedAddresses = new Set(newSequence.map((m) => m.address));
    const filteredAvailable = newAvailable.filter((m) => !visitedAddresses.has(m.address));

    const newPosition: LegalPosition = {
      id: `pos-${newSequence.map((m) => m.id).join("-")}`,
      arenaId: arena.id,
      sequence: newSequence,
      currentPlayer: newPlayer,
      isTerminal: filteredAvailable.length === 0,
    };

    setCurrentPosition(newPosition);
    setAvailableMoves(filteredAvailable);
    onSelectPosition?.(newPosition);
  };

  // Reset to empty position
  const reset = () => {
    const emptyPosition: LegalPosition = {
      id: "empty",
      arenaId: arena.id,
      sequence: [],
      currentPlayer: "P",
      isTerminal: false,
    };
    setCurrentPosition(emptyPosition);
    const initialMoves = arena.moves.filter((m) => !m.address.includes("."));
    setAvailableMoves(initialMoves);
    onSelectPosition?.(null);
  };

  // Undo last move
  const undo = () => {
    if (!currentPosition || currentPosition.sequence.length === 0) return;

    const newSequence = currentPosition.sequence.slice(0, -1);
    if (newSequence.length === 0) {
      reset();
      return;
    }

    const lastMove = newSequence[newSequence.length - 1];
    const newPlayer = lastMove.player === "P" ? "O" : "P";

    // Recalculate available moves
    const visitedAddresses = new Set(newSequence.map((m) => m.address));
    const newAvailable = arena.moves.filter((m) => {
      if (m.player !== newPlayer) return false;
      if (visitedAddresses.has(m.address)) return false;
      // Simplified enabling check
      return true;
    });

    const newPosition: LegalPosition = {
      id: `pos-${newSequence.map((m) => m.id).join("-")}`,
      arenaId: arena.id,
      sequence: newSequence,
      currentPlayer: newPlayer,
      isTerminal: false,
    };

    setCurrentPosition(newPosition);
    setAvailableMoves(newAvailable);
    onSelectPosition?.(newPosition);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Position Explorer</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            Reset
          </button>
          <button
            onClick={undo}
            disabled={!currentPosition || currentPosition.sequence.length === 0}
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      </div>

      {/* Current Position */}
      <div className="bg-slate-50 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">
            Current Position (length: {currentPosition?.sequence.length || 0})
          </div>
          <div
            className={cn(
              "px-2 py-1 rounded text-sm font-medium",
              currentPosition?.currentPlayer === "P"
                ? "bg-blue-100 text-blue-700"
                : "bg-rose-100 text-rose-700"
            )}
          >
            {currentPosition?.currentPlayer}'s turn
          </div>
        </div>

        {/* Position Sequence */}
        <div className="flex flex-wrap gap-1 mb-4 min-h-[32px]">
          {currentPosition?.sequence.length === 0 ? (
            <span className="text-slate-400 text-sm italic">Empty position (initial)</span>
          ) : (
            currentPosition?.sequence.map((move, idx) => (
              <span
                key={idx}
                className={cn(
                  "px-2 py-1 rounded text-xs font-mono",
                  move.player === "P"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-rose-100 text-rose-700"
                )}
              >
                {idx + 1}. {move.address}
              </span>
            ))
          )}
        </div>

        {/* Terminal State */}
        {currentPosition?.isTerminal && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center text-sm">
            <span className="font-medium text-amber-700">Terminal Position</span>
            <span className="text-amber-600 ml-2">— No more moves available</span>
          </div>
        )}

        {/* Available Moves */}
        {!currentPosition?.isTerminal && (
          <div>
            <div className="text-sm text-slate-600 mb-2">
              Available moves ({availableMoves.length}):
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
              {availableMoves.map((move) => (
                <button
                  key={move.id}
                  onClick={() => makeMove(move)}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm font-mono border transition-colors",
                    move.player === "P"
                      ? "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700"
                      : "border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                  )}
                >
                  {move.address}
                  {move.ramification.length > 0 && (
                    <span className="text-xs opacity-70 ml-1">
                      [{move.ramification.join(",")}]
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Batch Enumerate */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-sm text-slate-600">Enumerate positions up to depth:</span>
          <input
            type="range"
            min={1}
            max={Math.min(maxDepth, 6)}
            value={selectedDepth}
            onChange={(e) => setSelectedDepth(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm font-medium w-4">{selectedDepth}</span>
          <button
            onClick={enumeratePositions}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Loading..." : "Enumerate"}
          </button>
        </div>

        {/* Position List */}
        {positions.length > 0 && (
          <div className="bg-white border rounded-lg max-h-48 overflow-auto">
            <div className="text-xs text-slate-500 p-2 border-b bg-slate-50 sticky top-0">
              Found {positions.length} positions
            </div>
            {positions.slice(0, 50).map((pos) => (
              <div
                key={pos.id}
                onClick={() => {
                  setCurrentPosition(pos);
                  onSelectPosition?.(pos);
                }}
                className="px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">len={pos.sequence.length}</span>
                  <span className="text-sm font-mono">
                    {pos.sequence.map((m) => m.address).join(" → ") || "(empty)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      pos.currentPlayer === "P" ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                    )}
                  >
                    {pos.currentPlayer}
                  </span>
                  {pos.isTerminal && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">
                      terminal
                    </span>
                  )}
                </div>
              </div>
            ))}
            {positions.length > 50 && (
              <div className="text-center text-xs text-slate-500 py-2">
                ... and {positions.length - 50} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PositionExplorer;
