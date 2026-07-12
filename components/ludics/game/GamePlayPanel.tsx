"use client";

/**
 * DDS Phase 3 - Game Play Panel
 * 
 * Interactive game play interface with manual and AI modes.
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

type GameStrategy = {
  id: string;
  gameId: string;
  sourceDesignId: string;
  player: "P" | "O";
  name?: string;
};

type LudicsGame = {
  id: string;
  name?: string;
  arena: {
    id: string;
    moves: ArenaMove[];
  };
  strategies: GameStrategy[];
};

type MoveLogEntry = {
  moveNumber: number;
  player: "P" | "O";
  move: ArenaMove;
  source: "manual" | "strategy" | "ai";
  thinkTime?: number;
  timestamp: Date;
};

type GamePlayState = {
  gameId: string;
  currentPosition: {
    id: string;
    arenaId: string;
    sequence: ArenaMove[];
    currentPlayer: "P" | "O";
    isTerminal: boolean;
  };
  pStrategyId?: string;
  oStrategyId?: string;
  mode: "manual" | "p_strategy" | "o_strategy" | "auto";
  status: "setup" | "playing" | "p_wins" | "o_wins" | "draw" | "abandoned";
  moveLog: MoveLogEntry[];
  startedAt: Date;
};

type AIDifficulty = "easy" | "medium" | "hard";

interface GamePlayPanelProps {
  game: LudicsGame;
  gameState: GamePlayState | null;
  onStateChange: (state: GamePlayState) => void;
}

export function GamePlayPanel({
  game,
  gameState,
  onStateChange,
}: GamePlayPanelProps) {
  const [availableMoves, setAvailableMoves] = React.useState<ArenaMove[]>([]);
  const [selectedMove, setSelectedMove] = React.useState<ArenaMove | null>(null);
  const [aiDifficulty, setAIDifficulty] = React.useState<AIDifficulty>("medium");
  const [isThinking, setIsThinking] = React.useState(false);
  const [aiSuggestion, setAISuggestion] = React.useState<{
    move: ArenaMove;
    score: number;
    reason: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize game state if not present
  React.useEffect(() => {
    if (!gameState) {
      initializeGame();
    }
  }, [game, gameState]);

  // Update available moves when position changes
  React.useEffect(() => {
    if (gameState && !gameState.currentPosition.isTerminal) {
      computeAvailableMoves();
    } else {
      setAvailableMoves([]);
    }
  }, [gameState?.currentPosition]);

  const initializeGame = async () => {
    try {
      const res = await fetch("/api/ludics/dds/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initialize",
          gameId: game.id,
          arenaConfig: game.arena,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const newState: GamePlayState = {
          gameId: game.id,
          currentPosition: {
            id: "initial",
            arenaId: game.arena.id,
            sequence: [],
            currentPlayer: "P",
            isTerminal: false,
          },
          mode: "manual",
          status: "playing",
          moveLog: [],
          startedAt: new Date(),
        };
        onStateChange(newState);
        setAvailableMoves(
          data.availableMoves?.map((m: any) => ({
            ...m,
            player: newState.currentPosition.currentPlayer,
          })) || []
        );
      }
    } catch (err) {
      console.error("Failed to initialize game:", err);
    }
  };

  const computeAvailableMoves = () => {
    if (!gameState) return;
    if (!game.arena?.moves) {
      console.warn("Arena moves not available");
      setAvailableMoves([]);
      return;
    }

    const currentPlayer = gameState.currentPosition.currentPlayer;
    const visitedAddresses = new Set(
      gameState.currentPosition.sequence.map((m) => m.address)
    );

    // Get moves for current player that haven't been played
    const available = game.arena.moves.filter((m) => {
      if (m.player !== currentPlayer) return false;
      if (visitedAddresses.has(m.address)) return false;
      // Simplified: allow all unvisited moves for current player
      return true;
    });

    setAvailableMoves(available);
  };

  const makeMove = async (move: ArenaMove) => {
    if (!gameState || gameState.status !== "playing") return;

    setIsThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/ludics/dds/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          gameId: game.id,
          move: {
            id: move.id,
            address: move.address,
            ramification: move.ramification,
          },
          encodedState: null, // Would use encoding in production
          arenaConfig: game.arena,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setError(null);
        const newLogEntry: MoveLogEntry = {
          moveNumber: gameState.moveLog.length + 1,
          player: move.player,
          move,
          source: "manual",
          timestamp: new Date(),
        };

        const newState: GamePlayState = {
          ...gameState,
          currentPosition: {
            ...gameState.currentPosition,
            sequence: [...gameState.currentPosition.sequence, move],
            currentPlayer: move.player === "P" ? "O" : "P",
            isTerminal: data.state?.isGameOver || false,
          },
          status: data.state?.status || gameState.status,
          moveLog: [...gameState.moveLog, newLogEntry],
        };

        onStateChange(newState);
        setSelectedMove(null);
        setAISuggestion(null);
      } else {
        setError(data.error || "Move failed");
        console.error("Move failed:", data.error);
      }
    } catch (err) {
      setError("Network error");
      console.error("Failed to make move:", err);
    } finally {
      setIsThinking(false);
    }
  };

  const getAIMove = async () => {
    if (!gameState || gameState.status !== "playing") return;

    setIsThinking(true);
    try {
      const res = await fetch("/api/ludics/dds/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai_move",
          gameId: game.id,
          difficulty: aiDifficulty,
          encodedState: null,
          arenaConfig: game.arena,
        }),
      });

      const data = await res.json();
      if (data.ok && data.aiMove) {
        // Show suggestion
        const suggestedMove = game.arena.moves.find(
          (m) => m.address === data.aiMove.address
        );
        if (suggestedMove) {
          setAISuggestion({
            move: suggestedMove,
            score: data.aiMove.score,
            reason: data.aiMove.reason,
          });
        }
      }
    } catch (err) {
      console.error("Failed to get AI move:", err);
    } finally {
      setIsThinking(false);
    }
  };

  const playAIMove = async () => {
    if (!aiSuggestion) return;
    await makeMove(aiSuggestion.move);
  };

  const resetGame = () => {
    initializeGame();
    setSelectedMove(null);
    setAISuggestion(null);
  };

  const undoMove = () => {
    if (!gameState || gameState.moveLog.length === 0) return;

    const newLog = gameState.moveLog.slice(0, -1);
    const newSequence = gameState.currentPosition.sequence.slice(0, -1);
    const lastPlayer = newSequence.length > 0 
      ? newSequence[newSequence.length - 1].player 
      : null;
    const currentPlayer = lastPlayer === "P" ? "O" : "P";

    const newState: GamePlayState = {
      ...gameState,
      currentPosition: {
        ...gameState.currentPosition,
        sequence: newSequence,
        currentPlayer,
        isTerminal: false,
      },
      status: "playing",
      moveLog: newLog,
    };

    onStateChange(newState);
    setAISuggestion(null);
  };

  const currentPlayer = gameState?.currentPosition.currentPlayer || "P";
  const isGameOver = gameState?.status !== "playing" && gameState?.status !== "setup";

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Left: Proponent Panel */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
            P
          </span>
          Proponent
        </h4>

        {/* Turn Indicator */}
        <div
          className={cn(
            "p-2 rounded mb-4 text-center text-sm font-medium",
            currentPlayer === "P" && !isGameOver
              ? "bg-blue-200 text-blue-800"
              : "bg-slate-100 text-slate-500"
          )}
        >
          {currentPlayer === "P" && !isGameOver ? "Your Turn!" : "Waiting..."}
        </div>

        {/* P Strategies */}
        <div className="text-sm">
          <div className="text-slate-600 mb-2">Strategies:</div>
          {game.strategies.filter((s) => s.player === "P").length === 0 ? (
            <div className="text-slate-400 italic">None available</div>
          ) : (
            <div className="space-y-1">
              {game.strategies
                .filter((s) => s.player === "P")
                .map((s) => (
                  <div
                    key={s.id}
                    className="px-2 py-1 bg-blue-100 rounded text-xs"
                  >
                    {s.name || s.id.slice(0, 12)}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Game Board (2 columns) */}
      <div className="col-span-2 space-y-4">
        {/* Position Display */}
        <div className="bg-slate-50 rounded-lg p-4 border">
          <h5 className="text-sm font-semibold mb-3 flex items-center justify-between">
            <span>Current Position</span>
            <span className="text-xs text-slate-500">
              Move {gameState?.moveLog.length || 0}
            </span>
          </h5>

          {/* Move Sequence */}
          <div className="flex flex-wrap gap-1 min-h-[40px] mb-4">
            {gameState?.currentPosition.sequence.length === 0 ? (
              <span className="text-slate-400 italic text-sm">
                Game start - P to play
              </span>
            ) : (
              gameState?.currentPosition.sequence.map((move, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "px-2 py-1 rounded text-sm font-mono",
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

          {/* Game Result */}
          {isGameOver && (
            <div
              className={cn(
                "p-4 rounded-lg text-center",
                gameState?.status === "p_wins" && "bg-blue-100",
                gameState?.status === "o_wins" && "bg-rose-100",
                gameState?.status === "draw" && "bg-amber-100"
              )}
            >
              <div className="text-2xl font-bold">
                {gameState?.status === "p_wins" && "🎉 Proponent Wins!"}
                {gameState?.status === "o_wins" && "🎉 Opponent Wins!"}
                {gameState?.status === "draw" && "🤝 Draw!"}
              </div>
              <button
                onClick={resetGame}
                className="mt-3 px-4 py-2 bg-white rounded border hover:bg-slate-50 text-sm"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Available Moves */}
        {!isGameOver && (
          <div className="bg-white rounded-lg p-4 border">
            <h5 className="text-sm font-semibold mb-3 flex items-center justify-between">
              <span>Available Moves ({availableMoves.length})</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs",
                  currentPlayer === "P"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-rose-100 text-rose-700"
                )}
              >
                {currentPlayer}'s turn
              </span>
            </h5>

            <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
              {availableMoves.map((move) => (
                <button
                  key={move.id}
                  onClick={() => setSelectedMove(move)}
                  className={cn(
                    "px-3 py-2 rounded border text-sm font-mono transition-all",
                    selectedMove?.id === move.id
                      ? "ring-2 ring-blue-400 border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    aiSuggestion?.move.id === move.id &&
                      "ring-2 ring-green-400 border-green-400 bg-green-50"
                  )}
                >
                  {move.address}
                  {move.ramification.length > 0 && (
                    <span className="text-xs text-slate-400 ml-1">
                      [{move.ramification.join(",")}]
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* AI Suggestion */}
            {aiSuggestion && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-700 mb-1">
                  AI Suggests: {aiSuggestion.move.address}
                </div>
                <div className="text-xs text-green-600">
                  Score: {aiSuggestion.score.toFixed(1)} — {aiSuggestion.reason}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm font-medium text-red-700">
                  ⚠️ {error}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {!isGameOver && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectedMove && makeMove(selectedMove)}
                disabled={!selectedMove || isThinking}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isThinking ? "Thinking..." : "Make Move"}
              </button>
              <button
                onClick={undoMove}
                disabled={!gameState?.moveLog.length}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Undo
              </button>
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={aiDifficulty}
                onChange={(e) => setAIDifficulty(e.target.value as AIDifficulty)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="easy">Easy AI</option>
                <option value="medium">Medium AI</option>
                <option value="hard">Hard AI</option>
              </select>
              <button
                onClick={getAIMove}
                disabled={isThinking}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                🤖 Get AI Hint
              </button>
              {aiSuggestion && (
                <button
                  onClick={playAIMove}
                  disabled={isThinking}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  Play AI Move
                </button>
              )}
            </div>
          </div>
        )}

        {/* Move History */}
        <div className="bg-white rounded-lg p-4 border">
          <h5 className="text-sm font-semibold mb-3 flex items-center justify-between">
            <span>Move History</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (!gameState) return;
                  // Export game state to clipboard
                  const exportData = {
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    game: { id: game.id, name: game.name },
                    state: {
                      moves: gameState.moveLog.map(e => ({
                        n: e.moveNumber,
                        p: e.player,
                        a: e.move.address,
                        r: e.move.ramification,
                      })),
                      status: gameState.status,
                      currentPlayer: gameState.currentPosition.currentPlayer,
                    },
                  };
                  navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
                  alert("Game state copied to clipboard!");
                }}
                disabled={!gameState}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                title="Copy game state to clipboard"
              >
                📋 Copy
              </button>
              <button
                onClick={() => {
                  if (!gameState) return;
                  // Download game state as JSON
                  const exportData = {
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    game: { id: game.id, name: game.name },
                    arena: { id: game.arena.id, moveCount: game.arena.moves.length },
                    state: {
                      moves: gameState.moveLog.map(e => ({
                        n: e.moveNumber,
                        p: e.player,
                        a: e.move.address,
                        r: e.move.ramification,
                      })),
                      status: gameState.status,
                      currentPlayer: gameState.currentPosition.currentPlayer,
                    },
                  };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ludics-game-${game.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!gameState}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                title="Download game state as JSON"
              >
                💾 Save
              </button>
            </div>
          </h5>
          <div className="max-h-32 overflow-auto">
            {gameState?.moveLog.length === 0 ? (
              <div className="text-slate-400 italic text-sm">No moves yet</div>
            ) : (
              <div className="space-y-1">
                {gameState?.moveLog.map((entry) => (
                  <div
                    key={entry.moveNumber}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-6 text-slate-400">{entry.moveNumber}.</span>
                    <span
                      className={cn(
                        "w-6",
                        entry.player === "P" ? "text-blue-600" : "text-rose-600"
                      )}
                    >
                      {entry.player}
                    </span>
                    <span className="font-mono">{entry.move.address}</span>
                    <span className="text-xs text-slate-400">
                      ({entry.source})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Opponent Panel */}
      <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
        <h4 className="font-bold text-rose-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-sm">
            O
          </span>
          Opponent
        </h4>

        {/* Turn Indicator */}
        <div
          className={cn(
            "p-2 rounded mb-4 text-center text-sm font-medium",
            currentPlayer === "O" && !isGameOver
              ? "bg-rose-200 text-rose-800"
              : "bg-slate-100 text-slate-500"
          )}
        >
          {currentPlayer === "O" && !isGameOver ? "Your Turn!" : "Waiting..."}
        </div>

        {/* O Strategies */}
        <div className="text-sm">
          <div className="text-slate-600 mb-2">Strategies:</div>
          {game.strategies.filter((s) => s.player === "O").length === 0 ? (
            <div className="text-slate-400 italic">None available</div>
          ) : (
            <div className="space-y-1">
              {game.strategies
                .filter((s) => s.player === "O")
                .map((s) => (
                  <div
                    key={s.id}
                    className="px-2 py-1 bg-rose-100 rounded text-xs"
                  >
                    {s.name || s.id.slice(0, 12)}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GamePlayPanel;
