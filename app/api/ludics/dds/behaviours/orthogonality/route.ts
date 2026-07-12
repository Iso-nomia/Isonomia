export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Orthogonality Checking API
 * POST /api/ludics/dds/behaviours/orthogonality
 * 
 * Checks if two designs are orthogonal (D ⊥ E).
 * Based on Definition 6.1 from Faggian & Hyland (2002):
 * Two designs are orthogonal if their interaction converges.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  checkOrthogonalityBasic,
  findOrthogonalDesigns,
  verifyOrthogonalitySymmetry,
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
    const mode = body.mode || "check";
    
    // Support both designId and strategyId naming
    let designIdA = body.designIdA;
    let designIdB = body.designIdB;
    
    // If strategyIds provided, look up the associated designIds
    if (body.strategyAId || body.strategyBId) {
      const strategyIds = [body.strategyAId, body.strategyBId].filter(Boolean);
      const strategies = await prisma.ludicStrategy.findMany({
        where: { id: { in: strategyIds } },
        select: { id: true, designId: true },
      });
      
      const strategyToDesign = new Map(strategies.map(s => [s.id, s.designId]));
      
      if (body.strategyAId) {
        designIdA = strategyToDesign.get(body.strategyAId) || designIdA;
      }
      if (body.strategyBId) {
        designIdB = strategyToDesign.get(body.strategyBId) || designIdB;
      }
    }

    if (mode === "check") {
      // Check orthogonality between two specific designs
      if (!designIdA || !designIdB) {
        return NextResponse.json(
          { ok: false, error: "designIdA/strategyAId and designIdB/strategyBId are required" },
          { status: 400 }
        );
      }

      // Fetch designs with their acts ordered
      const [designA, designB] = await Promise.all([
        prisma.ludicDesign.findUnique({
          where: { id: designIdA },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
        prisma.ludicDesign.findUnique({
          where: { id: designIdB },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
      ]);

      if (!designA || !designB) {
        return NextResponse.json(
          { ok: false, error: "One or both designs not found" },
          { status: 404 }
        );
      }

      // Convert to DesignForCorrespondence format (async to fetch locus paths)
      const [design1, design2] = await Promise.all([
        toDesignForCorrespondence(designA as PrismaDesignWithActs),
        toDesignForCorrespondence(designB as PrismaDesignWithActs),
      ]);

      // Get diagnostic info about the designs
      const designAPolarity = design1.acts[0]?.polarity || "unknown";
      const designBPolarity = design2.acts[0]?.polarity || "unknown";
      const designALocus = design1.acts[0]?.locusPath || "none";
      const designBLocus = design2.acts[0]?.locusPath || "none";
      
      // Check orthogonality using the basic method
      const result = await checkOrthogonalityBasic(design1, design2);

      // Store result in LudicDispute (orthogonality is recorded as dispute status)
      const disputeStatus = result.isOrthogonal ? "CONVERGENT" : "DIVERGENT";
      
      // Check for existing dispute between these designs
      const existingDispute = await prisma.ludicDispute.findFirst({
        where: {
          OR: [
            { posDesignId: designIdA, negDesignId: designIdB },
            { posDesignId: designIdB, negDesignId: designIdA },
          ],
        },
      });

      if (existingDispute) {
        await prisma.ludicDispute.update({
          where: { id: existingDispute.id },
          data: {
            status: disputeStatus,
            extJson: {
              ...(existingDispute.extJson as object || {}),
              orthogonalityCheck: {
                method: result.method,
                convergenceType: result.convergenceType,
                checkedAt: new Date().toISOString(),
              },
            },
          },
        });
      } else {
        await prisma.ludicDispute.create({
          data: {
            deliberationId: designA.deliberationId,
            posDesignId: designIdA,
            negDesignId: designIdB,
            actionPairs: [],
            status: disputeStatus,
            length: 0,
            extJson: {
              orthogonalityCheck: {
                method: result.method,
                convergenceType: result.convergenceType,
                checkedAt: new Date().toISOString(),
              },
            },
          },
        });
      }

      return NextResponse.json({
        ok: true,
        isOrthogonal: result.isOrthogonal,
        strategyAId: body.strategyAId,
        strategyBId: body.strategyBId,
        method: result.method,
        convergenceType: result.convergenceType,
        reason: result.isOrthogonal 
          ? "Designs interact successfully (interaction converges)"
          : (result.evidence?.counterexample?.divergencePoint || "Designs are not orthogonal (interaction diverges)"),
        details: {
          designA: {
            id: designIdA,
            participantId: designA.participantId,
            actCount: designA.acts.length,
            initialPolarity: designAPolarity,
            initialLocus: designALocus,
          },
          designB: {
            id: designIdB,
            participantId: designB.participantId,
            actCount: designB.acts.length,
            initialPolarity: designBPolarity,
            initialLocus: designBLocus,
          },
        },
        // Diagnostic hints for non-orthogonal results
        diagnostics: !result.isOrthogonal ? {
          polarityCompatible: designAPolarity !== designBPolarity,
          locusCompatible: designALocus === designBLocus,
          hint: designAPolarity === designBPolarity 
            ? "Orthogonality requires designs with opposite initial polarities (P vs O). Try comparing a Proponent design with an Opponent design."
            : designALocus !== designBLocus
              ? `Designs have different initial loci (${designALocus} vs ${designBLocus}). Orthogonality requires matching loci for interaction.`
              : "Check the interaction trace for divergence points.",
        } : undefined,
      });
    } else if (mode === "verify") {
      // Verify orthogonality symmetry between two designs
      if (!designIdA || !designIdB) {
        return NextResponse.json(
          { ok: false, error: "designIdA and designIdB are required for verify mode" },
          { status: 400 }
        );
      }

      // Fetch designs
      const [designA, designB] = await Promise.all([
        prisma.ludicDesign.findUnique({
          where: { id: designIdA },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
        prisma.ludicDesign.findUnique({
          where: { id: designIdB },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
      ]);

      if (!designA || !designB) {
        return NextResponse.json(
          { ok: false, error: "One or both designs not found" },
          { status: 404 }
        );
      }

      const [design1, design2] = await Promise.all([
        toDesignForCorrespondence(designA as PrismaDesignWithActs),
        toDesignForCorrespondence(designB as PrismaDesignWithActs),
      ]);

      const result = await verifyOrthogonalitySymmetry(design1, design2);

      return NextResponse.json({
        ok: true,
        allOrthogonal: result.isSymmetric && result.forward.isOrthogonal,
        isSymmetric: result.isSymmetric,
        pairs: [
          {
            designA: designIdA,
            designB: designIdB,
            orthogonal: result.forward.isOrthogonal,
            direction: "forward",
          },
          {
            designA: designIdB,
            designB: designIdA,
            orthogonal: result.backward.isOrthogonal,
            direction: "backward",
          },
        ],
        summary: {
          totalPairs: 2,
          orthogonalCount: [result.forward.isOrthogonal, result.backward.isOrthogonal].filter(Boolean).length,
        },
      });
    } else if (mode === "counter" || mode === "find-orthogonal") {
      // Find orthogonal designs (counter-designs are non-orthogonal)
      if (!designIdA) {
        return NextResponse.json(
          { ok: false, error: "designIdA is required for counter/find-orthogonal mode" },
          { status: 400 }
        );
      }

      // Fetch the design
      const design = await prisma.ludicDesign.findUnique({
        where: { id: designIdA },
        include: { acts: { orderBy: { orderInDesign: "asc" } } },
      });

      if (!design) {
        return NextResponse.json(
          { ok: false, error: "Design not found" },
          { status: 404 }
        );
      }

      // Fetch all designs in same deliberation
      const allDesigns = await prisma.ludicDesign.findMany({
        where: {
          deliberationId: design.deliberationId,
          id: { not: designIdA },
        },
        include: { acts: { orderBy: { orderInDesign: "asc" } } },
      });

      const targetDesign = await toDesignForCorrespondence(design as PrismaDesignWithActs);
      const candidateDesigns = await Promise.all(
        allDesigns.map(d => toDesignForCorrespondence(d as PrismaDesignWithActs))
      );

      // Find orthogonal designs
      const orthogonalDesigns = await findOrthogonalDesigns(targetDesign, candidateDesigns, "basic");

      // Counter-designs are those NOT in the orthogonal set
      const orthogonalIds = new Set(orthogonalDesigns.map(d => d.id));
      const counterDesigns = candidateDesigns.filter(d => !orthogonalIds.has(d.id));

      return NextResponse.json({
        ok: true,
        orthogonalDesigns: orthogonalDesigns.map(d => ({
          id: d.id,
          participantId: d.participantId,
          actCount: d.acts.length,
        })),
        counterDesigns: counterDesigns.map(d => ({
          id: d.id,
          participantId: d.participantId,
          actCount: d.acts.length,
        })),
        hasCounterDesigns: counterDesigns.length > 0,
        candidatesChecked: candidateDesigns.length,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid mode. Use: check, verify, counter, or find-orthogonal" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Orthogonality Check Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designIdA = url.searchParams.get("designIdA");
    const designIdB = url.searchParams.get("designIdB");
    const deliberationId = url.searchParams.get("deliberationId");

    if (!designIdA && !deliberationId) {
      return NextResponse.json(
        { ok: false, error: "designIdA or deliberationId query param required" },
        { status: 400 }
      );
    }

    // Build query for disputes (which store orthogonality results)
    const whereClause: any = {};
    
    if (designIdA) {
      whereClause.OR = [
        { posDesignId: designIdA },
        { negDesignId: designIdA },
      ];
    }
    
    if (deliberationId) {
      whereClause.deliberationId = deliberationId;
    }

    // Fetch disputes with orthogonality info
    const disputes = await prisma.ludicDispute.findMany({
      where: whereClause,
      select: {
        id: true,
        posDesignId: true,
        negDesignId: true,
        status: true,
        extJson: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (designIdB && designIdA) {
      // Return specific orthogonality check
      const specific = disputes.find(
        (d) =>
          (d.posDesignId === designIdA && d.negDesignId === designIdB) ||
          (d.posDesignId === designIdB && d.negDesignId === designIdA)
      );

      return NextResponse.json({
        ok: true,
        hasResult: !!specific,
        isOrthogonal: specific?.status === "CONVERGENT",
        dispute: specific ? {
          id: specific.id,
          posDesignId: specific.posDesignId,
          negDesignId: specific.negDesignId,
          status: specific.status,
          orthogonalityCheck: (specific.extJson as any)?.orthogonalityCheck,
        } : null,
      });
    }

    // Return all orthogonality results
    return NextResponse.json({
      ok: true,
      designId: designIdA,
      deliberationId,
      orthogonalPairs: disputes.map((d) => ({
        id: d.id,
        posDesignId: d.posDesignId,
        negDesignId: d.negDesignId,
        isOrthogonal: d.status === "CONVERGENT",
        status: d.status,
        orthogonalityCheck: (d.extJson as any)?.orthogonalityCheck,
      })),
      totalPairs: disputes.length,
    });
  } catch (error: any) {
    console.error("[DDS Orthogonality GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
