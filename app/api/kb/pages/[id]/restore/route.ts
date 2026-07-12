import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { requireKbRole, fail } from "@/lib/kb/withSpaceAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  snapshotId: z.string().min(6),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id;
    const { snapshotId } = Body.parse(await req.json());

    // Load page and check ACL
    const page = await prisma.kbPage.findUnique({
      where: { id: pageId },
      select: { id: true, spaceId: true },
    });
    if (!page)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    await requireKbRole(req, { spaceId: page.spaceId, need: "editor" });

    // Load snapshot
    const snapshot = await prisma.kbSnapshot.findUnique({
      where: { id: snapshotId, pageId },
      select: { manifest: true, atTime: true },
    });
    if (!snapshot)
      return NextResponse.json(
        { error: "snapshot_not_found" },
        { status: 404 }
      );

    const manifest = snapshot.manifest as any;
    if (!manifest || !manifest.blocks) {
      return NextResponse.json(
        { error: "invalid_manifest" },
        { status: 400 }
      );
    }

    // Delete all existing blocks
    await prisma.kbBlock.deleteMany({ where: { pageId } });

    // Recreate blocks from snapshot manifest
    const blocksToCreate = manifest.blocks.map((b: any) => ({
      id: b.id, // Preserve original block IDs
      pageId,
      ord: b.ord,
      type: b.type,
      live: b.live,
      dataJson: b.pinnedJson ?? {},
      pinnedJson: b.pinnedJson ?? null,
      createdById: "system", // TODO: use current user
      citations: null,
    }));

    await prisma.kbBlock.createMany({
      data: blocksToCreate,
    });

    // Update page metadata from snapshot if present
    if (manifest.page) {
      await prisma.kbPage.update({
        where: { id: pageId },
        data: {
          title: manifest.page.title ?? undefined,
          tags: manifest.page.tags ?? undefined,
          frontmatter: manifest.page.frontmatter ?? undefined,
          updatedById: "system", // TODO: use current user
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Restored page to snapshot from ${new Date(snapshot.atTime).toLocaleString()}`,
        restoredBlocks: blocksToCreate.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return fail(e);
  }
}
