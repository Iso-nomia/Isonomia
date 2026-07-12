export const dynamic = "force-dynamic";

/**
 * Main Correspondence API Endpoint
 * GET /api/ludics/dds/correspondence?strategyId=xxx
 * 
 * Fetches correspondence status and verifies isomorphisms for a strategy
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  checkAllIsomorphisms,
  allIsomorphismsHold,
} from "@/packages/ludics-core/dds/correspondence";
import type { Strategy } from "@/packages/ludics-core/dds/strategy";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const strategyId = url.searchParams.get("strategyId");
    const designId = url.searchParams.get("designId");

    if (!strategyId && !designId) {
      return NextResponse.json(
        { ok: false, error: "strategyId or designId query param required" },
        { status: 400 }
      );
    }

    let strategyRecord: any;

    if (strategyId) {
      strategyRecord = await prisma.ludicStrategy.findUnique({
        where: { id: strategyId },
        include: {
          design: {
            include: {
              acts: { include: { locus: true } },
            },
          },
          plays: true,
          viewCache: true,
          innocenceCheck: true,
          propagationCheck: true,
        },
      });
    } else if (designId) {
      // Find strategy for the design
      strategyRecord = await prisma.ludicStrategy.findFirst({
        where: { designId },
        include: {
          design: {
            include: {
              acts: { include: { locus: true } },
            },
          },
          plays: true,
          viewCache: true,
          innocenceCheck: true,
          propagationCheck: true,
        },
      });
    }

    if (!strategyRecord) {
      return NextResponse.json(
        { ok: false, error: "Strategy not found" },
        { status: 404 }
      );
    }

    const design = strategyRecord.design;
    const player = strategyRecord.player as "P" | "O";

    // Build design for correspondence checking
    const designForCorr: DesignForCorrespondence = {
      id: design.id,
      deliberationId: design.deliberationId,
      participantId: design.participantId || "unknown",
      acts: design.acts.map((act: any) => ({
        id: act.id,
        designId: act.designId,
        kind: act.kind || "PROPER",
        polarity: act.polarity as "P" | "O",
        expression: act.expression || undefined,
        locusId: act.locusId || undefined,
        locusPath: act.locus?.path || act.locusPath || "0",
        ramification: (act.subLoci as string[]) || [],
      })),
      loci: design.acts
        .filter((act: any) => act.locus)
        .map((act: any) => ({
          id: act.locus.id,
          designId: design.id,
          path: act.locus.path,
        })),
    };

    // Build strategy for correspondence checking
    const strategy: Strategy = {
      id: strategyRecord.id,
      designId: strategyRecord.designId,
      player,
      plays: strategyRecord.plays.map((p: any) => ({
        id: p.id,
        strategyId: p.strategyId,
        sequence: (p.sequence as any[]) || [],
        length: (p.sequence as any[])?.length || 0,
        isPositive: player === "P",
      })),
      isInnocent: strategyRecord.isInnocent,
      satisfiesPropagation: strategyRecord.satisfiesPropagation,
    };

    // Fetch counter-designs (opponent designs in same deliberation)
    const counterDesigns = await prisma.ludicDesign.findMany({
      where: {
        deliberationId: design.deliberationId,
        participantId: { not: design.participantId },
      },
      include: {
        acts: { include: { locus: true } },
      },
    });

    const counterDesignsForCorr: DesignForCorrespondence[] = counterDesigns.map((cd: any) => ({
      id: cd.id,
      deliberationId: cd.deliberationId,
      participantId: cd.participantId || "unknown",
      acts: cd.acts.map((act: any) => ({
        id: act.id,
        designId: act.designId,
        kind: act.kind || "PROPER",
        polarity: act.polarity as "P" | "O",
        expression: act.expression || undefined,
        locusId: act.locusId || undefined,
        locusPath: act.locus?.path || act.locusPath || "0",
        ramification: (act.subLoci as string[]) || [],
      })),
      loci: cd.acts
        .filter((act: any) => act.locus)
        .map((act: any) => ({
          id: act.locus.id,
          designId: cd.id,
          path: act.locus.path,
        })),
    }));

    // Check isomorphisms
    const isomorphisms = checkAllIsomorphisms(designForCorr, strategy, counterDesignsForCorr);
    const allHold = allIsomorphismsHold(isomorphisms);

    // Check if a correspondence record exists
    const existingCorrespondence = await prisma.ludicCorrespondence.findFirst({
      where: { strategyId: strategyRecord.id },
    });

    return NextResponse.json({
      ok: true,
      id: existingCorrespondence?.id || `corr-${strategyRecord.id}`,
      strategyId: strategyRecord.id,
      designId: design.id,
      isVerified: allHold,
      isomorphisms: {
        ...isomorphisms,
        allHold,
      },
      strategy: {
        id: strategyRecord.id,
        player: strategyRecord.player,
        isInnocent: strategyRecord.isInnocent,
        satisfiesPropagation: strategyRecord.satisfiesPropagation,
        playCount: strategyRecord.plays.length,
        viewCount: strategyRecord.viewCache.length,
      },
      design: {
        id: design.id,
        participantId: design.participantId,
        actCount: design.acts.length,
      },
    });
  } catch (error: any) {
    console.error("[DDS Correspondence GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch correspondence" },
      { status: 500 }
    );
  }
}
