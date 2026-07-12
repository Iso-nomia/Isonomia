export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/evidence/route.ts
// Phase 2.4: Deliberation-level evidence browsing with filtering

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: deliberationId } = await params;
  const { searchParams } = new URL(req.url);

  // Parse filters
  const intentParam = searchParams.get("intent");
  const intents = intentParam ? intentParam.split(",").filter(Boolean) : undefined;

  const sourceKindParam = searchParams.get("sourceKind");
  const sourceKinds = sourceKindParam ? sourceKindParam.split(",").filter(Boolean) : undefined;

  const minRelevance = searchParams.get("minRelevance")
    ? parseInt(searchParams.get("minRelevance")!, 10)
    : undefined;

  const search = searchParams.get("search") || undefined;
  const targetType = searchParams.get("targetType") || undefined; // Filter by claim/argument

  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  try {
    // Get all claims and arguments in this deliberation
    const [claims, args] = await Promise.all([
      prisma.claim.findMany({
        where: { deliberationId },
        select: { id: true },
      }),
      prisma.argument.findMany({
        where: { deliberationId },
        select: { id: true },
      }),
    ]);

    const claimIds = claims.map((c) => c.id);
    const argIds = args.map((a) => a.id);

    // Build where clause for citations in this deliberation
    const targetConditions: any[] = [];
    
    if (!targetType || targetType === "claim") {
      if (claimIds.length > 0) {
        targetConditions.push({
          targetType: "claim",
          targetId: { in: claimIds },
        });
      }
    }
    if (!targetType || targetType === "argument") {
      if (argIds.length > 0) {
        targetConditions.push({
          targetType: "argument",
          targetId: { in: argIds },
        });
      }
    }

    if (targetConditions.length === 0) {
      return NextResponse.json({
        citations: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        facets: { intent: {}, targetType: {} },
      });
    }

    const where: any = {
      OR: targetConditions,
    };

    if (intents && intents.length > 0) {
      where.intent = { in: intents };
    }

    if (minRelevance) {
      where.relevance = { gte: minRelevance };
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { quote: { contains: search, mode: "insensitive" } },
            { note: { contains: search, mode: "insensitive" } },
            { locator: { contains: search, mode: "insensitive" } },
          ],
        },
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
          annotation: true,
        },
      }),
      prisma.citation.count({ where }),
    ]);

    // Compute facets
    const [intentFacets, typeFacets] = await Promise.all([
      prisma.citation.groupBy({
        by: ["intent"],
        where: { OR: targetConditions },
        _count: { id: true },
      }),
      prisma.citation.groupBy({
        by: ["targetType"],
        where: { OR: targetConditions },
        _count: { id: true },
      }),
    ]);

    const intentCounts = intentFacets.reduce((acc, f) => {
      if (f.intent) acc[f.intent] = f._count.id;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = typeFacets.reduce((acc, f) => {
      acc[f.targetType] = f._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Enrich citations with target info (batch for performance)
    const claimTexts = new Map<string, string>();
    const argTexts = new Map<string, string>();

    const citationClaimIds = [...new Set(citations.filter((c) => c.targetType === "claim").map((c) => c.targetId))];
    const citationArgIds = [...new Set(citations.filter((c) => c.targetType === "argument").map((c) => c.targetId))];

    if (citationClaimIds.length > 0) {
      const claimsData = await prisma.claim.findMany({
        where: { id: { in: citationClaimIds } },
        select: { id: true, text: true },
      });
      claimsData.forEach((c) => claimTexts.set(c.id, c.text || ""));
    }

    if (citationArgIds.length > 0) {
      const argsData = await prisma.argument.findMany({
        where: { id: { in: citationArgIds } },
        select: { id: true, conclusion: { select: { text: true } } },
      });
      argsData.forEach((a) => argTexts.set(a.id, a.conclusion?.text || ""));
    }

    const enrichedCitations = citations.map((c) => ({
      ...c,
      targetText: c.targetType === "claim" 
        ? claimTexts.get(c.targetId) || ""
        : argTexts.get(c.targetId) || "",
    }));

    return NextResponse.json({
      citations: enrichedCitations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets: {
        intent: intentCounts,
        targetType: typeCounts,
      },
    });
  } catch (error) {
    console.error("Failed to fetch deliberation evidence:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 }
    );
  }
}
