export const dynamic = "force-dynamic";

/**
 * DDS Arena Delocate API Route
 * 
 * POST: Delocate an arena to a specific base address
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createUniversalArena,
  delocateArena,
  encodeArena,
  getArenaStats,
} from "@/packages/ludics-core/dds/arena/client";
import type { UniversalArena } from "@/packages/ludics-core/dds/arena/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { arena: arenaConfig, baseAddress, maxDepth, maxRamification } = body;

    if (!baseAddress) {
      return NextResponse.json(
        { ok: false, error: "baseAddress is required" },
        { status: 400 }
      );
    }

    // Build or receive arena
    let arena: UniversalArena;
    if (arenaConfig?.moves) {
      // Arena provided directly
      arena = arenaConfig as UniversalArena;
    } else {
      // Create universal arena first
      arena = createUniversalArena({
        maxDepth: maxDepth ?? 3,
        maxRamification: maxRamification ?? 3,
      });
    }

    // Delocate arena to new base
    const delocated = delocateArena(arena, baseAddress);

    // Get stats
    const stats = getArenaStats(delocated);

    // Encode for storage
    const encoded = encodeArena(delocated);

    return NextResponse.json({
      ok: true,
      arena: {
        id: delocated.id,
        base: delocated.base,
        isUniversal: delocated.isUniversal,
        delocalizationAddress: delocated.delocalizationAddress,
        moveCount: delocated.moves.length,
        stats,
      },
      moves: delocated.moves.slice(0, 50), // Limit response size
      totalMoves: delocated.moves.length,
      encoded,
    });
  } catch (error: any) {
    console.error("Arena delocate error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
