export const dynamic = "force-dynamic";

/**
 * DDS Phase 2: Plays(V) Operation API
 * POST /api/ludics/dds/strategies/plays
 * 
 * Computes Plays(V) - generates smallest innocent strategy containing view set V.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { computePlays } from "@/packages/ludics-core/dds/strategy";
import type { View } from "@/packages/ludics-core/dds/types";

export async function POST(req: NextRequest) {
  try {
    const { views, maxIterations, maxPlays } = await req.json();

    if (!views || !Array.isArray(views)) {
      return NextResponse.json(
        { ok: false, error: "views array is required" },
        { status: 400 }
      );
    }

    if (views.length === 0) {
      return NextResponse.json({
        ok: true,
        plays: [],
        playCount: 0,
        isSmallest: true,
        iterations: 0,
        message: "Empty view set produces empty strategy",
      });
    }

    // Validate view structure
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      if (!view.sequence || !Array.isArray(view.sequence)) {
        return NextResponse.json(
          {
            ok: false,
            error: `View at index ${i} missing sequence array`,
          },
          { status: 400 }
        );
      }
      if (!view.player || !["P", "O"].includes(view.player)) {
        return NextResponse.json(
          {
            ok: false,
            error: `View at index ${i} has invalid player (must be "P" or "O")`,
          },
          { status: 400 }
        );
      }
    }

    // Ensure all views are for same player
    const player = views[0].player;
    if (!views.every((v: View) => v.player === player)) {
      return NextResponse.json(
        { ok: false, error: "All views must be for the same player" },
        { status: 400 }
      );
    }

    // Compute Plays(V)
    const playsResult = computePlays(views as View[], {
      maxIterations: maxIterations ?? 100,
      maxPlays: maxPlays ?? 10000,
    });

    return NextResponse.json({
      ok: true,
      plays: playsResult.plays.map((p) => ({
        id: p.id,
        sequence: p.sequence,
        length: p.length,
        isPositive: p.isPositive,
      })),
      playCount: playsResult.playCount,
      isSmallest: playsResult.isSmallest,
      iterations: playsResult.iterations,
    });
  } catch (error: any) {
    console.error("[DDS Plays(V) Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Fetch plays from a stored strategy
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const strategyId = url.searchParams.get("strategyId");
    const designId = url.searchParams.get("designId");
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);

    if (!strategyId && !designId) {
      return NextResponse.json(
        { ok: false, error: "strategyId or designId required" },
        { status: 400 }
      );
    }

    // Find strategy
    let strategy;
    if (strategyId) {
      strategy = await prisma.ludicStrategy.findUnique({
        where: { id: strategyId },
        include: {
          plays: {
            take: limit,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    } else {
      strategy = await prisma.ludicStrategy.findFirst({
        where: { designId: designId! },
        include: {
          plays: {
            take: limit,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!strategy) {
      return NextResponse.json({
        ok: true,
        hasPlays: false,
        message: "No strategy found. Create disputes first.",
      });
    }

    return NextResponse.json({
      ok: true,
      hasPlays: strategy.plays.length > 0,
      plays: strategy.plays.map((p) => ({
        id: p.id,
        sequence: p.sequence,
        length: p.length,
        isPositive: p.isPositive,
      })),
      playCount: strategy.playCount,
      strategyId: strategy.id,
      isInnocent: strategy.isInnocent,
      satisfiesPropagation: strategy.satisfiesPropagation,
    });
  } catch (error: any) {
    console.error("[DDS Plays GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
