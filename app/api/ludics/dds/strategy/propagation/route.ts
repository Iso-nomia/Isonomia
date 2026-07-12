export const dynamic = "force-dynamic";

/**
 * DDS Strategy Propagation API - Alias Route
 * GET/POST /api/ludics/dds/strategy/propagation
 * 
 * Alias for /api/ludics/dds/strategies/propagation
 * Created for UI component consistency.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  constructStrategy,
  checkPropagation,
} from "@/packages/ludics-core/dds/strategy";
import type { Dispute } from "@/packages/ludics-core/dds/types";

export async function POST(req: NextRequest) {
  try {
    const { designId, forceRecheck } = await req.json();

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

    // Determine player based on participantId
    const player = design.participantId === "Proponent" ? "P" : "O";

    // Fetch disputes involving this design
    const disputes = await prisma.ludicDispute.findMany({
      where: {
        OR: [{ posDesignId: designId }, { negDesignId: designId }],
      },
    });

    // Convert to Dispute type for the algorithm
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

    // Check propagation
    const propagationCheck = checkPropagation(strategy);

    // Find or create strategy record
    const strategyRecord = await prisma.ludicStrategy.upsert({
      where: {
        designId_player: {
          designId,
          player,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        designId,
        player,
        isInnocent: false,
        playCount: strategy.plays.length,
      },
    });

    // Store propagation check result
    await prisma.ludicPropagationCheck.upsert({
      where: { strategyId: strategyRecord.id },
      update: {
        satisfiesProp: propagationCheck.satisfiesPropagation,
        violations: propagationCheck.violations as any,
        checkedAt: new Date(),
      },
      create: {
        strategyId: strategyRecord.id,
        satisfiesProp: propagationCheck.satisfiesPropagation,
        violations: propagationCheck.violations as any,
      },
    });

    return NextResponse.json({
      ok: true,
      satisfiesPropagation: propagationCheck.satisfiesPropagation,
      violations: propagationCheck.violations,
      strategyId: strategyRecord.id,
      cached: false,
    });
  } catch (error: any) {
    console.error("[DDS Propagation Check Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");

    if (!designId) {
      return NextResponse.json(
        { ok: false, error: "designId query param required" },
        { status: 400 }
      );
    }

    // Fetch cached propagation check
    const cached = await prisma.ludicPropagationCheck.findFirst({
      where: {
        strategy: {
          designId,
        },
      },
      include: {
        strategy: true,
      },
      orderBy: { checkedAt: "desc" },
    });

    if (!cached) {
      return NextResponse.json({
        ok: true,
        hasResult: false,
        message: "No propagation check found. POST to run check.",
      });
    }

    return NextResponse.json({
      ok: true,
      hasResult: true,
      satisfiesPropagation: cached.satisfiesProp,
      violations: cached.violations,
      strategyId: cached.strategyId,
      checkedAt: cached.checkedAt,
    });
  } catch (error: any) {
    console.error("[DDS Propagation GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
