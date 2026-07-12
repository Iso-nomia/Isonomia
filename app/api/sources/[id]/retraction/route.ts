export const dynamic = "force-dynamic";

// app/api/sources/[id]/retraction/route.ts
// Phase 3.1: Retraction Check API
// Check a source for retraction/correction status

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { checkSourceRetraction } from "@/lib/sources/retractionCheck";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sources/[id]/retraction
 * Get current retraction status
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const source = await prisma.source.findUnique({
      where: { id },
      select: {
        id: true,
        doi: true,
        retractionStatus: true,
        retractionCheckedAt: true,
        retractionNoticeUrl: true,
        retractionReason: true,
        retractionDate: true,
        correctionStatus: true,
        correctionUrl: true,
        correctionDate: true,
        correctionSummary: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      source: {
        id: source.id,
        doi: source.doi,
        retraction: {
          status: source.retractionStatus,
          checkedAt: source.retractionCheckedAt,
          noticeUrl: source.retractionNoticeUrl,
          reason: source.retractionReason,
          date: source.retractionDate,
        },
        correction: {
          status: source.correctionStatus,
          url: source.correctionUrl,
          date: source.correctionDate,
          summary: source.correctionSummary,
        },
      },
    });
  } catch (error) {
    console.error("[sources/retraction] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get retraction status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources/[id]/retraction
 * Check for retraction (requires DOI)
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // First check if source exists and has a DOI
    const source = await prisma.source.findUnique({
      where: { id },
      select: { id: true, doi: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    if (!source.doi) {
      return NextResponse.json(
        { error: "Source has no DOI - retraction check requires a DOI" },
        { status: 400 }
      );
    }

    // Perform retraction check
    const result = await checkSourceRetraction(id);

    if (!result) {
      return NextResponse.json(
        { error: "Retraction check failed" },
        { status: 500 }
      );
    }

    // Fetch updated source
    const updatedSource = await prisma.source.findUnique({
      where: { id },
      select: {
        id: true,
        doi: true,
        retractionStatus: true,
        retractionCheckedAt: true,
        retractionNoticeUrl: true,
        retractionReason: true,
        retractionDate: true,
        correctionStatus: true,
        correctionUrl: true,
        correctionDate: true,
        correctionSummary: true,
      },
    });

    return NextResponse.json({
      checked: true,
      result: {
        isRetracted: result.retraction.isRetracted,
        retractionStatus: result.retraction.status,
        hasCorrectionUrl: result.correction.hasCorrectionUrl,
        correctionStatus: result.correction.status,
      },
      source: updatedSource,
    });
  } catch (error) {
    console.error("[sources/retraction] POST error:", error);
    return NextResponse.json(
      { error: "Failed to check retraction status" },
      { status: 500 }
    );
  }
}
