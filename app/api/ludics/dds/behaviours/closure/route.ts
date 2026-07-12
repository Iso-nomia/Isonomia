export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Biorthogonal Closure API
 * POST /api/ludics/dds/behaviours/closure
 * 
 * Computes the biorthogonal closure of a set of designs (D⊥⊥).
 * Based on Definition 6.2 from Faggian & Hyland (2002).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  computeBiorthogonal,
  isBehaviour,
  computeOrthogonal,
} from "@/packages/ludics-core/dds/behaviours";
import type { DesignForCorrespondence, DesignAct } from "@/packages/ludics-core/dds/correspondence/types";

// Type for Prisma design with acts
type PrismaDesignWithActs = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    designId: string;
    kind: string;
    polarity: string | null;
    expression: string | null;
    locusId: string | null;
    ramification: string[];
    orderInDesign: number;
  }>;
};

/**
 * Helper to convert Prisma design to DesignForCorrespondence
 * Fetches locus paths for acts that have locusId
 */
async function toDesignForCorrespondence(
  design: PrismaDesignWithActs
): Promise<DesignForCorrespondence> {
  // Collect locus IDs from acts
  const locusIds = design.acts
    .map(a => a.locusId)
    .filter((id): id is string => id !== null);
  
  // Fetch locus paths if there are any locus IDs
  const loci = locusIds.length > 0 
    ? await prisma.ludicLocus.findMany({
        where: { id: { in: locusIds } },
        select: { id: true, path: true },
      })
    : [];
  const locusMap = new Map(loci.map(l => [l.id, l.path]));

  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId || "",
    acts: design.acts.map((act): DesignAct => ({
      id: act.id,
      designId: act.designId,
      kind: (act.kind as "INITIAL" | "POSITIVE" | "NEGATIVE" | "DAIMON") || "POSITIVE",
      polarity: (act.polarity as "P" | "O") || "P",
      expression: act.expression || undefined,
      locusId: act.locusId || undefined,
      locusPath: act.locusId ? (locusMap.get(act.locusId) || "") : "",
      ramification: act.ramification?.map(r => parseInt(r, 10)).filter(n => !isNaN(n)) || [],
    })),
    loci: loci.map(l => ({ id: l.id, designId: design.id, path: l.path })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const maxIterations = body.maxIterations || 10;
    const mode = body.mode || "closure";
    
    // Support both designIds and strategyIds
    let designIds = body.designIds;
    
    // If strategyIds provided, look up the associated designIds
    if (body.strategyIds && Array.isArray(body.strategyIds) && body.strategyIds.length > 0) {
      const strategies = await prisma.ludicStrategy.findMany({
        where: { id: { in: body.strategyIds } },
        select: { id: true, designId: true },
      });
      designIds = strategies.map(s => s.designId);
    }

    if (!designIds || !Array.isArray(designIds) || designIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "designIds or strategyIds array is required" },
        { status: 400 }
      );
    }

    // Fetch all designs with ordered acts
    const designs = await prisma.ludicDesign.findMany({
      where: { id: { in: designIds } },
      include: { acts: { orderBy: { orderInDesign: "asc" } } },
    });

    if (designs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No designs found" },
        { status: 404 }
      );
    }

    // Convert to DesignForCorrespondence format (async to fetch locus paths)
    const targetDesigns = await Promise.all(
      designs.map(d => toDesignForCorrespondence(d as PrismaDesignWithActs))
    );

    // Fetch potential counter-designs from same deliberation
    const deliberationIds = [...new Set(designs.map((d) => d.deliberationId))];
    const potentialCounters = await prisma.ludicDesign.findMany({
      where: {
        deliberationId: { in: deliberationIds },
        id: { notIn: designIds },
      },
      include: { acts: { orderBy: { orderInDesign: "asc" } } },
    });

    // Convert counter designs
    const counterDesigns = await Promise.all(
      potentialCounters.map(d => toDesignForCorrespondence(d as PrismaDesignWithActs))
    );

    // All designs (input + potential counters)
    const allDesigns = [...targetDesigns, ...counterDesigns];

    if (mode === "check") {
      // Check if current set is already a behaviour (closed under ⊥⊥)
      const isClosed = await isBehaviour(targetDesigns, allDesigns, { maxIterations });

      return NextResponse.json({
        ok: true,
        isClosed,
        reason: isClosed 
          ? "Set is closed under biorthogonal closure (forms a behaviour)" 
          : "Set is not closed - biorthogonal closure would add more designs",
        designIds,
        designCount: designs.length,
      });
    } else if (mode === "iterate") {
      // Perform single orthogonal computation (D⊥)
      const orthogonal = await computeOrthogonal(targetDesigns, allDesigns, { maxIterations: 1 });

      return NextResponse.json({
        ok: true,
        originalCount: targetDesigns.length,
        orthogonalCount: orthogonal.length,
        orthogonalDesignIds: orthogonal.map(d => d.id),
        iteration: 1,
      });
    } else {
      // Full biorthogonal closure
      const closureResult = await computeBiorthogonal(targetDesigns, allDesigns, { maxIterations });

      // Note: Results are returned directly - storage would require schema updates
      // The LudicBehaviour model has a different structure (base, polarity, regular, uniformBound)
      // For now, we just return the closure computation results

      return NextResponse.json({
        ok: true,
        isClosed: closureResult.isComplete,
        converged: closureResult.isComplete,
        fixpointReached: closureResult.isComplete,
        iterations: closureResult.iterations,
        originalCount: closureResult.baseDesignIds.length,
        closedCount: closureResult.closureDesignIds.length,
        closureIds: closureResult.closureDesignIds,
        closedDesignIds: closureResult.closureDesignIds,
      });
    }
  } catch (error: any) {
    console.error("[DDS Closure Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get("deliberationId");
    const behaviourId = url.searchParams.get("behaviourId");

    if (behaviourId) {
      // Get specific behaviour
      const behaviour = await prisma.ludicBehaviour.findUnique({
        where: { id: behaviourId },
        include: { materialDesigns: true },
      });

      if (!behaviour) {
        return NextResponse.json(
          { ok: false, error: "Behaviour not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        behaviour: {
          id: behaviour.id,
          deliberationId: behaviour.deliberationId,
          base: behaviour.base,
          polarity: behaviour.polarity,
          regular: behaviour.regular,
          uniformBound: behaviour.uniformBound,
          createdAt: behaviour.createdAt,
          materialDesignCount: behaviour.materialDesigns.length,
        },
      });
    }

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId or behaviourId required" },
        { status: 400 }
      );
    }

    // Get all behaviours for deliberation
    const behaviours = await prisma.ludicBehaviour.findMany({
      where: { deliberationId },
      include: { materialDesigns: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      deliberationId,
      behaviours: behaviours.map((b) => ({
        id: b.id,
        base: b.base,
        polarity: b.polarity,
        regular: b.regular,
        uniformBound: b.uniformBound,
        materialDesignCount: b.materialDesigns.length,
        createdAt: b.createdAt,
      })),
      totalBehaviours: behaviours.length,
    });
  } catch (error: any) {
    console.error("[DDS Closure GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
