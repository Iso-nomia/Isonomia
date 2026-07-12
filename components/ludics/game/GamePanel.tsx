"use client";

/**
 * DDS Phase 3 - Game Panel
 * 
 * Main panel for Ludics games - setup, play, simulate, analyze.
 * Based on Faggian & Hyland Section 6.2.
 */

import * as React from "react";
import useSWR from "swr";
import { GameSetupPanel } from "./GameSetupPanel";
import { GamePlayPanel } from "./GamePlayPanel";
import { GameSimulatorPanel } from "./GameSimulatorPanel";
import { WinningAnalysisPanel } from "./WinningAnalysisPanel";
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

type GameStrategy = {
  id: string;
  gameId: string;
  sourceDesignId: string;
  player: "P" | "O";
  name?: string;
  responseMap: Record<string, { address: string; ramification: number[] }>;
};

type LudicsGame = {
  id: string;
  name?: string;
  deliberationId: string;
  positiveBehaviourId: string;
  negativeBehaviourId: string;
  arena: UniversalArena;
  strategies: GameStrategy[];
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
  moveLog: Array<{
    moveNumber: number;
    player: "P" | "O";
    move: ArenaMove;
    source: "manual" | "strategy" | "ai";
    timestamp: Date;
  }>;
  startedAt: Date;
};

type GameMode = "setup" | "play" | "simulate" | "analyze";

interface GamePanelProps {
  deliberationId: string;
  gameId?: string;
  className?: string;
  onGameCreated?: (game: LudicsGame) => void;
}

export function GamePanel({
  deliberationId,
  gameId,
  className,
  onGameCreated,
}: GamePanelProps) {
  const [mode, setMode] = React.useState<GameMode>("setup");
  const [game, setGame] = React.useState<LudicsGame | null>(null);
  const [gameState, setGameState] = React.useState<GamePlayState | null>(null);

  // Fetch game if gameId provided
  const { data: gameData, mutate: refetchGame } = useSWR(
    gameId ? `/api/ludics/dds/games?gameId=${gameId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    if (gameData?.ok && gameData.game) {
      setGame(gameData.game);
      setMode("play");
    }
  }, [gameData]);

  const handleGameCreated = (newGame: LudicsGame) => {
    setGame(newGame);
    setMode("play");
    onGameCreated?.(newGame);
  };

  const handleStateChange = (newState: GamePlayState) => {
    setGameState(newState);
  };

  const tabs: { mode: GameMode; label: string; icon: string; disabled?: boolean }[] = [
    { mode: "setup", label: "Setup", icon: "⚙️" },
    { mode: "play", label: "Play", icon: "🎮", disabled: !game },
    { mode: "simulate", label: "Simulate", icon: "🔄", disabled: !game },
    { mode: "analyze", label: "Analyze", icon: "📊", disabled: !game },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Game Header */}
      <div className="bg-gradient-to-r from-blue-50 via-white to-rose-50 rounded-lg p-4 border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="text-xl">🎲</span>
              Ludics Game
              {game?.name && (
                <span className="text-slate-500 font-normal">— {game.name}</span>
              )}
            </h3>
            {game ? (
              <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-700">
                  A: {game.positiveBehaviourId.slice(0, 8)}...
                </span>
                <span className="text-slate-400 font-bold">⊥</span>
                <span className="px-2 py-0.5 bg-rose-100 rounded text-rose-700">
                  A⊥: {game.negativeBehaviourId.slice(0, 8)}...
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">
                  {game.strategies.length} strategies
                </span>
              </div>
            ) : (
              <div className="text-sm text-slate-500 mt-1">
                Create a game from two orthogonal behaviours
              </div>
            )}
          </div>

          {/* Game Status */}
          {gameState && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "px-3 py-1 rounded-lg text-sm font-medium",
                  gameState.status === "playing" && "bg-green-100 text-green-700",
                  gameState.status === "p_wins" && "bg-blue-100 text-blue-700",
                  gameState.status === "o_wins" && "bg-rose-100 text-rose-700",
                  gameState.status === "draw" && "bg-amber-100 text-amber-700",
                  gameState.status === "setup" && "bg-slate-100 text-slate-600"
                )}
              >
                {gameState.status === "playing" && "In Progress"}
                {gameState.status === "p_wins" && "P Wins!"}
                {gameState.status === "o_wins" && "O Wins!"}
                {gameState.status === "draw" && "Draw"}
                {gameState.status === "setup" && "Setup"}
              </span>
              <span className="text-sm text-slate-500">
                Move {gameState.moveLog.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => !tab.disabled && setMode(tab.mode)}
            disabled={tab.disabled}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              mode === tab.mode
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mode Content */}
      <div className="min-h-[400px]">
        {mode === "setup" && (
          <GameSetupPanel
            deliberationId={deliberationId}
            existingGame={game as any}
            onGameCreated={handleGameCreated as (game: any) => void}
          />
        )}

        {mode === "play" && game && (
          <GamePlayPanel
            game={game}
            gameState={gameState}
            onStateChange={handleStateChange}
          />
        )}

        {mode === "simulate" && game && (
          <GameSimulatorPanel game={game} />
        )}

        {mode === "analyze" && game && (
          <WinningAnalysisPanel game={game} gameState={gameState} />
        )}
      </div>
    </div>
  );
}

export default GamePanel;
