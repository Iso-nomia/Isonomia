// app/api/kb/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = String(user.userId);

  // Ensure a personal space (no `kind` field needed)
  let space = await prisma.kbSpace.findFirst({
    where: { createdById: userId, slug: { startsWith: `personal-${userId.slice(0,4)}-` } },
    select: { id: true },
  });
  if (!space) {
    space = await prisma.kbSpace.create({
      data: {
        slug: `personal-${userId.slice(0,4)}-${Math.random().toString(36).slice(2,6)}`,
        title: 'Personal Space',
        visibility: 'private' as any,
        createdById: userId,
      },
      select: { id: true },
    });
    await prisma.kbSpaceMember.create({
      data: { spaceId: space.id, userId, role: 'owner' as any },
    }).catch(()=>{});
  }

  const page = await prisma.kbPage.create({
    data: {
      id: `pg_${Math.random().toString(36).slice(2, 10)}`,
      space: { connect: { id: space.id } },
      slug: `untitled-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Untitled',
      summary: null,
      visibility: 'private' as any,
      tags: [],
      createdById: userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: page.id }, { headers: { 'Cache-Control': 'no-store' } });
}
