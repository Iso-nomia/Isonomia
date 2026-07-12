export const dynamic = "force-dynamic";

/**
 * DDS Strategies Generation API
 * POST /api/ludics/dds/strategies/generate
 * 
 * Generates strategies for ALL designs in a deliberation:
 * - P-Strategy for Proponent designs
 * - O-Strategy for Opponent designs
 * - Optionally: Counter-strategies (P for O designs, O for P designs)
 * 
 * Based on Faggian & Hyland (2002):
 * - Strategy is a set of plays determined by disputes
 * - Disp(D) = disputes between D and orthogonal designs
 * 
 * The generate endpoint will:
 * 1. Auto-create disputes between P/O design pairs if none exist
 * 2. Build strategies from those disputes
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  constructStrategy,
  checkInnocence,
  checkPropagation,
} from "@/packages/ludics-core/dds/strategy";
import type { Dispute } from "@/packages/ludics-core/dds/types";

interface GenerationOptions {
  deliberationId: string;
  includeCounterStrategies?: boolean;  // Generate O-Strategy for P designs and vice versa
  forceRegenerate?: boolean;
  autoCreateDisputes?: boolean;        // Auto-create disputes from design pairs if none exist
}

export async function POST(req: NextRequest) {
  try {
    const { 
      deliberationId, 
      includeCounterStrategies = false,
      forceRegenerate = false,
      autoCreateDisputes = true,  // Default to auto-creating disputes
    }: GenerationOptions = await req.json();

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Fetch all designs for this deliberation
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      include: { 
        acts: {
          include: { locus: true },
          orderBy: { orderInDesign: "asc" }
        }
      },
    });

    if (designs.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No designs found for deliberation",
      }, { status: 404 });
    }

    // Separate P and O designs
    const pDesigns = designs.filter((d) => d.participantId === "Proponent");
    const oDesigns = designs.filter((d) => d.participantId === "Opponent");

    // Fetch existing disputes for this deliberation
    let disputes = await prisma.ludicDispute.findMany({
      where: { deliberationId },
    });

    // Auto-create disputes from P/O design pairs if none exist
    let disputesCreated = 0;
    if (autoCreateDisputes && disputes.length === 0 && pDesigns.length > 0 && oDesigns.length > 0) {
      console.log(`[Strategies Generate] Auto-creating disputes from ${pDesigns.length} P × ${oDesigns.length} O design pairs`);
      
      // Create disputes for each P × O pair
      for (const pDesign of pDesigns) {
        for (const oDesign of oDesigns) {
          // Build action pairs from the designs' acts
          // The dispute represents how P and O acts interact at shared loci
          const pActs = pDesign.acts || [];
          const oActs = oDesign.acts || [];
          
          console.log(`[Strategies Generate] P design ${pDesign.id.slice(-8)} acts:`, 
            pActs.map(a => ({ id: a.id.slice(-8), path: a.locus?.path })));
          console.log(`[Strategies Generate] O design ${oDesign.id.slice(-8)} acts:`, 
            oActs.map(a => ({ id: a.id.slice(-8), path: a.locus?.path })));
          
          // Collect all unique locus paths from both designs
          // In Faggian-Hyland: each locus path represents one node in the interaction tree
          const allPaths = new Set<string>();
          const actsByPath = new Map<string, { pActId?: string; oActId?: string }>();
          
          for (const pAct of pActs) {
            const path = (pAct.locus?.path as string) || "0";
            allPaths.add(path);
            const existing = actsByPath.get(path) || {};
            existing.pActId = pAct.id;
            actsByPath.set(path, existing);
          }
          
          for (const oAct of oActs) {
            const path = (oAct.locus?.path as string) || "0";
            allPaths.add(path);
            const existing = actsByPath.get(path) || {};
            existing.oActId = oAct.id;
            actsByPath.set(path, existing);
          }
          
          // Sort paths by depth (tree traversal order)
          const sortedPaths = Array.from(allPaths).sort((a, b) => {
            const depthA = a.split(".").length;
            const depthB = b.split(".").length;
            return depthA - depthB || a.localeCompare(b);
          });
          
          console.log(`[Strategies Generate] Sorted locus paths:`, sortedPaths);
          
          // Build action pairs with proper tree structure
          // Each pair represents one node in the tree, with polarity determined by depth
          const actionPairs: Array<{
            posActId: string;
            negActId: string;
            locusPath: string;
            ts: number;
          }> = [];
          
          for (let i = 0; i < sortedPaths.length; i++) {
            const path = sortedPaths[i];
            const acts = actsByPath.get(path) || {};
            
            actionPairs.push({
              posActId: acts.pActId || "∅",
              negActId: acts.oActId || "∅",
              locusPath: path,
              ts: i,
            });
          }
          
          console.log(`[Strategies Generate] Action pairs created:`, actionPairs.map(p => 
            `${p.locusPath}: P=${p.posActId?.slice(-8) || "∅"}, O=${p.negActId?.slice(-8) || "∅"}`
          ));

          // Create the dispute
          const dispute = await prisma.ludicDispute.create({
            data: {
              deliberationId,
              posDesignId: pDesign.id,
              negDesignId: oDesign.id,
              actionPairs: actionPairs as any,
              status: actionPairs.length > 0 ? "CONVERGENT" : "ONGOING",
              length: actionPairs.length,
            },
          });
          disputesCreated++;
        }
      }

      // Re-fetch disputes after creation
      disputes = await prisma.ludicDispute.findMany({
        where: { deliberationId },
      });
    }

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

    // Track generated strategies
    const generated: Array<{
      designId: string;
      player: string;
      strategyId: string;
      isInnocent: boolean;
      satisfiesPropagation: boolean;
      playCount: number;
      type: "primary" | "counter";
    }> = [];

    for (const design of designs) {
      // Determine primary player based on participantId
      const primaryPlayer = design.participantId === "Proponent" ? "P" : "O";
      const counterPlayer = primaryPlayer === "P" ? "O" : "P";

      // Filter disputes involving this design
      const designDisputes = disputeData.filter(
        (d) => d.posDesignId === design.id || d.negDesignId === design.id
      );

      // Generate primary strategy
      const primaryStrategy = await generateAndSaveStrategy(
        design.id,
        primaryPlayer,
        designDisputes,
        forceRegenerate,
        "primary"
      );
      if (primaryStrategy) {
        generated.push(primaryStrategy);
      }

      // Optionally generate counter-strategy
      if (includeCounterStrategies) {
        const counterStrategy = await generateAndSaveStrategy(
          design.id,
          counterPlayer,
          designDisputes,
          forceRegenerate,
          "counter"
        );
        if (counterStrategy) {
          generated.push(counterStrategy);
        }
      }
    }

    // Summary stats
    const pStrategies = generated.filter((g) => g.player === "P");
    const oStrategies = generated.filter((g) => g.player === "O");
    const innocentCount = generated.filter((g) => g.isInnocent).length;
    const propagatingCount = generated.filter((g) => g.satisfiesPropagation).length;

    return NextResponse.json({
      ok: true,
      generated: generated.length,
      strategies: generated,
      summary: {
        totalDesigns: designs.length,
        pDesigns: pDesigns.length,
        oDesigns: oDesigns.length,
        disputesCreated,
        totalDisputes: disputes.length,
        pStrategies: pStrategies.length,
        oStrategies: oStrategies.length,
        innocentStrategies: innocentCount,
        propagatingStrategies: propagatingCount,
        primaryStrategies: generated.filter((g) => g.type === "primary").length,
        counterStrategies: generated.filter((g) => g.type === "counter").length,
      },
    });
  } catch (error: any) {
    console.error("[Strategies Generate Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

async function generateAndSaveStrategy(
  designId: string,
  player: "P" | "O",
  disputes: Dispute[],
  forceRegenerate: boolean,
  type: "primary" | "counter"
): Promise<{
  designId: string;
  player: string;
  strategyId: string;
  isInnocent: boolean;
  satisfiesPropagation: boolean;
  playCount: number;
  type: "primary" | "counter";
} | null> {
  try {
    // Check for existing strategy
    if (!forceRegenerate) {
      const existing = await prisma.ludicStrategy.findUnique({
        where: {
          designId_player: { designId, player },
        },
      });
      if (existing) {
        return {
          designId,
          player,
          strategyId: existing.id,
          isInnocent: existing.isInnocent,
          satisfiesPropagation: existing.satisfiesPropagation,
          playCount: existing.playCount,
          type,
        };
      }
    }

    // Construct strategy from disputes
    const strategy = constructStrategy(designId, player, disputes);

    // Check properties
    const innocenceResult = checkInnocence(strategy);
    const propagationResult = checkPropagation(strategy);

    // Upsert strategy record
    const record = await prisma.ludicStrategy.upsert({
      where: {
        designId_player: { designId, player },
      },
      update: {
        isInnocent: innocenceResult.isInnocent,
        satisfiesPropagation: propagationResult.satisfiesPropagation,
        playCount: strategy.plays.length,
        updatedAt: new Date(),
      },
      create: {
        designId,
        player,
        isInnocent: innocenceResult.isInnocent,
        satisfiesPropagation: propagationResult.satisfiesPropagation,
        playCount: strategy.plays.length,
      },
    });

    // Store plays
    await prisma.ludicPlay.deleteMany({
      where: { strategyId: record.id },
    });

    if (strategy.plays.length > 0) {
      await prisma.ludicPlay.createMany({
        data: strategy.plays.slice(0, 500).map((play) => ({
          strategyId: record.id,
          sequence: play.sequence as any,
          length: play.length,
          isPositive: play.isPositive,
        })),
      });
    }

    // Store innocence check
    await prisma.ludicInnocenceCheck.upsert({
      where: { strategyId: record.id },
      update: {
        isInnocent: innocenceResult.isInnocent,
        isDeterministic: innocenceResult.isDeterministic,
        isViewStable: innocenceResult.isViewStable,
        violationLog: innocenceResult.violations as any,
        checkedAt: new Date(),
      },
      create: {
        strategyId: record.id,
        isInnocent: innocenceResult.isInnocent,
        isDeterministic: innocenceResult.isDeterministic,
        isViewStable: innocenceResult.isViewStable,
        violationLog: innocenceResult.violations as any,
      },
    });

    // Store propagation check
    await prisma.ludicPropagationCheck.upsert({
      where: { strategyId: record.id },
      update: {
        satisfiesProp: propagationResult.satisfiesPropagation,
        violations: propagationResult.violations as any,
        checkedAt: new Date(),
      },
      create: {
        strategyId: record.id,
        satisfiesProp: propagationResult.satisfiesPropagation,
        violations: propagationResult.violations as any,
      },
    });

    return {
      designId,
      player,
      strategyId: record.id,
      isInnocent: innocenceResult.isInnocent,
      satisfiesPropagation: propagationResult.satisfiesPropagation,
      playCount: strategy.plays.length,
      type,
    };
  } catch (error) {
    console.error(`[Strategy Generate] Error for ${designId}/${player}:`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get("deliberationId");

  if (!deliberationId) {
    return NextResponse.json(
      { ok: false, error: "deliberationId query param required" },
      { status: 400 }
    );
  }

  // Get all strategies for this deliberation
  const strategies = await prisma.ludicStrategy.findMany({
    where: {
      design: { deliberationId },
    },
    include: {
      design: {
        select: {
          id: true,
          participantId: true,
          scope: true,
        },
      },
      innocenceCheck: true,
      propagationCheck: true,
      _count: {
        select: { plays: true, viewCache: true },
      },
    },
    orderBy: [
      { player: "asc" },
      { createdAt: "desc" },
    ],
  });

  // Format for UI
  const formatted = strategies.map((s) => ({
    id: s.id,
    designId: s.designId,
    player: s.player,
    isInnocent: s.isInnocent,
    satisfiesPropagation: s.satisfiesPropagation,
    playCount: s.playCount,
    viewCount: s._count.viewCache,
    design: s.design,
    isPrimary: 
      (s.design?.participantId === "Proponent" && s.player === "P") ||
      (s.design?.participantId === "Opponent" && s.player === "O"),
    label: `${s.player}-Strategy • ${s.design?.participantId || "design"}${s.isInnocent ? " ✓ innocent" : ""}${s.satisfiesPropagation ? " ✓ propagates" : ""}`,
  }));

  // Group by player for summary
  const pStrategies = formatted.filter((s) => s.player === "P");
  const oStrategies = formatted.filter((s) => s.player === "O");

  return NextResponse.json({
    ok: true,
    strategies: formatted,
    summary: {
      total: formatted.length,
      pStrategies: pStrategies.length,
      oStrategies: oStrategies.length,
      innocentCount: formatted.filter((s) => s.isInnocent).length,
      propagatingCount: formatted.filter((s) => s.satisfiesPropagation).length,
    },
  });
}
