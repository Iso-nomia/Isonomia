export const dynamic = "force-dynamic";

// API route for claim citations
// app/api/claims/[id]/citations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

/**
 * GET /api/claims/[id]/citations
 * Retrieve all citations for a claim using the unified Citation system
 * Phase 2 of Citation Integration
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const claimId = params.id;

    if (!claimId) {
      return NextResponse.json(
        { ok: false, error: "Missing claimId" },
        { status: 400 }
      );
    }

    // Fetch citations with embedded source data
    const citations = await prisma.citation.findMany({
      where: {
        targetType: "claim",
        targetId: claimId,
      },
      include: {
        source: {
          select: {
            id: true,
            url: true,
            title: true,
            authorsJson: true,
            doi: true,
            platform: true,
            kind: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Transform to include source fields at top level for consistency
    const formattedCitations = citations.map((citation: any) => ({
      id: citation.id,
      url: citation.source?.url || null,
      title: citation.source?.title || citation.source?.url || "Untitled",
      authors: citation.source?.authorsJson || null,
      doi: citation.source?.doi || null,
      platform: citation.source?.platform || null,
      kind: citation.source?.kind || null,
      text: citation.quote || null,
      locator: citation.locator || null,
      note: citation.note || null,
      relevance: citation.relevance || null,
      createdAt: citation.createdAt,
      // Phase 2.1: Anchor fields
      anchorType: citation.anchorType || null,
      anchorId: citation.anchorId || null,
      anchorData: citation.anchorData || null,
      // Phase 2.3: Intent
      intent: citation.intent || null,
      // Include source object for CitationWithSource compatibility
      source: citation.source,
    }));

    return NextResponse.json({
      ok: true,
      citations: formattedCitations,
    });
  } catch (error: any) {
    console.error("Error fetching claim citations:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch citations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/claims/[id]/citations
 * Legacy endpoint for creating ClaimCitation (deprecated - use unified Citation system)
 * @deprecated Use /api/citations/attach instead
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;
  const { uri, locatorStart, locatorEnd, excerptHash, snapshotKey, cslJson, note } = await req.json();
  if (!uri || !excerptHash) return NextResponse.json({ error: 'uri & excerptHash required' }, { status: 400 });

  const cit = await prisma.claimCitation.create({
    data: { claimId, uri, locatorStart, locatorEnd, excerptHash, snapshotKey, cslJson, note }
  });
  return NextResponse.json({ citation: cit });
}
