export const dynamic = "force-dynamic";

// app/api/citations/list/route.ts
// Phase 2.4: Evidence List API with filtering, sorting, pagination

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");

  if (!targetType || !targetId) {
    return NextResponse.json(
      { error: "targetType and targetId required" },
      { status: 400 }
    );
  }

  // Parse filters
  const intentParam = searchParams.get("intent");
  const intents = intentParam ? intentParam.split(",").filter(Boolean) : undefined;

  const sourceKindParam = searchParams.get("sourceKind");
  const sourceKinds = sourceKindParam ? sourceKindParam.split(",").filter(Boolean) : undefined;

  const minRelevance = searchParams.get("minRelevance")
    ? parseInt(searchParams.get("minRelevance")!, 10)
    : undefined;

  const search = searchParams.get("search") || undefined;

  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  try {
    // Build where clause
    const where: any = {
      targetType,
      targetId,
    };

    if (intents && intents.length > 0) {
      where.intent = { in: intents };
    }

    if (minRelevance) {
      where.relevance = { gte: minRelevance };
    }

    if (search) {
      where.OR = [
        { quote: { contains: search, mode: "insensitive" } },
        { note: { contains: search, mode: "insensitive" } },
        { locator: { contains: search, mode: "insensitive" } },
        { source: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (sourceKinds && sourceKinds.length > 0) {
      where.source = {
        ...((where.source as object) || {}),
        kind: { in: sourceKinds },
      };
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case "relevance":
        orderBy = { relevance: sortOrder };
        break;
      case "source":
        orderBy = { source: { title: sortOrder } };
        break;
      case "intent":
        orderBy = { intent: sortOrder };
        break;
      case "createdAt":
      default:
        orderBy = { createdAt: sortOrder };
    }

    // Execute query
    const [citations, total] = await Promise.all([
      prisma.citation.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          source: {
            select: {
              id: true,
              kind: true,
              title: true,
              authorsJson: true,
              year: true,
              url: true,
              doi: true,
              libraryPostId: true,
            },
          },
          annotation: {
            select: {
              id: true,
              page: true,
              rect: true,
              text: true,
            },
          },
        },
      }),
      prisma.citation.count({ where }),
    ]);

    // Compute facets for filter UI (unfiltered by intent to show all options)
    const facetResults = await prisma.citation.groupBy({
      by: ["intent"],
      where: { targetType, targetId },
      _count: { id: true },
    });

    const intentFacets: Record<string, number> = {};
    for (const f of facetResults) {
      const key = f.intent ?? "unclassified";
      intentFacets[key] = f._count.id;
    }

    // Format citations with source data
    const formattedCitations = citations.map((c: any) => ({
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      sourceId: c.sourceId,
      locator: c.locator,
      quote: c.quote,
      note: c.note,
      relevance: c.relevance,
      createdAt: c.createdAt,
      createdById: c.createdById,
      // Phase 2.1 anchor fields
      anchorType: c.anchorType,
      anchorId: c.anchorId,
      anchorData: c.anchorData,
      // Phase 2.3 intent
      intent: c.intent,
      // Source for CitationWithSource compatibility
      source: c.source,
      annotation: c.annotation,
    }));

    return NextResponse.json({
      citations: formattedCitations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets: {
        intent: intentFacets,
      },
    });
  } catch (error: any) {
    console.error("Error fetching citations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch citations" },
      { status: 500 }
    );
  }
}
