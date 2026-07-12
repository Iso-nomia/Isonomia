export const dynamic = "force-dynamic";

/**
 * DDS Step Endpoint
 * POST /api/ludics/dds/step
 * 
 * Computes dispute between two designs using Faggian-Hyland (2002) DDS semantics.
 * This uses depth-based polarity assignment (tree-traversal model).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  computeDispute,
  disputesToPlays,
} from "@/packages/ludics-core/dds/correspondence/disp";
import type { DesignForCorrespondence, DesignAct } from "@/packages/ludics-core/dds/correspondence";

/**
 * Map Prisma acts to DesignAct format expected by computeDispute
 */
function mapActsForDispute(
  acts: any[],
  lociMap: Map<string, string>
): DesignAct[] {
  return acts.map((a: any) => ({
    id: a.id,
    designId: a.designId,
    kind: (a.kind === "PROPER" ? "INITIAL" : a.kind) as any,
    polarity: a.polarity as "P" | "O",
    expression: a.expression || undefined,
    locusId: a.locusId || undefined,
    locusPath: a.locusId ? lociMap.get(a.locusId) || "0" : "0",
    ramification: (a.subLoci as string[]) || [],
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deliberationId,
      posDesignId,
      negDesignId,
      player = "P",
    } = body as {
      deliberationId: string;
      posDesignId: string;
      negDesignId: string;
      player?: "P" | "O";
    };

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Load designs
    let posDesign: any;
    let negDesign: any;

    if (posDesignId && negDesignId) {
      [posDesign, negDesign] = await Promise.all([
        prisma.ludicDesign.findUnique({
          where: { id: posDesignId },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
        prisma.ludicDesign.findUnique({
          where: { id: negDesignId },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
      ]);
    } else {
      // Auto-find Proponent/Opponent designs
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId },
        include: { acts: { orderBy: { orderInDesign: "asc" } } },
        orderBy: { id: "asc" },
      });

      posDesign = designs.find((d) => d.participantId === "Proponent");
      negDesign = designs.find((d) => d.participantId === "Opponent");
    }

    if (!posDesign || !negDesign) {
      return NextResponse.json(
        { ok: false, error: "Could not find P/O design pair" },
        { status: 404 }
      );
    }

    // Load loci
    const loci = await prisma.ludicLocus.findMany({
      where: { dialogueId: deliberationId },
    });
    const lociMap = new Map(loci.map((l) => [l.id, l.path]));

    // Build designs for correspondence
    const posForCorr: DesignForCorrespondence = {
      id: posDesign.id,
      deliberationId: posDesign.deliberationId,
      participantId: posDesign.participantId || "Proponent",
      acts: mapActsForDispute(posDesign.acts, lociMap),
      loci: loci
        .filter((l) => posDesign.acts.some((a: any) => a.locusId === l.id))
        .map((l) => ({
          id: l.id,
          designId: posDesign.id,
          path: l.path,
        })),
    };

    const negForCorr: DesignForCorrespondence = {
      id: negDesign.id,
      deliberationId: negDesign.deliberationId,
      participantId: negDesign.participantId || "Opponent",
      acts: mapActsForDispute(negDesign.acts, lociMap),
      loci: loci
        .filter((l) => negDesign.acts.some((a: any) => a.locusId === l.id))
        .map((l) => ({
          id: l.id,
          designId: negDesign.id,
          path: l.path,
        })),
    };

    // Compute dispute using DDS semantics
    const dispute = computeDispute(posForCorr, negForCorr);

    if (!dispute) {
      return NextResponse.json({
        ok: true,
        status: "DIVERGENT",
        pairs: [],
        reason: "no-interaction",
        posDesignId: posDesign.id,
        negDesignId: negDesign.id,
      });
    }

    // Convert to plays for UI compatibility
    const plays = disputesToPlays([dispute], player);

    // Format pairs for UI (matching old stepper format)
    const pairs = dispute.pairs.map((p, idx) => ({
      posActId: p.posActId || "",
      negActId: p.negActId || "",
      locusPath: p.locusPath,
      ts: idx,
    }));

    return NextResponse.json({
      ok: true,
      status: dispute.status,
      pairs,
      plays: plays.map((p) => ({
        sequence: p.sequence,
        length: p.length,
      })),
      posDesignId: posDesign.id,
      negDesignId: negDesign.id,
      disputeLength: dispute.length,
    });
  } catch (error: any) {
    console.error("[DDS Step Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to compute dispute" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/step
 * Get dispute using query params
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get("deliberationId");
    const posDesignId = url.searchParams.get("posDesignId");
    const negDesignId = url.searchParams.get("negDesignId");
    const player = (url.searchParams.get("player") || "P") as "P" | "O";

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId query param required" },
        { status: 400 }
      );
    }

    // Load designs
    let posDesign: any;
    let negDesign: any;

    if (posDesignId && negDesignId) {
      [posDesign, negDesign] = await Promise.all([
        prisma.ludicDesign.findUnique({
          where: { id: posDesignId },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
        prisma.ludicDesign.findUnique({
          where: { id: negDesignId },
          include: { acts: { orderBy: { orderInDesign: "asc" } } },
        }),
      ]);
    } else {
      // Auto-find Proponent/Opponent designs
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId },
        include: { acts: { orderBy: { orderInDesign: "asc" } } },
        orderBy: { id: "asc" },
      });

      posDesign = designs.find((d) => d.participantId === "Proponent");
      negDesign = designs.find((d) => d.participantId === "Opponent");
    }

    if (!posDesign || !negDesign) {
      return NextResponse.json(
        { ok: false, error: "Could not find P/O design pair" },
        { status: 404 }
      );
    }

    // Load loci
    const loci = await prisma.ludicLocus.findMany({
      where: { dialogueId: deliberationId },
    });
    const lociMap = new Map(loci.map((l) => [l.id, l.path]));

    // Build designs for correspondence
    const posForCorr: DesignForCorrespondence = {
      id: posDesign.id,
      deliberationId: posDesign.deliberationId,
      participantId: posDesign.participantId || "Proponent",
      acts: mapActsForDispute(posDesign.acts, lociMap),
      loci: loci
        .filter((l) => posDesign.acts.some((a: any) => a.locusId === l.id))
        .map((l) => ({
          id: l.id,
          designId: posDesign.id,
          path: l.path,
        })),
    };

    const negForCorr: DesignForCorrespondence = {
      id: negDesign.id,
      deliberationId: negDesign.deliberationId,
      participantId: negDesign.participantId || "Opponent",
      acts: mapActsForDispute(negDesign.acts, lociMap),
      loci: loci
        .filter((l) => negDesign.acts.some((a: any) => a.locusId === l.id))
        .map((l) => ({
          id: l.id,
          designId: negDesign.id,
          path: l.path,
        })),
    };

    // Compute dispute using DDS semantics
    const dispute = computeDispute(posForCorr, negForCorr);

    if (!dispute) {
      return NextResponse.json({
        ok: true,
        status: "DIVERGENT",
        pairs: [],
        reason: "no-interaction",
        posDesignId: posDesign.id,
        negDesignId: negDesign.id,
      });
    }

    // Convert to plays for UI compatibility
    const plays = disputesToPlays([dispute], player);

    // Format pairs for UI (matching old stepper format)
    const pairs = dispute.pairs.map((p, idx) => ({
      posActId: p.posActId || "",
      negActId: p.negActId || "",
      locusPath: p.locusPath,
      ts: idx,
    }));

    return NextResponse.json({
      ok: true,
      status: dispute.status,
      pairs,
      plays: plays.map((p) => ({
        sequence: p.sequence,
        length: p.length,
      })),
      posDesignId: posDesign.id,
      negDesignId: negDesign.id,
      disputeLength: dispute.length,
    });
  } catch (error: any) {
    console.error("[DDS Step GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to compute dispute" },
      { status: 500 }
    );
  }
}
