export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { PaginationQuery, makePage } from '@/lib/server/pagination';
import { z } from 'zod';
import { since as startTimer, addServerTiming } from '@/lib/server/timing';
import { parseISO } from 'date-fns';

// GET /api/deliberations/[id]/claims?authorId=&since=&until=&cursor=&limit=&sort=
const Query = PaginationQuery.extend({
  authorId: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const t = startTimer();
    const url = new URL(req.url);
  const parsed = Query.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    authorId: url.searchParams.get('authorId') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    until: url.searchParams.get('until') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cursor, limit, sort, authorId, since, until } = parsed.data;
const [field, dir] = (sort ?? 'createdAt:desc').split(':') as ['createdAt','asc'|'desc'];

  const where: any = { deliberationId: params.id };
  if (authorId) where.createdById = authorId;
  if (since) where.createdAt = { ...(where.createdAt ?? {}), gte: parseISO(since) };
  if (until) where.createdAt = { ...(where.createdAt ?? {}), lt: parseISO(until) };

  const rows = await prisma.claim.findMany({
    where,
    orderBy: [{ [field]: dir }, { id: dir }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, text: true, createdAt: true, createdById: true },
  });

  const page = makePage(rows, limit);
  const res = NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  addServerTiming(res, [{ name: 'total', durMs: t() }]);
  return res;
}
