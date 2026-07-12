"use client";

/**
 * DDS Phase 3 - Game Simulator Panel
 * 
 * Run simulations between AI players and analyze results.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type GameStrategy = {
  id: string;
  gameId: string;
  sourceDesignId: string;
  player: "P" | "O";
  name?: string;
};

type LudicsGame = {
  id: string;
  arena: {
    id: string;
    moves: any[];
  };
  strategies: GameStrategy[];
};

type AIDifficulty = "easy" | "medium" | "hard";

type SimulationResult = {
  winner: "P" | "O" | "draw";
  moveCount: number;
  duration: number;
  trace?: Array<{ moveNumber: number; player: string; address: string }>;
};

type BatchResult = {
  games: number;
  pWins: number;
  oWins: number;
  draws: number;
  pWinRate: number;
  oWinRate: number;
  avgMoves: number;
  avgDuration: number;
  gameResults?: Array<{ winner: string; moveCount: number }>;
};

interface GameSimulatorPanelProps {
  game: LudicsGame;
}

export function GameSimulatorPanel({ game }: GameSimulatorPanelProps) {
  const [mode, setMode] = React.useState<"single" | "batch" | "analysis">("single");
  const [pDifficulty, setPDifficulty] = React.useState<AIDifficulty>("medium");
  const [oDifficulty, setODifficulty] = React.useState<AIDifficulty>("medium");
  const [numGames, setNumGames] = React.useState(10);
  const [isRunning, setIsRunning] = React.useState(false);
  const [singleResult, setSingleResult] = React.useState<SimulationResult | null>(null);
  const [batchResult, setBatchResult] = React.useState<BatchResult | null>(null);
  const [arenaAnalysis, setArenaAnalysis] = React.useState<any>(null);

  const runSingleSimulation = async () => {
    setIsRunning(true);
    setSingleResult(null);

    try {
      const res = await fetch("/api/ludics/dds/games/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai_vs_ai",
          gameId: game.id,
          pDifficulty,
          oDifficulty,
          arenaConfig: game.arena,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSingleResult(data.result);
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const runBatchSimulation = async () => {
    setIsRunning(true);
    setBatchResult(null);

    try {
      const res = await fetch("/api/ludics/dds/games/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_ai_vs_ai",
          gameId: game.id,
          pDifficulty,
          oDifficulty,
          gameCount: numGames,
          arenaConfig: game.arena,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setBatchResult(data.result);
      }
    } catch (err) {
      console.error("Batch simulation failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const analyzeArena = async () => {
    setIsRunning(true);

    try {
      const res = await fetch("/api/ludics/dds/games/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_arena",
          gameId: game.id,
          arenaConfig: game.arena,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setArenaAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Arena analysis failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-analyze arena on mount
  React.useEffect(() => {
    analyzeArena();
  }, [game.id]);

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        {(["single", "batch", "analysis"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              mode === m
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {m === "single" && "🎯 Single Game"}
            {m === "batch" && "📊 Batch Simulation"}
            {m === "analysis" && "🔬 Arena Analysis"}
          </button>
        ))}
      </div>

      {/* Arena Stats Banner */}
      {arenaAnalysis && (
        <div className="bg-gradient-to-r from-blue-50 to-rose-50 rounded-lg p-4 border">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{arenaAnalysis.totalMoves}</div>
              <div className="text-xs text-slate-500">Total Moves</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{arenaAnalysis.maxDepth}</div>
              <div className="text-xs text-slate-500">Max Depth</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{arenaAnalysis.pMoves}</div>
              <div className="text-xs text-blue-500">P Moves</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-600">{arenaAnalysis.oMoves}</div>
              <div className="text-xs text-rose-500">O Moves</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{arenaAnalysis.avgRamification?.toFixed(1)}</div>
              <div className="text-xs text-slate-500">Avg Branch</div>
            </div>
          </div>
        </div>
      )}

      {/* Single/Batch Mode */}
      {(mode === "single" || mode === "batch") && (
        <div className="grid grid-cols-2 gap-6">
          {/* AI Configuration */}
          <div className="space-y-4">
            <h4 className="font-semibold">AI Configuration</h4>

            {/* P AI Difficulty */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                🤖 Proponent AI (P)
              </label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setPDifficulty(d)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors",
                      pDifficulty === d
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                    )}
                  >
                    {d === "easy" && "😊 Easy"}
                    {d === "medium" && "🤔 Medium"}
                    {d === "hard" && "🧠 Hard"}
                  </button>
                ))}
              </div>
            </div>

            {/* O AI Difficulty */}
            <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
              <label className="block text-sm font-medium text-rose-700 mb-2">
                🤖 Opponent AI (O)
              </label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setODifficulty(d)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors",
                      oDifficulty === d
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-100"
                    )}
                  >
                    {d === "easy" && "😊 Easy"}
                    {d === "medium" && "🤔 Medium"}
                    {d === "hard" && "🧠 Hard"}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Settings */}
            {mode === "batch" && (
              <div className="bg-slate-50 rounded-lg p-4 border">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Number of Games: <span className="font-bold">{numGames}</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={numGames}
                  onChange={(e) => setNumGames(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={mode === "single" ? runSingleSimulation : runBatchSimulation}
              disabled={isRunning}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-rose-600 text-white rounded-lg hover:from-blue-700 hover:to-rose-700 disabled:opacity-50 transition-all font-medium"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Running Simulation...
                </span>
              ) : mode === "single" ? (
                "▶️ Run Single Game"
              ) : (
                `▶️ Run ${numGames} Games`
              )}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <h4 className="font-semibold">Results</h4>

            {/* Single Game Result */}
            {mode === "single" && singleResult && (
              <div className="bg-slate-50 rounded-lg p-4 border space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {singleResult.winner === "P" && "🔵"}
                    {singleResult.winner === "O" && "🔴"}
                    {singleResult.winner === "draw" && "🤝"}
                  </div>
                  <div className="text-2xl font-bold">
                    {singleResult.winner === "P" && (
                      <span className="text-blue-600">Proponent Wins!</span>
                    )}
                    {singleResult.winner === "O" && (
                      <span className="text-rose-600">Opponent Wins!</span>
                    )}
                    {singleResult.winner === "draw" && (
                      <span className="text-amber-600">Draw</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded border text-center">
                    <div className="text-2xl font-bold">{singleResult.moveCount}</div>
                    <div className="text-xs text-slate-500">Moves</div>
                  </div>
                  <div className="bg-white p-3 rounded border text-center">
                    <div className="text-2xl font-bold">{singleResult.duration}ms</div>
                    <div className="text-xs text-slate-500">Duration</div>
                  </div>
                </div>

                {/* Move Trace */}
                {singleResult.trace && singleResult.trace.length > 0 && (
                  <div className="bg-white rounded border p-3">
                    <div className="text-sm font-medium mb-2">Move Sequence</div>
                    <div className="flex flex-wrap gap-1">
                      {singleResult.trace.map((t, i) => (
                        <span
                          key={i}
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-mono",
                            t.player === "P"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-rose-100 text-rose-700"
                          )}
                        >
                          {t.address || "ε"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Batch Results */}
            {mode === "batch" && batchResult && (
              <div className="bg-slate-50 rounded-lg p-4 border space-y-4">
                <div className="text-center text-lg font-semibold">
                  {batchResult.games} Games Completed
                </div>

                {/* Win Rate Bar */}
                <div className="h-10 rounded-lg overflow-hidden flex shadow-inner">
                  <div
                    className="bg-blue-500 flex items-center justify-center text-white text-sm font-medium"
                    style={{ width: `${batchResult.pWinRate * 100}%` }}
                  >
                    {batchResult.pWins > 0 && `${batchResult.pWins}P`}
                  </div>
                  {batchResult.draws > 0 && (
                    <div
                      className="bg-amber-400 flex items-center justify-center text-white text-sm font-medium"
                      style={{ width: `${(batchResult.draws / batchResult.games) * 100}%` }}
                    >
                      {batchResult.draws}D
                    </div>
                  )}
                  <div
                    className="bg-rose-500 flex items-center justify-center text-white text-sm font-medium"
                    style={{ width: `${batchResult.oWinRate * 100}%` }}
                  >
                    {batchResult.oWins > 0 && `${batchResult.oWins}O`}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded border border-blue-200 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {(batchResult.pWinRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-blue-600">P Win Rate</div>
                  </div>
                  <div className="bg-rose-50 p-3 rounded border border-rose-200 text-center">
                    <div className="text-2xl font-bold text-rose-700">
                      {(batchResult.oWinRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-rose-600">O Win Rate</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded border text-center">
                    <div className="text-lg font-bold">{batchResult.avgMoves.toFixed(1)}</div>
                    <div className="text-xs text-slate-500">Avg Moves/Game</div>
                  </div>
                  <div className="bg-white p-3 rounded border text-center">
                    <div className="text-lg font-bold">{batchResult.avgDuration.toFixed(0)}ms</div>
                    <div className="text-xs text-slate-500">Avg Duration</div>
                  </div>
                </div>

                {/* Individual Results */}
                {batchResult.gameResults && (
                  <div className="bg-white rounded border p-3">
                    <div className="text-sm font-medium mb-2">Game Results</div>
                    <div className="flex flex-wrap gap-1">
                      {batchResult.gameResults.map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                            r.winner === "P" && "bg-blue-500 text-white",
                            r.winner === "O" && "bg-rose-500 text-white",
                            r.winner === "draw" && "bg-amber-400 text-white"
                          )}
                          title={`Game ${i + 1}: ${r.winner} (${r.moveCount} moves)`}
                        >
                          {r.winner === "P" ? "P" : r.winner === "O" ? "O" : "D"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {((mode === "single" && !singleResult) || (mode === "batch" && !batchResult)) && !isRunning && (
              <div className="bg-slate-50 rounded-lg p-8 border text-center text-slate-500">
                <div className="text-4xl mb-3">🎲</div>
                <div>Configure AI difficulty and run a simulation</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Mode */}
      {mode === "analysis" && arenaAnalysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Arena Structure */}
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <h4 className="font-semibold">Arena Structure</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-600">Total Moves</span>
                  <span className="font-bold text-lg">{arenaAnalysis.totalMoves}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-600">Maximum Depth</span>
                  <span className="font-bold text-lg">{arenaAnalysis.maxDepth}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                  <span className="text-blue-600">Proponent Moves</span>
                  <span className="font-bold text-lg text-blue-700">{arenaAnalysis.pMoves}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-rose-50 rounded">
                  <span className="text-rose-600">Opponent Moves</span>
                  <span className="font-bold text-lg text-rose-700">{arenaAnalysis.oMoves}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-600">Avg Ramification</span>
                  <span className="font-bold text-lg">{arenaAnalysis.avgRamification?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Game Theory Insights */}
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <h4 className="font-semibold">Game Theory Insights</h4>
              
              <div className="space-y-3">
                <div className="p-3 bg-gradient-to-r from-blue-50 to-rose-50 rounded">
                  <div className="text-sm font-medium text-slate-700">Move Balance</div>
                  <div className="mt-2 h-4 bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500"
                      style={{
                        width: `${(arenaAnalysis.pMoves / arenaAnalysis.totalMoves) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-rose-500"
                      style={{
                        width: `${(arenaAnalysis.oMoves / arenaAnalysis.totalMoves) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>P: {((arenaAnalysis.pMoves / arenaAnalysis.totalMoves) * 100).toFixed(0)}%</span>
                    <span>O: {((arenaAnalysis.oMoves / arenaAnalysis.totalMoves) * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-sm font-medium text-slate-700">Complexity Rating</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 via-amber-400 to-red-500"
                        style={{
                          width: `${Math.min(100, (arenaAnalysis.totalMoves / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {arenaAnalysis.totalMoves < 15 ? "Low" : arenaAnalysis.totalMoves < 25 ? "Medium" : "High"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded border border-amber-200">
                  <div className="text-sm font-medium text-amber-700">Theoretical Note</div>
                  <div className="text-xs text-amber-600 mt-1">
                    In Ludics, the game outcome depends on the interaction between strategies.
                    The player who can no longer respond loses (similar to exhaustion in game semantics).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="text-center">
            <button
              onClick={analyzeArena}
              disabled={isRunning}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              {isRunning ? "Analyzing..." : "🔄 Refresh Analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameSimulatorPanel;
