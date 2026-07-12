export const dynamic = "force-dynamic";

/**
 * DDS View Extraction API
 * POST /api/ludics/dds/views/extract
 * 
 * Extracts views from a dispute for a given player.
 * Based on Faggian & Hyland (2002) - Definition 3.5
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  extractView,
  extractProponentView,
  extractOpponentView,
  disputeToPosition,
  type Action,
  type Position,
  type Dispute,
} from "@/packages/ludics-core/dds";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { disputeId, player, traceId, designId } = body as {
      disputeId?: string;
      player?: "P" | "O";
      traceId?: string;
      designId?: string;
    };

    // Validate player
    if (!player || (player !== "P" && player !== "O")) {
      return NextResponse.json(
        { ok: false, error: "player must be 'P' or 'O'" },
        { status: 400 }
      );
    }

    let dispute: Dispute | null = null;

    // Option 1: Load from existing LudicDispute
    if (disputeId) {
      const dbDispute = await prisma.ludicDispute.findUnique({
        where: { id: disputeId },
        include: {
          posDesign: { include: { acts: true } },
          negDesign: { include: { acts: true } },
        },
      });

      if (!dbDispute) {
        return NextResponse.json(
          { ok: false, error: "Dispute not found" },
          { status: 404 }
        );
      }

      dispute = {
        id: dbDispute.id,
        dialogueId: dbDispute.deliberationId,
        posDesignId: dbDispute.posDesignId,
        negDesignId: dbDispute.negDesignId,
        pairs: (dbDispute.actionPairs as any[]) || [],
        status: dbDispute.status as any,
        length: dbDispute.length,
        isLegal: dbDispute.isLegal ?? undefined,
      };
    }

    // Option 2: Load from LudicTrace
    if (traceId && !dispute) {
      const trace = await prisma.ludicTrace.findUnique({
        where: { id: traceId },
        include: {
          posDesign: { include: { acts: true } },
          negDesign: { include: { acts: true } },
        },
      });

      if (!trace) {
        return NextResponse.json(
          { ok: false, error: "Trace not found" },
          { status: 404 }
        );
      }

      // Convert trace steps to dispute format
      const steps = (trace.steps as any[]) || [];
      dispute = {
        id: trace.id,
        dialogueId: trace.deliberationId,
        posDesignId: trace.posDesignId,
        negDesignId: trace.negDesignId,
        pairs: steps.map((step, idx) => ({
          posActId: step.posActId || `pos-${idx}`,
          negActId: step.negActId || `neg-${idx}`,
          locusPath: step.locusPath || step.locus || "0",
          ts: step.ts || idx,
        })),
        status: trace.status as any,
        length: steps.length,
      };
    }

    if (!dispute) {
      return NextResponse.json(
        { ok: false, error: "Either disputeId or traceId is required" },
        { status: 400 }
      );
    }

    // Convert dispute to position and extract view
    const position = disputeToPosition(dispute);
    const viewSequence =
      player === "P"
        ? extractProponentView(position)
        : extractOpponentView(position);

    // Determine design ID for storage
    const targetDesignId =
      designId ||
      (player === "P" ? dispute.posDesignId : dispute.negDesignId);

    // Store view in database
    const savedView = await prisma.ludicView.create({
      data: {
        designId: targetDesignId,
        player,
        viewSequence: viewSequence as any,
        parentDisputeId: disputeId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      view: savedView,
      sequence: viewSequence,
      length: viewSequence.length,
    });
  } catch (error: any) {
    console.error("View extraction error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/views/extract
 * Fetch existing views for a design or dispute
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    const disputeId = url.searchParams.get("disputeId");
    const player = url.searchParams.get("player") as "P" | "O" | null;

    const where: any = {};
    if (designId) where.designId = designId;
    if (disputeId) where.parentDisputeId = disputeId;
    if (player) where.player = player;

    if (!designId && !disputeId) {
      return NextResponse.json(
        { ok: false, error: "Either designId or disputeId is required" },
        { status: 400 }
      );
    }

    const views = await prisma.ludicView.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      views,
      count: views.length,
    });
  } catch (error: any) {
    console.error("View fetch error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
