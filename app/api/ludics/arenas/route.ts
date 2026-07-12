export const dynamic = "force-dynamic";

/**
 * DDS Arenas API Route
 * 
 * POST: Create a new arena
 * GET: List arenas for a deliberation
 * 
 * Arenas are the formal spaces where ludic interactions occur.
 * Based on Faggian & Hyland (2002) - universal arenas contain all possible moves.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
// Use client-safe imports to avoid pulling in Prisma
import {
  createUniversalArena,
  createArenaFromDesigns,
} from "@/packages/ludics-core/dds/arena/client";
import type { UniversalArena, ArenaMove } from "@/packages/ludics-core/dds/arena/client";
import { arenaStore, arenaById } from "./store";

/**
 * POST /api/ludics/arenas
 * Create a new arena
 * 
 * Body options:
 * 1. Universal arena: { deliberationId, name?, maxDepth?, maxRamification? }
 * 2. From designs: { deliberationId, fromDesigns: string[], name? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deliberationId,
      name,
      maxDepth = 4,
      maxRamification = 3,
      fromDesigns,
      scope,
    } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    let arena: UniversalArena;
    const arenaId = `arena-${uuidv4().slice(0, 8)}`;

    if (fromDesigns && Array.isArray(fromDesigns) && fromDesigns.length > 0) {
      // Create arena from provided designs
      // For now, we'll create a universal arena with the parameters
      // In production, this would analyze the designs to determine structure
      arena = createUniversalArena({
        maxDepth,
        maxRamification,
      });
      arena.id = arenaId;
    } else {
      // Create universal arena with specified parameters
      arena = createUniversalArena({
        maxDepth,
        maxRamification,
      });
      arena.id = arenaId;
    }

    // Assign deliberationId to arena
    (arena as any).deliberationId = deliberationId;

    const arenaRecord = {
      id: arenaId,
      name: name || `Arena ${new Date().toISOString().slice(0, 16)}`,
      deliberationId,
      arena,
      createdAt: new Date(),
      metadata: {
        sourceDesignIds: fromDesigns,
        scope,
        maxDepth,
        maxRamification,
      },
    };

    // Store in memory
    if (!arenaStore.has(deliberationId)) {
      arenaStore.set(deliberationId, []);
    }
    arenaStore.get(deliberationId)!.push(arenaRecord);

    // Also store in global lookup
    arenaById.set(arenaId, {
      ...arena,
      name: arenaRecord.name,
      deliberationId,
      createdAt: arenaRecord.createdAt,
    });

    // Compute arena statistics
    const stats = computeArenaStats(arena);

    return NextResponse.json({
      ok: true,
      arena: {
        id: arenaId,
        name: arenaRecord.name,
        deliberationId,
        base: arena.base,
        isUniversal: arena.isUniversal,
        moveCount: arena.moves.length,
        moves: arena.moves.map(m => ({
          id: m.id,
          address: m.address,
          ramification: m.ramification,
          player: m.player,
          isInitial: m.isInitial,
        })),
        createdAt: arenaRecord.createdAt,
      },
      stats,
      metadata: arenaRecord.metadata,
    });
  } catch (error: any) {
    console.error("[Arenas POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/arenas
 * List arenas for a deliberation
 * 
 * Query params:
 * - deliberationId: required
 * - limit: optional (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const arenaId = searchParams.get("arenaId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get specific arena by ID
    if (arenaId) {
      const arena = arenaById.get(arenaId);
      if (!arena) {
        return NextResponse.json(
          { ok: false, error: "Arena not found" },
          { status: 404 }
        );
      }

      const stats = computeArenaStats(arena);

      return NextResponse.json({
        ok: true,
        arena: {
          id: arenaId,
          name: (arena as any).name,
          deliberationId: (arena as any).deliberationId,
          base: arena.base,
          isUniversal: arena.isUniversal,
          moveCount: arena.moves.length,
          moves: arena.moves,
          createdAt: (arena as any).createdAt,
        },
        stats,
      });
    }

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId query param required" },
        { status: 400 }
      );
    }

    const arenas = arenaStore.get(deliberationId) || [];
    const limited = arenas.slice(0, limit);

    return NextResponse.json({
      ok: true,
      arenas: limited.map(record => ({
        id: record.id,
        name: record.name,
        deliberationId: record.deliberationId,
        base: record.arena.base,
        isUniversal: record.arena.isUniversal,
        moveCount: record.arena.moves.length,
        createdAt: record.createdAt,
        metadata: record.metadata,
      })),
      count: limited.length,
      total: arenas.length,
    });
  } catch (error: any) {
    console.error("[Arenas GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Compute statistics for an arena
 */
function computeArenaStats(arena: UniversalArena): {
  totalMoves: number;
  maxDepth: number;
  avgRamification: number;
  pMoves: number;
  oMoves: number;
  terminalCount: number;
} {
  const moves = arena.moves;
  const maxDepth = Math.max(...moves.map(m => m.address.length), 0);
  
  const pMoves = moves.filter(m => m.player === "P").length;
  const oMoves = moves.filter(m => m.player === "O").length;
  
  const nonTerminal = moves.filter(m => m.ramification.length > 0);
  const avgRamification = nonTerminal.length > 0
    ? nonTerminal.reduce((sum, m) => sum + m.ramification.length, 0) / nonTerminal.length
    : 0;

  const terminalCount = moves.filter(m => m.ramification.length === 0).length;

  return {
    totalMoves: moves.length,
    maxDepth,
    avgRamification: Math.round(avgRamification * 100) / 100,
    pMoves,
    oMoves,
    terminalCount,
  };
}

// Export arena store for use by other routes
// re-exports removed: not valid in Next.js route files
