//  app/api/works/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 15)));
  const cursorCreatedAt = url.searchParams.get('cursorCreatedAt');
  const cursorId = url.searchParams.get('cursorId');
  const scope = url.searchParams.get('scope') || 'mine';
  const deliberationId = url.searchParams.get('deliberationId') || undefined;

  const userId = String(user.userId);

  const whereBase =
    scope === 'deliberation' && deliberationId
      ? { deliberationId }
      : { authorId: userId };

  const where =
    cursorCreatedAt && cursorId
      ? {
          AND: [
            whereBase as any,
            {
              OR: [
                { createdAt: { lt: new Date(cursorCreatedAt) } },
                { AND: [{ createdAt: new Date(cursorCreatedAt) }, { id: { lt: cursorId } }] },
              ],
            },
          ],
        }
      : whereBase;

  const rows = await prisma.theoryWork.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      theoryType: true,
      createdAt: true,
      deliberationId: true,
      authorId: true,
      slug: true,
      status: true,
      visibility: true,
      publishedAt: true,
    },
  });

  const hasMore = rows.length > limit;
const page = rows.slice(0, limit).map(i => ({
  id: i.id,
  title: i.title ?? 'Untitled Work',
  theoryType: i.theoryType as any,
  createdAt: i.createdAt.toISOString(),
  deliberationId: i.deliberationId ?? null,
  authorId: i.authorId ?? null,
  slug: i.slug,
  status: i.status,
}));

  const nextCursor = hasMore
    ? { createdAt: page[page.length - 1].createdAt, id: page[page.length - 1].id }
    : null;

  return NextResponse.json(
    { items: page, nextCursor },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
