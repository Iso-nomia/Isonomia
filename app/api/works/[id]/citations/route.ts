export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
const Item = z.object({
  targetType: z.enum(['claim','argument','proposition','work']),
  targetId: z.string(),
  section: z.string().optional(),
  role: z.string().default('reference'),
  note: z.string().optional(),
});
const Body = z.object({ items: z.array(Item).min(1) });

export async function GET(_req: NextRequest, { params }:{ params:{ id:string }}) {
  const rows = await prisma.theoryWorkCitation.findMany({ where: { workId: params.id }});
  return NextResponse.json({ ok:true, citations: rows });
}

export async function POST(req: NextRequest, { params }:{ params:{ id:string }}) {
  const { items } = Body.parse(await req.json());
  const created = await prisma.$transaction(items.map(i => prisma.theoryWorkCitation.upsert({
    where: { workId_targetType_targetId_section: { workId: params.id, targetType: i.targetType, targetId: i.targetId, section: i.section ?? '' } },
    create: { workId: params.id, ...i },
    update: { note: i.note, role: i.role },
  })));
  return NextResponse.json({ ok:true, citations: created });
}

export async function DELETE(req: NextRequest, { params }:{ params:{ id:string }}) {
  const url = new URL(req.url);
  const targetType = url.searchParams.get('targetType')!;
  const targetId   = url.searchParams.get('targetId')!;
  const section    = url.searchParams.get('section') || '';
  await prisma.theoryWorkCitation.delete({
    where: { workId_targetType_targetId_section: { workId: params.id, targetType, targetId, section } }
  });
  return NextResponse.json({ ok:true });
}
