//app/api/discussions/list/route.ts
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
  const cursorUpdatedAt = url.searchParams.get('cursorUpdatedAt');
  const cursorId = url.searchParams.get('cursorId');

  const userId = String(user.userId );

  const whereBase = { createdById: userId };
  const where =
    cursorUpdatedAt && cursorId
      ? {
          AND: [
            whereBase as any,
            {
              OR: [
                { updatedAt: { lt: new Date(cursorUpdatedAt) } },
                { AND: [{ updatedAt: new Date(cursorUpdatedAt) }, { id: { lt: cursorId } }] },
              ],
            },
          ],
        }
      : whereBase;

  const items = await prisma.discussion.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
            lastActiveAt: true, // ✅ Added
      replyCount: true,
      conversationId: true,
    },
  });

  const hasMore = items.length > limit;
  const page = items.slice(0, limit).map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
        lastActiveAt: i.lastActiveAt.toISOString(), // ✅ Serialize

  }));

  const nextCursor = hasMore
    ? { updatedAt: page[page.length - 1].updatedAt, id: page[page.length - 1].id }
    : null;

  return NextResponse.json(
    { items: page, nextCursor },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
