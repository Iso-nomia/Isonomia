export const dynamic = "force-dynamic";

/**
 * DDS Phase 2: Propagation Checking API
 * POST /api/ludics/dds/strategies/propagation
 * 
 * Checks if a strategy satisfies the propagation condition.
 * Propagation: Views with same prefix must agree on continuation addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  constructStrategy,
  checkPropagation,
  checkFullPropagation,
  analyzePropagationStructure,
} from "@/packages/ludics-core/dds/strategy";
import type { Dispute } from "@/packages/ludics-core/dds/types";

export async function POST(req: NextRequest) {
  try {
    const { designId, forceRecheck, includeAnalysis } = await req.json();

    if (!designId) {
      return NextResponse.json(
        { ok: false, error: "designId is required" },
        { status: 400 }
      );
    }

    // Check for cached result if not forcing recheck
    if (!forceRecheck) {
      const cached = await prisma.ludicPropagationCheck.findFirst({
        where: {
          strategy: {
            designId,
          },
        },
        orderBy: { checkedAt: "desc" },
      });

      if (cached) {
        return NextResponse.json({
          ok: true,
          satisfiesPropagation: cached.satisfiesProp,
          violations: cached.violations,
          cached: true,
          checkedAt: cached.checkedAt,
        });
      }
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

    // Fetch disputes involving this design
    const disputes = await prisma.ludicDispute.findMany({
      where: {
        OR: [{ posDesignId: designId }, { negDesignId: designId }],
      },
    });

    // Convert to Dispute type
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

    // Check propagation (full check if requested)
    const propagationCheck = checkFullPropagation(strategy);

    // Optionally include detailed analysis
    let analysis = null;
    if (includeAnalysis) {
      analysis = analyzePropagationStructure(strategy);
    }

    // Upsert strategy record
    const strategyRecord = await prisma.ludicStrategy.upsert({
      where: {
        designId_player: {
          designId,
          player,
        },
      },
      update: {
        satisfiesPropagation: propagationCheck.satisfiesPropagation,
        playCount: strategy.plays.length,
        updatedAt: new Date(),
      },
      create: {
        designId,
        player,
        satisfiesPropagation: propagationCheck.satisfiesPropagation,
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
      satisfiesSliceLinearity: propagationCheck.satisfiesSliceLinearity,
      satisfiesPairPropagation: propagationCheck.satisfiesPairPropagation,
      violations: propagationCheck.violations,
      strategyId: strategyRecord.id,
      playCount: strategy.plays.length,
      analysis,
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
