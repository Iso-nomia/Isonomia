"use client";

/**
 * DDS Phase 3 - Winning Analysis Panel
 * 
 * Analyze positions, moves, and game balance.
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

type LudicsGame = {
  id: string;
  arena: {
    id: string;
    moves: ArenaMove[];
  };
  strategies: any[];
};

type GamePlayState = {
  gameId: string;
  currentPosition: {
    sequence: ArenaMove[];
    currentPlayer: "P" | "O";
    isTerminal: boolean;
  };
  status: string;
  moveLog: any[];
};

type PositionAnalysis = {
  currentPlayer: "P" | "O";
  availableMoves: number;
  topMoves: Array<{
    address: string;
    ramification: number[];
    player: "P" | "O";
    score: number;
    isInitial: boolean;
  }>;
  positionType: "terminal" | "active";
};

interface WinningAnalysisPanelProps {
  game: LudicsGame;
  gameState?: GamePlayState | null;
}

export function WinningAnalysisPanel({ game, gameState }: WinningAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [positionAnalysis, setPositionAnalysis] = React.useState<PositionAnalysis | null>(null);
  const [moveTree, setMoveTree] = React.useState<Map<string, ArenaMove[]>>(new Map());
  const [selectedDepth, setSelectedDepth] = React.useState<number | null>(null);
  const [balanceStats, setBalanceStats] = React.useState<{
    pAdvantage: number;
    oAdvantage: number;
    balanced: boolean;
  } | null>(null);

  // Build move tree on mount
  React.useEffect(() => {
    if (!game.arena?.moves) return;

    const tree = new Map<string, ArenaMove[]>();
    const depths = new Set<number>();

    for (const move of game.arena.moves) {
      const depth = move.address.length;
      depths.add(depth);
      
      if (!tree.has(String(depth))) {
        tree.set(String(depth), []);
      }
      tree.get(String(depth))!.push(move);
    }

    setMoveTree(tree);
    
    // Calculate balance
    const pMoves = game.arena.moves.filter(m => m.player === "P").length;
    const oMoves = game.arena.moves.filter(m => m.player === "O").length;
    const total = pMoves + oMoves;
    
    if (total > 0) {
      const pRatio = pMoves / total;
      const oRatio = oMoves / total;
      setBalanceStats({
        pAdvantage: pRatio,
        oAdvantage: oRatio,
        balanced: Math.abs(pRatio - oRatio) < 0.1,
      });
    }
  }, [game.arena]);

  // Analyze current position
  const analyzePosition = async () => {
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/ludics/dds/games/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_position",
          gameId: game.id,
          arenaConfig: game.arena,
          position: gameState?.currentPosition,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPositionAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get moves at specific depth
  const getMovesAtDepth = (depth: number): ArenaMove[] => {
    return moveTree.get(String(depth)) || [];
  };

  // Get all depths
  const getAllDepths = (): number[] => {
    return Array.from(moveTree.keys())
      .map(k => parseInt(k))
      .sort((a, b) => a - b);
  };

  // Count total branches from a move
  const countBranches = (address: string): number => {
    return game.arena.moves.filter(m => 
      m.address.startsWith(address) && m.address !== address
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border text-center">
          <div className="text-3xl font-bold">{game.arena.moves?.length || 0}</div>
          <div className="text-xs text-slate-500">Total Moves</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border text-center">
          <div className="text-3xl font-bold text-blue-700">
            {game.arena.moves?.filter(m => m.player === "P").length || 0}
          </div>
          <div className="text-xs text-blue-500">P Moves</div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg p-4 border text-center">
          <div className="text-3xl font-bold text-rose-700">
            {game.arena.moves?.filter(m => m.player === "O").length || 0}
          </div>
          <div className="text-xs text-rose-500">O Moves</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border text-center">
          <div className="text-3xl font-bold text-amber-700">
            {getAllDepths().length}
          </div>
          <div className="text-xs text-amber-500">Depth Levels</div>
        </div>
      </div>

      {/* Balance Indicator */}
      {balanceStats && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Game Balance</h4>
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              balanceStats.balanced 
                ? "bg-green-100 text-green-700" 
                : "bg-amber-100 text-amber-700"
            )}>
              {balanceStats.balanced ? "✓ Balanced" : "⚠ Unbalanced"}
            </span>
          </div>
          
          <div className="h-6 rounded-lg overflow-hidden flex bg-slate-200">
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all"
              style={{ width: `${balanceStats.pAdvantage * 100}%` }}
            >
              P {(balanceStats.pAdvantage * 100).toFixed(0)}%
            </div>
            <div
              className="bg-rose-500 flex items-center justify-center text-white text-xs font-medium transition-all"
              style={{ width: `${balanceStats.oAdvantage * 100}%` }}
            >
              O {(balanceStats.oAdvantage * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="mt-2 text-xs text-slate-500 text-center">
            {balanceStats.balanced 
              ? "Both players have similar move options"
              : balanceStats.pAdvantage > balanceStats.oAdvantage
                ? "Proponent has more move options"
                : "Opponent has more move options"
            }
          </div>
        </div>
      )}

      {/* Move Tree Explorer */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold mb-4">Move Tree by Depth</h4>
        
        <div className="space-y-3">
          {getAllDepths().map((depth) => {
            const moves = getMovesAtDepth(depth);
            const pMoves = moves.filter(m => m.player === "P");
            const oMoves = moves.filter(m => m.player === "O");
            const isSelected = selectedDepth === depth;

            return (
              <div key={depth}>
                <button
                  onClick={() => setSelectedDepth(isSelected ? null : depth)}
                  className={cn(
                    "w-full p-3 rounded-lg border transition-all text-left",
                    isSelected 
                      ? "bg-slate-100 border-slate-300" 
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        depth % 2 === 0 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-rose-100 text-rose-700"
                      )}>
                        {depth}
                      </span>
                      <div>
                        <div className="font-medium">
                          Depth {depth} {depth === 0 && "(Root)"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {moves.length} moves • {depth % 2 === 0 ? "P" : "O"}&apos;s turn
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                        {pMoves.length} P
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs">
                        {oMoves.length} O
                      </span>
                      <span className="text-slate-400">{isSelected ? "▼" : "▶"}</span>
                    </div>
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-2 ml-11 space-y-2">
                    {moves.map((move) => (
                      <div
                        key={move.id}
                        className={cn(
                          "p-2 rounded border text-sm",
                          move.player === "P" 
                            ? "bg-blue-50 border-blue-200" 
                            : "bg-rose-50 border-rose-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">
                              {move.address || "ε"}
                            </span>
                            {move.isInitial && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">
                                Initial
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            Ram: [{move.ramification.join(", ")}]
                            {countBranches(move.address) > 0 && (
                              <span className="ml-2">
                                → {countBranches(move.address)} branches
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Analysis */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Position Analysis</h4>
          <button
            onClick={analyzePosition}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {isAnalyzing ? "Analyzing..." : "🔍 Analyze Current Position"}
          </button>
        </div>

        {positionAnalysis ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 rounded border text-center">
                <div className={cn(
                  "text-xl font-bold",
                  positionAnalysis.currentPlayer === "P" ? "text-blue-700" : "text-rose-700"
                )}>
                  {positionAnalysis.currentPlayer}
                </div>
                <div className="text-xs text-slate-500">Current Player</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border text-center">
                <div className="text-xl font-bold">{positionAnalysis.availableMoves}</div>
                <div className="text-xs text-slate-500">Available Moves</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border text-center">
                <div className={cn(
                  "text-xl font-bold",
                  positionAnalysis.positionType === "terminal" ? "text-red-600" : "text-green-600"
                )}>
                  {positionAnalysis.positionType === "terminal" ? "Terminal" : "Active"}
                </div>
                <div className="text-xs text-slate-500">Position Type</div>
              </div>
            </div>

            {positionAnalysis.topMoves && positionAnalysis.topMoves.length > 0 && (
              <div>
                <div className="text-sm font-medium text-slate-600 mb-2">Top Moves</div>
                <div className="space-y-2">
                  {positionAnalysis.topMoves.map((move, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-2 rounded border flex items-center justify-between",
                        move.player === "P" ? "bg-blue-50 border-blue-200" : "bg-rose-50 border-rose-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="font-mono">{move.address || "ε"}</span>
                        <span className="text-xs text-slate-500">
                          [{move.ramification.join(",")}]
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${Math.min(100, move.score * 10)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8">
                          {move.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Analyzing position...
              </span>
            ) : (
              <div>
                <div className="text-4xl mb-3">📊</div>
                <div>Click &quot;Analyze Current Position&quot; to see move recommendations</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theoretical Notes */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
        <h4 className="font-semibold text-purple-800 mb-2">📚 Game-Theoretic Insights</h4>
        <div className="text-sm text-purple-700 space-y-2">
          <p>
            <strong>Winning Condition:</strong> In Ludics, a player wins when their opponent cannot make a legal move.
            This is determined by the exhaustion of available responses in the opponent&apos;s strategy.
          </p>
          <p>
            <strong>Strategy Quality:</strong> The quality of a strategy depends on how it responds to all possible
            opponent moves. A winning strategy ensures at least one response exists for every opponent action.
          </p>
          <p>
            <strong>Balance:</strong> A balanced arena gives both players similar opportunities. An unbalanced arena
            may favor one player structurally.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WinningAnalysisPanel;
