/**
 * ============================================
 * VISUALIZATION DATA
 * ============================================
 * 
 * Generate visualization data for the strategic landscape.
 * 
 * This module provides:
 * - Heat map data for position strength visualization
 * - Flow paths showing common traversal patterns
 * - Critical point detection
 * - Tree layout algorithms
 * - Export to various formats (JSON, SVG)
 * 
 * The visualization data is designed to be consumed by UI components
 * to render interactive strategic landscape views.
 */

import type {
  LudicDesignTheory,
  LudicAddress,
  DeliberationArena,
  ArenaPositionTheory,
  PositionStrength,
  Polarity,
  VisitablePath,
  LandscapeData,
  HeatMapData,
  FlowPath,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  keyToAddress,
  isAddressPrefix,
  getParentAddress,
} from "../types/ludics-theory";

import { type SimulationResult } from "./position-analyzer";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get polarity from address depth
 * Even depth (0, 2, 4...) = positive (+)
 * Odd depth (1, 3, 5...) = negative (-)
 */
function getPolarityFromDepth(depth: number): Polarity {
  return depth % 2 === 0 ? "+" : "-";
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Heat map position data
 */
export interface HeatMapPosition {
  /** Address in arena */
  address: LudicAddress;

  /** X coordinate for visualization */
  x: number;

  /** Y coordinate for visualization */
  y: number;

  /** Strength value (0-1) */
  strength: number;

  /** Polarity at this position */
  polarity: Polarity;

  /** Optional label */
  label?: string;

  /** Size factor for rendering */
  size?: number;

  /** Color value (derived from strength) */
  color?: string;
}

/**
 * Layout bounds
 */
export interface LayoutBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Extended heat map data
 */
export interface ExtendedHeatMapData {
  /** All position data */
  positions: HeatMapPosition[];

  /** Bounds of the layout */
  bounds: LayoutBounds;

  /** Color scale range */
  colorScale: {
    min: number;
    max: number;
    minColor: string;
    maxColor: string;
  };

  /** Edges between positions */
  edges: HeatMapEdge[];
}

/**
 * Edge in heat map
 */
export interface HeatMapEdge {
  /** Source address */
  from: LudicAddress;

  /** Target address */
  to: LudicAddress;

  /** Edge weight (frequency) */
  weight: number;

  /** Edge type */
  type: "tree" | "flow";
}

/**
 * Landscape statistics
 */
export interface LandscapeStatistics {
  /** Total number of positions */
  totalPositions: number;

  /** Number of terminal positions (no children) */
  terminalPositions: number;

  /** Average branching factor */
  avgBranchingFactor: number;

  /** Maximum depth */
  maxDepth: number;

  /** Number of critical points */
  criticalPointCount: number;

  /** P win rate across all positions */
  pWinRate: number;

  /** O win rate across all positions */
  oWinRate: number;

  /** Average position strength */
  avgStrength: number;
}

/**
 * Layout options
 */
export interface LayoutOptions {
  /** Node spacing in X direction */
  nodeSpacingX?: number;

  /** Node spacing in Y direction */
  nodeSpacingY?: number;

  /** Padding around layout */
  padding?: number;

  /** Layout algorithm */
  algorithm?: "tree" | "radial" | "force";

  /** Include edge data */
  includeEdges?: boolean;
}

/**
 * Complete landscape analysis data
 */
export interface CompleteLandscapeData extends LandscapeData {
  /** Extended heat map with edges */
  extendedHeatMap: ExtendedHeatMapData;

  /** Computed statistics */
  statistics: LandscapeStatistics;

  /** Simulation traces used */
  traces?: VisitablePath[];
}

// ============================================================================
// LANDSCAPE GENERATION
// ============================================================================

/**
 * Generate complete landscape data for an arena
 * 
 * @param arena The deliberation arena
 * @param analysis Position strength analysis
 * @param simulations Optional simulation results for flow paths
 * @returns Complete landscape visualization data
 */
export function generateLandscapeData(
  arena: DeliberationArena,
  analysis: PositionStrength[],
  simulations?: SimulationResult[]
): CompleteLandscapeData {
  // Generate heat map with tree layout
  const heatMap = layoutAsTree(arena, analysis);
  const extendedHeatMap = generateExtendedHeatMap(arena, analysis);

  // Find critical points
  const criticalPoints = findCriticalPoints(analysis);

  // Extract flow paths from simulations
  const flowPaths = simulations
    ? extractFlowPaths(arena, simulations)
    : [];

  // Compute statistics
  const statistics = computeLandscapeStatistics(
    arena,
    analysis,
    criticalPoints,
    flowPaths
  );

  return {
    arena,
    positions: analysis,
    heatMap,
    flowPaths,
    criticalPoints,
    extendedHeatMap,
    statistics,
    traces: simulations?.map((s) => s.path),
  };
}

// ============================================================================
// TREE LAYOUT
// ============================================================================

/**
 * Layout positions as a tree
 * 
 * Uses a simple hierarchical layout with:
 * - Y = depth in tree
 * - X = position among siblings
 * 
 * @param arena The arena
 * @param positions Position strength data
 * @param options Layout options
 * @returns Heat map data with positions laid out
 */
export function layoutAsTree(
  arena: DeliberationArena,
  positions: PositionStrength[],
  options?: LayoutOptions
): HeatMapData {
  const spacingX = options?.nodeSpacingX ?? 100;
  const spacingY = options?.nodeSpacingY ?? 80;
  const padding = options?.padding ?? 50;

  // Build position lookup
  const positionMap = new Map<string, PositionStrength>();
  for (const pos of positions) {
    positionMap.set(addressToKey(pos.address), pos);
  }

  // Build tree structure
  const tree = buildTreeStructure(arena);

  // Assign positions
  const heatMapPositions: HeatMapPosition[] = [];
  const depthWidths = new Map<number, number>();

  // First pass: count nodes at each depth
  function countAtDepth(node: TreeNode, depth: number): void {
    depthWidths.set(depth, (depthWidths.get(depth) ?? 0) + 1);
    for (const child of node.children) {
      countAtDepth(child, depth + 1);
    }
  }
  countAtDepth(tree, 0);

  // Second pass: assign coordinates
  const depthCounters = new Map<number, number>();
  
  function assignCoordinates(node: TreeNode, depth: number): void {
    const currentIndex = depthCounters.get(depth) ?? 0;
    depthCounters.set(depth, currentIndex + 1);

    const widthAtDepth = depthWidths.get(depth) ?? 1;
    const x = padding + ((currentIndex + 0.5) / widthAtDepth) * (widthAtDepth * spacingX);
    const y = padding + depth * spacingY;

    const strength = positionMap.get(addressToKey(node.address));

    heatMapPositions.push({
      address: node.address,
      x,
      y,
      strength: strength?.winRate ?? 0.5,
      polarity: getPolarityFromDepth(node.address.length),
      label: node.label,
    });

    for (const child of node.children) {
      assignCoordinates(child, depth + 1);
    }
  }
  assignCoordinates(tree, 0);

  return {
    positions: heatMapPositions.map((p) => ({
      address: p.address,
      x: p.x,
      y: p.y,
      strength: p.strength,
      polarity: p.polarity,
    })),
  };
}

/**
 * Tree node for layout
 */
interface TreeNode {
  address: LudicAddress;
  label?: string;
  children: TreeNode[];
}

/**
 * Build tree structure from arena
 */
function buildTreeStructure(arena: DeliberationArena): TreeNode {
  const root: TreeNode = {
    address: arena.rootAddress,
    label: "Root",
    children: [],
  };

  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set(addressToKey(arena.rootAddress), root);

  // Sort positions by depth for proper parent-child linking
  const sortedPositions = [...arena.positions.entries()].sort(
    ([a], [b]) => keyToAddress(a).length - keyToAddress(b).length
  );

  for (const [key, position] of sortedPositions) {
    const address = keyToAddress(key);
    
    if (addressEquals(address, arena.rootAddress)) {
      root.label = position.content;
      continue;
    }

    const node: TreeNode = {
      address,
      label: position.content,
      children: [],
    };
    nodeMap.set(key, node);

    // Find parent and add as child
    const parentAddr = getParentAddress(address);
    const parentKey = addressToKey(parentAddr);
    const parent = nodeMap.get(parentKey);

    if (parent) {
      parent.children.push(node);
    }
  }

  return root;
}

// ============================================================================
// CRITICAL POINTS
// ============================================================================

/**
 * Find critical points in the landscape
 * 
 * A critical point is a position where:
 * - Win rate changes significantly from parent
 * - Winning strategy exists but children don't have it
 * - Position is a decision point (multiple significantly different paths)
 * 
 * @param positions Position strength analysis
 * @param threshold Significance threshold for win rate change
 * @returns List of critical point addresses
 */
export function findCriticalPoints(
  positions: PositionStrength[],
  threshold: number = 0.15
): LudicAddress[] {
  const criticalPoints: LudicAddress[] = [];

  // Build position map
  const positionMap = new Map<string, PositionStrength>();
  for (const pos of positions) {
    positionMap.set(addressToKey(pos.address), pos);
  }

  for (const position of positions) {
    const { address, winRate, hasWinningStrategy } = position;
    
    // Skip root
    if (address.length === 0) continue;

    // Check parent win rate change
    const parentAddr = getParentAddress(address);
    const parent = positionMap.get(addressToKey(parentAddr));

    if (parent) {
      const winRateChange = Math.abs(winRate - parent.winRate);
      
      if (winRateChange >= threshold) {
        criticalPoints.push(address);
        continue;
      }

      // Check winning strategy change
      if (parent.hasWinningStrategy && !hasWinningStrategy) {
        criticalPoints.push(address);
        continue;
      }
    }

    // Check for decision points (positions with multiple children with different outcomes)
    const childAddresses = getChildAddresses(positions, address);
    if (childAddresses.length >= 2) {
      const childWinRates = childAddresses
        .map((a) => positionMap.get(addressToKey(a))?.winRate ?? 0.5)
        .filter((r) => r !== undefined);

      if (childWinRates.length >= 2) {
        const minRate = Math.min(...childWinRates);
        const maxRate = Math.max(...childWinRates);
        
        if (maxRate - minRate >= threshold) {
          criticalPoints.push(address);
        }
      }
    }
  }

  // Remove duplicates
  const seen = new Set<string>();
  return criticalPoints.filter((addr) => {
    const key = addressToKey(addr);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get child addresses of a position
 */
function getChildAddresses(
  positions: PositionStrength[],
  address: LudicAddress
): LudicAddress[] {
  return positions
    .filter((p) => {
      if (p.address.length !== address.length + 1) return false;
      return isAddressPrefix(address, p.address);
    })
    .map((p) => p.address);
}

/**
 * Check if a position is critical
 */
export function isCriticalPoint(
  address: LudicAddress,
  criticalPoints: LudicAddress[]
): boolean {
  return criticalPoints.some((cp) => addressEquals(cp, address));
}

// ============================================================================
// FLOW PATHS
// ============================================================================

/**
 * Extract flow paths from simulation results
 * 
 * Flow paths show common traversal patterns through the arena.
 * 
 * @param arena The arena
 * @param simulations Simulation results
 * @param minFrequency Minimum frequency to include
 * @returns Common flow paths
 */
export function extractFlowPaths(
  arena: DeliberationArena,
  simulations: SimulationResult[],
  minFrequency: number = 2
): FlowPath[] {
  // Count path frequencies
  const pathCounts = new Map<string, { count: number; convergent: number; addresses: LudicAddress[] }>();

  for (const sim of simulations) {
    const addresses = sim.path.actions.map((a) => a.focus);
    const pathKey = addresses.map(addressToKey).join("|");

    const existing = pathCounts.get(pathKey);
    if (existing) {
      existing.count++;
      if (sim.convergent) existing.convergent++;
    } else {
      pathCounts.set(pathKey, {
        count: 1,
        convergent: sim.convergent ? 1 : 0,
        addresses,
      });
    }
  }

  // Convert to FlowPath array and filter by frequency
  const flowPaths: FlowPath[] = [];

  for (const [, data] of pathCounts) {
    if (data.count >= minFrequency) {
      flowPaths.push({
        addresses: data.addresses,
        frequency: data.count,
        outcome: data.convergent > data.count / 2 ? "convergent" : "divergent",
      });
    }
  }

  // Sort by frequency (most common first)
  return flowPaths.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Find the most common path
 */
export function findMostCommonPath(flowPaths: FlowPath[]): FlowPath | null {
  if (flowPaths.length === 0) return null;
  return flowPaths.reduce((max, path) =>
    path.frequency > max.frequency ? path : max
  );
}

/**
 * Get paths through a specific position
 */
export function getPathsThrough(
  flowPaths: FlowPath[],
  address: LudicAddress
): FlowPath[] {
  return flowPaths.filter((path) =>
    path.addresses.some((a) => addressEquals(a, address))
  );
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Compute landscape statistics
 */
export function computeLandscapeStatistics(
  arena: DeliberationArena,
  positions: PositionStrength[],
  criticalPoints: LudicAddress[],
  flowPaths: FlowPath[]
): LandscapeStatistics {
  // Total positions
  const totalPositions = positions.length;

  // Terminal positions (no children)
  const terminalPositions = positions.filter((p) => {
    const children = getChildAddresses(positions, p.address);
    return children.length === 0;
  }).length;

  // Max depth
  const maxDepth = positions.reduce(
    (max, p) => Math.max(max, p.address.length),
    0
  );

  // Average branching factor
  const branchingCounts: number[] = [];
  for (const pos of positions) {
    const children = getChildAddresses(positions, pos.address);
    if (children.length > 0) {
      branchingCounts.push(children.length);
    }
  }
  const avgBranchingFactor =
    branchingCounts.length > 0
      ? branchingCounts.reduce((a, b) => a + b, 0) / branchingCounts.length
      : 0;

  // Win rates
  const pWinRates = positions.map((p) => p.winRate);
  const pWinRate =
    pWinRates.length > 0
      ? pWinRates.reduce((a, b) => a + b, 0) / pWinRates.length
      : 0.5;
  const oWinRate = 1 - pWinRate;

  // Average strength
  const avgStrength = pWinRate; // Win rate is our strength metric

  return {
    totalPositions,
    terminalPositions,
    avgBranchingFactor,
    maxDepth,
    criticalPointCount: criticalPoints.length,
    pWinRate,
    oWinRate,
    avgStrength,
  };
}

// ============================================================================
// EXTENDED HEAT MAP
// ============================================================================

/**
 * Generate extended heat map with edges and colors
 */
function generateExtendedHeatMap(
  arena: DeliberationArena,
  positions: PositionStrength[],
  options?: LayoutOptions
): ExtendedHeatMapData {
  const basicLayout = layoutAsTree(arena, positions, options);

  // Add color values
  const positionsWithColor: HeatMapPosition[] = basicLayout.positions.map((p) => ({
    ...p,
    color: strengthToColor(p.strength),
    size: 1 + p.strength * 0.5, // Stronger positions are slightly larger
  }));

  // Compute bounds
  const xs = positionsWithColor.map((p) => p.x);
  const ys = positionsWithColor.map((p) => p.y);
  
  const bounds: LayoutBounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };

  // Generate edges (tree structure)
  const edges: HeatMapEdge[] = [];
  if (options?.includeEdges !== false) {
    for (const pos of positions) {
      if (pos.address.length > 0) {
        const parentAddr = getParentAddress(pos.address);
        edges.push({
          from: parentAddr,
          to: pos.address,
          weight: 1,
          type: "tree",
        });
      }
    }
  }

  // Find min/max strength for color scale
  const strengths = positions.map((p) => p.winRate);
  const minStrength = Math.min(...strengths);
  const maxStrength = Math.max(...strengths);

  return {
    positions: positionsWithColor,
    bounds,
    colorScale: {
      min: minStrength,
      max: maxStrength,
      minColor: "#ff6b6b", // Red for low strength (P loses)
      maxColor: "#51cf66", // Green for high strength (P wins)
    },
    edges,
  };
}

/**
 * Convert strength value to color
 */
function strengthToColor(strength: number): string {
  // Interpolate from red (0) through yellow (0.5) to green (1)
  if (strength <= 0.5) {
    // Red to yellow
    const t = strength * 2;
    const r = 255;
    const g = Math.round(107 + t * (255 - 107));
    const b = Math.round(107 - t * 107);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to green
    const t = (strength - 0.5) * 2;
    const r = Math.round(255 - t * (255 - 81));
    const g = Math.round(255 - t * (255 - 207));
    const b = Math.round(0 + t * 102);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

/**
 * Export landscape data as JSON
 */
export function landscapeToJSON(data: CompleteLandscapeData): object {
  return {
    arenaId: data.arena.id ?? data.arena.deliberationId,
    statistics: data.statistics,
    positions: data.positions.map((p) => ({
      address: addressToKey(p.address),
      winRate: p.winRate,
      winningDesigns: p.winningDesignCount,
      totalDesigns: p.totalDesignCount,
      hasWinningStrategy: p.hasWinningStrategy,
      depth: p.depth,
    })),
    heatMap: {
      ...data.extendedHeatMap,
      positions: data.extendedHeatMap.positions.map((p) => ({
        ...p,
        address: addressToKey(p.address),
      })),
      edges: data.extendedHeatMap.edges.map((e) => ({
        ...e,
        from: addressToKey(e.from),
        to: addressToKey(e.to),
      })),
    },
    flowPaths: data.flowPaths.map((fp) => ({
      path: fp.addresses.map(addressToKey),
      frequency: fp.frequency,
      outcome: fp.outcome,
    })),
    criticalPoints: data.criticalPoints.map(addressToKey),
  };
}

/**
 * Export landscape as simple SVG (basic visualization)
 */
export function landscapeToSVG(
  data: CompleteLandscapeData,
  width: number = 800,
  height: number = 600
): string {
  const { extendedHeatMap, criticalPoints } = data;
  const { positions, edges, bounds } = extendedHeatMap;

  // Scale positions to fit
  const scaleX = (width - 100) / Math.max(bounds.width, 1);
  const scaleY = (height - 100) / Math.max(bounds.height, 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  
  // Add styles
  svg += `
    <style>
      .edge { stroke: #ccc; stroke-width: 2; fill: none; }
      .node { stroke: #333; stroke-width: 1; }
      .critical { stroke: #f00; stroke-width: 3; }
      .label { font-family: sans-serif; font-size: 10px; }
    </style>
  `;

  // Draw edges
  for (const edge of edges) {
    const fromPos = positions.find((p) => addressEquals(p.address, edge.from));
    const toPos = positions.find((p) => addressEquals(p.address, edge.to));
    
    if (fromPos && toPos) {
      const x1 = 50 + (fromPos.x - bounds.minX) * scaleX;
      const y1 = 50 + (fromPos.y - bounds.minY) * scaleY;
      const x2 = 50 + (toPos.x - bounds.minX) * scaleX;
      const y2 = 50 + (toPos.y - bounds.minY) * scaleY;
      
      svg += `<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }
  }

  // Draw nodes
  for (const pos of positions) {
    const x = 50 + (pos.x - bounds.minX) * scaleX;
    const y = 50 + (pos.y - bounds.minY) * scaleY;
    const radius = 10 * (pos.size ?? 1);
    const isCritical = criticalPoints.some((cp) => addressEquals(cp, pos.address));
    
    svg += `<circle class="node ${isCritical ? "critical" : ""}" 
      cx="${x}" cy="${y}" r="${radius}" 
      fill="${pos.color ?? strengthToColor(pos.strength)}" />`;
    
    if (pos.label) {
      svg += `<text class="label" x="${x}" y="${y + radius + 12}" 
        text-anchor="middle">${pos.label}</text>`;
    }
  }

  svg += "</svg>";
  return svg;
}
