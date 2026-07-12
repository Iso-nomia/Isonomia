// app/api/deliberations/[id]/sources/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/deliberations/[id]/sources
 * 
 * Returns all sources (citations/evidence) used in a deliberation with usage metrics.
 * Aggregates citations from arguments and claims with usage counts and quality ratings.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = decodeURIComponent(params.id);

  if (!deliberationId) {
    return NextResponse.json(
      { error: "Missing deliberationId" },
      { status: 400 }
    );
  }

  try {
    // Fetch all citations used in this deliberation
    // Using the unified Citation model which links to Source
    const citations = await prisma.citation.findMany({
      where: {
        OR: [
          // Citations on arguments in this deliberation
          {
            targetType: "argument",
            targetId: {
              in: (
                await prisma.argument.findMany({
                  where: { deliberationId },
                  select: { id: true },
                })
              ).map((a) => a.id),
            },
          },
          // Citations on claims in this deliberation
          {
            targetType: "claim",
            targetId: {
              in: (
                await prisma.claim.findMany({
                  where: { deliberationId },
                  select: { id: true },
                })
              ).map((c) => c.id),
            },
          },
        ],
      },
      include: {
        source: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group by source to get usage metrics
    const sourceMap = new Map<
      string,
      {
        source: any;
        usageCount: number;
        citationIds: string[];
        usedInArguments: number;
        usedInClaims: number;
        firstUsed: Date;
        lastUsed: Date;
        users: Set<string>;
      }
    >();

    citations.forEach((citation) => {
      const sourceId = citation.sourceId;

      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, {
          source: citation.source,
          usageCount: 0,
          citationIds: [],
          usedInArguments: 0,
          usedInClaims: 0,
          firstUsed: citation.createdAt,
          lastUsed: citation.createdAt,
          users: new Set(),
        });
      }

      const entry = sourceMap.get(sourceId)!;
      entry.usageCount++;
      entry.citationIds.push(citation.id);

      if (citation.targetType === "argument") {
        entry.usedInArguments++;
      } else if (citation.targetType === "claim") {
        entry.usedInClaims++;
      }

      if (citation.createdAt < entry.firstUsed) {
        entry.firstUsed = citation.createdAt;
      }
      if (citation.createdAt > entry.lastUsed) {
        entry.lastUsed = citation.createdAt;
      }

      if (citation.createdById) {
        entry.users.add(citation.createdById);
      }
    });

    // Fetch ratings for all sources
    const sourceIds = Array.from(sourceMap.keys());
    const ratings = await prisma.sourceRating.findMany({
      where: {
        sourceId: { in: sourceIds },
      },
      select: {
        sourceId: true,
        rating: true,
      },
    });

    // Calculate average ratings per source
    const ratingsBySource = new Map<string, { total: number; count: number }>();
    ratings.forEach((r) => {
      if (!ratingsBySource.has(r.sourceId)) {
        ratingsBySource.set(r.sourceId, { total: 0, count: 0 });
      }
      const stats = ratingsBySource.get(r.sourceId)!;
      stats.total += r.rating;
      stats.count++;
    });

    // Convert to array and format response
    const sources = Array.from(sourceMap.entries()).map(([sourceId, data]) => {
      const ratingStats = ratingsBySource.get(sourceId);
      const averageRating = ratingStats
        ? Math.round((ratingStats.total / ratingStats.count) * 10) / 10
        : null;
      const ratingCount = ratingStats ? ratingStats.count : 0;

      return {
        sourceId,
        title: data.source.title || "Untitled Source",
        url: data.source.url,
        type: data.source.type || "unknown",
        authorsJson: data.source.authorsJson,
        year: data.source.year,
        publicationTitle: data.source.publicationTitle,
        doi: data.source.doi,
        // Usage metrics
        usageCount: data.usageCount,
        usedInArguments: data.usedInArguments,
        usedInClaims: data.usedInClaims,
        uniqueUsers: data.users.size,
        firstUsed: data.firstUsed.toISOString(),
        lastUsed: data.lastUsed.toISOString(),
        // Quality ratings
        averageRating,
        ratingCount,
        // Phase 3.1: Trust fields
        verificationStatus: data.source.verificationStatus || "unverified",
        lastCheckedAt: data.source.lastCheckedAt?.toISOString() || null,
        canonicalUrl: data.source.canonicalUrl || null,
        archiveStatus: data.source.archiveStatus || "none",
        archiveUrl: data.source.archiveUrl || null,
        archivedAt: data.source.archivedAt?.toISOString() || null,
      };
    });

    // Sort by usage count (most used first)
    sources.sort((a, b) => b.usageCount - a.usageCount);

    return NextResponse.json(
      {
        ok: true,
        sources,
        totalSources: sources.length,
        totalCitations: citations.length,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Error fetching deliberation sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}
