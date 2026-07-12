export const dynamic = "force-dynamic";

/**
 * DDS Phase 2: Innocence Checking API
 * POST /api/ludics/dds/strategies/innocence
 * 
 * Checks if a strategy (derived from a design) is innocent.
 * An innocent strategy responds the same way to the same view.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  constructStrategy,
  checkInnocence,
} from "@/packages/ludics-core/dds/strategy";
import { disputeToPosition } from "@/packages/ludics-core/dds/chronicles";
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

    // Check for cached result if not forcing recheck
    if (!forceRecheck) {
      const cached = await prisma.ludicInnocenceCheck.findFirst({
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
          isInnocent: cached.isInnocent,
          isDeterministic: cached.isDeterministic,
          isViewStable: cached.isViewStable,
          violations: cached.violationLog,
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

    // Check innocence
    const innocenceCheck = checkInnocence(strategy);

    // Upsert strategy record
    const strategyRecord = await prisma.ludicStrategy.upsert({
      where: {
        designId_player: {
          designId,
          player,
        },
      },
      update: {
        isInnocent: innocenceCheck.isInnocent,
        playCount: strategy.plays.length,
        updatedAt: new Date(),
      },
      create: {
        designId,
        player,
        isInnocent: innocenceCheck.isInnocent,
        playCount: strategy.plays.length,
      },
    });

    // Store innocence check result
    await prisma.ludicInnocenceCheck.upsert({
      where: { strategyId: strategyRecord.id },
      update: {
        isInnocent: innocenceCheck.isInnocent,
        isDeterministic: innocenceCheck.isDeterministic,
        isViewStable: innocenceCheck.isViewStable,
        violationLog: innocenceCheck.violations as any,
        checkedAt: new Date(),
      },
      create: {
        strategyId: strategyRecord.id,
        isInnocent: innocenceCheck.isInnocent,
        isDeterministic: innocenceCheck.isDeterministic,
        isViewStable: innocenceCheck.isViewStable,
        violationLog: innocenceCheck.violations as any,
      },
    });

    return NextResponse.json({
      ok: true,
      isInnocent: innocenceCheck.isInnocent,
      isDeterministic: innocenceCheck.isDeterministic,
      isViewStable: innocenceCheck.isViewStable,
      isSaturated: innocenceCheck.isSaturated,
      violations: innocenceCheck.violations,
      strategyId: strategyRecord.id,
      playCount: strategy.plays.length,
      cached: false,
    });
  } catch (error: any) {
    console.error("[DDS Innocence Check Error]", error);
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

    // Fetch cached innocence check
    const cached = await prisma.ludicInnocenceCheck.findFirst({
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
        message: "No innocence check found. POST to run check.",
      });
    }

    return NextResponse.json({
      ok: true,
      hasResult: true,
      isInnocent: cached.isInnocent,
      isDeterministic: cached.isDeterministic,
      isViewStable: cached.isViewStable,
      violations: cached.violationLog,
      strategyId: cached.strategyId,
      checkedAt: cached.checkedAt,
    });
  } catch (error: any) {
    console.error("[DDS Innocence GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
