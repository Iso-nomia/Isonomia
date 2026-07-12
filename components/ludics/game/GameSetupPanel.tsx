"use client";

/**
 * DDS Phase 3 - Game Setup Panel
 * 
 * Wizard for creating a new Ludics game from behaviours.
 */

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Behaviour = {
  id: string;
  name?: string;
  deliberationId: string;
  participantRole: string;
  closureDesignIds: string[];
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
  deliberationId: string;
  positiveBehaviourId: string;
  negativeBehaviourId: string;
  arena: any;
  strategies: GameStrategy[];
};

interface GameSetupPanelProps {
  deliberationId: string;
  existingGame?: LudicsGame | null;
  onGameCreated?: (game: LudicsGame) => void;
}

export function GameSetupPanel({
  deliberationId,
  existingGame,
  onGameCreated,
}: GameSetupPanelProps) {
  const [step, setStep] = React.useState(existingGame ? 3 : 1);
  const [selectedPositive, setSelectedPositive] = React.useState<string | null>(
    existingGame?.positiveBehaviourId || null
  );
  const [selectedNegative, setSelectedNegative] = React.useState<string | null>(
    existingGame?.negativeBehaviourId || null
  );
  const [gameName, setGameName] = React.useState(existingGame?.name || "");
  const [arenaConfig, setArenaConfig] = React.useState({
    maxDepth: 4,
    maxRamification: 3,
  });
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch behaviours
  const { data: behavioursData } = useSWR(
    `/api/ludics/dds/behaviours?deliberationId=${deliberationId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const behaviours: Behaviour[] = behavioursData?.ok ? behavioursData.behaviours : [];
  
  // Separate into potential positive/negative
  const positiveBehaviours = behaviours.filter((b) => b.participantRole === "Proponent");
  const negativeBehaviours = behaviours.filter((b) => b.participantRole === "Opponent");

  const createGame = async () => {
    if (!selectedPositive || !selectedNegative) {
      setError("Please select both behaviours");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/ludics/dds/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          positiveBehaviourId: selectedPositive,
          negativeBehaviourId: selectedNegative,
          name: gameName || undefined,
          arenaConfig,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        onGameCreated?.(data.game);
        setStep(4); // Success step
      } else {
        setError(data.error || "Failed to create game");
      }
    } catch (err) {
      setError("Failed to create game");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-500"
              )}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "w-16 h-1 rounded",
                  step > s ? "bg-blue-600" : "bg-slate-200"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-center gap-8 text-sm text-slate-500">
        <span className={step >= 1 ? "text-blue-600 font-medium" : ""}>
          Select Behaviours
        </span>
        <span className={step >= 2 ? "text-blue-600 font-medium" : ""}>
          Configure Arena
        </span>
        <span className={step >= 3 ? "text-blue-600 font-medium" : ""}>
          Create Game
        </span>
      </div>

      {/* Step 1: Select Behaviours */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center text-slate-600 text-sm">
            Select two orthogonal behaviours to form a game (A, A⊥)
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Positive Behaviour (A) */}
            <div className="space-y-3">
              <h4 className="font-medium text-blue-700 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm">
                  A
                </span>
                Positive Behaviour (Proponent)
              </h4>
              <div className="space-y-2 max-h-64 overflow-auto">
                {positiveBehaviours.length === 0 ? (
                  <div className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded">
                    No proponent behaviours found
                  </div>
                ) : (
                  positiveBehaviours.map((b) => (
                    <BehaviourCard
                      key={b.id}
                      behaviour={b}
                      selected={selectedPositive === b.id}
                      onClick={() => setSelectedPositive(b.id)}
                      color="blue"
                    />
                  ))
                )}
              </div>
            </div>

            {/* Negative Behaviour (A⊥) */}
            <div className="space-y-3">
              <h4 className="font-medium text-rose-700 flex items-center gap-2">
                <span className="w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center text-sm">
                  A⊥
                </span>
                Negative Behaviour (Opponent)
              </h4>
              <div className="space-y-2 max-h-64 overflow-auto">
                {negativeBehaviours.length === 0 ? (
                  <div className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded">
                    No opponent behaviours found
                  </div>
                ) : (
                  negativeBehaviours.map((b) => (
                    <BehaviourCard
                      key={b.id}
                      behaviour={b}
                      selected={selectedNegative === b.id}
                      onClick={() => setSelectedNegative(b.id)}
                      color="rose"
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedPositive || !selectedNegative}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Next: Configure Arena →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure Arena */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center text-slate-600 text-sm">
            Configure the arena parameters for the game
          </div>

          <div className="max-w-md mx-auto space-y-6 bg-slate-50 rounded-lg p-6">
            {/* Game Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Game Name (optional)
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., My First Ludics Game"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Max Depth */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maximum Arena Depth: {arenaConfig.maxDepth}
              </label>
              <input
                type="range"
                min={2}
                max={8}
                value={arenaConfig.maxDepth}
                onChange={(e) =>
                  setArenaConfig((c) => ({ ...c, maxDepth: parseInt(e.target.value) }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Shallow (2)</span>
                <span>Deep (8)</span>
              </div>
            </div>

            {/* Max Ramification */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maximum Ramification: {arenaConfig.maxRamification}
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={arenaConfig.maxRamification}
                onChange={(e) =>
                  setArenaConfig((c) => ({
                    ...c,
                    maxRamification: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Narrow (1)</span>
                <span>Wide (6)</span>
              </div>
            </div>

            {/* Estimated Size */}
            <div className="p-3 bg-white rounded border text-sm">
              <div className="text-slate-500">Estimated Arena Size:</div>
              <div className="text-lg font-medium">
                ~{estimateArenaSize(arenaConfig.maxDepth, arenaConfig.maxRamification)} moves
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center text-slate-600 text-sm">
            Review your game configuration and create
          </div>

          <div className="max-w-lg mx-auto bg-slate-50 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold text-center mb-4">Game Summary</h4>

            {gameName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Name:</span>
                <span className="font-medium">{gameName}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Positive Behaviour (A):</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-mono">
                {selectedPositive?.slice(0, 12)}...
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Negative Behaviour (A⊥):</span>
              <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-sm font-mono">
                {selectedNegative?.slice(0, 12)}...
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Arena Depth:</span>
              <span>{arenaConfig.maxDepth}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Max Ramification:</span>
              <span>{arenaConfig.maxRamification}</span>
            </div>
          </div>

          {error && (
            <div className="text-center text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={createGame}
              disabled={isCreating}
              className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? "Creating..." : "🎮 Create Game"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && existingGame && (
        <div className="text-center space-y-4 py-8">
          <div className="text-4xl">🎉</div>
          <h4 className="text-xl font-semibold text-green-600">Game Created!</h4>
          <p className="text-slate-600">
            Your game has been created with {existingGame.strategies.length} strategies.
          </p>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Another Game
          </button>
        </div>
      )}
    </div>
  );
}

function BehaviourCard({
  behaviour,
  selected,
  onClick,
  color,
}: {
  behaviour: Behaviour;
  selected: boolean;
  onClick: () => void;
  color: "blue" | "rose";
}) {
  const colorClasses = {
    blue: {
      bg: selected ? "bg-blue-50 border-blue-400" : "bg-white border-slate-200",
      text: "text-blue-700",
    },
    rose: {
      bg: selected ? "bg-rose-50 border-rose-400" : "bg-white border-slate-200",
      text: "text-rose-700",
    },
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm",
        colorClasses[color].bg,
        selected && "ring-2 ring-offset-2",
        selected && (color === "blue" ? "ring-blue-400" : "ring-rose-400")
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={cn("font-medium", colorClasses[color].text)}>
            {behaviour.name || behaviour.id.slice(0, 12)}
          </div>
          <div className="text-xs text-slate-500">
            {behaviour.closureDesignIds.length} designs
          </div>
        </div>
        {selected && (
          <span className={cn("text-lg", colorClasses[color].text)}>✓</span>
        )}
      </div>
    </div>
  );
}

function estimateArenaSize(depth: number, ramification: number): number {
  // Rough estimate: sum of ramification^d for d from 1 to depth
  let size = 0;
  for (let d = 1; d <= depth; d++) {
    size += Math.pow(ramification, d);
  }
  return Math.min(size, 10000);
}

export default GameSetupPanel;
