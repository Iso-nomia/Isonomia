"use client";

import * as React from "react";
import useSWR from "swr";
import { LociTree } from "packages/ludics-react/LociTree";
import { TraceRibbon } from "packages/ludics-react/TraceRibbon";
import { JudgeConsole } from "packages/ludics-react/JudgeConsole";
import { CommitmentsPanel } from "packages/ludics-react/CommitmentsPanel";
import { DefenseTree } from "packages/ludics-react/DefenseTree";
import { ActInspector } from "@/packages/ludics-react/ActInspector";
import { narrateTrace } from "@/components/dialogue/narrateTrace";
import { mergeDesignsToTree } from "packages/ludics-react/mergeDesignsToTree";
import { CommitmentDelta } from "@/components/dialogue/CommitmentDelta";
import { NLCommitPopover } from "@/components/dialogue/NLCommitPopover";
import { useDialogueTarget } from "@/components/dialogue/DialogueTargetContext";
import type { StepResult } from "@/packages/ludics-core/types";
import LociTreeWithControls from "@/components/ludics/LociTreeWithControls";
import { LudicsForest } from "@/components/ludics/LudicsForest";
import { InsightsBadge, PolarityBadge } from "@/components/ludics/InsightsBadges";
import { InsightsTooltip } from "@/components/ludics/InsightsTooltip";
import type { LudicsInsights } from "@/lib/ludics/computeInsights";
import {
  isPath,
  dualPath,
  type Act as VeAct,
} from "@/packages/ludics-core/ve/pathCheck";

// Phase 1-5 Analysis Components
import {
  AnalysisPanel,
  createDefaultAnalysisState,
  type LudicsAnalysisState,
} from "@/components/ludics/analysis";
import { StrategyInspector } from "@/components/ludics/StrategyInspector";
import { ViewInspector } from "@/components/ludics/ViewInspector";
import { ChronicleViewer } from "@/components/ludics/ChronicleViewer";
import { CorrespondenceViewer } from "@/components/ludics/CorrespondenceViewer";
import { BehaviourHUD } from "@/components/ludics/BehaviourHUD";

// Phase 6 Game Viewer Components (Deliberation Integration)
import {
  ArenaViewer,
  InteractionPlayer,
  LandscapeHeatMap,
  ProofNarrative,
} from "@/components/ludics/viewers";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

// type TraceLike = {
//   steps: { posActId?: string; negActId?: string; locusPath?: string; ts?: number }[];
//   status?: 'ONGOING' | 'CONVERGENT' | 'DIVERGENT';
//   decisiveIndices?: number[];
// };

function asTraceLike(t?: StepResult | null) {
  if (!t) return null;
  return {
    steps: (t.pairs ?? [])
      .map((p) => {
        // Only include if posActId and negActId are defined (as required by ActRef)
        if (typeof p.posActId === "string" && typeof p.negActId === "string") {
          return {
            posActId: p.posActId,
            negActId: p.negActId,
            locusPath: p.locusPath ?? "",
            ts: p.ts ?? 0,
          };
        }
        // If not, skip this entry
        return null;
      })
      .filter(
        (
          x
        ): x is {
          posActId: string;
          negActId: string;
          locusPath: string;
          ts: number;
        } => x !== null
      ),
    // map STUCK → ONGOING so it fits the older UI type
    status: t.status === "STUCK" ? "ONGOING" : t.status,
    decisiveIndices: t.decisiveIndices,
  };
}

/* ------------------------ UI helpers (consistent) ----------------------- */
function ChipBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] backdrop-blur">
      {children}
    </div>
  );
}

function useMicroToast() {
  const [msg, setMsg] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const show = React.useCallback(
    (text: string, kind: "ok" | "err" = "ok", ms = 1600) => {
      setMsg({ kind, text });
      const id = setTimeout(() => setMsg(null), ms);
      return () => clearTimeout(id);
    },
    []
  );
  const node = msg ? (
    <div
      aria-live="polite"
      className={[
        "fixed bottom-4 right-4 z-50 rounded-md border px-3 py-2 text-xs shadow",
        "backdrop-blur bg-white/90",
        msg.kind === "ok"
          ? "border-emerald-200 text-emerald-700"
          : "border-rose-200 text-rose-700",
      ].join(" ")}
    >
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-slate-200/80 bg-white/70 p-0.5 backdrop-blur"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={[
              "px-2.5 py-1 text-xs rounded transition",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-white",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border rounded-lg p-3 bg-white/60">
      <div className="h-4 w-28 bg-slate-200/60 rounded mb-2" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full bg-slate-200/50 rounded mb-1" />
      ))}
    </div>
  );
}

/* --------------------- Phase 6 Game View Panel -------------------------- */
/**
 * GameViewPanel - Phase 6 Deliberation Integration Game Interface
 * 
 * Integrates the Phase 6 viewer components:
 * - InteractionPlayer: Play/replay/simulate game interactions
 * - ArenaViewer: Visualize arena with polarity coloring
 * - LandscapeHeatMap: Strategic landscape visualization
 * - ProofNarrative: Justified narrative from interactions
 */
function GameViewPanel({
  deliberationId,
  designs,
  isLoading,
}: {
  deliberationId: string;
  designs: any[];
  isLoading: boolean;
}) {
  // Game mode state
  const [gameMode, setGameMode] = React.useState<"play" | "replay" | "simulate">("play");
  const [activeTab, setActiveTab] = React.useState<"player" | "arena" | "landscape" | "narrative">("arena");
  const [userPlayer, setUserPlayer] = React.useState<"P" | "O">("P");
  const [aiStrategy, setAiStrategy] = React.useState<"random" | "minimax" | "greedy">("minimax");
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1000);
  
  // Extract proponent and opponent design IDs
  const posDesign = designs.find((d: any) => d.participantId === "Proponent") || designs[0];
  const negDesign = designs.find((d: any) => d.participantId === "Opponent") || designs[1] || designs[0];
  const posDesignId = posDesign?.id || "";

  const negDesignId = negDesign?.id || "";
  
  // Arena state - created on-demand from designs
  const [arena, setArena] = React.useState<any>(null);
  const [arenaLoading, setArenaLoading] = React.useState(false);
  const [arenaError, setArenaError] = React.useState<string | null>(null);
  const [arenaAttempted, setArenaAttempted] = React.useState(false);


  
  // Create arena from designs - using client-side construction to avoid DB issues
  const createArena = React.useCallback(async () => {
    if (!designs || designs.length === 0) return;
    if (arenaAttempted) return; // Don't retry automatically
    
    setArenaLoading(true);
    setArenaError(null);
    setArenaAttempted(true);
    
    try {
      // Build arena directly from designs client-side instead of calling API
      // This avoids the prisma.findMany issue in the API route
      const arenaId = `arena-${deliberationId}-${Date.now()}`;
      
      // Collect all moves from all designs
      const moves: any[] = [];
      let moveIndex = 0;
      
      designs.forEach((design: any) => {
        if (design.acts) {
          design.acts.forEach((act: any) => {
            moves.push({
              id: `${arenaId}-move-${moveIndex++}`,
              address: act.locusPath || act.locus?.path || "0",
              ramification: act.ramification || [],
              player: act.polarity === "P" || act.polarity === "+" ? "P" : "O",
              isInitial: moveIndex === 1,
              content: act.expression || "",
              designId: design.id,
              participantId: design.participantId,
            });
          });
        }
      });
      
      // Calculate stats
      const depths = moves.map(m => (m.address?.split(".").length || 1));
      const maxDepth = Math.max(...depths, 1);
      
      // Create arena object
      const newArena = {
        id: arenaId,
        base: "0",
        moves,
        deliberationId,
        isUniversal: false,
        stats: {
          totalMoves: moves.length,
          maxDepth,
          playerCount: { P: moves.filter(m => m.player === "P").length, O: moves.filter(m => m.player === "O").length },
        },
        enablingRelation: {},
      };
      
      setArena(newArena);
    } catch (err: any) {
      setArenaError(err.message || "Failed to create arena");
    } finally {
      setArenaLoading(false);
    }
  }, [deliberationId, designs, arenaAttempted]);
  
  // Auto-create arena when designs change (only once per mount)
  React.useEffect(() => {
    if (designs && designs.length > 0 && !arena && !arenaLoading && !arenaError && !arenaAttempted) {
      createArena();
    }
  }, [designs, arena, arenaLoading, arenaError, arenaAttempted, createArena]);
  
  // Landscape state - generated from arena data when tab is active
  const [landscapeData, setLandscapeData] = React.useState<any>(null);
  const [landscapeLoading, setLandscapeLoading] = React.useState(false);
  const [landscapeError, setLandscapeError] = React.useState<string | null>(null);
  
  // Interaction state for replay/current game (declared before effects that use it)
  const [currentInteraction, setCurrentInteraction] = React.useState<any>(null);
  const [narrativeData, setNarrativeData] = React.useState<any>(null);
  const [narrativeLoading, setNarrativeLoading] = React.useState(false);
  
  // Generate landscape data from arena when switching to landscape tab
  React.useEffect(() => {
    if (activeTab === "landscape" && arena && !landscapeData && !landscapeLoading) {
      setLandscapeLoading(true);
      setLandscapeError(null);
      
      try {
        // Generate landscape directly from arena moves
        const positions: any[] = [];
        const flowPaths: any[] = [];
        const criticalPoints: any[] = [];
        
        // Build position tree from arena moves
        const movesByAddress = new Map<string, any>();
        arena.moves.forEach((move: any) => {
          const addrStr = move.address || "";
          movesByAddress.set(addrStr, move);
        });
        
        // Calculate positions with coordinates based on depth
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        let posIndex = 0;
        
        // Root position
        positions.push({
          address: [],
          x: 0,
          y: 0,
          strength: 0.5,
          polarity: "+",
          label: "∅",
          size: 1,
        });
        
        // Build positions from moves
        arena.moves.forEach((move: any, idx: number) => {
          const addrStr = move.address || "";
          const depth = addrStr.length;
          const x = (idx % 10) * 60 - 270;
          const y = depth * 80;
          
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          
          // Convert string address to array
          const addressArray = addrStr ? addrStr.split("").map(Number) : [];
          
          positions.push({
            address: addressArray,
            x,
            y,
            strength: 0.3 + Math.random() * 0.4, // Simulated strength
            polarity: depth % 2 === 0 ? "+" : "-",
            label: addrStr || "∅",
            size: move.ramification?.length || 1,
          });
          posIndex++;
        });
        
        // Find branching points as critical points
        const childCounts = new Map<string, number>();
        arena.moves.forEach((move: any) => {
          const addr = move.address || "";
          if (addr.length > 0) {
            const parent = addr.slice(0, -1);
            childCounts.set(parent, (childCounts.get(parent) || 0) + 1);
          }
        });
        
        childCounts.forEach((count, addr) => {
          if (count > 1) {
            criticalPoints.push({
              address: addr ? addr.split("").map(Number) : [],
              type: count > 2 ? "decisive" : "bottleneck",
              description: `${count} branches`,
            });
          }
        });
        
        // Create a simple flow path from move history if available
        if (currentInteraction?.moveHistory?.length > 0) {
          flowPaths.push({
            id: "current-game",
            name: "Current Game Path",
            positions: currentInteraction.moveHistory.map((m: any) => 
              m.address ? m.address.split("").map(Number) : []
            ),
            frequency: 1,
            outcome: currentInteraction.winner || undefined,
          });
        }
        
        const landscape = {
          id: `landscape-${arena.id}`,
          arenaId: arena.id,
          positions,
          flowPaths,
          criticalPoints,
          bounds: { minX: minX - 50, maxX: maxX + 50, minY: minY - 50, maxY: maxY + 50 },
          stats: {
            totalPositions: positions.length,
            avgStrength: 0.5,
            maxDepth: Math.max(...positions.map(p => (p.address as number[]).length), 0),
          },
        };
        
        setLandscapeData({ ok: true, landscape });
      } catch (err: any) {
        setLandscapeError(err.message || "Failed to generate landscape");
      } finally {
        setLandscapeLoading(false);
      }
    }
  }, [activeTab, arena, landscapeData, landscapeLoading, currentInteraction]);
  
  // Helper to generate narrative from move history
  const generateNarrativeFromMoves = React.useCallback((interaction: any) => {
    const moves = interaction?.moveHistory || [];
    const winner = interaction?.winner;
    
    return {
      id: `narrative-${interaction?.id || "local"}`,
      title: "Game Proof Narrative",
      steps: moves.map((move: any, idx: number) => ({
        stepNumber: idx + 1,
        speaker: move.player === "P" ? "Proponent" : "Opponent",
        moveType: idx === 0 ? "opening" : (idx === moves.length - 1 ? "closing" : "response"),
        content: idx === 0 
          ? "Opening move - establishing initial position"
          : `Response to ${moves[idx - 1]?.player === "P" ? "Proponent" : "Opponent"}'s move`,
        address: move.address ? (typeof move.address === "string" ? move.address.split("").map(Number) : move.address) : [],
        justificationChain: Array.from({ length: idx }, (_, i) => i + 1),
        polarity: move.player === "P" ? "+" as const : "-" as const,
        isDaimon: false,
        timestamp: move.timestamp || new Date().toISOString(),
      })),
      conclusion: {
        winner: winner === "P" ? "P" : winner === "O" ? "O" : "draw",
        summary: `Game completed in ${moves.length} moves. ${winner ? `Player ${winner} wins.` : "Game ended in draw."}`,
        keyPoints: [
          `Total moves: ${moves.length}`,
          `Proponent (P) moves: ${moves.filter((m: any) => m.player === "P").length}`,
          `Opponent (O) moves: ${moves.filter((m: any) => m.player === "O").length}`,
        ],
      },
      metadata: {
        interactionId: interaction?.id,
        generatedAt: new Date().toISOString(),
        style: "formal" as const,
      },
    };
  }, []);
  
  // Fetch narrative when switching to narrative tab (if we have a completed interaction)
  React.useEffect(() => {
    if (activeTab === "narrative" && currentInteraction?.id && !narrativeData && !narrativeLoading) {
      setNarrativeLoading(true);
      fetch(`/api/ludics/interactions/${currentInteraction.id}/path?format=narrative`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.narrative) {
            setNarrativeData(data.narrative);
          } else {
            // Fallback: generate from move history
            setNarrativeData(generateNarrativeFromMoves(currentInteraction));
          }
        })
        .catch(() => {
          // Fallback on error: generate from move history
          setNarrativeData(generateNarrativeFromMoves(currentInteraction));
        })
        .finally(() => setNarrativeLoading(false));
    }
  }, [activeTab, currentInteraction?.id, narrativeData, narrativeLoading, generateNarrativeFromMoves, currentInteraction]);
  
  // Handlers
  const handleInteractionComplete = React.useCallback((result: any) => {
    setCurrentInteraction(result.interaction);
    // Immediately fetch/generate narrative for completed interaction
    if (result.interaction?.id) {
      setNarrativeLoading(true);
      fetch(`/api/ludics/interactions/${result.interaction.id}/path?format=narrative`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.narrative) {
            setNarrativeData(data.narrative);
          } else {
            // Fallback: generate from move history
            setNarrativeData(generateNarrativeFromMoves(result.interaction));
          }
        })
        .catch(() => {
          // Fallback on error
          setNarrativeData(generateNarrativeFromMoves(result.interaction));
        })
        .finally(() => setNarrativeLoading(false));
    }
  }, [generateNarrativeFromMoves]);
  
  const handleMoveCallback = React.useCallback((move: any, state: any) => {
    setCurrentInteraction(state);
  }, []);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-white/60">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="animate-pulse">⏳</span>
          Loading designs...
        </div>
      </div>
    );
  }

  // If no designs exist yet, show setup UI
  if (!designs || designs.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎮</div>
          <h3 className="text-lg font-bold text-slate-800">Game Mode</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            No designs exist for this deliberation yet. Create designs using the Forest, Unified, or Split views first, 
            then return here to play the ludic game.
          </p>
          <div className="text-xs text-slate-500 bg-white/60 rounded-lg p-3 max-w-sm mx-auto">
            <p className="font-medium mb-1">Quick Start:</p>
            <ol className="list-decimal list-inside text-left space-y-1">
              <li>Add dialogue moves in the deliberation</li>
              <li>Click &ldquo;Compile&rdquo; to build designs</li>
              <li>Return to Game view to play</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }
  
  // Show arena loading state
  if (arenaLoading) {
    return (
      <div className="border rounded-lg p-4 bg-white/60">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="animate-pulse">🏟️</span>
          Building arena from {designs.length} design(s)...
        </div>
      </div>
    );
  }
  
  // Show arena error with retry
  if (arenaError) {
    return (
      <div className="border rounded-lg p-6 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h3 className="text-lg font-bold text-slate-800">Arena Creation Failed</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto">{arenaError}</p>
          <button
            onClick={() => {
              setArena(null);
              setArenaError(null);
              setArenaAttempted(false);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If arena not created yet (shouldn't happen normally due to auto-create)
  if (!arena) {
    return (
      <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎮</div>
          <h3 className="text-lg font-bold text-slate-800">Ready to Play</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Found {designs.length} design(s). Create an arena to start playing.
          </p>
          <button
            onClick={() => {
              setArenaAttempted(false);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            Create Arena
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 space-y-4">
      {/* Header with mode & player controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <h3 className="font-bold text-slate-800">Game Mode</h3>
          <span className="text-xs text-slate-500 bg-white/70 px-2 py-0.5 rounded">
            Phase 6
          </span>
          {arena.stats && (
            <span className="text-xs text-slate-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {arena.stats.totalMoves ?? arena.moves?.length ?? 0} moves · depth {arena.stats.maxDepth ?? "?"}
            </span>
          )}
        </div>
        
        {/* Mode selector */}
        <Segmented
          ariaLabel="Game mode"
          value={gameMode}
          onChange={setGameMode}
          options={[
            { value: "play", label: "▶ Play" },
            { value: "replay", label: "⏪ Replay" },
            { value: "simulate", label: "🤖 Simulate" },
          ]}
        />
      </div>
      
      {/* Settings row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {gameMode === "play" && (
          <>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">You play as:</span>
              <select
                value={userPlayer}
                onChange={(e) => setUserPlayer(e.target.value as "P" | "O")}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="P">Proponent (+)</option>
                <option value="O">Opponent (−)</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">AI Strategy:</span>
              <select
                value={aiStrategy}
                onChange={(e) => setAiStrategy(e.target.value as "random" | "minimax" | "greedy")}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="random">Random</option>
                <option value="minimax">Minimax</option>
                <option value="greedy">Greedy</option>
              </select>
            </label>
          </>
        )}
        {(gameMode === "replay" || gameMode === "simulate") && (
          <label className="flex items-center gap-1.5">
            <span className="text-slate-600">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value={2000}>0.5x</option>
              <option value={1000}>1x</option>
              <option value={500}>2x</option>
              <option value={250}>4x</option>
            </select>
          </label>
        )}
      </div>
      
      {/* Tab navigation for views */}
      <div className="flex border-b border-slate-200">
        {[
          { key: "player", label: "🎯 Player", desc: "Interactive game" },
          { key: "arena", label: "🏟️ Arena", desc: "Position tree" },
          { key: "landscape", label: "🗺️ Landscape", desc: "Heat map" },
          { key: "narrative", label: "📜 Narrative", desc: "Proof story" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={[
              "px-4 py-2 text-xs font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50",
            ].join(" ")}
            title={tab.desc}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content area */}
      <div className="min-h-[400px] bg-white/60 rounded-lg border border-slate-200 overflow-hidden">
        {activeTab === "player" && (
          <InteractionPlayer
            arenaId={arena.id}
            posDesignId={posDesignId}
            negDesignId={negDesignId}
            mode={gameMode}
            userPlayer={gameMode === "play" ? userPlayer : undefined}
            aiStrategy={aiStrategy}
            playbackSpeed={playbackSpeed}
            onComplete={handleInteractionComplete}
            onMove={handleMoveCallback}
            className="h-full"
          />
        )}
        
        {activeTab === "arena" && (
          <ArenaViewer
            arena={arena}
            currentPath={currentInteraction?.moveHistory}
            showStrength={true}
            mode="tree"
            className="h-full"
          />
        )}
        
        {activeTab === "landscape" && (
          landscapeLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              <span className="animate-pulse">🗺️ Loading landscape analysis...</span>
            </div>
          ) : landscapeError ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-red-500 p-6">
              <span className="text-3xl mb-2">⚠️</span>
              <p>Failed to load landscape</p>
              <p className="text-xs mt-1">{landscapeError}</p>
              <button
                onClick={() => {
                  setLandscapeData(null);
                  setLandscapeError(null);
                }}
                className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs"
              >
                Retry
              </button>
            </div>
          ) : landscapeData?.landscape ? (
            <LandscapeHeatMap
              landscape={landscapeData.landscape}
              showFlowPaths={true}
              showCriticalPoints={true}
              colorScheme="heat"
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-sm text-slate-500 p-6">
              <span className="text-3xl mb-2">🗺️</span>
              <p>No landscape data available.</p>
              <p className="text-xs mt-1">
                {arena ? "Loading landscape analysis..." : "Create an arena first by starting a game."}
              </p>
            </div>
          )
        )}
        
        {activeTab === "narrative" && (
          narrativeLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              <span className="animate-pulse">📜 Loading narrative...</span>
            </div>
          ) : narrativeData ? (
            <ProofNarrative
              narrative={narrativeData}
              showJustifications={true}
              expandable={true}
              defaultExpanded={false}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-sm text-slate-500 p-6">
              <span className="text-3xl mb-2">📜</span>
              <p>No narrative available yet.</p>
              <p className="text-xs mt-1">Complete an interaction to generate a proof narrative.</p>
            </div>
          )
        )}
      </div>
      
      {/* Status bar */}
      {currentInteraction && (
        <div className="flex items-center justify-between text-xs bg-white/70 rounded-lg px-3 py-2 border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-slate-600">
              Status: <span className="font-medium">{currentInteraction.status}</span>
            </span>
            <span className="text-slate-600">
              Moves: <span className="font-medium">{currentInteraction.moveHistory?.length ?? 0}</span>
            </span>
            {currentInteraction.currentPlayer && (
              <span className="text-slate-600">
                Turn: <span className={currentInteraction.currentPlayer === "P" ? "text-blue-600 font-medium" : "text-red-600 font-medium"}>
                  {currentInteraction.currentPlayer === "P" ? "Proponent" : "Opponent"}
                </span>
              </span>
            )}
          </div>
          {currentInteraction.winner && (
            <span className={[
              "px-2 py-0.5 rounded-full font-medium",
              currentInteraction.winner === "P" ? "bg-blue-100 text-blue-700" :
              currentInteraction.winner === "O" ? "bg-red-100 text-red-700" :
              "bg-slate-100 text-slate-700"
            ].join(" ")}>
              Winner: {currentInteraction.winner === "P" ? "Proponent" : currentInteraction.winner === "O" ? "Opponent" : "Draw"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Types ---------------------------------- */
// type StepResult = {
//   steps: Array<{ posActId: string; negActId: string; ts?: number }>;
//   status: 'ONGOING' | 'CONVERGENT' | 'DIVERGENT';
//   endedAtDaimonForParticipantId?: string;
//   endorsement?: { locusPath: string; byParticipantId: string; viaActId: string };
//   decisiveIndices?: number[];
//   usedAdditive?: Record<string, string>;
// };

/* -------------------------------- Panel --------------------------------- */
export default function LudicsPanel({
  deliberationId,
  proDesignId,
  oppDesignId,
}: {
  deliberationId: string;
  proDesignId?: string;
  oppDesignId?: string;
}) {
  // Designs SWR
  const {
    data: designsData,
    mutate: mutateDesigns,
    error: designsError,
    isLoading: isDesignsLoading,
  } = useSWR(
    `/api/ludics/designs?deliberationId=${encodeURIComponent(deliberationId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const designs = designsData?.designs ?? [];
  const pro =
    designs.find((d: any) => d.participantId === "Proponent") ?? designs[0];
  const opp =
    designs.find((d: any) => d.participantId === "Opponent") ??
    designs[1] ??
    designs[0];

  // Panel local UI state
  const [trace, setTrace] = React.useState<StepResult | null>(null);
  const [badges, setBadges] = React.useState<Record<number, string>>({});
  const [stable, setStable] = React.useState<number | null>(null);
  const [orthogonal, setOrthogonal] = React.useState<boolean | null>(null);
  const [focusIdx, setFocusIdx] = React.useState<number | null>(null);
  const [showGuide, setShowGuide] = React.useState(false);
  const [phase, setPhase] = React.useState<"neutral" | "focus-P" | "focus-O">(
    "neutral"
  );
  const [viewMode, setViewMode] = React.useState<"forest" | "unified" | "split" | "game">(
    "forest"
  );
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitPath, setCommitPath] = React.useState<string | null>(null);

  // NLI per-scope results (Task 6: Week 2)
  const [nliResultsByScope, setNliResultsByScope] = React.useState<
    Record<string, { contradictions: number; timestamp: string }>
  >({});

  // Stable sets per-scope results (Task 7: Week 2)
  const [stableSetsByScope, setStableSetsByScope] = React.useState<
    Record<string, number>
  >({});

  // Scoped designs state - activeScope filters which scope to show/analyze
  const [activeScope, setActiveScope] = React.useState<string | null>(null);

  // Append Daimon controls (Task 5: Week 2) - moved here before useMemo that uses them
  const [showAppendDaimon, setShowAppendDaimon] = React.useState(false);
  const [daimonTargetLocus, setDaimonTargetLocus] = React.useState<string>("");
  const [daimonTargetScope, setDaimonTargetScope] = React.useState<string | null>(null);

  // Phase 1-5 Analysis Panel State
  const [showAnalysisPanel, setShowAnalysisPanel] = React.useState(false);
  const [analysisState, setAnalysisState] = React.useState<LudicsAnalysisState>(() =>
    createDefaultAnalysisState()
  );
  const handleAnalysisUpdate = React.useCallback((update: Partial<LudicsAnalysisState>) => {
    setAnalysisState((prev) => ({ ...prev, ...update }));
  }, []);

  // Compute scopes and labels
  const scopes = React.useMemo(() => {
    const scopeSet = new Set<string>();
    designs.forEach((d: any) => {
      const scope = d.scope ?? "legacy";
      scopeSet.add(scope);
    });
    return Array.from(scopeSet);
  }, [designs]);

  const scopeLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    designs.forEach((d: any) => {
      const scope = d.scope ?? "legacy";
      if (scope === "legacy") {
        labels[scope] = "Legacy (All)";
      } else if (d.scopeMetadata?.label) {
        labels[scope] = d.scopeMetadata.label;
      } else {
        labels[scope] = scope;
      }
    });
    return labels;
  }, [designs]);

  // Auto-select first scope if activeScope is null
  React.useEffect(() => {
    if (scopes.length > 0 && !activeScope) {
      setActiveScope(scopes[0]);
    }
  }, [scopes, activeScope]);

  // Compute available loci for daimon append (from ALL designs in scope, not just Opponent)
  const availableLoci = React.useMemo(() => {
    const targetScope = daimonTargetScope ?? activeScope;
    const scopeDesigns = designs.filter(
      (d: any) => (d.scope ?? "legacy") === targetScope
    );
    
    // Get unique locus paths from ALL acts across all designs in scope
    const lociSet = new Set<string>();
    scopeDesigns.forEach((design: any) => {
      if (design.acts) {
        design.acts.forEach((act: any) => {
          if (act.locus?.path) {
            lociSet.add(act.locus.path);
          }
        });
      }
    });
    
    // Always include root locus "0" as an option
    if (lociSet.size === 0) {
      lociSet.add("0");
    }
    
    return Array.from(lociSet).sort((a, b) => {
      // Sort by depth (number of dots) then alphabetically
      const depthA = (a.match(/\./g) || []).length;
      const depthB = (b.match(/\./g) || []).length;
      return depthA - depthB || a.localeCompare(b);
    });
  }, [designs, daimonTargetScope, activeScope]);

  // Auto-select first locus when available loci change
  React.useEffect(() => {
    if (availableLoci.length > 0 && !daimonTargetLocus) {
      setDaimonTargetLocus(availableLoci[0]);
    }
  }, [availableLoci, daimonTargetLocus]);

  // Sync daimon target scope with active scope
  React.useEffect(() => {
    if (!showAppendDaimon) {
      setDaimonTargetScope(activeScope);
    }
  }, [showAppendDaimon, activeScope]);

  // Fetch Ludics insights (Phase 1: Week 2)
  const { data: insightsData, isLoading: insightsLoading } = useSWR<{
    ok: boolean;
    insights: LudicsInsights | null;
  }>(
    `/api/ludics/insights?deliberationId=${deliberationId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 } // Cache for 1 min client-side
  );

  const [showAttach, setShowAttach] = React.useState(false);
  const [attachLoading, setAttachLoading] = React.useState(false);
  const [attachPick, setAttachPick] = React.useState(""); // selected workId
  const [attachTargetScope, setAttachTargetScope] = React.useState<string | null>(null); // Task 8: Week 2
  const [attachCandidates, setAttachCandidates] = React.useState<
    { id: string; title: string; theoryType: "IH" | "TC" | "DN" | "OP" }[]
  >([]);

  // AIF Sync Status
  const [syncStatus, setSyncStatus] = React.useState<{
    totalLudicActs: number;
    significantActs: number;
    daimonActs: number;
    concessionActs: number;
    regularActs: number;
    syncedSignificant: number;
    totalSynced: number;
    dialogueMovesWithLudics: number;
    syncPercentage: number;
    needsSync: number;
  } | null>(null);
  const [showSyncPanel, setShowSyncPanel] = React.useState(false);

  // Fetch sync status when panel opens
  React.useEffect(() => {
    if (!showSyncPanel) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ludics/aif-sync?deliberationId=${encodeURIComponent(deliberationId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setSyncStatus(data.stats);
        }
      } catch (e) {
        console.error("Failed to fetch sync status:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [showSyncPanel, deliberationId]);

  // When the attach section opens, list IH/TC works in this deliberation

  // When the attach section opens, list IH/TC works in this deliberation
  React.useEffect(() => {
    if (!showAttach) return;
    // Sync scope with active scope when opening
    setAttachTargetScope(activeScope);
    let cancelled = false;
    (async () => {
      try {
        setAttachLoading(true);
        const r = await fetch(
          `/api/works?deliberationId=${encodeURIComponent(deliberationId)}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (cancelled) return;
        setAttachCandidates(
          (j.works ?? []).filter(
            (w: any) => w.theoryType === "IH" || w.theoryType === "TC"
          )
        );
      } finally {
        if (!cancelled) setAttachLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAttach, deliberationId]);

  const { target } = useDialogueTarget();
  const targetIdFromContext = target?.id ?? null;
  const targetTypeFromContext = target?.type ?? "claim"; // sensible default

  const commitAtPath = React.useCallback((path: string) => {
    setCommitPath(path);
    setCommitOpen(true);
  }, []);

  // Broadcast phase so other components (e.g., row chips) can derive commitOwner
  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("ludics:phase", { detail: { phase } })
    );
  }, [phase]);

  // Throttled compile-step control
  const compRef = React.useRef(false);
  const lastCompileAt = React.useRef(0);
  const [busy, setBusy] = React.useState<
    | false
    | "compile"
    | "step"
    | "nli"
    | "orth"
    | "append"
    | "fix-all"
    | "sync-aif"
    | "sync-status"
    | "sync-verify"
  >(false);
  const toast = useMicroToast();

  // Map acts by id from current designs (for NLI/Inspector, heatmap)
  const byAct = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const d of designs) for (const a of d.acts ?? []) map.set(a.id, a);
    return map;
  }, [designs]);

  // ------------------------------------------------------------------
  // Orthogonal SWR (trace   acts for narration & stable heatmap)
  const { data: orthoData, mutate: refreshOrth } = useSWR(
    deliberationId
      ? `/api/ludics/orthogonal?dialogueId=${encodeURIComponent(
          deliberationId
        )}&phase=neutral`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    const h = () => refreshOrth();
    window.addEventListener("dialogue:moves:refresh", h as any);
    return () => window.removeEventListener("dialogue:moves:refresh", h as any);
  }, [refreshOrth]);

  // keep local trace in sync with ortho trace
  React.useEffect(() => {
    const t = orthoData?.trace;
    if (t) {
      setTrace({
        pairs: t.pairs ?? [],
        status: t.status,
        endedAtDaimonForParticipantId: t.endedAtDaimonForParticipantId,
        endorsement: t.endorsement,
        decisiveIndices: t.decisiveIndices,
        usedAdditive: t.usedAdditive,
        daimonHints: t.daimonHints,
        reason: t.reason,
      });
    }
  }, [orthoData]);

  // 1) step index by act id (for tiny ① ② superscripts)
  const stepIndexByActId = React.useMemo(() => {
    const m: Record<string, number> = {};
    (trace?.pairs ?? []).forEach((p, i) => {
      // if (!p.posActId && !p.negActId) return;
      // if (m[p.posActId || ''] && m[p.negActId || '']) return; // already indexed
      if (p.posActId !== undefined) m[p.posActId] = i + 1;
      if (p.negActId !== undefined) m[p.negActId] = i + 1;
    });
    return m;
  }, [trace]);

  // 2) locus heatmap (frequency; bump decisive hits)
  const heatmap = React.useMemo(() => {
    const hm: Record<string, number> = {};
    const t = orthoData?.trace;
    const acts = (orthoData?.acts ?? {}) as Record<
      string,
      { locusPath?: string }
    >;
    if (!t) return hm;
    (t.pairs ?? []).forEach((p: { posActId?: string; negActId?: string }) => {
      const path = acts[p.posActId ?? ""]?.locusPath ?? acts[p.negActId ?? ""]?.locusPath;
      if (!path) return;
      hm[path] = (hm[path] ?? 0) + 1;
    });
    (t.decisiveIndices ?? []).forEach((i: number) => {
      const p = t.pairs?.[i];
      if (!p) return;
      const path = acts[p.posActId]?.locusPath ?? acts[p.negActId]?.locusPath;
      if (!path) return;
      hm[path] = (hm[path] ?? 0) + 2; // extra weight for decisive
    });
    return hm;
  }, [orthoData]);

  // 3) focused locus path (keeps narration ↔ tree synced)
  const focusPath = React.useMemo(() => {
    if (focusIdx == null || !trace) return null;
    const p = trace.pairs[focusIdx];
    if (!p) return null; // Handle summary lines that don't have pairs
    const pos = byAct.get(p.posActId ?? "");
    const neg = byAct.get(p.negActId ?? "");
    return pos?.locus?.path ?? neg?.locus?.path ?? null;
  }, [focusIdx, trace, byAct]);

  // Handle "Focus" click from the tree toolbar
  const onFocusPathChange = React.useCallback(
    (path: string) => {
      const idx = (trace?.pairs ?? []).findIndex(
        (p) =>
          String(byAct.get(p.posActId ?? "")?.locus?.path) === path ||
          String(byAct.get(p.negActId ?? "")?.locus?.path) === path
      );
      if (idx >= 0) setFocusIdx(idx);
    },
    [trace, byAct]
  );
const suggestClose = React.useCallback((path: string) => {
  const t = orthoData?.trace;
  if (!t) return false;
  const last = t.pairs?.[t.pairs.length - 1]?.locusPath;
  return last === path && (t.status === 'CONVERGENT' || t.status === 'STUCK');
}, [orthoData]);
  // Narration lines
  const actsForNarration = orthoData?.acts ?? {};
  const lines = orthoData?.trace
    ? narrateTrace(orthoData.trace, actsForNarration)
    : [];

  /* ------------------------------- Actions ------------------------------- */
  const compileStep = React.useCallback(
    async (p: "neutral" | "focus-P" | "focus-O" = phase) => {
      const now = Date.now();
      if (now - lastCompileAt.current < 1200) return;
      if (compRef.current) return;
      compRef.current = true;
      setBusy("compile");
      try {
        // Use new /api/ludics/compile endpoint (uses existing designs' scoping)
        const compileRes = await fetch("/api/ludics/compile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            forceRecompile: true,
          }),
        }).then((r) => r.json());

        if (!compileRes.ok) {
          toast.show(compileRes.error || "Compilation failed", "err");
          return;
        }

        // Sync to AIF
        await fetch("/api/ludics/sync-to-aif", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deliberationId }),
        }).catch(() => {
          console.warn("[LudicsPanel] AIF sync failed (non-fatal)");
        });

        // Invalidate insights cache
        await fetch("/api/ludics/insights/invalidate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deliberationId }),
        }).catch(() => {
          console.warn("[LudicsPanel] Cache invalidation failed (non-fatal)");
        });

        // Step the active scope if available
        await mutateDesigns();
        
        // Note: We don't auto-step here to avoid circular dependency
        // User can click Step button after compilation
      } finally {
        compRef.current = false;
        setBusy(false);
        lastCompileAt.current = Date.now();
      }
    },
    [deliberationId, phase, mutateDesigns, activeScope, toast]
  );
  const compileStepRef = React.useRef(compileStep);
  React.useEffect(() => {
    compileStepRef.current = compileStep;
  }, [compileStep]);

  React.useEffect(() => {
    function onRefresh(e: any) {
      const id = e?.detail?.deliberationId;
      if (id && id !== deliberationId) return;
      compileStepRef.current("neutral");
    }
    window.addEventListener("dialogue:moves:refresh", onRefresh);
    return () =>
      window.removeEventListener("dialogue:moves:refresh", onRefresh);
  }, [deliberationId]);

  const step = React.useCallback(async () => {
    if (!designs?.length) return;
    setBusy("step");
    try {
      // Filter designs by active scope
      const scopeDesigns = designs.filter(
        (d: any) => (d.scope ?? "legacy") === activeScope
      );

      if (scopeDesigns.length === 0) {
        toast.show(
          `No designs found for scope: ${scopeLabels[activeScope ?? "legacy"] || activeScope}`,
          "err"
        );
        return;
      }

      const pos = scopeDesigns.find(
        (d: any) => d.participantId === "Proponent"
      );
      const neg = scopeDesigns.find(
        (d: any) => d.participantId === "Opponent"
      );

      if (!pos || !neg) {
        toast.show(
          `No P/O pair found for scope: ${scopeLabels[activeScope ?? "legacy"] || activeScope}`,
          "err"
        );
        return;
      }

      const res = await fetch("/api/ludics/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dialogueId: deliberationId,
          posDesignId: pos.id,
          negDesignId: neg.id,
        }),
      }).then((r) => r.json());
      setTrace({
        pairs: res.pairs || [],
        status: res.status,
        endedAtDaimonForParticipantId: res.endedAtDaimonForParticipantId,
        endorsement: res.endorsement,
        decisiveIndices: res.decisiveIndices,
        usedAdditive: res.usedAdditive,
        daimonHints: res.daimonHints,
        reason: res.reason,
      });
      const scopeLabel = scopeLabels[activeScope ?? "legacy"] || activeScope;
      const pairCount = res.pairs?.length ?? 0;
      toast.show(
        pairCount > 0 
          ? `Stepped ${pairCount} pair(s) in scope: ${scopeLabel}`
          : `No pairs matched in scope: ${scopeLabel} (${res.status})`,
        pairCount > 0 ? "ok" : "err"
      );
    } finally {
      setBusy(false);
    }
  }, [deliberationId, designs, activeScope, scopeLabels, toast]);

  const appendDaimonToNext = React.useCallback(async () => {
    // Validate inputs
    if (!daimonTargetLocus) {
      toast.show("Please select a locus for the daimon", "err");
      return;
    }

    const targetScope = daimonTargetScope ?? activeScope;
    
    setBusy("append");
    try {
      // Fetch fresh designs to avoid stale IDs after Compile
      const freshDesignsRes = await fetch(
        `/api/ludics/designs?deliberationId=${encodeURIComponent(deliberationId)}`
      );
      const freshDesignsData = await freshDesignsRes.json();
      const freshDesigns = freshDesignsData?.designs ?? [];
      
      if (!freshDesigns.length) {
        toast.show("No designs found. Try running Compile first.", "err");
        return;
      }
      
      // Filter designs by target scope
      const scopeDesigns = freshDesigns.filter(
        (d: any) => (d.scope ?? "legacy") === targetScope
      );
      
      const B = scopeDesigns.find((d: any) => d.participantId === "Opponent");
      if (!B) {
        toast.show(
          `No Opponent design found for scope: ${scopeLabels[targetScope ?? "legacy"] || targetScope}`,
          "err"
        );
        return;
      }
      
      const res = await fetch("/api/ludics/acts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          designId: B.id,
          enforceAlternation: false,
          acts: [{ 
            kind: "DAIMON",
            locusPath: daimonTargetLocus,
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to append daimon");
      }
      
      const scopeLabel = scopeLabels[targetScope ?? "legacy"] || targetScope;
      toast.show(
        `Daimon appended at ${daimonTargetLocus} in scope: ${scopeLabel}`,
        "ok"
      );
      
      // Refresh designs in SWR cache
      await mutateDesigns();
      
      // Re-step only the affected scope
      if (targetScope === activeScope) {
        await step();
      }
      
      // Close the append panel after success
      setShowAppendDaimon(false);
    } catch (e: any) {
      toast.show(e?.message || "Append failed", "err");
    } finally {
      setBusy(false);
    }
  }, [
    deliberationId,
    daimonTargetLocus,
    daimonTargetScope,
    activeScope,
    scopeLabels,
    step,
    mutateDesigns,
    toast,
  ]);

  const pickAdditive = React.useCallback(
    async (parentPath: string, child: string) => {
      if (!designs?.length) return;
      const pos =
        designs.find((d: any) => d.participantId === "Proponent") ?? designs[0];
      const neg =
        designs.find((d: any) => d.participantId === "Opponent") ??
        designs[1] ??
        designs[0];
      try {
        const r = await fetch("/api/ludics/additive/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dialogueId: deliberationId,
            posDesignId: pos.id,
            negDesignId: neg.id,
            parentPath,
            childSuffix: child,
          }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Pick failed");
        toast.show(`Choice locked for ${parentPath} → ${child}`, "ok");
        await compileStep("focus-P");
      } catch (e: any) {
        toast.show(`Pick failed: ${e?.message ?? "error"}`, "err");
      }
    },
    [designs, deliberationId, compileStep, toast]
  );

  const checkOrthogonal = React.useCallback(async () => {
    if (!designs?.length) return;
    setBusy("orth");
    try {
      // Filter designs by active scope
      const scopeDesigns = designs.filter(
        (d: any) => (d.scope ?? "legacy") === activeScope
      );

      const A = scopeDesigns.find((d: any) => d.participantId === "Proponent");
      const B = scopeDesigns.find((d: any) => d.participantId === "Opponent");
      
      if (!A || !B) {
        toast.show(
          `Missing P/O pair for scope: ${scopeLabels[activeScope ?? "legacy"] || activeScope}`,
          "err"
        );
        return;
      }
      const r = await fetch(
        `/api/ludics/orthogonal?dialogueId=${encodeURIComponent(
          deliberationId
        )}&posDesignId=${A.id}&negDesignId=${B.id}`
      ).then((r) => r.json());
      setOrthogonal(r?.orthogonal ?? null);
      if (r?.trace) {
        setTrace({
          pairs: r.trace.pairs ?? [],
          status: r.trace.status,
          endedAtDaimonForParticipantId: r.trace.endedAtDaimonForParticipantId,
          endorsement: r.trace.endorsement,
          decisiveIndices: r.trace.decisiveIndices,
          usedAdditive: r.trace.usedAdditive,
          daimonHints: r.trace.daimonHints,
          reason: r.trace.reason,
        });
      }
      const scopeLabel = scopeLabels[activeScope ?? "legacy"] || activeScope;
      toast.show(
        r?.orthogonal
          ? `Orthogonal ✓ (${scopeLabel})`
          : `Not orthogonal (${scopeLabel})`,
        r?.orthogonal ? "ok" : "err"
      );
      refreshOrth();
    } finally {
      setBusy(false);
    }
  }, [designs, deliberationId, activeScope, scopeLabels, toast, refreshOrth]);

  const analyzeNLI = React.useCallback(async () => {
    if (!trace || !designs?.length) return;
    setBusy("nli");
    try {
      const pairs = (trace.pairs ?? []).map((p) => ({
        premise: String(byAct.get(p.posActId ?? "")?.expression ?? ""),
        hypothesis: String(byAct.get(p.negActId ?? "")?.expression ?? ""),
      })).filter(p => p.premise && p.hypothesis); // Filter out empty pairs
      
      if (pairs.length === 0) {
        toast.show("No valid pairs to analyze", "err");
        return;
      }
      
      const res = await fetch("/api/nli/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairs }), // Fixed: was 'items', API expects 'pairs'
      }).then((r) => r.json());

      const TAU = Number(process.env.NEXT_PUBLIC_CQ_NLI_THRESHOLD ?? "0.72");
      const b: Record<number, string> = {};
      let contradictionCount = 0;
      
      res?.results?.forEach((r: any, i: number) => {
        if (r?.relation === "contradicts" && (r.score ?? 0) >= TAU) {
          b[i] = "NLI⊥";
          contradictionCount++;
        }
      });
      
      setBadges(b);
      
      // Store NLI results per scope
      const scopeKey = activeScope ?? "legacy";
      const scopeLabel = scopeLabels[scopeKey] || scopeKey;
      
      setNliResultsByScope(prev => ({
        ...prev,
        [scopeKey]: {
          contradictions: contradictionCount,
          timestamp: new Date().toISOString(),
        },
      }));
      
      // Persist to trace extJson (if trace has an ID)
      // Note: This would require a trace update endpoint which may not exist yet
      // For now, we store in component state
      
      toast.show(
        contradictionCount > 0
          ? `Found ${contradictionCount} contradiction(s) in scope: ${scopeLabel}`
          : `No contradictions found in scope: ${scopeLabel}`,
        contradictionCount > 0 ? "err" : "ok"
      );
    } finally {
      setBusy(false);
    }
  }, [trace, designs, byAct, activeScope, scopeLabels, toast]);

  const checkStable = React.useCallback(async () => {
    setBusy("orth"); // Reuse busy state
    try {
      const scopeKey = activeScope ?? "legacy";
      const scopeLabel = scopeLabels[scopeKey] || scopeKey;
      
      // Add scope parameter to API call
      const url = new URL(
        `/api/af/stable`,
        window.location.origin
      );
      url.searchParams.set("deliberationId", deliberationId);
      
      // Add scope parameter if not legacy
      if (scopeKey !== "legacy") {
        url.searchParams.set("scope", scopeKey);
      }
      
      const res = await fetch(url.toString()).then((r) => r.json());
      
      if (!res.ok) {
        toast.show(res.error || "Failed to compute stable sets", "err");
        return;
      }
      
      const count = res.count ?? 0;
      
      // Update global stable state (for backward compat)
      setStable(count);
      
      // Store per-scope result
      setStableSetsByScope(prev => ({
        ...prev,
        [scopeKey]: count,
      }));
      
      toast.show(
        `Found ${count} stable extension(s) in scope: ${scopeLabel}`,
        "ok"
      );
    } catch (e: any) {
      toast.show("Stable sets computation failed", "err");
    } finally {
      setBusy(false);
    }
  }, [deliberationId, activeScope, scopeLabels, toast]);

  // Build prefix path up to index i from the trace, as (pol,locus) acts:
  const prefixActs = React.useCallback(
    (i: number): VeAct[] => {
      const out: VeAct[] = [];
      for (let k = 0; k <= i; k++) {
        const p = trace?.pairs?.[k];
        if (!p) break;
        const P = byAct.get(p.posActId ?? "");
        const O = byAct.get(p.negActId ?? "");
        if (P?.locus?.path)
          out.push({ pol: "pos", locus: String(P.locus.path) });
        if (O?.locus?.path)
          out.push({ pol: "neg", locus: String(O.locus.path) });
      }
      return out;
    },
    [trace, byAct]
  );

  // ⊙ failures per pair index (i): dual(prefix) is *not* a path
  const revFail = React.useMemo(() => {
    const m: Record<number, true> = {};
    const n = trace?.pairs?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const acts = prefixActs(i);
      const dual = dualPath(acts);
      const ok = isPath(dual).ok;
      if (!ok) m[i] = true;
    }
    return m;
  }, [trace, prefixActs]);

  const onConcede = React.useCallback(
    async (locus: string, proposition: string, conceding?: "Proponent" | "Opponent") => {
      const concedingParticipantId = conceding ?? "Opponent";
      const receiver = concedingParticipantId === "Proponent" ? "Opponent" : "Proponent";
      
      // Find the conceding design
      const scopeDesigns = designs.filter(
        (d: any) => (d.scope ?? "legacy") === activeScope
      );
      const concedingDesign = scopeDesigns.find(
        (d: any) => d.participantId === concedingParticipantId
      );
      
      if (!concedingDesign) {
        toast.show(`No ${concedingParticipantId} design found`, "err");
        return;
      }
      
      try {
        await fetch("/api/ludics/concession", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dialogueId: deliberationId,
            concedingParticipantId,
            receiverParticipantId: receiver,
            anchorDesignId: concedingDesign.id,
            anchorLocus: locus,
            proposition: { text: proposition, csLocus: locus },
          }),
        });
        await mutateDesigns();
        await step();
        toast.show(`Concession recorded at ${locus}`, "ok");
      } catch (e: any) {
        toast.show(e?.message || "Concession failed", "err");
      }
    },
    [deliberationId, designs, activeScope, mutateDesigns, step, toast]
  );

  const onForceConcession = React.useCallback(
    async (locus: string, text: string, target?: "Proponent" | "Opponent") => {
      if (!designs?.length) return;
      
      const targetParticipant = target ?? "Opponent";
      const scopeDesigns = designs.filter(
        (d: any) => (d.scope ?? "legacy") === activeScope
      );
      const targetDesign = scopeDesigns.find(
        (d: any) => d.participantId === targetParticipant
      );
      
      if (!targetDesign) {
        toast.show(`No ${targetParticipant} design found`, "err");
        return;
      }
      
      try {
        await fetch("/api/ludics/judge/force", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dialogueId: deliberationId,
            action: "FORCE_CONCESSION",
            target: { designId: targetDesign.id, locusPath: locus },
            data: { text },
          }),
        });
        await mutateDesigns();
        await step();
        toast.show(`Forced concession at ${locus}`, "ok");
      } catch (e: any) {
        toast.show(e?.message || "Force concession failed", "err");
      }
    },
    [designs, deliberationId, activeScope, mutateDesigns, step, toast]
  );

  const onCloseBranch = React.useCallback(
    async (locus: string, target?: "Proponent" | "Opponent") => {
      if (!designs?.length) return;
      
      const targetParticipant = target ?? "Opponent";
      const scopeDesigns = designs.filter(
        (d: any) => (d.scope ?? "legacy") === activeScope
      );
      const targetDesign = scopeDesigns.find(
        (d: any) => d.participantId === targetParticipant
      );
      
      if (!targetDesign) {
        toast.show(`No ${targetParticipant} design found`, "err");
        return;
      }
      
      try {
        await fetch("/api/ludics/judge/force", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dialogueId: deliberationId,
            action: "CLOSE_BRANCH",
            target: { designId: targetDesign.id, locusPath: locus },
          }),
        });
        await mutateDesigns();
        await step();
        toast.show(`Branch closed at ${locus}`, "ok");
      } catch (e: any) {
        toast.show(e?.message || "Close branch failed", "err");
      }
    },
    [designs, deliberationId, activeScope, mutateDesigns, step, toast]
  );

  //    const commitAtPath = React.useCallback(async (path: string) => {
  //    const label = window.prompt('New commitment label (fact):', '');
  //    if (!label) return;
  //    try {
  //      await fetch('/api/commitments/apply', {
  //        method:'POST', headers:{'content-type':'application/json'},
  //        body: JSON.stringify({
  //          dialogueId: deliberationId,
  //          ownerId: 'Proponent',               // or current side
  //          autoPersistDerived: false,
  //          ops: { add: [{ label, basePolarity: 'pos', baseLocusPath: path, entitled: true }] }
  //        })
  //      });
  //      window.dispatchEvent(new CustomEvent('dialogue:cs:refresh', { detail: { dialogueId: deliberationId, ownerId: 'Proponent' }}));
  //      toast.show(`Committed “${label}” @ ${path}`, 'ok');
  //    } catch (e:any) {
  //      toast.show('Commit failed', 'err');
  //    }
  // }, [deliberationId, toast]);

  /* ------------------------- Sync + keyboard hooks ----------------------- */
  React.useEffect(() => {
    const onFocus = async (e: any) => {
      const { phase } = e?.detail || {};
      await compileStep(phase ?? "focus-P");
    };
    window.addEventListener("ludics:focus", onFocus as any);
    return () => window.removeEventListener("ludics:focus", onFocus as any);
  }, [compileStep]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key === "c") compileStep();
      else if (e.key === "s") step();
      else if (e.key === "o") checkOrthogonal();
      else if (e.key === "n") analyzeNLI();
      else if (e.key === "l") setShowGuide((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [compileStep, step, checkOrthogonal, analyzeNLI]);

  /* ------------------------------ Rendering ------------------------------ */
  const steps = trace?.pairs ?? [];
  const actsCount = designs.reduce(
    (acc: number, d: any) => acc + (d.acts?.length ?? 0),
    0
  );
  const traceLike = asTraceLike(trace) ?? {
    steps: [],
    status: "ONGOING" as const,
  };

  return (
    <div className="space-y-3 rounded-2xl  p-3 panelv2 hover:translate-y-0 bg-white/10 backdrop-blur-md">
      {/* Ludics Insights Section (Phase 1: Week 2) */}
      {insightsData?.insights && (
        <div className="rounded-lg bg-white/80 border border-slate-200/80 p-3 space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Interaction Metrics
            </h3>
            <div className="flex items-center gap-4">
              <InsightsTooltip insights={insightsData.insights}>
                <InsightsBadge
                  complexityScore={insightsData.insights.interactionComplexity}
                  size="sm"
                />
              </InsightsTooltip>
              <PolarityBadge
                positive={insightsData.insights.polarityDistribution.positive}
                negative={insightsData.insights.polarityDistribution.negative}
                neutral={insightsData.insights.polarityDistribution.neutral}
                size="sm"
              />
            </div>
         
          <div className="flex border-l pl-8 ml-4 border-slate-500/50 tracking-wide  text-xs gap-8">
            <div className="text-center ">
              <div className="font-bold text-slate-900">{insightsData.insights.totalActs}</div>
              <div className="text-slate-600">Acts</div>

            </div>

            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.totalLoci}</div>
              <div className="text-slate-600">Loci</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.maxDepth}</div>
              <div className="text-slate-600">Depth</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900">{insightsData.insights.branchFactor.toFixed(1)}</div>
              <div className="text-slate-600">Branches</div>
            </div>
          </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChipBar>
            <span>|D| {designs.length}</span>
            <span>|acts| {actsCount}</span>
            <span>|pairs| {steps.length}</span>
            {trace?.status && (
              <span
                className={[
                  "px-1.5 py-0.5 rounded border",
                  trace.status === "CONVERGENT"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : trace.status === "DIVERGENT"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-slate-50 border-slate-200 text-slate-700",
                ].join(" ")}
              >
                {trace.status === "CONVERGENT" ? "† CONVERGENT" : trace.status}
              </span>
            )}
            {typeof stable === "number" && <span>stable {stable}</span>}
            {orthogonal !== null && (
              <span
                className={[
                  "px-1.5 py-0.5 rounded border",
                  orthogonal
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700",
                ].join(" ")}
              >
                {orthogonal ? "orthogonal ✓" : "not orthogonal"}
              </span>
            )}
          </ChipBar>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Scope Selector (for filtering results) */}
          {scopes.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] backdrop-blur">
              <label className="text-slate-600 font-medium">Scope:</label>
              <select
                value={activeScope ?? ""}
                onChange={(e) => setActiveScope(e.target.value || null)}
                className="border-0 bg-transparent text-[11px] font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 max-w-[200px]"
                disabled={!!busy}
              >
                {scopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scopeLabels[scope] || scope}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Segmented
            ariaLabel="Phase"
            value={phase}
            onChange={(v) => {
              setPhase(v);
              compileStep(v);
            }}
            options={[
              { value: "neutral", label: "Neutral" },
              { value: "focus-P", label: "Focus P" },
              { value: "focus-O", label: "Focus O" },
            ]}
          />
          <Segmented
            ariaLabel="Tree layout"
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { value: "forest", label: "Forest" },
              { value: "unified", label: "Unified" },
              { value: "split", label: "Split" },
              { value: "game", label: "🎮 Game" },
            ]}
          />

          <button
            className="btnv2"
            aria-label="Compile from moves"
            onClick={() => compileStep("neutral")}
            disabled={!!busy}
            title="Recompile designs from dialogue moves"
          >
            {busy === "compile" ? "Compiling…" : "Compile"}
          </button>
          <button
            className="btnv2"
            aria-label="Step"
            onClick={step}
            disabled={!!busy}
          >
            {busy === "step" ? "Stepping…" : "Step"}
          </button>
          <button
            className="btnv2"
            aria-label="Append daimon"
            onClick={() => setShowAppendDaimon((v) => !v)}
            aria-expanded={showAppendDaimon}
          >
            {showAppendDaimon ? "Hide †" : "Append †"}
          </button>
          <button
            className="btnv2"
            aria-label="Check orthogonality"
            onClick={checkOrthogonal}
            disabled={!!busy}
          >
            {busy === "orth" ? "Checking…" : "Orthogonality"}
          </button>
          <button
            className="btnv2"
            aria-label="Analyze NLI"
            onClick={analyzeNLI}
            disabled={!!busy}
            title={
              nliResultsByScope[activeScope ?? "legacy"]
                ? `Last analyzed: ${new Date(
                    nliResultsByScope[activeScope ?? "legacy"].timestamp
                  ).toLocaleTimeString()}`
                : "Analyze Natural Language Inference"
            }
          >
            {busy === "nli" ? "Analyzing…" : (
              <>
                NLI
                {nliResultsByScope[activeScope ?? "legacy"] && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({nliResultsByScope[activeScope ?? "legacy"].contradictions})
                  </span>
                )}
              </>
            )}
          </button>
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Trace Log"
            onClick={() => setShowGuide((v) => !v)}
          >
            {showGuide ? "Hide log" : "Trace log"}
          </button>
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Stable sets"
            onClick={checkStable}
            title={
              stableSetsByScope[activeScope ?? "legacy"] !== undefined
                ? `${stableSetsByScope[activeScope ?? "legacy"]} stable extension(s) in this scope`
                : "Compute stable sets for active scope"
            }
          >
            Stable sets
            {stableSetsByScope[activeScope ?? "legacy"] !== undefined && (
              <span className="ml-1 text-[10px] opacity-70">
                ({stableSetsByScope[activeScope ?? "legacy"]})
              </span>
            )}
          </button>
          {/* <button
            className="btnv2 btnv2--ghost"
            onClick={() => setShowAttach((v) => !v)}
            aria-expanded={showAttach}
          >
            {showAttach ? "Hide testers" : "Attach testers"}
          </button> */}
          <button
            className={`btnv2 ${showAnalysisPanel ? "btnv2--primary" : "btnv2--ghost"}`}
            onClick={() => setShowAnalysisPanel((v) => !v)}
            aria-expanded={showAnalysisPanel}
            title="Phase 1-5 Analysis Panel: Views, Chronicles, Strategy, Types, Behaviours"
          >
            {showAnalysisPanel ? "◀ Analysis" : "▶ Analysis"}
          </button>
          <button
            className={`btnv2 ${showSyncPanel ? "btnv2--primary" : "btnv2--ghost"}`}
            disabled={!!busy}
            onClick={() => setShowSyncPanel((v) => !v)}
            title="AIF/Dialogue Sync Status"
          >
            {busy === "sync-aif" ? "Syncing…" : (
              <>
                Sync AIF
                {syncStatus && syncStatus.significantActs > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({syncStatus.syncedSignificant}/{syncStatus.significantActs})
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* AIF Sync Status Panel */}
      {showSyncPanel && (
        <div className="rounded border border-blue-200 bg-blue-50/80 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900">AIF/Dialogue Sync</h4>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 underline"
              onClick={() => setShowSyncPanel(false)}
            >
              Close
            </button>
          </div>
          
          {/* Status Display */}
          <div className="grid grid-cols-3 gap-2 text-slate-700">
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">Total Acts</div>
              <div className="text-lg font-bold">{syncStatus?.totalLudicActs ?? "—"}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">Significant</div>
              <div className="text-lg font-bold text-amber-600">{syncStatus?.significantActs ?? "—"}</div>
              <div className="text-[9px] text-slate-500">
                {syncStatus ? `${syncStatus.daimonActs} daimons, ${syncStatus.concessionActs} concessions` : ""}
              </div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">Needs Sync</div>
              <div className={`text-lg font-bold ${(syncStatus?.needsSync ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {syncStatus?.needsSync ?? "—"}
              </div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">Synced (Sig.)</div>
              <div className="text-lg font-bold text-emerald-600">{syncStatus?.syncedSignificant ?? "—"}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">Total Synced</div>
              <div className="text-lg font-bold text-blue-600">{syncStatus?.totalSynced ?? "—"}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-slate-500 uppercase">DialogueMoves</div>
              <div className="text-lg font-bold text-indigo-600">{syncStatus?.dialogueMovesWithLudics ?? "—"}</div>
            </div>
          </div>

          {/* Progress Bar */}
          {syncStatus && syncStatus.significantActs > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                <span>Sync Progress (Significant Acts)</span>
                <span>{syncStatus.syncedSignificant}/{syncStatus.significantActs} ({syncStatus.syncPercentage}%)</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${syncStatus.syncPercentage >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, syncStatus.syncPercentage)}%` }}
                />
              </div>
              {syncStatus.needsSync > 0 && (
                <div className="text-[10px] text-rose-600 mt-1">
                  ⚠ {syncStatus.needsSync} significant acts not yet synced
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
              disabled={busy === "sync-status"}
              onClick={async () => {
                setBusy("sync-status");
                try {
                  const res = await fetch(`/api/ludics/aif-sync?deliberationId=${encodeURIComponent(deliberationId)}`);
                  const data = await res.json();
                  if (data.ok) {
                    setSyncStatus(data.stats);
                  }
                } catch (e) {
                  console.error("Failed to fetch sync status:", e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy === "sync-status" ? "Checking…" : "Refresh Status"}
            </button>
            <button
              className="flex-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-medium transition-colors disabled:opacity-50"
              disabled={busy === "sync-verify"}
              onClick={async () => {
                setBusy("sync-verify");
                try {
                  const res = await fetch("/api/ludics/aif-sync", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ deliberationId, mode: "verify" }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    toast.show(`Verify: ${data.stats.shouldSync} acts need sync, ${data.stats.alreadySynced} already synced`, "ok");
                  }
                } catch (e: any) {
                  toast.show(e?.message || "Verify error", "err");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy === "sync-verify" ? "Verifying…" : "Verify"}
            </button>
            <button
              className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              disabled={!!busy}
              onClick={async () => {
                setBusy("sync-aif");
                try {
                  const res = await fetch("/api/ludics/aif-sync", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ deliberationId, mode: "backfill" }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    toast.show(`Synced ${data.stats?.synced ?? 0} acts (${data.stats?.skipped ?? 0} skipped)`, "ok");
                    // Refresh status after sync
                    const statusRes = await fetch(`/api/ludics/aif-sync?deliberationId=${encodeURIComponent(deliberationId)}`);
                    const statusData = await statusRes.json();
                    if (statusData.ok) {
                      setSyncStatus(statusData.stats);
                    }
                  } else {
                    toast.show(data.error?.message || "Sync failed", "err");
                  }
                } catch (e: any) {
                  toast.show(e?.message || "Sync error", "err");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy === "sync-aif" ? "Syncing…" : "Sync Now"}
            </button>
          </div>

          {/* Info Text */}
          <div className="text-[10px] text-slate-500 mt-2">
            <strong>Note:</strong> Only significant ludics actions (daimons, concessions, force concessions) are synced to the AIF/DialogueMove system. 
            Regular P/O interaction acts remain in the ludics layer only.
          </div>
        </div>
      )}

      {/* Ribbon */}
      <div className="rounded-md border border-slate-200 bg-white/60 p-2">
        {traceLike ? (
          <TraceRibbon
            steps={traceLike.steps}
            status={traceLike.status}
            badges={badges}
            decisiveIndices={trace?.decisiveIndices}
            revFailIndices={Object.keys(revFail).map(Number)}
          />
        ) : (
          <div className="text-xs text-neutral-500">No traversal yet.</div>
        )}
        {trace?.decisiveIndices?.length ? (
          <div className="mt-1 text-[11px] text-indigo-700">
            decisive: {trace.decisiveIndices.map((i) => i + 1).join(", ")}
          </div>
        ) : null}
        {/* commitment delta overlay */}
        <CommitmentDelta
          dialogueId={deliberationId}
          refreshKey={`${trace?.status}:${trace?.pairs?.length ?? 0}`}
        />
      </div>
      {/* Append Daimon Panel (Task 5: Week 2) */}
      {showAppendDaimon && (
        <div className="rounded border border-amber-200 bg-amber-50/80 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-amber-900">Append Daimon (†)</h4>
            <button
              className="text-xs text-amber-600 hover:text-amber-800 underline"
              onClick={() => setShowAppendDaimon(false)}
            >
              Close
            </button>
          </div>
          
          <div className="grid gap-2">
            {/* Scope selector (if multiple scopes) */}
            {scopes.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-amber-800 font-medium min-w-[60px]">
                  Scope:
                </label>
                <select
                  className="border rounded px-2 py-1 bg-white flex-1"
                  value={daimonTargetScope ?? ""}
                  onChange={(e) => {
                    setDaimonTargetScope(e.target.value || null);
                    setDaimonTargetLocus(""); // Reset locus when scope changes
                  }}
                  disabled={!!busy}
                >
                  {scopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {scopeLabels[scope] || scope}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Locus selector */}
            <div className="flex items-center gap-2">
              <label className="text-amber-800 font-medium min-w-[60px]">
                Locus:
              </label>
              <select
                className="border rounded px-2 py-1 bg-white flex-1 font-mono text-[11px]"
                value={daimonTargetLocus}
                onChange={(e) => setDaimonTargetLocus(e.target.value)}
                disabled={!!busy || availableLoci.length === 0}
              >
                {availableLoci.length === 0 ? (
                  <option value="">No loci available</option>
                ) : (
                  <>
                    <option value="">— Select locus —</option>
                    {availableLoci.map((locus) => (
                      <option key={locus} value={locus}>
                        {locus}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            
            {/* Append button */}
            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <div className="text-[11px] text-amber-700">
                {availableLoci.length} loci available
              </div>
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-amber-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={appendDaimonToNext}
                disabled={!!busy || !daimonTargetLocus || availableLoci.length === 0}
              >
                {busy === "append" ? "Appending…" : "Append †"}
              </button>
            </div>
          </div>
          
          <div className="text-[10px] text-amber-600 bg-amber-100 rounded p-2 mt-2">
            <strong>Tip:</strong> Appending a daimon (†) to a locus marks it as terminal/closed.
            This signals convergence or concession at that point in the interaction.
          </div>
        </div>
      )}

      {showAttach && (
        <div className="mt-2 rounded border bg-white/60 p-2 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-neutral-600">Target Scope:</span>
            <select
              className="border rounded px-2 py-1 text-xs"
              value={attachTargetScope ?? ""}
              onChange={(e) => setAttachTargetScope(e.target.value || null)}
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {scopeLabels[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-600">Source Work:</span>
            <select
              className="border rounded px-2 py-1"
              value={attachPick}
              onChange={(e) => setAttachPick(e.target.value)}
            >
              <option value="">— Select IH/TC Work —</option>
              {attachCandidates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} [{w.theoryType}]
                </option>
              ))}
            </select>

            <button
              className="px-2 py-1 border rounded bg-white"
              disabled={!attachPick || attachLoading || isDesignsLoading}
              onClick={async () => {
                try {
                  setAttachLoading(true);
                  // Get suggested testers from the selected Work
                  const j = await fetch(
                    `/api/works/${attachPick}/ludics-testers`,
                    { cache: "no-store" }
                  )
                    .then((r) => r.json())
                    .catch(() => null);

                  const targetScope = attachTargetScope ?? activeScope;
                  const scopeKey = targetScope ?? "legacy";
                  const scopeLabel = scopeLabels[scopeKey] ?? scopeKey;

                  // Filter designs by target scope
                  const scopeDesigns = designs.filter(
                    (d: any) => (d.scope ?? "legacy") === scopeKey
                  );
                  
                  // Resolve designs (pos/neg) from filtered scope designs
                  const pos = scopeDesigns.find((d: any) => d.participantId === "Proponent")?.id;
                  const neg = scopeDesigns.find((d: any) => d.participantId === "Opponent")?.id;
                  if (!pos || !neg) throw new Error(`Missing P/O designs in scope: ${scopeLabel}`);

                  // Attach testers by stepping with them
                  const r = await fetch("/api/ludics/step", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      dialogueId: deliberationId,
                      posDesignId: pos,
                      negDesignId: neg,
                      testers: j?.testers ?? [],
                      fuel: 2048,
                    }),
                  });

                  if (!r.ok) throw new Error(await r.text());
                  toast.show(`Testers attached to scope: ${scopeLabel}`, "ok");

                  // Refresh panels that depend on the run/designs
                  await Promise.all([refreshOrth(), mutateDesigns()]);
                } catch (e: any) {
                  toast.show(`Attach failed: ${e?.message ?? "error"}`, "err");
                } finally {
                  setAttachLoading(false);
                }
              }}
            >
              {attachLoading ? "Attaching…" : "Attach"}
            </button>
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Tip: Testers will be attached to the selected scope. Refine loci in Evaluation/Loci tools after attaching.
          </div>
        </div>
      )}

      {/* Enhanced Trace Log */}
      {showGuide && (
        <div className="grid gap-4">
          {/* Plain Text Trace Output */}
          {lines.length > 0 && (
            <div className="border rounded-lg bg-slate-100 p-4 font-mono text-sm">
              <div className="flex items-center justify-between mb-3">
                
              </div>
              <div className="text-slate-800 space-y-1 max-h-48 overflow-y-auto">
                {lines.map((l, i) => (
                  <div key={i} className="hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                    <span className="text-slate-500">{i + 1}.</span> {l.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header with Stats */}
          <div className="border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">Trace Log Analysis</h3>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
                  onClick={() => {
                    if (!lines.length) return;
                    const txt = lines
                      .map((l, i) => `${i + 1}. ${l.text}`)
                      .join("\n");
                    navigator.clipboard?.writeText(txt).catch(() => {});
                  }}
                  title="Copy narrated trace to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  className="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
                  onClick={() => setShowGuide(false)}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Trace Statistics */}
            {trace && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600 mb-1">Total Pairs</div>
                  <div className="text-2xl font-bold text-slate-900">{trace.pairs.length}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600 mb-1">Decisive Steps</div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {trace.decisiveIndices?.length ?? 0}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600 mb-1">Status</div>
                  <div className={[
                    "text-sm font-bold uppercase",
                    trace.status === "CONVERGENT" ? "text-emerald-600" :
                    trace.status === "DIVERGENT" ? "text-rose-600" :
                    "text-amber-600"
                  ].join(" ")}>
                    {trace.status === "CONVERGENT" ? "✓ Convergent" :
                     trace.status === "DIVERGENT" ? "✗ Divergent" :
                     "⋯ Ongoing"}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600 mb-1">Unique Loci</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {new Set(trace.pairs.map(p => {
                      const pos = byAct.get(p.posActId ?? "");
                      const neg = byAct.get(p.negActId ?? "");
                      return pos?.locus?.path ?? neg?.locus?.path ?? "0";
                    })).size}
                  </div>
                </div>
              </div>
            )}

            {/* Outcome Summary */}
            {trace && trace.status === "CONVERGENT" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">✓</div>
                  <div className="flex-1">
                    <div className="font-semibold text-emerald-900 mb-1">
                      Dialogue Converged Successfully
                    </div>
                    <div className="text-sm text-emerald-700">
                      {trace.endedAtDaimonForParticipantId && (
                        <span>Ended with daimon by <strong>{trace.endedAtDaimonForParticipantId}</strong></span>
                      )}
                      {trace.endorsement && (
                        <span className="ml-2">
                          • Endorsed by <strong>{trace.endorsement.byParticipantId}</strong> at locus <code className="bg-emerald-100 px-1 rounded">{trace.endorsement.locusPath}</code>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {trace && trace.status === "DIVERGENT" && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">✗</div>
                  <div className="flex-1">
                    <div className="font-semibold text-rose-900 mb-1">
                      Dialogue Diverged
                    </div>
                    <div className="text-sm text-rose-700">
                      Unresolved obligations remain. Further moves required to reach convergence.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ONGOING/STUCK Panel with Daimon Hints */}
            {trace && (trace.status === "ONGOING" || trace.status === "STUCK") && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{trace.status === "STUCK" ? "⏸" : "⋯"}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900 mb-1">
                      {trace.status === "STUCK" ? "Dialogue Stuck" : "Dialogue In Progress"}
                    </div>
                    <div className="text-sm text-amber-700 mb-2">
                      {trace.status === "STUCK" 
                        ? "The stepper is awaiting the next move. Some branches may need closure."
                        : `${trace.pairs.length} interaction pair(s) processed. More moves may be possible.`
                      }
                    </div>
                    
                    {/* Daimon Hints for ONGOING/STUCK */}
                    {trace.daimonHints && trace.daimonHints.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">💡</span>
                          <span className="text-xs font-semibold text-amber-800">
                            Suggested Daimons ({trace.daimonHints.length})
                          </span>
                        </div>
                        <div className="text-xs text-amber-700 mb-2">
                          Appending a daimon (†) at these loci can help reach convergence:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {trace.daimonHints.slice(0, 12).map((hint: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => {
                                setDaimonTargetLocus(hint.locusPath);
                                setShowAppendDaimon(true);
                              }}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-mono flex items-center gap-1 transition-colors"
                              title={`Click to append daimon at ${hint.locusPath}`}
                            >
                              <span className="text-amber-600">†</span>
                              {hint.locusPath}
                            </button>
                          ))}
                          {trace.daimonHints.length > 12 && (
                            <span className="text-xs text-amber-600 px-2 py-1">
                              +{trace.daimonHints.length - 12} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Zero Pairs Diagnostic - shows why no interaction happened */}
            {trace && trace.pairs.length === 0 && designs.length >= 2 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-xl">🔍</div>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900 mb-1">
                      No Interaction Pairs Generated
                    </div>
                    <div className="text-sm text-amber-700">
                      The stepper couldn&apos;t match any P/O act pairs at the same locus.
                    </div>
                  </div>
                </div>
                
                {(() => {
                  // Compute loci analysis
                  const scopeDesigns = designs.filter((d: any) => (d.scope ?? "legacy") === activeScope);
                  const proDesign = scopeDesigns.find((d: any) => d.participantId === "Proponent");
                  const oppDesign = scopeDesigns.find((d: any) => d.participantId === "Opponent");
                  
                  const proActs = proDesign?.acts ?? [];
                  const oppActs = oppDesign?.acts ?? [];
                  
                  const proPLoci = new Set(proActs.filter((a: any) => a.polarity === "P").map((a: any) => a.locus?.path ?? "0"));
                  const proOLoci = new Set(proActs.filter((a: any) => a.polarity === "O").map((a: any) => a.locus?.path ?? "0"));
                  const oppPLoci = new Set(oppActs.filter((a: any) => a.polarity === "P").map((a: any) => a.locus?.path ?? "0"));
                  const oppOLoci = new Set(oppActs.filter((a: any) => a.polarity === "O").map((a: any) => a.locus?.path ?? "0"));
                  
                  // For interaction: need P-acts from one side to match O-acts from other side at same locus
                  const proPArr = Array.from(proPLoci);
                  const oppOArr = Array.from(oppOLoci);
                  const matchingLoci = proPArr.filter(l => oppOLoci.has(l));
                  
                  // Loci where P-acts exist but no O-acts - these need concessions
                  const missingOLoci = proPArr.filter(l => !oppOLoci.has(l));
                  
                  return (
                    <>
                      {/* Loci Analysis */}
                      <div className="bg-white/80 rounded p-3 mb-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">Loci Analysis</div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-medium text-blue-700 mb-1">Proponent P-acts at:</div>
                            <div className="font-mono text-[10px] text-slate-600 bg-blue-50 p-1.5 rounded max-h-20 overflow-y-auto">
                              {proPArr.length > 0 ? proPArr.sort().join(", ") : "(none)"}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-rose-700 mb-1">Opponent O-acts at:</div>
                            <div className="font-mono text-[10px] text-slate-600 bg-rose-50 p-1.5 rounded max-h-20 overflow-y-auto">
                              {oppOArr.length > 0 ? oppOArr.sort().join(", ") : "(none)"}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className={matchingLoci.length > 0 ? "text-emerald-600" : "text-rose-600"}>
                              {matchingLoci.length > 0 ? "✓" : "✗"}
                            </span>
                            <span className="text-xs text-slate-700">
                              <strong>Overlapping loci:</strong>{" "}
                              {matchingLoci.length > 0 
                                ? <span className="font-mono text-emerald-700">{matchingLoci.join(", ")}</span>
                                : <span className="text-rose-600">None - P and O acts are at different loci</span>
                              }
                            </span>
                          </div>
                        </div>
                        
                        {/* Quick Fix: Add concessions at missing loci */}
                        {missingOLoci.length > 0 && oppDesign && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="text-xs font-medium text-slate-700 mb-2">
                              Missing O-acts at {missingOLoci.length} P-loci:
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {missingOLoci.sort().slice(0, 8).map((locus) => {
                                const locusStr = String(locus);
                                return (
                                <button
                                  key={locusStr}
                                  onClick={async () => {
                                    try {
                                      await fetch("/api/ludics/judge/force", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({
                                          dialogueId: deliberationId,
                                          action: "FORCE_CONCESSION",
                                          target: { designId: oppDesign.id, locusPath: locusStr },
                                          data: { text: "ACK" },
                                        }),
                                      });
                                      await mutateDesigns();
                                      await step();
                                      toast.show(`Added ACK at ${locusStr}`, "ok");
                                    } catch (e: any) {
                                      toast.show(e?.message || "Failed", "err");
                                    }
                                  }}
                                  className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-800 rounded text-[10px] font-mono transition-colors"
                                  title={`Add O-act (ACK) at ${locusStr}`}
                                >
                                  +O@{locusStr}
                                </button>);
                              })}
                              {missingOLoci.length > 8 && (
                                <span className="text-[10px] text-slate-500">+{missingOLoci.length - 8} more</span>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  setBusy("fix-all");
                                  for (const locus of missingOLoci) {
                                    const locusStr = String(locus);
                                    await fetch("/api/ludics/judge/force", {
                                      method: "POST",
                                      headers: { "content-type": "application/json" },
                                      body: JSON.stringify({
                                        dialogueId: deliberationId,
                                        action: "FORCE_CONCESSION",
                                        target: { designId: oppDesign.id, locusPath: locusStr },
                                        data: { text: "ACK" },
                                      }),
                                    });
                                  }
                                  await mutateDesigns();
                                  await step();
                                  toast.show(`Added ACK at ${missingOLoci.length} loci`, "ok");
                                } catch (e: any) {
                                  toast.show(e?.message || "Failed", "err");
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              disabled={busy === "fix-all"}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {busy === "fix-all" ? "Adding..." : `Add ACK to all ${missingOLoci.length} missing loci`}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Design summaries */}
                      <div className="grid md:grid-cols-2 gap-3 mb-3">
                        {scopeDesigns.slice(0, 2).map((d: any) => {
                          const acts = d.acts ?? [];
                          const pActs = acts.filter((a: any) => a.polarity === "P");
                          const oActs = acts.filter((a: any) => a.polarity === "O");
                          const daimons = acts.filter((a: any) => a.kind === "DAIMON");
                          
                          return (
                            <div key={d.id} className="bg-white/80 rounded p-3 text-xs">
                              <div className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <span className={d.participantId === "Proponent" ? "text-blue-600" : "text-rose-600"}>
                                  {d.participantId === "Proponent" ? "P" : "O"}
                                </span>
                                {d.participantId}
                              </div>
                              <div className="space-y-1 text-slate-600">
                                <div>Acts: <span className="font-mono">{acts.length}</span></div>
                                <div>
                                  Polarity: 
                                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">P: {pActs.length}</span>
                                  <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded">O: {oActs.length}</span>
                                  {daimons.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">†: {daimons.length}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
                
                {/* Daimon Hints from stepper */}
                {trace.daimonHints && trace.daimonHints.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💡</span>
                      <span className="font-semibold text-emerald-800 text-sm">
                        Suggested Daimons ({trace.daimonHints.length})
                      </span>
                    </div>
                    <div className="text-xs text-emerald-700 mb-2">
                      The stepper found leaf loci where appending a daimon (†) would help reach convergence:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trace.daimonHints.map((hint: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            setDaimonTargetLocus(hint.locusPath);
                            setShowAppendDaimon(true);
                          }}
                          className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs font-mono flex items-center gap-1 transition-colors"
                          title={`Click to append daimon at ${hint.locusPath}`}
                        >
                          <span className="text-amber-600">†</span>
                          {hint.locusPath}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-2">
                      Click a locus to open the daimon append dialog
                    </div>
                  </div>
                )}
                
                {/* Divergence reason */}
                {trace.reason && (
                  <div className="bg-slate-100 rounded p-2 mb-3 text-xs">
                    <span className="font-medium text-slate-700">Reason: </span>
                    <span className="text-slate-600 font-mono">
                      {trace.reason === "incoherent-move" && "Incoherent move detected"}
                      {trace.reason === "no-response" && "No matching response found"}
                      {trace.reason === "additive-violation" && "Additive choice violation"}
                      {trace.reason === "dir-collision" && "Direction collision at locus"}
                      {trace.reason === "timeout" && "Computation timed out"}
                      {trace.reason === "consensus-draw" && "Reached consensus (draw)"}
                      {!["incoherent-move", "no-response", "additive-violation", "dir-collision", "timeout", "consensus-draw"].includes(trace.reason) && trace.reason}
                    </span>
                  </div>
                )}

                <div className="text-xs text-amber-800 bg-amber-100 rounded p-2 space-y-1">
                  <div><strong>Why no pairs?</strong></div>
                  <div className="text-[11px] text-amber-700 mt-1">
                    The stepper requires P-acts and O-acts to be at the <strong>same locus</strong> to form a pair. 
                    In dialogue terms, when Opponent &quot;challenges&quot; a claim, it creates a <em>child</em> locus 
                    (e.g., 0.1 → 0.1.1), not a response at the same locus. This is expected for challenge/response 
                    dialogues but means the stepper can&apos;t match acts directly.
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <strong>To generate pairs:</strong>
                    <ul className="list-disc list-inside space-y-0.5 ml-2 mt-1">
                      <li>Use the <strong>Analysis Panel</strong> for Views/Chronicles (works with child loci)</li>
                      <li>Append a daimon (†) at leaf loci to mark convergence</li>
                      <li>The stepper is designed for direct P↔O interaction at same locus</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content: Legend and Trace */}
          <div className="grid gap-4 md:grid-cols-[300px_1fr]">
            {/* Legend Panel */}
            <div className="border rounded-lg p-4 bg-white h-fit">
              <div className="font-semibold text-sm mb-3 text-slate-900">Quick Reference</div>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-medium text-slate-700 mb-1">Participants</div>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">P</span>
                      <span>Proponent (positive polarity)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">O</span>
                      <span>Opponent (negative polarity)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="font-medium text-slate-700 mb-1">Move Types</div>
                  <div className="space-y-1 text-slate-600">
                    <div><strong>Assert:</strong> Initial claim at locus</div>
                    <div><strong>Challenge (WHY):</strong> Question/attack</div>
                    <div><strong>Grounds:</strong> Supporting evidence</div>
                    <div><strong>† Daimon:</strong> Terminal/acceptance</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="font-medium text-slate-700 mb-1">Locus Notation</div>
                  <div className="space-y-1 text-slate-600">
                    <div><code className="bg-slate-100 px-1 rounded">0</code> = Root position</div>
                    <div><code className="bg-slate-100 px-1 rounded">0.1</code> = First child of root</div>
                    <div><code className="bg-slate-100 px-1 rounded">0.1.2</code> = Second child of 0.1</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="font-medium text-slate-700 mb-1">Indicators</div>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">✓</span>
                      <span>Decisive step</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">⊕</span>
                      <span>Additive choice</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">⊙</span>
                      <span>Reversibility failure</span>
                    </div>
                  </div>
                </div>

                {badges && Object.keys(badges).length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="font-medium text-slate-700 mb-1">NLI Results</div>
                    <div className="text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">NLI⊥</span>
                        <span>Detected contradiction</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Narrated Trace */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm text-slate-900">Step-by-Step Narrative</div>
                {lines.length > 0 && (
                  <div className="text-xs text-slate-500">
                    {lines.length} step{lines.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {!trace ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 opacity-30">📝</div>
                  <div className="text-sm text-slate-600 font-medium mb-1">No trace yet</div>
                  <div className="text-xs text-slate-500">
                    Start the dialogue by posting WHY or GROUNDS moves
                  </div>
                </div>
              ) : lines.length === 0 || (lines.length === 1 && trace.pairs.length === 0) ? (
                <div className="space-y-4">
                  {/* Show the status line even with 0 pairs */}
                  {lines.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm font-medium text-slate-700">{lines[0]?.text}</div>
                    </div>
                  )}
                  
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3 opacity-30">🔄</div>
                    <div className="text-sm text-slate-600 font-medium mb-1">No interaction pairs found</div>
                    <div className="text-xs text-slate-500 max-w-md mx-auto">
                      The stepper couldn&apos;t match P-acts with O-acts at the same loci. 
                      This happens when designs don&apos;t have compatible moves for interaction.
                    </div>
                  </div>
                  
                  {/* Show acts summary from designs */}
                  <div className="border-t pt-4">
                    <div className="text-xs font-semibold text-slate-700 mb-3">Acts Summary (from designs)</div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {designs.filter((d: any) => (d.scope ?? "legacy") === activeScope).slice(0, 2).map((d: any) => {
                        const acts = (d.acts ?? []).slice(0, 10);
                        return (
                          <div key={d.id} className="bg-slate-50 rounded p-3 text-xs">
                            <div className="font-semibold text-slate-800 mb-2">
                              {d.participantId} ({d.acts?.length ?? 0} acts)
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {acts.map((act: any, idx: number) => (
                                <div key={act.id || idx} className="flex items-start gap-2 text-[11px]">
                                  <span className={`px-1 rounded ${act.polarity === "P" ? "bg-blue-100 text-blue-700" : act.polarity === "O" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                    {act.kind === "DAIMON" ? "†" : act.polarity}
                                  </span>
                                  <span className="font-mono text-slate-500">{act.locus?.path ?? "0"}</span>
                                  <span className="text-slate-600 truncate flex-1">{act.expression?.slice(0, 40) || "—"}</span>
                                </div>
                              ))}
                              {(d.acts?.length ?? 0) > 10 && (
                                <div className="text-slate-400 italic">...and {(d.acts?.length ?? 0) - 10} more</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {lines.map((ln, i) => {
                    const isDecisive = ln.decisive;
                    const isSelected = focusIdx === i;
                    const hasNLI = badges[i];
                    const hasRevFail = revFail[i];
                    const pair = trace?.pairs[i];
                    const hasValidPair = pair && (pair.posActId || pair.negActId);
                    
                    return (
                      <div key={i} className="space-y-2">
                        <div
                          className={[
                            "group relative rounded-lg border p-3 transition-all cursor-pointer",
                            isSelected 
                              ? "bg-sky-50 border-sky-300 shadow-sm" 
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300",
                            isDecisive && "ring-2 ring-indigo-200"
                          ].join(" ")}
                          onClick={() => setFocusIdx(i)}
                        >
                          {/* Step number and badges */}
                          <div className="flex items-start gap-3">
                            <div className={[
                              "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              isSelected
                                ? "bg-sky-600 text-white"
                                : isDecisive
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-300 text-slate-700"
                            ].join(" ")}>
                              {i + 1}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {/* Main text */}
                              <div className={[
                                "text-sm leading-relaxed mb-1",
                                isDecisive ? "font-semibold text-slate-900" : "text-slate-700",
                                // Style status lines differently
                                ln.text.startsWith('✓') ? "text-emerald-700" : "",
                                ln.text.startsWith('✗') ? "text-rose-700" : "",
                                ln.text.startsWith('⋯') ? "text-amber-700" : "",
                                ln.text.startsWith('⏸') ? "text-slate-600" : "",
                                ln.text.startsWith('  └─') ? "text-xs text-slate-500 ml-4" : "",
                              ].filter(Boolean).join(" ")}>
                                {ln.text}
                              </div>
                              
                              {/* Hover details - show differently for status lines vs pair lines */}
                              {ln.hover && (
                                <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                                  {ln.hover.includes('P:') && ln.hover.includes('O:') ? (
                                    // This is a pair line with P/O expressions
                                    <>
                                      <div className="font-medium mb-1">Full expressions:</div>
                                      <div className="space-y-1 font-mono text-[10px] bg-slate-100 p-2 rounded">
                                        {ln.hover.split(' • ').map((expr, idx) => (
                                          <div key={idx} className="truncate">{expr}</div>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    // This is a status line with explanatory hover
                                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                      💡 {ln.hover}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Badges */}
                            <div className="flex flex-col gap-1 items-end">
                              {isDecisive && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                                  ✓ DECISIVE
                                </span>
                              )}
                              {hasNLI && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                                  NLI⊥
                                </span>
                              )}
                              {hasRevFail && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                                  ⊙
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inline Act Inspector - only show for valid pairs */}
                        {isSelected && hasValidPair && pair && (
                          <div className="ml-10 border-l-2 border-sky-400 pl-4">
                            <ActInspector
                              pos={byAct.get(pair.posActId ?? "")}
                              neg={byAct.get(pair.negActId ?? "")}
                              onClose={() => setFocusIdx(null)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Trees */}
      <div className="grid  gap-4">
        {viewMode === "forest" ? (
          <LudicsForest deliberationId={deliberationId} />
        ) : viewMode === "unified" ? (
          <div className="border rounded-lg p-2 bg-white/60">
            <div className="text-xs mb-1 flex items-center gap-2">
              <b>Unified loci</b>
              <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                acts {actsCount}
              </span>
            </div>
            {/* <LociTree
              root={mergeDesignsToTree(designs)}
              usedAdditive={trace?.usedAdditive}
              onPickBranch={pickAdditive}
              focusPath={focusPath}
              onCommitHere={commitAtPath}
              onFocusPathChange={onFocusPathChange}
              defaultCollapsedDepth={1}
              showExpressions
              heatmap={heatmap}
              stepIndexByActId={stepIndexByActId}
              autoScrollOnFocus
              enableKeyboardNav
            /> */}
            <LociTreeWithControls
              dialogueId={deliberationId}
              posDesignId={proDesignId ?? ""}
              negDesignId={oppDesignId ?? ""}
              defaultMode="assoc"
              suggestCloseDaimonAt={suggestClose}
            />

            {commitOpen && commitPath && targetIdFromContext && (
              <NLCommitPopover
                open={commitOpen}
                onOpenChange={setCommitOpen}
                deliberationId={deliberationId}
                targetType={targetTypeFromContext}
                targetId={targetIdFromContext}
                locusPath={commitPath}
                defaultOwner="Proponent"
                onDone={() => {
                  /* refresh */
                }}
              />
            )}
          </div>
        ) : viewMode === "split" ? (
          // Split view: one per design (kept for debugging/teaching)
          <div className="grid md:grid-cols-2 gap-4">
            {isDesignsLoading && (
              <>
                <SkeletonCard lines={4} />
                <SkeletonCard lines={4} />
              </>
            )}
            {designsError && (
              <div className="col-span-2 text-xs text-rose-600 border rounded p-2">
                Failed to load designs.
              </div>
            )}
            {designs?.map((d: any) => (
              <div key={d.id} className="border rounded-lg p-2 bg-white/60">
                <div className="text-xs mb-1 flex items-center gap-2">
                  <b>{d.participantId}</b> · {d.id.slice(0, 6)}
                  {(() => {
                    const first = (d.acts ?? [])[0];
                    const start =
                      first?.polarity === "O"
                        ? "Start: Negative"
                        : first?.polarity === "P"
                        ? "Start: Positive"
                        : "Start: —";
                    return (
                      <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                        {start}
                      </span>
                    );
                  })()}
                  <span className="px-1.5 py-0.5 rounded border bg-slate-50">
                    acts {d.acts?.length ?? 0}
                  </span>
                </div>
                <LociTree
                  root={shapeToTree(d)}
                  onPickBranch={pickAdditive}
                  usedAdditive={trace?.usedAdditive}
                  focusPath={focusPath}
                  onFocusPathChange={onFocusPathChange}
                  defaultCollapsedDepth={1}
                  showExpressions
                  heatmap={heatmap}
                  stepIndexByActId={stepIndexByActId}
                  autoScrollOnFocus
                />
              </div>
            ))}
          </div>
        ) : (
          // Game view: Phase 6 interactive game components
          <GameViewPanel
            deliberationId={deliberationId}
            designs={designs}
            isLoading={isDesignsLoading}
          />
        )}
      </div>

      {/* Commitments */}
      <div className="grid md:grid-cols-2 gap-4">
        <CommitmentsPanel
          dialogueId={deliberationId}
          ownerId="Proponent"
          onChanged={() => {}}
        />
        <CommitmentsPanel
          dialogueId={deliberationId}
          ownerId="Opponent"
          onChanged={() => {}}
        />
      </div>

      {/* Defense tree */}
      <DefenseTree
        designs={designs}
        trace={traceLike}
        decisiveWindow={3}
        highlightIndices={trace?.decisiveIndices}
      />

      {/* Judge tools */}
      <JudgeConsole
        onForceConcession={onForceConcession}
        onCloseBranch={onCloseBranch}
        onConcede={onConcede}
        onStepNow={step}
        locusSuggestions={availableLoci.length > 0 ? availableLoci : ["0"]}
        defaultTarget="Opponent"
      />

      {/* Phase 1-5 Analysis Panel (DDS Analysis: Views, Chronicles, Strategy, Types, Behaviours) */}
      {showAnalysisPanel && (pro?.id || designs.length > 0) && (
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-base">📊</span>
              DDS Analysis Panel
              <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Phases 1-5
              </span>
            </h3>
            <button
              className="text-xs text-slate-500 hover:text-slate-700 underline"
              onClick={() => setShowAnalysisPanel(false)}
            >
              Close
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
            <AnalysisPanel
              designId={pro?.id || designs[0]?.id || ""}
              deliberationId={deliberationId}
              analysisState={analysisState}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
          </div>
        </div>
      )}

      {toast.node}
    </div>
  );
}

/* ------------------------------ Utilities ------------------------------- */
function shapeToTree(d: any) {
  const nodes = new Map<string, any>();
  const ensure = (path: string) => {
    if (!nodes.has(path))
      nodes.set(path, { id: path, path, acts: [], children: [] });
    return nodes.get(path);
  };

  for (const a of d.acts ?? []) {
    const p = a?.locus?.path ?? "0";
    ensure(p).acts.push({
      id: a.id,
      polarity: a.polarity,
      expression: a.expression,
      isAdditive: a.isAdditive || a.additive,
    });
    const parts = p.split(".");
    for (let i = 1; i < parts.length; i++) ensure(parts.slice(0, i).join("."));
  }

  const all = Array.from(nodes.values());
  const byPath = Object.fromEntries(all.map((n: any) => [n.path, n]));
  for (const n of all) {
    const parent = n.path.includes(".")
      ? n.path.split(".").slice(0, -1).join(".")
      : null;
    if (parent && byPath[parent]) byPath[parent].children.push(n);
  }
  return (
    byPath["0"] || all[0] || { id: "0", path: "0", acts: [], children: [] }
  );
}
