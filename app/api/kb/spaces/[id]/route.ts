import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

export const dynamic = 'force-dynamic'; export const revalidate = 0;

const Patch = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  visibility: z.enum(['public','org','followers','private']).optional(),
});

export async function GET(_:NextRequest,{ params }:{params:{id:string}}) {
  const s = await prisma.kbSpace.findUnique({
    where: { id: params.id },
    select: { id:true, slug:true, title:true, summary:true, visibility:true, updatedAt:true },
  });
  if (!s) return NextResponse.json({ error:'Not found' }, { status:404 });
  return NextResponse.json({ ok:true, space:s }, { headers:{'Cache-Control':'no-store'}});
}

export async function PATCH(req:NextRequest,{ params }:{params:{id:string}}) {
  const b = Patch.parse(await req.json());
  const s = await prisma.kbSpace.update({
    where: { id: params.id }, data: { ...b }, select: { id:true, title:true, visibility:true }
  }).catch(()=>null);
  if (!s) return NextResponse.json({ error:'Not found' }, { status:404 });
  return NextResponse.json({ ok:true, space:s });
}

export async function DELETE(_:NextRequest,{ params }:{params:{id:string}}) {
  await prisma.kbSpace.delete({ where: { id: params.id } }).catch(()=>null);
  return NextResponse.json({ ok:true });
}
