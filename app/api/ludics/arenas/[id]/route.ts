export const dynamic = "force-dynamic";

/**
 * DDS Arena Detail API Route
 * 
 * GET /api/ludics/arenas/[id]
 * Get a single arena by ID with full details
 */

import { NextRequest, NextResponse } from "next/server";
import { arenaById } from "../store";
// Use client-safe imports to avoid pulling in Prisma
import type { UniversalArena, ArenaMove } from "@/packages/ludics-core/dds/arena/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ludics/arenas/[id]
 * Get full details of a specific arena
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Arena ID is required" },
        { status: 400 }
      );
    }

    const arena = arenaById.get(id);
    if (!arena) {
      return NextResponse.json(
        { ok: false, error: "Arena not found" },
        { status: 404 }
      );
    }

    // Build move tree structure for visualization
    const moveTree = buildMoveTree(arena.moves);
    
    // Compute detailed statistics
    const stats = computeDetailedStats(arena);

    return NextResponse.json({
      ok: true,
      arena: {
        id,
        name: (arena as any).name,
        deliberationId: (arena as any).deliberationId,
        base: arena.base,
        isUniversal: arena.isUniversal,
        createdAt: (arena as any).createdAt,
      },
      moves: arena.moves.map(m => ({
        id: m.id,
        address: m.address,
        ramification: m.ramification,
        player: m.player,
        isInitial: m.isInitial,
        depth: m.address.length,
      })),
      tree: moveTree,
      stats,
    });
  } catch (error: any) {
    console.error("[Arena Detail GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build a tree structure from arena moves for visualization
 */
function buildMoveTree(moves: ArenaMove[]): {
  root: string;
  nodes: Array<{
    address: string;
    player: "P" | "O";
    children: string[];
    isTerminal: boolean;
  }>;
} {
  const nodes: Array<{
    address: string;
    player: "P" | "O";
    children: string[];
    isTerminal: boolean;
  }> = [];

  // Sort moves by address length for proper tree building
  const sortedMoves = [...moves].sort((a, b) => a.address.length - b.address.length);

  for (const move of sortedMoves) {
    // Find children - moves whose address starts with this move's address
    // and has exactly one more character
    const children = moves
      .filter(m => 
        m.address.length === move.address.length + 1 &&
        m.address.startsWith(move.address)
      )
      .map(m => m.address);

    nodes.push({
      address: move.address || "(root)",
      player: move.player,
      children,
      isTerminal: move.ramification.length === 0,
    });
  }

  return {
    root: "(root)",
    nodes,
  };
}

/**
 * Compute detailed statistics for an arena
 */
function computeDetailedStats(arena: UniversalArena): {
  totalMoves: number;
  maxDepth: number;
  avgRamification: number;
  pMoves: number;
  oMoves: number;
  terminalCount: number;
  branchingFactor: number;
  depthDistribution: Record<number, number>;
  playerByDepth: Array<{ depth: number; pCount: number; oCount: number }>;
} {
  const moves = arena.moves;
  
  // Basic stats
  const maxDepth = Math.max(...moves.map(m => m.address.length), 0);
  const pMoves = moves.filter(m => m.player === "P").length;
  const oMoves = moves.filter(m => m.player === "O").length;
  
  // Ramification stats
  const nonTerminal = moves.filter(m => m.ramification.length > 0);
  const avgRamification = nonTerminal.length > 0
    ? nonTerminal.reduce((sum, m) => sum + m.ramification.length, 0) / nonTerminal.length
    : 0;

  const terminalCount = moves.filter(m => m.ramification.length === 0).length;

  // Branching factor (at root level)
  const rootMove = moves.find(m => m.address === "" || m.isInitial);
  const branchingFactor = rootMove?.ramification.length ?? 0;

  // Depth distribution
  const depthDistribution: Record<number, number> = {};
  for (const move of moves) {
    const depth = move.address.length;
    depthDistribution[depth] = (depthDistribution[depth] || 0) + 1;
  }

  // Player distribution by depth
  const playerByDepth: Array<{ depth: number; pCount: number; oCount: number }> = [];
  for (let d = 0; d <= maxDepth; d++) {
    const atDepth = moves.filter(m => m.address.length === d);
    playerByDepth.push({
      depth: d,
      pCount: atDepth.filter(m => m.player === "P").length,
      oCount: atDepth.filter(m => m.player === "O").length,
    });
  }

  return {
    totalMoves: moves.length,
    maxDepth,
    avgRamification: Math.round(avgRamification * 100) / 100,
    pMoves,
    oMoves,
    terminalCount,
    branchingFactor,
    depthDistribution,
    playerByDepth,
  };
}
