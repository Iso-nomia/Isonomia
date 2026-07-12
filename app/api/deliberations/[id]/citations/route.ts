// app/api/deliberations/[id]/citations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/deliberations/[id]/citations
 * Returns all KB pages that cite this deliberation, grouped by page
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    // Fetch all citations for this deliberation
    const citations = await (prisma as any).debateCitation.findMany({
      where: { deliberationId },
      include: {
        kbPage: { select: { id: true, title: true, slug: true, spaceId: true } },
        kbBlock: { select: { id: true, type: true, ord: true } },
      },
      orderBy: [{ kbPageId: "asc" }, { kbBlock: { ord: "asc" } }],
    });

    // Group by page
    const grouped = citations.reduce((acc: any, c: any) => {
      if (!acc[c.kbPageId]) {
        acc[c.kbPageId] = {
          page: c.kbPage,
          blocks: [],
        };
      }
      acc[c.kbPageId].blocks.push({
        id: c.kbBlock.id,
        type: c.kbBlock.type,
        ord: c.kbBlock.ord,
        citedAt: c.citedAt,
      });
      return acc;
    }, {});

    const pages = Object.values(grouped).map((g: any) => ({
      ...g.page,
      blockCount: g.blocks.length,
      blocks: g.blocks,
    }));

    return NextResponse.json(
      { ok: true, pages, totalCitations: citations.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[Deliberation Citations] Error:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/deliberations/[id]/citations?kbBlockId=...
 * Removes a specific citation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const { searchParams } = new URL(req.url);
    const kbBlockId = searchParams.get("kbBlockId");

    if (!kbBlockId) {
      return NextResponse.json(
        { ok: false, error: "Missing kbBlockId query parameter" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete the citation
    const deleted = await (prisma as any).debateCitation.deleteMany({
      where: {
        deliberationId,
        kbBlockId,
      },
    });

    return NextResponse.json(
      { ok: true, deletedCount: deleted.count },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[Deliberation Citations] Delete error:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
