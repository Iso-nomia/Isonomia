// app/api/arguments/[id]/citations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";

/**
 * GET /api/arguments/[id]/citations
 * Returns all citations attached to an argument
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    const citations = await prisma.citation.findMany({
      where: {
        targetType: "argument",
        targetId: argumentId,
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

    // Transform to include source fields at top level for consistency with propositions
    const formattedCitations = citations.map((citation) => ({
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
    }));

    return NextResponse.json(
      { ok: true, citations: formattedCitations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[GET /api/arguments/[id]/citations] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to fetch citations" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
