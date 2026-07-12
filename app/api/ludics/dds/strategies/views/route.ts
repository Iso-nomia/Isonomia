export const dynamic = "force-dynamic";

/**
 * DDS Phase 2: Views(S) Operation API
 * GET/POST /api/ludics/dds/strategies/views
 * 
 * Computes Views(S) - all player views from a strategy.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  constructStrategy,
  computeViews,
} from "@/packages/ludics-core/dds/strategy";
import type { Dispute } from "@/packages/ludics-core/dds/types";

export async function POST(req: NextRequest) {
  try {
    const { designId, cacheResults } = await req.json();

    if (!designId) {
      return NextResponse.json(
        { ok: false, error: "designId is required" },
        { status: 400 }
      );
    }

    // Fetch design
    const design = await prisma.ludicDesign.findUnique({
      where: { id: designId },
      include: { acts: true },
    });

    if (!design) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Determine player
    const player = design.participantId === "Proponent" ? "P" : "O";

    // Fetch disputes
    const disputes = await prisma.ludicDispute.findMany({
      where: {
        OR: [{ posDesignId: designId }, { negDesignId: designId }],
      },
    });

    // Convert disputes
    const disputeData: Dispute[] = disputes.map((d) => ({
      id: d.id,
      dialogueId: d.deliberationId,
      posDesignId: d.posDesignId,
      negDesignId: d.negDesignId,
      pairs: (d.actionPairs as any) || [],
      status: d.status as "ONGOING" | "CONVERGENT" | "DIVERGENT" | "STUCK",
      length: d.length,
    }));

    // Construct strategy
    const strategy = constructStrategy(designId, player, disputeData);

    // Compute Views(S)
    const viewsResult = computeViews(strategy);

    // Optionally cache views in database
    if (cacheResults) {
      const strategyRecord = await prisma.ludicStrategy.upsert({
        where: {
          designId_player: {
            designId,
            player,
          },
        },
        update: {
          playCount: strategy.plays.length,
        },
        create: {
          designId,
          player,
          playCount: strategy.plays.length,
        },
      });

      // Cache views
      for (const view of viewsResult.views.slice(0, 100)) {
        // Limit to avoid too many records
        await prisma.ludicStrategyView.create({
          data: {
            strategyId: strategyRecord.id,
            viewSequence: view.sequence as any,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      views: viewsResult.views,
      viewCount: viewsResult.viewCount,
      isStable: viewsResult.isStable,
      playCount: strategy.plays.length,
    });
  } catch (error: any) {
    console.error("[DDS Views(S) Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const strategyId = url.searchParams.get("strategyId");
    const designId = url.searchParams.get("designId");

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
          viewCache: {
            take: 100,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    } else {
      strategy = await prisma.ludicStrategy.findFirst({
        where: { designId: designId! },
        include: {
          viewCache: {
            take: 100,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!strategy) {
      return NextResponse.json({
        ok: true,
        hasViews: false,
        message: "No cached views. POST to compute.",
      });
    }

    return NextResponse.json({
      ok: true,
      hasViews: strategy.viewCache.length > 0,
      views: strategy.viewCache.map((v) => ({
        id: v.id,
        sequence: v.viewSequence,
        determinedMove: v.determinedMove,
        playCount: v.playCount,
      })),
      viewCount: strategy.viewCache.length,
      strategyId: strategy.id,
    });
  } catch (error: any) {
    console.error("[DDS Views GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
