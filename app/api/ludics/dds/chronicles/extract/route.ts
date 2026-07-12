export const dynamic = "force-dynamic";

/**
 * DDS Chronicle Extraction API
 * POST /api/ludics/dds/chronicles/extract
 * 
 * Extracts chronicles (branches) from a dispute.
 * Based on Faggian & Hyland (2002) - Proposition 3.6
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  extractChronicles,
  extractAllChronicles,
  disputeToPosition,
  type Dispute,
  type ChronicleExtractionOptions,
} from "@/packages/ludics-core/dds";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { disputeId, traceId, player, options } = body as {
      disputeId?: string;
      traceId?: string;
      player?: "P" | "O" | "both";
      options?: ChronicleExtractionOptions;
    };

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

    // Extract chronicles based on player
    let result: any;

    if (player === "both" || !player) {
      const position = disputeToPosition(dispute);
      const allChronicles = extractAllChronicles(position, options || {});
      result = {
        proponent: allChronicles.proponent,
        opponent: allChronicles.opponent,
        totalCount:
          allChronicles.proponent.length + allChronicles.opponent.length,
      };
    } else {
      const chronicles = extractChronicles(dispute, player, options || {});
      result = {
        [player === "P" ? "proponent" : "opponent"]: chronicles,
        totalCount: chronicles.length,
      };
    }

    // Store chronicles in the database (using existing LudicChronicle model)
    // The existing model links to design and acts
    let savedCount = 0;

    // For now, we return the extracted data without persisting
    // Full persistence can be added when integrating with UI

    return NextResponse.json({
      ok: true,
      ...result,
      disputeId: dispute.id,
      savedCount,
    });
  } catch (error: any) {
    console.error("Chronicle extraction error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/chronicles/extract
 * Get chronicle metadata for a design
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    const disputeId = url.searchParams.get("disputeId");

    if (!designId && !disputeId) {
      return NextResponse.json(
        { ok: false, error: "Either designId or disputeId is required" },
        { status: 400 }
      );
    }

    // Fetch existing chronicles from the design
    if (designId) {
      const chronicles = await prisma.ludicChronicle.findMany({
        where: { designId },
        include: { act: true },
        orderBy: { order: "asc" },
      });

      return NextResponse.json({
        ok: true,
        chronicles,
        count: chronicles.length,
      });
    }

    // If disputeId, extract fresh
    if (disputeId) {
      const dbDispute = await prisma.ludicDispute.findUnique({
        where: { id: disputeId },
      });

      if (!dbDispute) {
        return NextResponse.json(
          { ok: false, error: "Dispute not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Use POST to extract chronicles from dispute",
        disputeId,
      });
    }

    return NextResponse.json({ ok: true, chronicles: [], count: 0 });
  } catch (error: any) {
    console.error("Chronicle fetch error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
