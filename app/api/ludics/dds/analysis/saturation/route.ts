export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Saturation Analysis API
 * POST /api/ludics/dds/analysis/saturation
 * 
 * Checks if a strategy is saturated: Views(S) = S.
 * Based on Proposition 4.17 from Faggian & Hyland (2002).
 * 
 * A saturated strategy is stable under view extraction.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  checkSaturation,
  computeSaturationClosure,
  getSaturationDeficiency,
} from "@/packages/ludics-core/dds/analysis";
import { constructStrategy } from "@/packages/ludics-core/dds/strategy";
import type { Dispute } from "@/packages/ludics-core/dds/types";

export async function POST(req: NextRequest) {
  try {
    const { designId, strategyId, mode = "check" } = await req.json();

    if (!designId && !strategyId) {
      return NextResponse.json(
        { ok: false, error: "designId or strategyId is required" },
        { status: 400 }
      );
    }

    let strategy: any;
    let player: "P" | "O";

    if (strategyId) {
      // Use existing strategy
      const strategyRecord = await prisma.ludicStrategy.findUnique({
        where: { id: strategyId },
        include: {
          design: { include: { acts: true } },
          plays: true,
        },
      });

      if (!strategyRecord) {
        return NextResponse.json(
          { ok: false, error: "Strategy not found" },
          { status: 404 }
        );
      }

      player = strategyRecord.player as "P" | "O";
      strategy = {
        id: strategyRecord.id,
        designId: strategyRecord.designId,
        player,
        plays: strategyRecord.plays.map((p) => ({
          id: p.id,
          strategyId: p.strategyId,
          sequence: (p.sequence as any) || [],
          length: (p.sequence as any[])?.length || p.length || 0,
          isPositive: p.isPositive,
        })),
        isInnocent: strategyRecord.isInnocent,
      };
    } else {
      // Construct strategy from design
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

      player = design.participantId === "Proponent" ? "P" : "O";

      // Fetch disputes
      const disputes = await prisma.ludicDispute.findMany({
        where: {
          OR: [{ posDesignId: designId }, { negDesignId: designId }],
        },
      });

      const disputeData: Dispute[] = disputes.map((d) => ({
        id: d.id,
        dialogueId: d.deliberationId,
        posDesignId: d.posDesignId,
        negDesignId: d.negDesignId,
        pairs: (d.actionPairs as any) || [],
        status: d.status as "ONGOING" | "CONVERGENT" | "DIVERGENT" | "STUCK",
        length: d.length,
      }));

      strategy = constructStrategy(designId!, player, disputeData);
    }

    if (mode === "check") {
      // Standard saturation check
      const result = await checkSaturation(strategy);

      return NextResponse.json({
        ok: true,
        isSaturated: result.isSaturated,
        viewsEqualStrategy: result.viewsEqualStrategy,
        playCount: strategy.plays.length,
        details: result.details,
      });
    } else if (mode === "closure") {
      // Compute saturation closure
      const result = await computeSaturationClosure(strategy);

      return NextResponse.json({
        ok: true,
        originalPlayCount: strategy.plays.length,
        closurePlayCount: result.closedStrategy.plays.length,
        playsAdded: result.closedStrategy.plays.length - strategy.plays.length,
        isSaturated: result.isSaturated,
        iterations: result.iterations,
      });
    } else if (mode === "deficiency") {
      // Compute saturation deficiency
      const result = await getSaturationDeficiency(strategy);

      return NextResponse.json({
        ok: true,
        deficiency: result.deficiency,
        missingPlays: result.missingPlays,
        isComplete: result.deficiency === 0,
        strategyPlayCount: strategy.plays.length,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid mode. Use: check, closure, or deficiency" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Saturation Analysis Error]", error);
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
    const strategyId = url.searchParams.get("strategyId");
    const deliberationId = url.searchParams.get("deliberationId");

    // Handle strategyId directly
    if (strategyId) {
      const strategyRecord = await prisma.ludicStrategy.findUnique({
        where: { id: strategyId },
        include: {
          design: { select: { id: true, participantId: true } },
          innocenceCheck: true,
          propagationCheck: true,
          plays: true,
        },
      });

      if (!strategyRecord) {
        return NextResponse.json(
          { ok: false, error: "Strategy not found" },
          { status: 404 }
        );
      }

      // Implied saturation from innocence
      const impliedSaturation = strategyRecord.isInnocent;

      return NextResponse.json({
        ok: true,
        hasStrategy: true,
        strategyId: strategyRecord.id,
        designId: strategyRecord.designId,
        isInnocent: strategyRecord.isInnocent,
        // Support both naming conventions for UI compatibility
        isSaturated: impliedSaturation,
        impliedSaturation,
        viewsEqualStrategy: impliedSaturation,
        playCount: strategyRecord.plays.length,
        innocenceCheck: strategyRecord.innocenceCheck
          ? {
              isDeterministic: strategyRecord.innocenceCheck.isDeterministic,
              isViewStable: strategyRecord.innocenceCheck.isViewStable,
            }
          : null,
        propagationCheck: strategyRecord.propagationCheck
          ? {
              satisfiesProp: strategyRecord.propagationCheck.satisfiesProp,
            }
          : null,
      });
    }

    if (designId) {
      // Get saturation status for specific design
      const strategyRecord = await prisma.ludicStrategy.findFirst({
        where: { designId },
        include: {
          innocenceCheck: true,
          propagationCheck: true,
        },
      });

      if (!strategyRecord) {
        return NextResponse.json({
          ok: true,
          hasStrategy: false,
          designId,
          message: "No strategy found. POST to compute saturation.",
        });
      }

      // Saturation is implied by innocence in many cases
      const impliedSaturation = strategyRecord.isInnocent;

      return NextResponse.json({
        ok: true,
        hasStrategy: true,
        designId,
        strategyId: strategyRecord.id,
        isInnocent: strategyRecord.isInnocent,
        impliedSaturation,
        innocenceCheck: strategyRecord.innocenceCheck
          ? {
              isDeterministic: strategyRecord.innocenceCheck.isDeterministic,
              isViewStable: strategyRecord.innocenceCheck.isViewStable,
            }
          : null,
      });
    }

    if (deliberationId) {
      // Get saturation status for all strategies in deliberation
      const strategies = await prisma.ludicStrategy.findMany({
        where: {
          design: { deliberationId },
        },
        include: {
          design: { select: { id: true, participantId: true } },
          innocenceCheck: true,
        },
      });

      return NextResponse.json({
        ok: true,
        deliberationId,
        strategies: strategies.map((s) => ({
          strategyId: s.id,
          designId: s.designId,
          player: s.player,
          isInnocent: s.isInnocent,
          playCount: s.playCount,
          innocenceDetails: s.innocenceCheck
            ? {
                isDeterministic: s.innocenceCheck.isDeterministic,
                isViewStable: s.innocenceCheck.isViewStable,
              }
            : null,
        })),
        summary: {
          total: strategies.length,
          innocentCount: strategies.filter((s) => s.isInnocent).length,
          saturatedCount: strategies.filter((s) => s.isInnocent).length, // Implied
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: "designId or deliberationId required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Saturation GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
