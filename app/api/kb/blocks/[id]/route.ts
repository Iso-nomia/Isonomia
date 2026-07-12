// app/api/kb/blocks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

async function loadBlockWithSpace(blockId: string) {
  const b = await prisma.kbBlock.findUnique({
    where: { id: blockId },
    select: { id: true, pageId: true, ord: true, type: true, dataJson: true, live: true, pinnedJson: true,
      page: { select: { spaceId: true } } },
  });
  if (!b) throw Object.assign(new Error('not_found'), { status: 404 });
  return b;
}

const PatchZ = z.object({
  ord: z.number().int().min(0).optional(),
  dataJson: z.any().optional(),
  live: z.boolean().optional(),
  pinnedJson: z.any().optional(),
  citations: z.any().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const block = await loadBlockWithSpace(params.id);
    await requireKbRole(req, { spaceId: block.page.spaceId, need: 'editor' });

    const body = PatchZ.parse(await req.json().catch(() => ({})));

    const updated = await prisma.kbBlock.update({
      where: { id: block.id },
      data: {
        ...(body.ord != null ? { ord: body.ord } : {}),
        ...(body.dataJson !== undefined ? { dataJson: body.dataJson } : {}),
        ...(body.live !== undefined ? { live: body.live } : {}),
        ...(body.pinnedJson !== undefined ? { pinnedJson: body.pinnedJson } : {}),
        ...(body.citations !== undefined ? { citations: body.citations } : {}),
      },
      select: { id:true, ord:true, type:true, dataJson:true, live:true, pinnedJson:true, updatedAt:true },
    });

    return NextResponse.json({ ok: true, block: updated }, NO_STORE);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const block = await loadBlockWithSpace(params.id);
    await requireKbRole(req, { spaceId: block.page.spaceId, need: 'editor' });

    await prisma.kbBlock.delete({ where: { id: block.id } });
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (e) {
    return fail(e);
  }
}
