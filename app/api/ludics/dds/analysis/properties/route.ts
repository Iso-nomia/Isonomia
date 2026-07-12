export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Property Analysis API
 * POST /api/ludics/dds/analysis/properties
 *
 * Comprehensive property analysis for designs, strategies, and games.
 * Validates theoretical properties from Faggian & Hyland (2002).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  analyzeDesignProperties,
  analyzeStrategyProperties,
  analyzeGameProperties,
  analyzeComplexity,
  batchAnalyzeDesigns,
} from "@/packages/ludics-core/dds/analysis";
import { constructStrategy } from "@/packages/ludics-core/dds/strategy";
import { createGame } from "@/packages/ludics-core/dds/behaviours/types";
import type { Game } from "@/packages/ludics-core/dds/behaviours/types";
import type { Dispute } from "@/packages/ludics-core/dds/types";
import type {
  DesignForCorrespondence,
  DesignAct,
} from "@/packages/ludics-core/dds/correspondence/types";

/**
 * Prisma result type with acts and locus
 */
type PrismaDesignWithActs = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    expression: string | null;
    polarity: string | null;
    kind: string;
    ramification: string[];
    locus: { path: string } | null;
  }>;
};

/**
 * Convert a Prisma design (with acts + locus) to DesignForCorrespondence format.
 */
function toDesignForCorr(design: PrismaDesignWithActs): DesignForCorrespondence {
  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId,
    acts: design.acts.map((act): DesignAct => ({
      id: act.id,
      designId: design.id,
      expression: act.expression || "",
      polarity: (act.polarity as "P" | "O") || "P",
      kind: act.kind as "PROPER" | "DAIMON",
      ramification: act.ramification.map((r) => {
        const num = parseInt(r, 10);
        return isNaN(num) ? r : num;
      }),
      locusPath: act.locus?.path || "",
    })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      designId,
      designIds,
      strategyId,
      type = "design", // design, strategy, game, batch
    } = await req.json();

    if (type === "batch" && designIds?.length > 0) {
      // Batch analysis of multiple designs
      const designs = await prisma.ludicDesign.findMany({
        where: { id: { in: designIds } },
        include: { acts: { include: { locus: true } } },
      });

      const designsForCorr = designs.map((d) => toDesignForCorr(d));

      const resultsMap = await batchAnalyzeDesigns(designsForCorr);
      const results = Array.from(resultsMap.entries());

      return NextResponse.json({
        ok: true,
        type: "batch",
        results: results.map(([id, analysis]) => ({
          designId: id,
          properties: analysis.properties,
          proofs: analysis.proofs,
        })),
        summary: {
          total: results.length,
          legalCount: results.filter(
            ([, analysis]) => analysis.properties.legal
          ).length,
        },
      });
    }

    if (type === "design") {
      if (!designId) {
        return NextResponse.json(
          { ok: false, error: "designId is required for design analysis" },
          { status: 400 }
        );
      }

      const design = await prisma.ludicDesign.findUnique({
        where: { id: designId },
        include: { acts: { include: { locus: true } } },
      });

      if (!design) {
        return NextResponse.json(
          { ok: false, error: "Design not found" },
          { status: 404 }
        );
      }

      const designForCorr = toDesignForCorr(design);

      const properties = await analyzeDesignProperties(designForCorr, [
        designForCorr,
      ]);
      const complexity = analyzeComplexity(designForCorr);

      return NextResponse.json({
        ok: true,
        type: "design",
        designId,
        properties,
        complexity,
        actCount: designForCorr.acts.length,
      });
    }

    if (type === "strategy") {
      if (!strategyId && !designId) {
        return NextResponse.json(
          { ok: false, error: "strategyId or designId required for strategy analysis" },
          { status: 400 }
        );
      }

      let strategy: any;
      let allDesignsForCorr: DesignForCorrespondence[] = [];

      if (strategyId) {
        const strategyRecord = await prisma.ludicStrategy.findUnique({
          where: { id: strategyId },
          include: {
            design: { include: { acts: { include: { locus: true } } } },
            plays: true,
          },
        });

        if (!strategyRecord) {
          return NextResponse.json(
            { ok: false, error: "Strategy not found" },
            { status: 404 }
          );
        }

        const player = strategyRecord.player as "P" | "O";
        allDesignsForCorr = [toDesignForCorr(strategyRecord.design)];
        strategy = {
          id: strategyRecord.id,
          designId: strategyRecord.designId,
          player,
          plays: strategyRecord.plays.map((p) => ({
            id: p.id,
            strategyId: p.strategyId,
            sequence: (p.sequence as any) || [],
            length: p.length,
            isPositive: p.isPositive,
          })),
          isInnocent: strategyRecord.isInnocent,
          satisfiesPropagation: strategyRecord.satisfiesPropagation,
        };
      } else {
        // Construct from design
        const design = await prisma.ludicDesign.findUnique({
          where: { id: designId },
          include: { acts: { include: { locus: true } } },
        });

        if (!design) {
          return NextResponse.json(
            { ok: false, error: "Design not found" },
            { status: 404 }
          );
        }

        allDesignsForCorr = [toDesignForCorr(design)];
        const player = design.participantId === "Proponent" ? "P" : "O";

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

      const properties = await analyzeStrategyProperties(
        strategy,
        allDesignsForCorr
      );

      return NextResponse.json({
        ok: true,
        type: "strategy",
        strategyId: strategy.id,
        designId: strategy.designId,
        properties,
        playCount: strategy.plays.length,
        isInnocent: strategy.isInnocent,
      });
    }

    if (type === "game") {
      if (!designId && !designIds?.length) {
        return NextResponse.json(
          { ok: false, error: "designId or designIds required for game analysis" },
          { status: 400 }
        );
      }

      const targetDesignIds: string[] = designIds || [designId];

      // Fetch behaviours that materialize any of the target designs
      const behaviours = await prisma.ludicBehaviour.findMany({
        where: {
          materialDesigns: {
            some: { designId: { in: targetDesignIds } },
          },
        },
      });

      // Construct a minimal game describing the collected behaviours.
      // The analysis routines only inspect game.id, positions, moves and
      // strategies, so an empty arena/positions set is a valid baseline.
      const game: Game = createGame(
        behaviours[0]?.id ?? targetDesignIds[0] ?? "game",
        { addresses: [], legalPositionIds: [], labeling: {} },
        [],
        [],
        []
      );

      const properties = await analyzeGameProperties(game);

      return NextResponse.json({
        ok: true,
        type: "game",
        designIds: targetDesignIds,
        properties,
        behaviourCount: behaviours.length,
        regularBehaviours: behaviours.filter((b) => b.regular === true).length,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid type. Use: design, strategy, game, or batch" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Property Analysis Error]", error);
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
    const deliberationId = url.searchParams.get("deliberationId");
    const type = url.searchParams.get("type") || "summary";

    if (designId) {
      // Get all property information for a design
      const design = await prisma.ludicDesign.findUnique({
        where: { id: designId },
        include: {
          acts: true,
        },
      });

      if (!design) {
        return NextResponse.json(
          { ok: false, error: "Design not found" },
          { status: 404 }
        );
      }

      const strategy = await prisma.ludicStrategy.findFirst({
        where: { designId },
        include: {
          innocenceCheck: true,
          propagationCheck: true,
        },
      });

      const behaviours = await prisma.ludicBehaviour.findMany({
        where: {
          materialDesigns: { some: { designId } },
        },
        include: { materialDesigns: true },
      });

      return NextResponse.json({
        ok: true,
        designId,
        design: {
          actCount: design.acts.length,
          participantId: design.participantId,
        },
        strategy: strategy
          ? {
              id: strategy.id,
              player: strategy.player,
              isInnocent: strategy.isInnocent,
              playCount: strategy.playCount,
              innocenceCheck: strategy.innocenceCheck,
              propagationCheck: strategy.propagationCheck,
            }
          : null,
        behaviours: behaviours.map((b) => ({
          id: b.id,
          base: b.base,
          polarity: b.polarity,
          regular: b.regular,
          designCount: b.materialDesigns.length,
        })),
      });
    }

    if (deliberationId) {
      // Get summary for all designs in deliberation
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId },
        include: {
          _count: { select: { acts: true } },
        },
      });

      const strategies = await prisma.ludicStrategy.findMany({
        where: { design: { deliberationId } },
      });

      const behaviours = await prisma.ludicBehaviour.findMany({
        where: { deliberationId },
      });

      return NextResponse.json({
        ok: true,
        deliberationId,
        summary: {
          designCount: designs.length,
          totalActs: designs.reduce((sum, d) => sum + d._count.acts, 0),
          strategyCount: strategies.length,
          innocentStrategies: strategies.filter((s) => s.isInnocent).length,
          behaviourCount: behaviours.length,
          regularBehaviours: behaviours.filter((b) => b.regular === true).length,
        },
        designs: designs.map((d) => ({
          id: d.id,
          actCount: d._count.acts,
          participantId: d.participantId,
        })),
      });
    }

    return NextResponse.json(
      { ok: false, error: "designId or deliberationId required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Property Analysis GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
