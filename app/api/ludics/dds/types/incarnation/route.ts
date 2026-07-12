export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Incarnation Checking API
 * POST /api/ludics/dds/types/incarnation
 * 
 * Checks if a design is incarnated in another design (D ⊂ E).
 * Based on Definition 6.3 from Faggian & Hyland (2002):
 * D is incarnated in E if D is less defined than E.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  checkIncarnation,
  checkLaxIncarnation,
  checkSharpIncarnation,
} from "@/packages/ludics-core/dds/types/incarnation";
import type { DesignForCorrespondence, DesignAct } from "@/packages/ludics-core/dds/correspondence/types";

/**
 * Prisma design type with acts including locus relation
 */
type PrismaDesignWithActs = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    designId: string;
    locusId: string | null;
    locus: { id: string; path: string } | null;
    polarity: string | null;
    ramification: string[];
    kind: string;
    expression: string | null;
    orderInDesign: number;
  }>;
};

/**
 * Convert Prisma design to DesignForCorrespondence format
 */
function toDesignForCorr(design: PrismaDesignWithActs): DesignForCorrespondence {
  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId || "unknown",
    acts: design.acts.map((act): DesignAct => ({
      id: act.id,
      designId: act.designId,
      kind: act.kind as "PROPER" | "DAIMON",
      polarity: (act.polarity as "P" | "O") || "P",
      expression: act.expression || undefined,
      locusId: act.locusId || undefined,
      locusPath: act.locus?.path || `${act.orderInDesign}`,
      ramification: (act.ramification || []).map((r) => {
        const num = parseInt(r, 10);
        return isNaN(num) ? r : num;
      }),
      orderInDesign: act.orderInDesign,
    })),
    loci: design.acts
      .filter((act) => act.locus)
      .map((act) => ({
        id: act.locus!.id,
        designId: design.id,
        path: act.locus!.path,
      })),
  };
}

/**
 * Fetch design with acts including locus paths
 */
async function fetchDesignWithLocus(designId: string) {
  return prisma.ludicDesign.findUnique({
    where: { id: designId },
    include: {
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: "asc" },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Support both naming conventions
    const designIdA = body.designIdA || body.sourceDesignId;
    const designIdB = body.designIdB || body.targetDesignId;
    // Support both 'mode' and 'type' for mode selection
    const mode = body.mode || body.type || "check";

    if (!designIdA || !designIdB) {
      return NextResponse.json(
        { ok: false, error: "designIdA/sourceDesignId and designIdB/targetDesignId are required" },
        { status: 400 }
      );
    }

    // Fetch designs with their loci
    const [designA, designB] = await Promise.all([
      fetchDesignWithLocus(designIdA),
      fetchDesignWithLocus(designIdB),
    ]);

    if (!designA || !designB) {
      return NextResponse.json(
        { ok: false, error: "One or both designs not found" },
        { status: 404 }
      );
    }

    // Convert to DesignForCorrespondence format
    const sourceDesign = toDesignForCorr(designA as PrismaDesignWithActs);
    const targetDesign = toDesignForCorr(designB as PrismaDesignWithActs);

    let result: any;

    if (mode === "lax") {
      // Lax incarnation check
      result = checkLaxIncarnation(sourceDesign, targetDesign);
    } else if (mode === "sharp") {
      // Sharp incarnation check
      result = checkSharpIncarnation(sourceDesign, targetDesign);
    } else {
      // Full incarnation check (both lax and sharp)
      const fullResult = checkIncarnation(sourceDesign, targetDesign);
      result = {
        isValid: fullResult.laxIncarnation,
        isIncarnated: fullResult.laxIncarnation,
        sharpIncarnation: fullResult.sharpIncarnation,
        witnesses: fullResult.witnesses,
        witnessActions: fullResult.witnesses,
      };
    }

    return NextResponse.json({
      ok: true,
      // Support both naming conventions for UI compatibility
      isIncarnated: result.isValid ?? result.isIncarnated,
      isValid: result.isValid ?? result.isIncarnated,
      incarnation: {
        sourceDesignId: designIdA,
        targetDesignId: designIdB,
        type: mode,
        isValid: result.isValid ?? result.isIncarnated,
        witnessActions: result.witnessActions || result.witnesses || [],
      },
      mode,
      type: mode,
      direction: `${designIdA} ⊂ ${designIdB}`,
      details: {
        designA: {
          id: designIdA,
          actCount: sourceDesign.acts.length,
        },
        designB: {
          id: designIdB,
          actCount: targetDesign.acts.length,
        },
      },
      incarnationDetails: result,
    });
  } catch (error: any) {
    console.error("[DDS Incarnation Check Error]", error);
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

    // Fetch the design and its deliberation context
    const design = await fetchDesignWithLocus(designId);

    if (!design) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Fetch related designs from same deliberation
    const relatedDesigns = await prisma.ludicDesign.findMany({
      where: {
        deliberationId: design.deliberationId,
        id: { not: designId },
      },
      include: { 
        acts: { 
          include: { locus: true },
          orderBy: { orderInDesign: "asc" },
        }
      },
    });

    // Convert target design to DesignForCorrespondence
    const targetDesign = toDesignForCorr(design as PrismaDesignWithActs);

    // Check incarnation relationships
    const incarnatedIn: string[] = [];
    const incarnates: string[] = [];

    for (const related of relatedDesigns) {
      const relatedDesign = toDesignForCorr(related as PrismaDesignWithActs);

      // Check if target is incarnated in related
      const forwardResult = checkIncarnation(targetDesign, relatedDesign);
      if (forwardResult.laxIncarnation) {
        incarnatedIn.push(related.id);
      }

      // Check if related is incarnated in target
      const reverseResult = checkIncarnation(relatedDesign, targetDesign);
      if (reverseResult.laxIncarnation) {
        incarnates.push(related.id);
      }
    }

    return NextResponse.json({
      ok: true,
      designId,
      incarnationRelationships: {
        incarnatedIn, // Designs that this design is incarnated in (D ⊂ E)
        incarnates,   // Designs incarnated in this design (E ⊂ D)
      },
      summary: {
        incarnatedInCount: incarnatedIn.length,
        incarnatesCount: incarnates.length,
        totalRelated: relatedDesigns.length,
      },
    });
  } catch (error: any) {
    console.error("[DDS Incarnation GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
