"use client";

/**
 * Phase 6 - Interaction Player Component
 * 
 * Unified component for interacting with ludic games:
 * - Play mode: Manual gameplay against AI or another player
 * - Replay mode: Step through recorded interactions
 * - Simulate mode: Watch AI vs AI simulations
 * 
 * Integrates with Phase 5 interaction API endpoints.
 */

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

type LudicAddress = number[];

interface DialogueAct {
  polarity: "+" | "-";
  focus: LudicAddress;
  ramification: LudicAddress[];
  expression: string;
  moveType?: string;
  timestamp?: string;
}

interface ApiMove {
  id: string;
  address: string;
  ramification: number[];
  player: "P" | "O";
}

interface InteractionState {
  id: string;
  arenaId: string;
  currentPlayer: "P" | "O";
  position?: LudicAddress;
  status: "active" | "complete" | "completed" | "abandoned";
  winner?: "P" | "O" | "draw";
  moveHistory: DialogueAct[];
  availableMoves: ApiMove[];
  startedAt?: string;
  lastMoveAt?: string;
}

interface InteractionResult {
  interaction: InteractionState;
  lastMove?: DialogueAct;
  isTerminal: boolean;
  winner?: "P" | "O" | "draw";
  analysis?: {
    pathLength: number;
    branchingFactor: number;
    timeElapsed: number;
  };
}

type PlayMode = "play" | "replay" | "simulate";

export interface InteractionPlayerProps {
  /** Arena ID to play in */
  arenaId: string;
  /** Proponent design ID */
  posDesignId: string;
  /** Opponent design ID */
  negDesignId: string;
  /** Interaction mode */
  mode: PlayMode;
  /** Existing interaction ID (for replay) */
  interactionId?: string;
  /** Player controlled by user (for play mode) */
  userPlayer?: "P" | "O";
  /** AI strategy for opponent */
  aiStrategy?: "random" | "minimax" | "greedy";
  /** Simulation speed in ms (for replay/simulate) */
  playbackSpeed?: number;
  /** Callback when interaction completes */
  onComplete?: (result: InteractionResult) => void;
  /** Callback when move is made */
  onMove?: (move: DialogueAct, state: InteractionState) => void;
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

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString();
}

// ============================================================================
// MOVE LIST COMPONENT
// ============================================================================

// API returns moves in this format
interface ApiMoveHistoryItem {
  moveNumber: number;
  player: "P" | "O";
  address: string;
  ramification?: number[];
  timestamp?: Date | string;
}

interface MoveListProps {
  moves: (DialogueAct | ApiMoveHistoryItem)[];
  currentIndex?: number;
  onMoveClick?: (index: number) => void;
}

function MoveList({ moves, currentIndex, onMoveClick }: MoveListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to current move
  React.useEffect(() => {
    if (listRef.current && currentIndex !== undefined) {
      const element = listRef.current.children[currentIndex] as HTMLElement;
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentIndex]);

  // Normalize move to display format
  const normalizeMove = (move: DialogueAct | ApiMoveHistoryItem, index: number) => {
    // Check if it's an API move history item (has player/address) vs DialogueAct (has polarity/focus)
    if ("player" in move && "address" in move) {
      return {
        index: index + 1,
        player: move.player,
        polarity: move.player === "P" ? "+" : "-",
        address: move.address,
        expression: undefined,
        timestamp: move.timestamp ? (typeof move.timestamp === "string" ? move.timestamp : move.timestamp.toISOString()) : undefined,
      };
    } else {
      // DialogueAct format
      return {
        index: index + 1,
        player: move.polarity === "+" ? "P" : "O",
        polarity: move.polarity,
        address: move.focus,
        expression: move.expression,
        timestamp: move.timestamp,
      };
    }
  };

  return (
    <div ref={listRef} className="space-y-1 max-h-[300px] overflow-y-auto p-2">
      {moves.map((move, i) => {
        const normalized = normalizeMove(move, i);
        return (
          <div
            key={i}
            onClick={() => onMoveClick?.(i)}
            className={cn(
              "flex items-center gap-2 p-2 rounded cursor-pointer",
              "hover:bg-slate-50 transition-colors",
              currentIndex === i && "bg-blue-50 border border-blue-200"
            )}
          >
            <span className="text-sm text-slate-400 w-6">{normalized.index}.</span>
            <span
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                normalized.player === "P"
                  ? "bg-blue-200 text-blue-800"
                  : "bg-orange-200 text-orange-800"
              )}
            >
              {normalized.player}
            </span>
            <code className="text-sm flex-1 font-mono">
              {addressToKey(normalized.address)}
            </code>
            {normalized.expression && (
              <span className="text-xs text-slate-500 truncate max-w-[150px]">
                {normalized.expression}
              </span>
            )}
            {normalized.timestamp && (
              <span className="text-xs text-slate-400">
                {formatTimestamp(normalized.timestamp)}
              </span>
            )}
          </div>
        );
      })}
      {moves.length === 0 && (
        <div className="text-center text-slate-400 py-4">No moves yet</div>
      )}
    </div>
  );
}

// ============================================================================
// AVAILABLE MOVES COMPONENT
// ============================================================================

interface AvailableMovesProps {
  moves?: ApiMove[];
  currentPlayer: "P" | "O";
  onMoveSelect: (move: ApiMove) => void;
  disabled?: boolean;
}

function AvailableMoves({
  moves = [],
  currentPlayer,
  onMoveSelect,
  disabled,
}: AvailableMovesProps) {
  const safeMoves = moves || [];
  
  const handleMoveClick = (move: ApiMove) => {
    onMoveSelect(move);
  };

  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <div className="text-sm font-medium mb-2">
        Available Moves for{" "}
        <span
          className={cn(
            "font-bold",
            currentPlayer === "P" ? "text-blue-600" : "text-orange-600"
          )}
        >
          Player {currentPlayer}
        </span>
        {" "}
        <span className="text-slate-500">({safeMoves.length} moves)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {safeMoves.map((move) => (
          <button
            key={move.id}
            onClick={() => handleMoveClick(move)}
            disabled={disabled}
            className={cn(
              "px-3 py-1 rounded border text-sm font-mono",
              "transition-colors",
              disabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : currentPlayer === "P"
                ? "bg-blue-100 border-blue-300 hover:bg-blue-200"
                : "bg-orange-100 border-orange-300 hover:bg-orange-200"
            )}
          >
            {move.address || "∅"} [{move.ramification.join(",")}]
          </button>
        ))}
        {safeMoves.length === 0 && (
          <span className="text-slate-400 text-sm">No moves available</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PLAYBACK CONTROLS COMPONENT
// ============================================================================

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentIndex: number;
  totalMoves: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: (direction: "forward" | "backward") => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: number) => void;
}

function PlaybackControls({
  isPlaying,
  currentIndex,
  totalMoves,
  speed,
  onPlay,
  onPause,
  onStep,
  onSeek,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg">
      {/* Step backward */}
      <button
        onClick={() => onStep("backward")}
        disabled={currentIndex <= 0}
        className="p-2 rounded hover:bg-slate-200 disabled:opacity-50"
        title="Step backward"
      >
        ⏮
      </button>

      {/* Play/Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="p-2 rounded hover:bg-slate-200"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Step forward */}
      <button
        onClick={() => onStep("forward")}
        disabled={currentIndex >= totalMoves - 1}
        className="p-2 rounded hover:bg-slate-200 disabled:opacity-50"
        title="Step forward"
      >
        ⏭
      </button>

      {/* Progress slider */}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalMoves - 1)}
        value={currentIndex}
        onChange={(e) => onSeek(parseInt(e.target.value))}
        className="flex-1"
      />

      {/* Position indicator */}
      <span className="text-sm text-slate-600 w-16 text-right">
        {currentIndex + 1} / {totalMoves}
      </span>

      {/* Speed control */}
      <select
        value={speed}
        onChange={(e) => onSpeedChange(parseInt(e.target.value))}
        className="text-sm border rounded px-2 py-1"
      >
        <option value={2000}>0.5x</option>
        <option value={1000}>1x</option>
        <option value={500}>2x</option>
        <option value={250}>4x</option>
      </select>
    </div>
  );
}

// ============================================================================
// RESULT DISPLAY COMPONENT
// ============================================================================

interface ResultDisplayProps {
  winner?: "P" | "O" | "draw";
  moveCount: number;
  onPlayAgain?: () => void;
  onViewNarrative?: () => void;
}

function ResultDisplay({
  winner,
  moveCount,
  onPlayAgain,
  onViewNarrative,
}: ResultDisplayProps) {
  return (
    <div className="text-center p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border">
      <div className="text-3xl mb-2">
        {winner === "draw" ? "🤝" : winner === "P" ? "🏆" : "🎯"}
      </div>
      <div className="text-xl font-bold mb-2">
        {winner === "draw"
          ? "Draw!"
          : winner === "P"
          ? "Player P Wins!"
          : "Player O Wins!"}
      </div>
      <div className="text-slate-600 mb-4">
        Completed in {moveCount} moves
      </div>
      <div className="flex justify-center gap-3">
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Play Again
          </button>
        )}
        {onViewNarrative && (
          <button
            onClick={onViewNarrative}
            className="px-4 py-2 border rounded hover:bg-slate-50"
          >
            View Narrative
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function InteractionPlayer({
  arenaId,
  posDesignId,
  negDesignId,
  mode,
  interactionId: propInteractionId,
  userPlayer = "P",
  aiStrategy = "minimax",
  playbackSpeed = 1000,
  onComplete,
  onMove,
  className,
}: InteractionPlayerProps) {
  // State
  const [interactionId, setInteractionId] = React.useState<string | null>(
    propInteractionId || null
  );
  const [interactionState, setInteractionState] = React.useState<InteractionState | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Replay/Simulate state
  const [playbackIndex, setPlaybackIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(playbackSpeed);

  // Fetch existing interaction
  const { data: fetchedInteraction } = useSWR(
    interactionId ? `/api/ludics/interactions/${interactionId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Update state from fetch
  React.useEffect(() => {
    if (fetchedInteraction?.ok && fetchedInteraction.interaction) {
      // Merge interaction data with state and availableMoves from root
      // Normalize status: "playing" from game state should map to "active" for UI
      const gameStatus = fetchedInteraction.state?.status;
      const interactionStatus = fetchedInteraction.interaction.status;
      const normalizedStatus = gameStatus === "playing" ? "active" : (interactionStatus || "active");
      
      setInteractionState({
        ...fetchedInteraction.interaction,
        currentPlayer: fetchedInteraction.state?.currentPlayer || "P",
        status: normalizedStatus,
        winner: fetchedInteraction.state?.winner,
        moveHistory: fetchedInteraction.moveHistory || [],
        availableMoves: fetchedInteraction.availableMoves || [],
      });
    }
  }, [fetchedInteraction]);

  // Playback timer for replay/simulate
  React.useEffect(() => {
    if (!isPlaying || !interactionState) return;

    const moveHistoryLength = interactionState.moveHistory?.length ?? 0;
    const timer = setTimeout(() => {
      if (playbackIndex < moveHistoryLength - 1) {
        setPlaybackIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [isPlaying, playbackIndex, speed, interactionState]);

  // Start new interaction
  const startInteraction = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ludics/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arenaId,
          posDesignId,
          negDesignId,
          mode: mode === "simulate" ? "auto" : "manual",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setInteractionId(data.interaction.id);
        // Merge availableMoves into the interaction state
        setInteractionState({
          ...data.interaction,
          availableMoves: data.availableMoves || [],
          moveHistory: data.interaction.moveHistory || [],
        });
        setPlaybackIndex(0);

        // For simulate mode, start auto-play
        if (mode === "simulate") {
          runSimulation(data.interaction.id);
        }
      } else {
        setError(data.error || "Failed to start interaction");
      }
    } catch (err) {
      setError("Failed to start interaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Make a move
  const makeMove = async (move: ApiMove) => {
    if (!interactionId || !interactionState) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/ludics/interactions/${interactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          move: {
            id: move.id,
            address: move.address,
            ramification: move.ramification,
          },
        }),
      });
      const data = await res.json();

      if (data.ok) {
        // Update state from response - API returns state at root level, not inside interaction
        const updatedState: InteractionState = {
          ...interactionState,
          currentPlayer: data.state?.currentPlayer || interactionState.currentPlayer,
          status: data.state?.status === "playing" ? "active" : (data.state?.isGameOver ? "complete" : interactionState.status),
          winner: data.state?.winner,
          availableMoves: data.availableMoves || [],
          moveHistory: data.moveHistory || interactionState.moveHistory || [],
        };
        setInteractionState(updatedState);
        onMove?.(data.moveMade, updatedState);

        // Check if complete
        if (data.state?.isGameOver || updatedState.status === "complete" || updatedState.status === "completed") {
          onComplete?.({
            interaction: updatedState,
            lastMove: data.moveMade,
            isTerminal: true,
            winner: data.state?.winner,
          });
        } else if (mode === "play" && data.state?.currentPlayer !== userPlayer) {
          // AI's turn
          await makeAIMove();
        }
      } else {
        setError(data.error || "Failed to make move");
      }
    } catch (err) {
      setError("Failed to make move");
    } finally {
      setIsLoading(false);
    }
  };

  // AI move
  const makeAIMove = async () => {
    if (!interactionId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/ludics/interactions/${interactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "step",
          strategy: aiStrategy,
        }),
      });
      const data = await res.json();

      if (data.ok && interactionState) {
        // Update state from response
        const updatedState: InteractionState = {
          ...interactionState,
          currentPlayer: data.state?.currentPlayer || interactionState.currentPlayer,
          status: data.state?.status === "playing" ? "active" : (data.state?.isGameOver ? "complete" : interactionState.status),
          winner: data.state?.winner,
          availableMoves: data.availableMoves || [],
          moveHistory: data.moveHistory || interactionState.moveHistory || [],
        };
        setInteractionState(updatedState);
        onMove?.(data.moveMade, updatedState);

        if (data.state?.isGameOver || updatedState.status === "complete") {
          onComplete?.({
            interaction: updatedState,
            lastMove: data.moveMade,
            isTerminal: true,
            winner: data.state?.winner,
          });
        }
      }
    } catch (err) {
      console.error("AI move failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run full simulation
  const runSimulation = async (id: string) => {
    setIsLoading(true);
    try {
      let currentState: InteractionState | null = interactionState;
      let iterations = 0;
      const maxIterations = 100;

      while (iterations < maxIterations && currentState) {
        const res = await fetch(`/api/ludics/interactions/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "step", strategy: aiStrategy }),
        });
        const data = await res.json();

        if (!data.ok) break;

        // Update state from response
        currentState = {
          ...currentState,
          currentPlayer: data.state?.currentPlayer || currentState.currentPlayer,
          status: data.state?.status === "playing" ? "active" : (data.state?.isGameOver ? "complete" : currentState.status),
          winner: data.state?.winner,
          availableMoves: data.availableMoves || [],
          moveHistory: data.moveHistory || currentState.moveHistory || [],
        };
        setInteractionState(currentState);

        if (data.state?.isGameOver || currentState.status === "complete") {
          onComplete?.({
            interaction: currentState,
            lastMove: data.moveMade,
            isTerminal: true,
            winner: data.state?.winner,
          });
          break;
        }

        // Small delay for visual effect
        await new Promise((r) => setTimeout(r, 100));
        iterations++;
      }
    } catch (err) {
      setError("Simulation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Playback controls
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleStep = (direction: "forward" | "backward") => {
    setIsPlaying(false);
    setPlaybackIndex((i) =>
      direction === "forward"
        ? Math.min(i + 1, (interactionState?.moveHistory.length || 1) - 1)
        : Math.max(i - 1, 0)
    );
  };
  const handleSeek = (index: number) => {
    setIsPlaying(false);
    setPlaybackIndex(index);
  };

  // Reset
  const handlePlayAgain = () => {
    setInteractionId(null);
    setInteractionState(null);
    setPlaybackIndex(0);
    setIsPlaying(false);
    startInteraction();
  };

  // Current display state for replay mode
  const displayMoves =
    mode === "replay" && interactionState
      ? interactionState.moveHistory.slice(0, playbackIndex + 1)
      : interactionState?.moveHistory || [];

  const isUserTurn =
    mode === "play" &&
    interactionState?.currentPlayer === userPlayer &&
    interactionState?.status === "active";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border">
        <div className="flex items-center gap-2">
          <span className="text-xl">
            {mode === "play" ? "🎮" : mode === "replay" ? "📼" : "🤖"}
          </span>
          <span className="font-bold">
            {mode === "play"
              ? "Interactive Play"
              : mode === "replay"
              ? "Replay"
              : "Simulation"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {interactionState && (
            <>
              <span
                className={cn(
                  "px-2 py-1 rounded text-sm",
                  interactionState.status === "active"
                    ? "bg-green-100 text-green-700"
                    : interactionState.status === "complete"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {interactionState.status}
              </span>
              <span className="text-xs text-slate-500">
                Moves: {interactionState.moveHistory?.length ?? 0}
              </span>
            </>
          )}
          {isLoading && (
            <span className="text-sm text-slate-500 animate-pulse">
              Loading...
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Start button if no interaction */}
      {!interactionState && !isLoading && (
        <div className="text-center py-8">
          <button
            onClick={startInteraction}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            {mode === "play"
              ? "Start Game"
              : mode === "replay"
              ? "Load Interaction"
              : "Run Simulation"}
          </button>
        </div>
      )}

      {/* Game result */}
      {interactionState?.status === "complete" && (
        <ResultDisplay
          winner={interactionState.winner}
          moveCount={interactionState.moveHistory?.length ?? 0}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Playback controls for replay/simulate */}
      {(mode === "replay" || mode === "simulate") &&
        interactionState &&
        (interactionState.moveHistory?.length ?? 0) > 0 && (
          <PlaybackControls
            isPlaying={isPlaying}
            currentIndex={playbackIndex}
            totalMoves={interactionState.moveHistory?.length ?? 0}
            speed={speed}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={handleStep}
            onSeek={handleSeek}
            onSpeedChange={setSpeed}
          />
        )}

      {/* Available moves for play mode */}
      {mode === "play" && interactionState?.status === "active" && (
        <AvailableMoves
          moves={interactionState.availableMoves}
          currentPlayer={interactionState.currentPlayer}
          onMoveSelect={makeMove}
          disabled={!isUserTurn || isLoading}
        />
      )}

      {/* Move history */}
      {interactionState && (
        <div className="border rounded-lg">
          <div className="border-b p-2 bg-slate-50 font-medium text-sm">
            Move History ({displayMoves.length} moves)
          </div>
          <MoveList
            moves={displayMoves}
            currentIndex={mode === "replay" ? playbackIndex : undefined}
            onMoveClick={mode === "replay" ? handleSeek : undefined}
          />
        </div>
      )}

      {/* Current player indicator for play mode */}
      {mode === "play" && interactionState?.status === "active" && (
        <div
          className={cn(
            "text-center p-3 rounded-lg font-medium",
            isUserTurn ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
          )}
        >
          {isUserTurn
            ? "Your turn! Select a move above."
            : `Waiting for Player ${interactionState.currentPlayer}...`}
        </div>
      )}
    </div>
  );
}

export default InteractionPlayer;
