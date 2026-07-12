// app/api/kb/pages/[id]/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({ order: z.array(z.string().min(6)).min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pageId = params.id;
    const { order } = Body.parse(await req.json());

    // Ensure editor on that page's space
    const page = await prisma.kbPage.findUnique({ where: { id: pageId }, select: { spaceId: true } });
    if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await requireKbRole(req, { spaceId: page.spaceId, need: 'editor' });

    // Validate the set matches existing blocks
    const rows = await prisma.kbBlock.findMany({ where: { pageId }, select: { id: true } });
    const ids = new Set(rows.map(r => r.id));
    if (order.length !== rows.length || order.some(id => !ids.has(id))) {
      return NextResponse.json({ error: 'bad_order' }, { status: 400 });
    }

    // Update ords in a tx
    await prisma.$transaction(
      order.map((id, idx) =>
        prisma.kbBlock.update({ where: { id }, data: { ord: idx } })
      )
    );

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fail(e);
  }
}
