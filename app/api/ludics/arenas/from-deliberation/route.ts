export const dynamic = "force-dynamic";

/**
 * DDS Arena from Deliberation API Route
 * 
 * POST /api/ludics/arenas/from-deliberation
 * Build an arena from a deliberation's existing designs
 * 
 * This analyzes all P and O designs in a deliberation, finds shared loci,
 * and constructs an arena that captures all possible interaction paths.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prismaclient";
import {
  createUniversalArena,
  createArenaFromDesigns,
  createArenaMove,
} from "@/packages/ludics-core/dds/arena";
import type { UniversalArena, ArenaMove } from "@/packages/ludics-core/dds/arena";
import { arenaStore, arenaById } from "../store";

/**
 * POST /api/ludics/arenas/from-deliberation
 * Build arena from deliberation's designs
 * 
 * Body:
 * - deliberationId: required
 * - scope?: filter designs by scope
 * - includeChronicles?: also analyze chronicle paths
 * - name?: custom arena name
 * - maxDepth?: override computed max depth
 * - maxRamification?: override computed max ramification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deliberationId,
      scope,
      includeChronicles = false,
      name,
      maxDepth: overrideMaxDepth,
      maxRamification: overrideMaxRamification,
    } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Fetch designs from database
    const designWhere: any = { deliberationId };
    if (scope) {
      designWhere.scope = scope;
    }

    const designs = await prisma.ludicDesign.findMany({
      where: designWhere,
      include: {
        acts: {
          include: { locus: true },
        },
      },
      orderBy: { version: "asc" },
    });

    if (designs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No designs found for this deliberation" },
        { status: 404 }
      );
    }

    // Separate P and O designs
    const pDesigns = designs.filter(d => d.participantId === "Proponent");
    const oDesigns = designs.filter(d => d.participantId === "Opponent");

    // Collect all unique loci from designs
    const allLoci = new Set<string>();
    const lociByDesign = new Map<string, Set<string>>();

    for (const design of designs) {
      const designLoci = new Set<string>();
      for (const act of design.acts) {
        const locusPath = act.locus?.path ?? act.locusId ?? null;
        if (locusPath) {
          designLoci.add(locusPath);
          allLoci.add(locusPath);
        }
        // Also include subloci (ramification = allowed next sub-addresses)
        const subLoci = act.ramification;
        if (subLoci) {
          for (const sub of subLoci) {
            designLoci.add(sub);
            allLoci.add(sub);
          }
        }
      }
      lociByDesign.set(design.id, designLoci);
    }

    // Find shared loci (appear in both P and O designs)
    const pLoci = new Set<string>();
    const oLoci = new Set<string>();

    for (const design of pDesigns) {
      const loci = lociByDesign.get(design.id);
      if (loci) {
        for (const l of loci) pLoci.add(l);
      }
    }

    for (const design of oDesigns) {
      const loci = lociByDesign.get(design.id);
      if (loci) {
        for (const l of loci) oLoci.add(l);
      }
    }

    const sharedLoci = [...pLoci].filter(l => oLoci.has(l));

    // Optionally include chronicle paths
    let chroniclePaths: string[] = [];
    if (includeChronicles) {
      const chronicles = await prisma.ludicChronicle.findMany({
        where: { design: { deliberationId } },
        select: { act: { select: { locus: { select: { path: true } }, locusId: true } } },
      });

      for (const chronicle of chronicles) {
        const pathStep = chronicle.act?.locus?.path ?? chronicle.act?.locusId ?? null;
        if (pathStep) {
          chroniclePaths.push(pathStep);
        }
      }
    }

    // Compute arena parameters from designs
    const computedMaxDepth = Math.max(
      ...Array.from(allLoci).map(l => l.length),
      4
    );
    const computedMaxRamification = Math.max(
      ...designs.flatMap(d => d.acts.map(a => {
        const sub = a.ramification;
        return sub?.length ?? 0;
      })),
      3
    );

    const finalMaxDepth = overrideMaxDepth ?? computedMaxDepth;
    const finalMaxRamification = overrideMaxRamification ?? computedMaxRamification;

    // Build arena with computed parameters
    const arena = createUniversalArena({
      maxDepth: finalMaxDepth,
      maxRamification: finalMaxRamification,
    });

    const arenaId = `arena-${uuidv4().slice(0, 8)}`;
    arena.id = arenaId;
    (arena as any).deliberationId = deliberationId;

    // Create arena record
    const arenaRecord = {
      id: arenaId,
      name: name || `Arena from ${designs.length} designs`,
      deliberationId,
      arena,
      createdAt: new Date(),
      metadata: {
        sourceDesignIds: designs.map(d => d.id),
        scope,
        maxDepth: finalMaxDepth,
        maxRamification: finalMaxRamification,
        computedFromDesigns: true,
      },
    };

    // Store in memory
    if (!arenaStore.has(deliberationId)) {
      arenaStore.set(deliberationId, []);
    }
    arenaStore.get(deliberationId)!.push(arenaRecord);

    arenaById.set(arenaId, {
      ...arena,
      name: arenaRecord.name,
      deliberationId,
      createdAt: arenaRecord.createdAt,
    } as any);

    // Compute statistics
    const stats = {
      totalMoves: arena.moves.length,
      maxDepth: Math.max(...arena.moves.map(m => m.address.length), 0),
      pMoves: arena.moves.filter(m => m.player === "P").length,
      oMoves: arena.moves.filter(m => m.player === "O").length,
      terminalCount: arena.moves.filter(m => m.ramification.length === 0).length,
    };

    return NextResponse.json({
      ok: true,
      arena: {
        id: arenaId,
        name: arenaRecord.name,
        deliberationId,
        base: arena.base,
        isUniversal: arena.isUniversal,
        moveCount: arena.moves.length,
        createdAt: arenaRecord.createdAt,
      },
      sourceAnalysis: {
        totalDesigns: designs.length,
        pDesignCount: pDesigns.length,
        oDesignCount: oDesigns.length,
        uniqueLociCount: allLoci.size,
        sharedLociCount: sharedLoci.length,
        sharedLoci,
        chroniclePathsIncluded: chroniclePaths.length,
      },
      computedParams: {
        maxDepth: finalMaxDepth,
        maxRamification: finalMaxRamification,
        wasOverridden: !!(overrideMaxDepth || overrideMaxRamification),
      },
      stats,
    });
  } catch (error: any) {
    console.error("[Arena from Deliberation Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
