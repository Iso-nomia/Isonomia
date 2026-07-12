export const dynamic = "force-dynamic";

/**
 * DDS Disputes API
 * POST /api/ludics/dds/disputes - Create a dispute from designs
 * GET /api/ludics/dds/disputes - List disputes for a deliberation
 * 
 * Disputes are first-class representations of design interactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  validateLegality,
  disputeToPosition,
  type Dispute,
} from "@/packages/ludics-core/dds";

/**
 * POST /api/ludics/dds/disputes
 * Create a dispute from existing designs or trace
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { posDesignId, negDesignId, traceId, deliberationId } = body as {
      posDesignId?: string;
      negDesignId?: string;
      traceId?: string;
      deliberationId?: string;
    };

    // Option 1: Create from trace
    if (traceId) {
      const trace = await prisma.ludicTrace.findUnique({
        where: { id: traceId },
        include: {
          posDesign: true,
          negDesign: true,
        },
      });

      if (!trace) {
        return NextResponse.json(
          { ok: false, error: "Trace not found" },
          { status: 404 }
        );
      }

      // Convert trace to dispute
      const steps = (trace.steps as any[]) || [];
      const actionPairs = steps.map((step, idx) => ({
        posActId: step.posActId || `pos-${idx}`,
        negActId: step.negActId || `neg-${idx}`,
        locusPath: step.locusPath || step.locus || "0",
        ts: step.ts || idx,
      }));

      // Create dispute record
      const dispute = await prisma.ludicDispute.create({
        data: {
          deliberationId: trace.deliberationId,
          posDesignId: trace.posDesignId,
          negDesignId: trace.negDesignId,
          actionPairs: actionPairs as any,
          status: trace.status as any,
          length: steps.length,
        },
        include: {
          posDesign: true,
          negDesign: true,
        },
      });

      // Validate legality
      const position = disputeToPosition({
        id: dispute.id,
        dialogueId: dispute.deliberationId,
        posDesignId: dispute.posDesignId,
        negDesignId: dispute.negDesignId,
        pairs: actionPairs,
        status: dispute.status as any,
        length: dispute.length,
      });

      const legalityCheck = validateLegality(position);
      const isLegal =
        legalityCheck.isLinear &&
        legalityCheck.isParity &&
        legalityCheck.isJustified &&
        legalityCheck.isVisible;

      // Update with legality check
      await prisma.ludicDispute.update({
        where: { id: dispute.id },
        data: {
          isLegal,
          legalityLog: legalityCheck as any,
        },
      });

      return NextResponse.json({
        ok: true,
        dispute: {
          ...dispute,
          isLegal,
          legalityCheck,
        },
      });
    }

    // Option 2: Create from design pair
    if (posDesignId && negDesignId) {
      // Verify designs exist
      const [posDesign, negDesign] = await Promise.all([
        prisma.ludicDesign.findUnique({ where: { id: posDesignId } }),
        prisma.ludicDesign.findUnique({ where: { id: negDesignId } }),
      ]);

      if (!posDesign || !negDesign) {
        return NextResponse.json(
          { ok: false, error: "One or both designs not found" },
          { status: 404 }
        );
      }

      // Determine deliberationId
      const delibId =
        deliberationId || posDesign.deliberationId || negDesign.deliberationId;

      // Create empty dispute (will be populated via step API)
      const dispute = await prisma.ludicDispute.create({
        data: {
          deliberationId: delibId,
          posDesignId,
          negDesignId,
          actionPairs: [],
          status: "ONGOING",
          length: 0,
        },
        include: {
          posDesign: true,
          negDesign: true,
        },
      });

      return NextResponse.json({
        ok: true,
        dispute,
        message: "Empty dispute created. Use step API to populate interaction.",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Either traceId or (posDesignId + negDesignId) is required",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Dispute creation error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/disputes
 * List disputes for a deliberation
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get("deliberationId");
    const designId = url.searchParams.get("designId");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const where: any = {};

    if (deliberationId) {
      where.deliberationId = deliberationId;
    }

    if (designId) {
      where.OR = [{ posDesignId: designId }, { negDesignId: designId }];
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (!deliberationId && !designId) {
      return NextResponse.json(
        { ok: false, error: "Either deliberationId or designId is required" },
        { status: 400 }
      );
    }

    const disputes = await prisma.ludicDispute.findMany({
      where,
      include: {
        posDesign: {
          select: { id: true, participantId: true, scope: true },
        },
        negDesign: {
          select: { id: true, participantId: true, scope: true },
        },
        _count: {
          select: { views: true, positions: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      disputes,
      count: disputes.length,
    });
  } catch (error: any) {
    console.error("Dispute fetch error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
