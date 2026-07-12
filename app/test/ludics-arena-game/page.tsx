"use client";

/**
 * DDS Phase 4 - Arena & Game Demo Page
 * 
 * Interactive demo showcasing Faggian-Hyland arena and game components.
 * This page is outside the (app) route group to avoid LiveEventsProvider polling.
 */

import * as React from "react";
import { ArenaPanel } from "@/components/ludics/arena";
import { GamePanel } from "@/components/ludics/game";
import { cn } from "@/lib/utils";

type DemoMode = "arena" | "game" | "integrated";

export default function LudicsArenaGameDemo() {
  const [mode, setMode] = React.useState<DemoMode>("integrated");
  const [selectedArenaId, setSelectedArenaId] = React.useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
  const [deliberationId] = React.useState("demo-deliberation-001");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          🎲 Ludics Arena & Game Demo
        </h1>
        <p className="text-slate-600">
          Interactive visualization of Faggian-Hyland Universal Arena and Game semantics
        </p>
        <div className="mt-2 text-sm text-slate-500">
          Based on &quot;Designs, Disputes and Strategies&quot; (DDS) — Definitions 3.1, 3.5, 3.7, 6.2
        </div>
      </div>

      {/* Mode Selector */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">View Mode:</span>
          <div className="flex gap-2">
            {(["arena", "game", "integrated"] as DemoMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {m === "arena" && "🏛️ Arena Only"}
                {m === "game" && "🎮 Game Only"}
                {m === "integrated" && "🔗 Integrated View"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {mode === "integrated" && (
          <div className="grid grid-cols-2 gap-6">
            {/* Arena Panel */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <ArenaPanel
                deliberationId={deliberationId}
                onArenaSelect={(arenaId) => setSelectedArenaId(arenaId)}
                selectedArenaId={selectedArenaId}
              />
            </div>

            {/* Game Panel */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <GamePanel
                deliberationId={deliberationId}
                gameId={selectedGameId || undefined}
                onGameCreated={(game) => setSelectedGameId(game.id)}
              />
            </div>
          </div>
        )}

        {mode === "arena" && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <ArenaPanel
              deliberationId={deliberationId}
              onArenaSelect={(arenaId) => setSelectedArenaId(arenaId)}
              selectedArenaId={selectedArenaId}
            />
          </div>
        )}

        {mode === "game" && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <GamePanel
              deliberationId={deliberationId}
              gameId={selectedGameId || undefined}
              onGameCreated={(game) => setSelectedGameId(game.id)}
            />
          </div>
        )}
      </div>

      {/* Theory Reference */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-bold text-lg text-slate-800 mb-4">
            📚 Theoretical Foundation
          </h2>
          
          <div className="grid grid-cols-3 gap-6">
            {/* Universal Arena */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-700 mb-2">
                Definition 3.1: Universal Arena
              </h3>
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  <strong>Arena A = (Moves, Labels, Enabling)</strong>
                </p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li><strong>Moves:</strong> Actions (ξ, J) with address ξ and ramification J ∈ ℘<sub>fin</sub>(ℕ)</li>
                  <li><strong>Labels:</strong> Player determined by address parity</li>
                  <li><strong>Enabling:</strong> (ξ, I) justifies (ξi, J) if i ∈ I</li>
                </ul>
              </div>
            </div>

            {/* Views */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-700 mb-2">
                Definition 3.5: Views
              </h3>
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  The <strong>view</strong> extracts relevant history from player&apos;s perspective:
                </p>
                <div className="font-mono text-xs bg-white p-2 rounded">
                  <div>• ε̅ = ε</div>
                  <div>• s̅κ⁺ = s̅⁻κ⁺</div>
                  <div>• s̅κ⁻ = κ⁻ (if initial)</div>
                </div>
              </div>
            </div>

            {/* Games */}
            <div className="bg-rose-50 rounded-lg p-4">
              <h3 className="font-semibold text-rose-700 mb-2">
                Definition 6.2: Games
              </h3>
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  A <strong>game</strong> G is derived from a behaviour B:
                </p>
                <div className="font-mono text-xs bg-white p-2 rounded">
                  <div>G = (A, A⊥)</div>
                  <div className="text-slate-500 mt-1">
                    where A ⊥ A⊥ (mutually orthogonal)
                  </div>
                </div>
                <p className="text-xs">
                  Strategies in A play against strategies in A⊥
                </p>
              </div>
            </div>
          </div>

          {/* Key Concepts */}
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold text-slate-700 mb-3">Key Concepts</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="bg-blue-100 rounded p-3 text-center">
                <div className="font-bold text-blue-700">P</div>
                <div className="text-xs text-slate-600">Proponent</div>
                <div className="text-xs text-slate-500">Starts game</div>
              </div>
              <div className="bg-rose-100 rounded p-3 text-center">
                <div className="font-bold text-rose-700">O</div>
                <div className="text-xs text-slate-600">Opponent</div>
                <div className="text-xs text-slate-500">Responds</div>
              </div>
              <div className="bg-amber-100 rounded p-3 text-center">
                <div className="font-bold text-amber-700">⊥</div>
                <div className="text-xs text-slate-600">Orthogonality</div>
                <div className="text-xs text-slate-500">|S ∩ T| = 1</div>
              </div>
              <div className="bg-purple-100 rounded p-3 text-center">
                <div className="font-bold text-purple-700">†</div>
                <div className="text-xs text-slate-600">Daimon</div>
                <div className="text-xs text-slate-500">Termination</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="max-w-7xl mx-auto mt-6">
        <div className="bg-slate-800 text-white rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="opacity-60">Deliberation:</span>
            <span className="font-mono">{deliberationId}</span>
            {selectedArenaId && (
              <>
                <span className="opacity-40">|</span>
                <span className="opacity-60">Arena:</span>
                <span className="font-mono">{selectedArenaId.slice(0, 12)}...</span>
              </>
            )}
            {selectedGameId && (
              <>
                <span className="opacity-40">|</span>
                <span className="opacity-60">Game:</span>
                <span className="font-mono">{selectedGameId.slice(0, 12)}...</span>
              </>
            )}
          </div>
          <div className="text-xs opacity-60">
            Phase 4: Integration Demo
          </div>
        </div>
      </div>
    </div>
  );
}
