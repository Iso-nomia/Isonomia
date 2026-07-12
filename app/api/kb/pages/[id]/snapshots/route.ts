import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { requireKbRole, fail } from "@/lib/kb/withSpaceAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id;

    // Load page and check ACL
    const page = await prisma.kbPage.findUnique({
      where: { id: pageId },
      select: { spaceId: true },
    });
    if (!page)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    await requireKbRole(req, { spaceId: page.spaceId, need: "reader" });

    // Load all snapshots for this page
    const snapshots = await prisma.kbSnapshot.findMany({
      where: { pageId },
      select: {
        id: true,
        label: true,
        atTime: true,
        createdById: true,
        manifest: true,
      },
      orderBy: { atTime: "desc" },
    });

    // Add summary info for each snapshot
    const snapshotsWithSummary = snapshots.map((s) => {
      const manifest = s.manifest as any;
      return {
        id: s.id,
        label: s.label,
        atTime: s.atTime,
        createdById: s.createdById,
        blockCount: manifest?.blocks?.length ?? 0,
        pageTitle: manifest?.page?.title,
      };
    });

    return NextResponse.json(
      { ok: true, snapshots: snapshotsWithSummary },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch (e) {
    return fail(e);
  }
}
