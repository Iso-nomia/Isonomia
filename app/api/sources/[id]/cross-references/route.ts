export const dynamic = "force-dynamic";

// app/api/sources/[id]/cross-references/route.ts
// Phase 3.3: Cross-Deliberation Citation Tracking API
// Returns all contexts where a source is cited across the platform

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    // Build the where clause for contexts
    // Include public contexts, plus private ones user has access to
    const contexts = await prisma.sourceCitationContext.findMany({
      where: {
        sourceId,
        OR: [
          { isPublic: true },
          // Include private deliberations where user is a participant
          // This requires checking deliberation membership
          ...(userId
            ? [
                {
                  deliberation: {
                    // Check if user created or has access
                    createdById: userId,
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        deliberation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            createdById: true,
          },
        },
        citation: {
          select: {
            id: true,
            quote: true,
            note: true,
            createdAt: true,
            createdById: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get aggregated usage stats
    const usage = await prisma.sourceUsage.findUnique({
      where: { sourceId },
    });

    // Get source basic info
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        title: true,
        kind: true,
        authorsJson: true,
        year: true,
        doi: true,
        url: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Group contexts by deliberation for easier display
    const byDeliberation: Record<
      string,
      {
        deliberationId: string;
        deliberationTitle: string | null;
        contexts: Array<{
          id: string;
          intent: string | null;
          quote: string | null;
          note: string | null;
          createdAt: Date;
        }>;
      }
    > = {};

    for (const ctx of contexts) {
      if (ctx.deliberationId && ctx.deliberation) {
        if (!byDeliberation[ctx.deliberationId]) {
          byDeliberation[ctx.deliberationId] = {
            deliberationId: ctx.deliberationId,
            deliberationTitle: ctx.deliberation.title,
            contexts: [],
          };
        }
        byDeliberation[ctx.deliberationId].contexts.push({
          id: ctx.id,
          intent: ctx.intent,
          quote: ctx.quote || ctx.citation?.quote || null,
          note: ctx.citation?.note || null,
          createdAt: ctx.createdAt,
        });
      }
    }

    return NextResponse.json({
      source: {
        id: source.id,
        title: source.title,
        kind: source.kind,
        authors: source.authorsJson,
        year: source.year,
        doi: source.doi,
        url: source.url,
      },
      contexts: contexts.map((c) => ({
        id: c.id,
        deliberationId: c.deliberationId,
        deliberationTitle: c.deliberation?.title,
        argumentId: c.argumentId,
        stackId: c.stackId,
        intent: c.intent,
        quote: c.quote || c.citation?.quote,
        note: c.citation?.note,
        createdAt: c.createdAt,
        isPublic: c.isPublic,
      })),
      byDeliberation: Object.values(byDeliberation),
      usage: usage
        ? {
            totalCitations: usage.totalCitations,
            deliberationCount: usage.deliberationCount,
            argumentCount: usage.argumentCount,
            stackCount: usage.stackCount,
            uniqueCiters: usage.uniqueCiters,
            supportCount: usage.supportCount,
            refuteCount: usage.refuteCount,
            contextCount: usage.contextCount,
            citationsLast7Days: usage.citationsLast7Days,
            citationsLast30Days: usage.citationsLast30Days,
            trendScore: usage.trendScore,
            firstCitedAt: usage.firstCitedAt,
            lastCitedAt: usage.lastCitedAt,
          }
        : null,
    });
  } catch (error) {
    console.error(`[CrossReferences] Error fetching cross-references for ${sourceId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch cross-references" },
      { status: 500 }
    );
  }
}
