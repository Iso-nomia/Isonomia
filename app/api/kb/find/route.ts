// app/api/kb/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';
import { getCurrentUserId } from '@/lib/serverutils';
import {
  listableDeliberationWhere,
  normalizeUserId,
} from '@/lib/deliberations/visibility';

export const dynamic = 'force-dynamic'; export const revalidate = 0;

const Q = z.object({
  kind: z.enum(['claim','argument','room','sheet']),
  q: z.string().min(1),
  spaceId: z.string().min(6)
});

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const p = Q.parse({ kind: u.searchParams.get('kind'), q: u.searchParams.get('q'), spaceId: u.searchParams.get('spaceId') });
    await requireKbRole(req, { spaceId: p.spaceId, need: 'reader' });
    const q = p.q;

    if (p.kind === 'claim') {
      const rows = await prisma.claim.findMany({
        where: { text: { contains: q, mode: 'insensitive' } },
        select: { id: true, text: true, deliberationId: true },
        take: 12
      });
      return NextResponse.json({ ok:true, items: rows });
    }
    if (p.kind === 'argument') {
      const rows = await prisma.argumentDiagram.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        select: { id:true, title:true },
        take: 12
      });
      return NextResponse.json({ ok:true, items: rows });
    }
    if (p.kind === 'room') {
      const userId = normalizeUserId(await getCurrentUserId().catch(() => null));
      // Visibility: search only surfaces public deliberations (plus viewer's own).
      const rows = await prisma.deliberation.findMany({
        where: {
          AND: [
            listableDeliberationWhere(userId),
            { title: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id:true, title:true },
        take: 12
      });
      return NextResponse.json({ ok:true, items: rows });
    }
    // sheet
    const rows = await prisma.debateSheet.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      select: { id:true, title:true, deliberationId:true },
      take: 12
    });
    return NextResponse.json({ ok:true, items: rows });
  } catch (e) { return fail(e); }
}
