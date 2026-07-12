import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';

export const dynamic = 'force-dynamic'; export const revalidate = 0;

const Body = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9\-:]+$/i),
  title: z.string().min(1),
  summary: z.string().optional(),
  visibility: z.enum(['public','org','followers','private']).default('public'),
});

export async function GET() {
  const rows = await prisma.kbSpace.findMany({
    select: { id:true, slug:true, title:true, summary:true, visibility:true, updatedAt:true },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ ok:true, spaces: rows }, { headers:{'Cache-Control':'no-store'}});
}

export async function POST(req: NextRequest) {
  const userId = String((await getCurrentUserId().catch(()=> 'system')) ?? 'system');
  const b = Body.parse(await req.json());
  const row = await prisma.kbSpace.create({
    data: {
      slug: b.slug, title: b.title, summary: b.summary ?? null,
      visibility: b.visibility as any, createdById: userId,
      members: { create: [{ userId, role: 'owner' as any }] },
    },
    select: { id:true, slug:true },
  });
  return NextResponse.json({ ok:true, space: row }, { headers:{'Cache-Control':'no-store'}});
}
