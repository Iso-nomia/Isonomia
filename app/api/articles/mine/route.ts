export const dynamic = "force-dynamic";

// app/api/articles/mine/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';

export async function GET(req: Request) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const cursorUpdatedAt = searchParams.get('cursorUpdatedAt');
  const cursorId = searchParams.get('cursorId');

  const where = { authorId: user.userId.toString(), deletedAt: null as any };

  const orderBy = [{ updatedAt: 'desc' as const }, { id: 'desc' as const }];

  const query = {
    where,
    orderBy,
    take: pageSize + 1,
    select: {
      id: true, title: true, slug: true, status: true,
      createdAt: true, updatedAt: true, heroImageKey: true, template: true,
    },
  } as any;

  if (cursorUpdatedAt && cursorId) {
    query.cursor = { updatedAt: new Date(cursorUpdatedAt), id: BigInt(cursorId) };
    query.skip = 1; // move past the cursor
  }

  const rows = await prisma.article.findMany(query);

  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  const last = items[items.length - 1];

  return NextResponse.json({
    items: items.map(i => ({
      ...i,
      id: i.id.toString(), // if BigInt
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    nextCursor: hasMore && last
      ? { updatedAt: last.updatedAt.toISOString(), id: last.id.toString() }
      : null,
  });
}
