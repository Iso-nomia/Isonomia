export const dynamic = "force-dynamic";

/**
 * Source Detail API
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Returns full source details including claims summary.
 * 
 * @route GET /api/sources/[id] - Get source details
 * @route PATCH /api/sources/[id] - Update source
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { enrichFromOpenAlex } from "@/lib/integrations/openAlex";
import { z } from "zod";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// ─────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: sourceId } = await params;

    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        claims: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            text: true,
            academicClaimType: true,
            humanVerified: true,
            aiConfidence: true,
            pageNumber: true,
            sectionName: true,
          },
        },
        _count: {
          select: {
            claims: true,
            citations: true,
            ratings: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Get claim statistics
    const claimStats = await prisma.claim.groupBy({
      by: ["academicClaimType"],
      where: { sourceId },
      _count: { id: true },
    });

    const verifiedCount = await prisma.claim.count({
      where: { sourceId, humanVerified: true },
    });

    return NextResponse.json({
      source,
      stats: {
        claimCount: source._count.claims,
        citationCount: source._count.citations,
        verifiedClaimCount: verifiedCount,
        claimTypeDistribution: claimStats.map((s) => ({
          type: s.academicClaimType,
          count: s._count.id,
        })),
      },
    });
  } catch (error) {
    console.error("[sources/[id]] Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// PATCH Handler - Update Source
// ─────────────────────────────────────────────────────────

const UpdateSourceSchema = z.object({
  title: z.string().optional(),
  abstractText: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  // Trigger re-enrichment
  reEnrich: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: sourceId } = await params;
    const body = await req.json();
    const input = UpdateSourceSchema.parse(body);

    // Verify source exists
    const existing = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true, doi: true, createdById: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Only allow creator to update (or add permission check)
    if (existing.createdById !== userId.toString()) {
      return NextResponse.json(
        { error: "Not authorized to update this source" },
        { status: 403 }
      );
    }

    let updateData: Record<string, unknown> = {};

    if (input.title) updateData.title = input.title;
    if (input.abstractText) updateData.abstractText = input.abstractText;
    if (input.keywords) updateData.keywords = input.keywords;

    // Re-enrich from OpenAlex if requested
    if (input.reEnrich && existing.doi) {
      const enrichment = await enrichFromOpenAlex(existing.doi);
      if (enrichment) {
        updateData = {
          ...updateData,
          openAlexId: enrichment.openAlexId,
          abstractText: enrichment.abstract || updateData.abstractText,
          keywords: enrichment.concepts.length > 0 
            ? enrichment.concepts 
            : updateData.keywords,
          pdfUrl: enrichment.pdfUrl,
          enrichmentStatus: "enriched",
          enrichedAt: new Date(),
          enrichmentSource: "openalex",
        };
      }
    }

    const source = await prisma.source.update({
      where: { id: sourceId },
      data: updateData,
      include: {
        _count: {
          select: { claims: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      source,
      message: input.reEnrich ? "Source re-enriched" : "Source updated",
    });
  } catch (error) {
    console.error("[sources/[id]] Update error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
