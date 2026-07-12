import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

export const dynamic='force-dynamic'; export const revalidate=0;

const Body = z.object({ label: z.string().optional() });

export async function POST(req:NextRequest,{ params }:{params:{id:string}}) {
  const { label } = Body.parse(await req.json().catch(()=>({})));
  const page = await prisma.kbPage.findUnique({
    where: { id: params.id },
    select: {
      id:true, spaceId:true, slug:true, title:true, summary:true, tags:true, visibility:true, frontmatter:true, updatedAt:true,
      blocks: { select:{ id:true,type:true,live:true,dataJson:true,pinnedJson:true,ord:true }, orderBy:{ ord:'asc' } }
    }
  });
  if (!page) return NextResponse.json({ error:'Not found' }, { status:404 });

  const manifest = {
    page: {
      id: page.id, title: page.title, slug: page.slug,
      frontmatter: page.frontmatter, tags: page.tags, visibility: page.visibility
    },
    blocks: page.blocks.map(b => ({
      id: b.id, type: b.type, ord: b.ord, live: b.live,
      liveHash: b.live ? JSON.stringify(b.dataJson ?? {}).length : undefined,
      pinnedJson: !b.live ? (b.pinnedJson ?? b.dataJson ?? {}) : undefined
    }))
  };

  const snap = await prisma.kbSnapshot.create({
    data: { pageId: page.id, label: label ?? null, createdById: 'system', manifest },
    select: { id:true, atTime:true }
  });

  return NextResponse.json({ ok:true, snapshot: snap });
}
