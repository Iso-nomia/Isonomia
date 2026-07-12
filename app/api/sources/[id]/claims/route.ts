export const dynamic = "force-dynamic";

/**
 * Source Claims API
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Returns claims associated with a specific source.
 * 
 * @route GET /api/sources/[id]/claims - Get claims for a source
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

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
    const { searchParams } = new URL(req.url);
    
    // Query params
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const claimType = searchParams.get("type"); // Filter by claim type
    const verified = searchParams.get("verified"); // Filter by verified status
    const sortBy = searchParams.get("sortBy") || "createdAt"; // createdAt, confidence, pageNumber
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Verify source exists
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true, title: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {
      sourceId,
    };

    if (claimType) {
      where.academicClaimType = claimType;
    }

    if (verified !== null && verified !== undefined) {
      where.humanVerified = verified === "true";
    }

    // Build orderBy
    const orderBy: Record<string, string> = {};
    if (sortBy === "confidence") {
      orderBy.aiConfidence = sortOrder;
    } else if (sortBy === "pageNumber") {
      orderBy.pageNumber = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Fetch claims
    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          text: true,
          moid: true,
          academicClaimType: true,
          pageNumber: true,
          sectionName: true,
          paragraphIndex: true,
          supportingQuote: true,
          quoteLocator: true,
          extractedByAI: true,
          aiConfidence: true,
          humanVerified: true,
          verifiedAt: true,
          createdAt: true,
          createdById: true,
          _count: {
            select: {
              arguments: true,
              edgesFrom: true,
              edgesTo: true,
            },
          },
        },
      }),
      prisma.claim.count({ where }),
    ]);

    // Get claim type distribution for this source
    const typeDistribution = await prisma.claim.groupBy({
      by: ["academicClaimType"],
      where: { sourceId },
      _count: { id: true },
    });

    return NextResponse.json({
      claims,
      source: {
        id: source.id,
        title: source.title,
      },
      stats: {
        total,
        verified: claims.filter((c) => c.humanVerified).length,
        aiExtracted: claims.filter((c) => c.extractedByAI).length,
        typeDistribution: typeDistribution.map((t) => ({
          type: t.academicClaimType,
          count: t._count.id,
        })),
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + claims.length < total,
      },
    });
  } catch (error) {
    console.error("[sources/[id]/claims] Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
