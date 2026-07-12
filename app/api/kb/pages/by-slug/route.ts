// app/api/kb/pages/by-slug/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const spaceSlug = u.searchParams.get('spaceSlug');
  const slug = u.searchParams.get('slug');
  if (!spaceSlug || !slug) return NextResponse.json({ error:'missing_params' }, { status:400 });

  const space = await prisma.kbSpace.findUnique({ where: { slug: spaceSlug }, select: { id: true } });
  if (!space) return NextResponse.json({ error:'space_not_found' }, { status:404 });

  const page = await prisma.kbPage.findUnique({
    where: { spaceId_slug: { spaceId: space.id, slug } },
    select: { id:true },
  });
  if (!page) return NextResponse.json({ error:'page_not_found' }, { status:404 });

  return NextResponse.json({ ok:true, id: page.id });
}
