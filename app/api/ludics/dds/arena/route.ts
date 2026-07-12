export const dynamic = "force-dynamic";

/**
 * DDS Arena API Route
 * 
 * POST: Create a new arena
 * GET: List arenas for a deliberation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  createUniversalArena,
  createArenaFromDesigns,
  encodeArena,
  validateArena,
  getArenaStats,
} from "@/packages/ludics-core/dds/arena";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deliberationId, designIds, maxDepth, maxRamification, name } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    let arena;

    if (designIds && designIds.length > 0) {
      // Create arena from existing designs
      const designs = await prisma.ludicDesign.findMany({
        where: {
          id: { in: designIds },
          deliberationId,
        },
        include: {
          acts: {
            include: { locus: true },
          },
        },
      });

      if (designs.length === 0) {
        return NextResponse.json(
          { ok: false, error: "No designs found with provided IDs" },
          { status: 404 }
        );
      }

      // Transform to format expected by createArenaFromDesigns
      const designData = designs.map((d) => ({
        id: d.id,
        acts: d.acts.map((a) => ({
          id: a.id,
          locusPath: a.locus?.path ?? "",
          ramification: Array.isArray(a.ramification)
            ? (a.ramification as unknown as number[])
            : [],
          polarity: a.polarity ?? "",
        })),
      }));

      arena = createArenaFromDesigns(designData, {
        deliberationId,
      });
    } else {
      // Create universal arena with specified depth
      arena = createUniversalArena({
        maxDepth: maxDepth ?? 3,
        maxRamification: maxRamification ?? 3,
        deliberationId,
      });
    }

    // Validate arena
    const validation = validateArena(arena);
    if (!validation.isValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid arena structure", errors: validation.errors },
        { status: 400 }
      );
    }

    // Get stats
    const stats = getArenaStats(arena);

    // Encode for storage
    const encoded = encodeArena(arena);

    // Store in database (using existing LudicGame table or new table)
    // For now, return the arena directly without persistence
    // TODO: Add LudicsArena model to schema

    return NextResponse.json({
      ok: true,
      arena: {
        id: arena.id,
        base: arena.base,
        isUniversal: arena.isUniversal,
        moveCount: arena.moves.length,
        stats,
      },
      moves: arena.moves,
      enablingRelation: arena.enablingRelation,
      encoded,
    });
  } catch (error: any) {
    console.error("Arena creation error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // TODO: Query from LudicsArena table once added to schema
    // For now, return empty list
    return NextResponse.json({
      ok: true,
      arenas: [],
      message: "Arena persistence not yet implemented",
    });
  } catch (error: any) {
    console.error("Arena list error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
