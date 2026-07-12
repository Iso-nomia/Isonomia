"use client";

/**
 * Phase 6 - Landscape Heat Map Component
 * 
 * Visualizes the strategic landscape as a heat map:
 * - Position strength as color intensity
 * - Critical points highlighted
 * - Flow paths as arrows
 * - Interactive position selection
 * 
 * Uses Phase 4 landscape/visualization-data module output.
 */

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

type LudicAddress = number[];

interface HeatMapPosition {
  address: LudicAddress;
  x: number;
  y: number;
  strength: number;
  polarity: "+" | "-";
  label?: string;
  size?: number;
  color?: string;
}

interface FlowPath {
  id: string;
  name?: string;
  positions: LudicAddress[];
  frequency: number;
  outcome?: "P" | "O" | "draw";
}

interface CriticalPoint {
  address: LudicAddress;
  type: "turning" | "decisive" | "bottleneck";
  description?: string;
}

interface LandscapeData {
  id: string;
  arenaId: string;
  positions: HeatMapPosition[];
  flowPaths: FlowPath[];
  criticalPoints: CriticalPoint[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  stats?: {
    totalPositions: number;
    avgStrength: number;
    maxDepth: number;
  };
}

export interface LandscapeHeatMapProps {
  /** Landscape data to display */
  landscape?: LandscapeData | null;
  /** Arena ID to fetch landscape for */
  arenaId?: string;
  /** Currently selected position */
  selectedPosition?: LudicAddress;
  /** Callback when position is selected */
  onPositionSelect?: (address: LudicAddress) => void;
  /** Show flow paths */
  showFlowPaths?: boolean;
  /** Show critical points */
  showCriticalPoints?: boolean;
  /** Color scheme */
  colorScheme?: "heat" | "polarity" | "outcome";
  /** View mode */
  mode?: "canvas" | "grid" | "list";
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

function getStrengthColor(strength: number, scheme: string): string {
  if (scheme === "heat") {
    // Red-Yellow-Green gradient
    const r = Math.round(255 * (1 - strength));
    const g = Math.round(255 * strength);
    return `rgb(${r}, ${g}, 100)`;
  }
  // Default: opacity-based blue
  return `rgba(59, 130, 246, ${0.2 + strength * 0.8})`;
}

function getPolarityColor(polarity: "+" | "-"): string {
  return polarity === "+" ? "rgb(59, 130, 246)" : "rgb(249, 115, 22)";
}

function getCriticalPointStyle(type: "turning" | "decisive" | "bottleneck") {
  switch (type) {
    case "decisive":
      return { ring: "ring-red-500", bg: "bg-red-100", icon: "⚡" };
    case "turning":
      return { ring: "ring-yellow-500", bg: "bg-yellow-100", icon: "↪" };
    case "bottleneck":
      return { ring: "ring-purple-500", bg: "bg-purple-100", icon: "⊗" };
    default:
      return { ring: "ring-slate-500", bg: "bg-slate-100", icon: "•" };
  }
}

// ============================================================================
// CANVAS RENDERER
// ============================================================================

interface CanvasViewProps {
  landscape: LandscapeData;
  selectedAddress?: string;
  onPositionClick?: (address: LudicAddress) => void;
  showFlowPaths: boolean;
  showCriticalPoints: boolean;
  colorScheme: string;
}

function CanvasView({
  landscape,
  selectedAddress,
  onPositionClick,
  showFlowPaths,
  showCriticalPoints,
  colorScheme,
}: CanvasViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hoveredPosition, setHoveredPosition] = React.useState<HeatMapPosition | null>(null);

  // Canvas dimensions
  const width = 600;
  const height = 400;
  const padding = 40;

  // Scale functions
  const scaleX = (x: number) => {
    const { minX, maxX } = landscape.bounds;
    const range = maxX - minX || 1;
    return padding + ((x - minX) / range) * (width - 2 * padding);
  };

  const scaleY = (y: number) => {
    const { minY, maxY } = landscape.bounds;
    const range = maxY - minY || 1;
    return padding + ((y - minY) / range) * (height - 2 * padding);
  };

  // Draw canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    // Draw flow paths
    if (showFlowPaths && landscape.flowPaths.length > 0) {
      for (const path of landscape.flowPaths) {
        if (path.positions.length < 2) continue;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(100, 100, 100, ${0.2 + path.frequency * 0.3})`;
        ctx.lineWidth = 1 + path.frequency * 2;

        const firstPos = landscape.positions.find(
          (p) => addressToKey(p.address) === addressToKey(path.positions[0])
        );
        if (firstPos) {
          ctx.moveTo(scaleX(firstPos.x), scaleY(firstPos.y));

          for (let i = 1; i < path.positions.length; i++) {
            const pos = landscape.positions.find(
              (p) => addressToKey(p.address) === addressToKey(path.positions[i])
            );
            if (pos) {
              ctx.lineTo(scaleX(pos.x), scaleY(pos.y));
            }
          }
        }
        ctx.stroke();
      }
    }

    // Draw positions
    for (const pos of landscape.positions) {
      const x = scaleX(pos.x);
      const y = scaleY(pos.y);
      const radius = (pos.size || 10) * (1 + pos.strength * 0.5);
      const key = addressToKey(pos.address);

      // Color based on scheme
      let fillColor: string;
      if (colorScheme === "polarity") {
        fillColor = getPolarityColor(pos.polarity);
      } else {
        fillColor = getStrengthColor(pos.strength, colorScheme);
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Selection ring
      if (key === selectedAddress) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Polarity indicator
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pos.polarity, x, y);
    }

    // Draw critical points
    if (showCriticalPoints) {
      for (const cp of landscape.criticalPoints) {
        const pos = landscape.positions.find(
          (p) => addressToKey(p.address) === addressToKey(cp.address)
        );
        if (!pos) continue;

        const x = scaleX(pos.x);
        const y = scaleY(pos.y);
        const style = getCriticalPointStyle(cp.type);

        // Draw marker
        ctx.beginPath();
        ctx.arc(x, y - 20, 8, 0, Math.PI * 2);
        ctx.fillStyle =
          cp.type === "decisive"
            ? "#ef4444"
            : cp.type === "turning"
            ? "#eab308"
            : "#a855f7";
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(style.icon, x, y - 20);
      }
    }
  }, [landscape, selectedAddress, showFlowPaths, showCriticalPoints, colorScheme]);

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find clicked position
    for (const pos of landscape.positions) {
      const x = scaleX(pos.x);
      const y = scaleY(pos.y);
      const radius = (pos.size || 10) * (1 + pos.strength * 0.5);

      const distance = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
      if (distance <= radius) {
        onPositionClick?.(pos.address);
        return;
      }
    }
  };

  // Handle mouse move for hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const pos of landscape.positions) {
      const x = scaleX(pos.x);
      const y = scaleY(pos.y);
      const radius = (pos.size || 10) * (1 + pos.strength * 0.5);

      const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
      if (distance <= radius) {
        setHoveredPosition(pos);
        return;
      }
    }
    setHoveredPosition(null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPosition(null)}
        className="border rounded-lg cursor-pointer"
      />
      {/* Tooltip */}
      {hoveredPosition && (
        <div className="absolute bg-white border rounded shadow-lg p-2 text-sm pointer-events-none z-10"
          style={{ 
            left: scaleX(hoveredPosition.x) + 10, 
            top: scaleY(hoveredPosition.y) - 40 
          }}
        >
          <div className="font-mono text-xs">{addressToKey(hoveredPosition.address)}</div>
          <div>Strength: {(hoveredPosition.strength * 100).toFixed(0)}%</div>
          <div>Polarity: {hoveredPosition.polarity}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GRID VIEW
// ============================================================================

interface GridViewProps {
  landscape: LandscapeData;
  selectedAddress?: string;
  onPositionClick?: (address: LudicAddress) => void;
  showCriticalPoints: boolean;
  colorScheme: string;
}

function GridView({
  landscape,
  selectedAddress,
  onPositionClick,
  showCriticalPoints,
  colorScheme,
}: GridViewProps) {
  // Group positions by depth
  const positionsByDepth = React.useMemo(() => {
    const groups = new Map<number, HeatMapPosition[]>();
    for (const pos of landscape.positions) {
      const depth = pos.address.length;
      if (!groups.has(depth)) groups.set(depth, []);
      groups.get(depth)!.push(pos);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [landscape.positions]);

  const criticalSet = React.useMemo(() => {
    const set = new Map<string, CriticalPoint>();
    landscape.criticalPoints.forEach((cp) => {
      set.set(addressToKey(cp.address), cp);
    });
    return set;
  }, [landscape.criticalPoints]);

  return (
    <div className="space-y-4 p-4">
      {positionsByDepth.map(([depth, positions]) => (
        <div key={depth}>
          <div className="text-sm font-medium text-slate-500 mb-2">
            Depth {depth}
          </div>
          <div className="flex flex-wrap gap-2">
            {positions.map((pos) => {
              const key = addressToKey(pos.address);
              const critical = criticalSet.get(key);
              const isSelected = key === selectedAddress;

              return (
                <button
                  key={key}
                  onClick={() => onPositionClick?.(pos.address)}
                  className={cn(
                    "relative px-3 py-2 rounded border transition-all",
                    "hover:shadow-md",
                    isSelected && "ring-2 ring-blue-500 ring-offset-1"
                  )}
                  style={{
                    backgroundColor:
                      colorScheme === "polarity"
                        ? getPolarityColor(pos.polarity)
                        : getStrengthColor(pos.strength, colorScheme),
                    opacity: 0.7 + pos.strength * 0.3,
                  }}
                >
                  <span className="font-mono text-xs text-white drop-shadow">
                    {key}
                  </span>
                  {showCriticalPoints && critical && (
                    <span
                      className={cn(
                        "absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center",
                        getCriticalPointStyle(critical.type).bg
                      )}
                      title={critical.description}
                    >
                      {getCriticalPointStyle(critical.type).icon}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// LIST VIEW
// ============================================================================

interface ListViewProps {
  landscape: LandscapeData;
  selectedAddress?: string;
  onPositionClick?: (address: LudicAddress) => void;
  colorScheme: string;
}

function ListView({
  landscape,
  selectedAddress,
  onPositionClick,
  colorScheme,
}: ListViewProps) {
  // Sort by strength
  const sortedPositions = React.useMemo(() => {
    return [...landscape.positions].sort((a, b) => b.strength - a.strength);
  }, [landscape.positions]);

  return (
    <div className="divide-y max-h-[400px] overflow-y-auto">
      {sortedPositions.map((pos) => {
        const key = addressToKey(pos.address);
        const isSelected = key === selectedAddress;

        return (
          <div
            key={key}
            onClick={() => onPositionClick?.(pos.address)}
            className={cn(
              "flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50",
              isSelected && "bg-blue-50"
            )}
          >
            {/* Strength bar */}
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pos.strength * 100}%`,
                  backgroundColor: getStrengthColor(pos.strength, colorScheme),
                }}
              />
            </div>

            {/* Strength percentage */}
            <span className="text-sm w-12 text-right">
              {(pos.strength * 100).toFixed(0)}%
            </span>

            {/* Address */}
            <code className="text-sm flex-1">{key}</code>

            {/* Polarity */}
            <span
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                pos.polarity === "+"
                  ? "bg-blue-200 text-blue-800"
                  : "bg-orange-200 text-orange-800"
              )}
            >
              {pos.polarity}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// LEGEND COMPONENT
// ============================================================================

interface LegendProps {
  colorScheme: string;
  showFlowPaths: boolean;
  showCriticalPoints: boolean;
}

function Legend({ colorScheme, showFlowPaths, showCriticalPoints }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 p-2 bg-slate-50 rounded">
      {/* Color legend */}
      {colorScheme === "polarity" ? (
        <>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500" /> Positive (+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-500" /> Negative (-)
          </span>
        </>
      ) : (
        <span className="flex items-center gap-1">
          <span className="w-12 h-3 rounded bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
          Weak → Strong
        </span>
      )}

      {/* Flow paths */}
      {showFlowPaths && (
        <span className="flex items-center gap-1">
          <span className="w-8 h-0.5 bg-slate-400" /> Flow path
        </span>
      )}

      {/* Critical points */}
      {showCriticalPoints && (
        <>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
              ⚡
            </span>
            Decisive
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500 text-white text-[8px] flex items-center justify-center">
              ↪
            </span>
            Turning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500 text-white text-[8px] flex items-center justify-center">
              ⊗
            </span>
            Bottleneck
          </span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LandscapeHeatMap({
  landscape: propLandscape,
  arenaId,
  selectedPosition,
  onPositionSelect,
  showFlowPaths = true,
  showCriticalPoints = true,
  colorScheme = "heat",
  mode = "canvas",
  className,
}: LandscapeHeatMapProps) {
  // Fetch landscape if arenaId provided and no landscape prop
  const { data: fetchedData, isLoading } = useSWR(
    arenaId && !propLandscape ? `/api/ludics/landscape/${arenaId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const landscape = propLandscape || (fetchedData?.ok ? fetchedData.landscape : null);
  const selectedAddressKey = selectedPosition ? addressToKey(selectedPosition) : undefined;

  // View mode state
  const [currentMode, setCurrentMode] = React.useState(mode);
  const [currentColorScheme, setCurrentColorScheme] = React.useState(colorScheme);
  const [showPaths, setShowPaths] = React.useState(showFlowPaths);
  const [showCritical, setShowCritical] = React.useState(showCriticalPoints);

  // Loading
  if (isLoading) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        Loading landscape data...
      </div>
    );
  }

  // No data
  if (!landscape) {
    return (
      <div className={cn("p-4 text-center text-slate-500", className)}>
        No landscape data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <span className="font-bold">Strategic Landscape</span>
          {landscape.stats && (
            <span className="text-sm text-slate-500">
              {landscape.stats.totalPositions} positions
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* View mode */}
          <select
            value={currentMode}
            onChange={(e) => setCurrentMode(e.target.value as "canvas" | "grid" | "list")}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="canvas">Canvas</option>
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>

          {/* Color scheme */}
          <select
            value={currentColorScheme}
            onChange={(e) => setCurrentColorScheme(e.target.value as "outcome" | "heat" | "polarity")}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="heat">Heat</option>
            <option value="polarity">Polarity</option>
          </select>

          {/* Toggle buttons */}
          <button
            onClick={() => setShowPaths(!showPaths)}
            className={cn(
              "px-2 py-1 text-sm border rounded",
              showPaths ? "bg-blue-100 border-blue-300" : "bg-white"
            )}
            title="Toggle flow paths"
          >
            ↝
          </button>
          <button
            onClick={() => setShowCritical(!showCritical)}
            className={cn(
              "px-2 py-1 text-sm border rounded",
              showCritical ? "bg-yellow-100 border-yellow-300" : "bg-white"
            )}
            title="Toggle critical points"
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Legend */}
      <Legend
        colorScheme={currentColorScheme}
        showFlowPaths={showPaths}
        showCriticalPoints={showCritical}
      />

      {/* View */}
      <div className="border rounded-lg bg-white overflow-hidden">
        {currentMode === "canvas" && (
          <CanvasView
            landscape={landscape}
            selectedAddress={selectedAddressKey}
            onPositionClick={onPositionSelect}
            showFlowPaths={showPaths}
            showCriticalPoints={showCritical}
            colorScheme={currentColorScheme}
          />
        )}
        {currentMode === "grid" && (
          <GridView
            landscape={landscape}
            selectedAddress={selectedAddressKey}
            onPositionClick={onPositionSelect}
            showCriticalPoints={showCritical}
            colorScheme={currentColorScheme}
          />
        )}
        {currentMode === "list" && (
          <ListView
            landscape={landscape}
            selectedAddress={selectedAddressKey}
            onPositionClick={onPositionSelect}
            colorScheme={currentColorScheme}
          />
        )}
      </div>

      {/* Stats */}
      {landscape.stats && (
        <div className="flex items-center gap-4 text-sm text-slate-600 p-2 bg-slate-50 rounded">
          <span>
            Avg strength:{" "}
            <span className="font-medium">
              {(landscape.stats.avgStrength * 100).toFixed(0)}%
            </span>
          </span>
          <span>
            Max depth: <span className="font-medium">{landscape.stats.maxDepth}</span>
          </span>
          <span>
            Flow paths: <span className="font-medium">{landscape.flowPaths.length}</span>
          </span>
          <span>
            Critical: <span className="font-medium">{landscape.criticalPoints.length}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default LandscapeHeatMap;
