export const dynamic = "force-dynamic";

/**
 * Disp(D) API Endpoint
 * 
 * Compute all disputes of design D with orthogonal counter-designs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { computeDisp } from "@/packages/ludics-core/dds/correspondence";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence";

/**
 * Helper to convert Prisma design to DesignForCorrespondence format
 */
function toDesignForCorr(design: {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    designId: string;
    locus?: { path: string } | null;
    polarity: string | null;
    ramification: string[];
    kind: string;
    expression: string | null;
    orderInDesign: number;
  }>;
}): DesignForCorrespondence {
  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId,
    acts: design.acts.map((act) => ({
      id: act.id,
      designId: act.designId,
      locusPath: act.locus?.path ?? "",
      polarity: (act.polarity ?? "P") as "P" | "O",
      ramification: (act.ramification as (string | number)[]) || [],
      kind: act.kind as "PROPER" | "DAIMON",
      expression: act.expression || undefined,
      orderInDesign: act.orderInDesign,
    })),
  };
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

    // Fetch design
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

    // Fetch counter-designs (designs with opposite polarity at same loci)
    const designLoci = design.acts.map((a) => a.locus?.path ?? "");
    const counterDesigns = await prisma.ludicDesign.findMany({
      where: {
        deliberationId: design.deliberationId,
        id: { not: designId },
        participantId: { not: design.participantId },
      },
      include: { acts: { include: { locus: true } } },
    });

    const designForCorr = toDesignForCorr(design);
    const counterDesignsForCorr = counterDesigns.map(toDesignForCorr);

    // Compute Disp(D)
    const result = computeDisp(designForCorr, counterDesignsForCorr);

    return NextResponse.json({
      ok: true,
      designId: result.designId,
      disputes: result.disputes,
      count: result.count,
      counterDesignCount: counterDesigns.length,
      computedAt: result.computedAt,
    });
  } catch (error: any) {
    console.error("Error computing Disp(D) GET:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to compute disputes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { design, counterDesigns } = body as {
      design: DesignForCorrespondence;
      counterDesigns: DesignForCorrespondence[];
    };

    if (!design) {
      return NextResponse.json(
        { ok: false, error: "design is required" },
        { status: 400 }
      );
    }

    if (!counterDesigns || !Array.isArray(counterDesigns)) {
      return NextResponse.json(
        { ok: false, error: "counterDesigns array is required" },
        { status: 400 }
      );
    }

    // Compute Disp(D)
    const result = computeDisp(design, counterDesigns);

    return NextResponse.json({
      ok: true,
      designId: result.designId,
      disputes: result.disputes,
      count: result.count,
      computedAt: result.computedAt,
    });
  } catch (error: any) {
    console.error("Error computing Disp(D):", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to compute disputes" },
      { status: 500 }
    );
  }
}
