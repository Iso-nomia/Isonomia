// app/api/kb/blocks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic'; export const revalidate = 0;

const Body = z.object({
  pageId: z.string().min(6),
  type: z.enum([
    'text','image','link','claim','claim_set','argument','sheet','room_summary','transport','evidence_list','cq_tracker','plexus_tile','theory_work',
  ]),
  ord: z.number().int().min(0).optional(),
  data: z.any().optional()
});

export async function POST(req: NextRequest) {
  try {
    const { pageId, type, ord, data } = Body.parse(await req.json());
    await requireKbRole(req, { pageId, need: 'editor' });

    // get next ord if not provided
    const max = await prisma.kbBlock.aggregate({ where: { pageId }, _max: { ord: true } });
    const nextOrd = ord ?? ((max._max.ord ?? -1) + 1);

    const created = await prisma.kbBlock.create({
  data: {
  pageId, ord: nextOrd, type,
  dataJson: (type === 'text') ? { md: '', lexical: null } : (data ?? {}),
  createdById: 'system'
},
      select: { id: true, pageId: true, ord: true, type: true, dataJson: true, live: true, updatedAt: true }
    });

    // Create DebateCitation if block references a deliberation
    if ((type === 'claim' || type === 'argument') && data && typeof data === 'object') {
      const deliberationId = (data as any).deliberationId;
      if (deliberationId && typeof deliberationId === 'string') {
        try {
          await prisma.debateCitation.upsert({
            where: {
              deliberationId_kbPageId_kbBlockId: {
                deliberationId,
                kbPageId: pageId,
                kbBlockId: created.id
              }
            },
            create: {
              deliberationId,
              kbPageId: pageId,
              kbBlockId: created.id
            },
            update: {
              citedAt: new Date()
            }
          });
        } catch (err) {
          console.warn('[KB Blocks] Failed to create DebateCitation:', err);
        }
      }
    }

    return NextResponse.json({ ok: true, block: created }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
