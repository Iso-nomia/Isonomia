export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/propositions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { PaginationQuery, makePage } from '@/lib/server/pagination';

const Query = PaginationQuery.extend({
  q: z.string().optional(),
  claimed: z.enum(['any','yes','no']).optional(),
  sort: z.string().optional(), // createdAt:desc
});
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(req: NextRequest, { params }: { params:{ id:string }}) {
  const u = new URL(req.url);
  const parsed = Query.safeParse({
    cursor: u.searchParams.get('cursor') ?? undefined,
    limit:  u.searchParams.get('limit') ?? undefined,
    sort:   u.searchParams.get('sort')  ?? 'createdAt:desc',
    q:      u.searchParams.get('q') ?? undefined,
    claimed: u.searchParams.get('claimed') ?? 'any',
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status:400, ...NO_STORE });
  const { cursor, limit, sort, q, claimed } = parsed.data;
  const [field, dir] = (sort ?? 'createdAt:desc').split(':') as ['createdAt','asc'|'desc'];

  const where: any = { deliberationId: params.id };
  if (q) where.text = { contains: q, mode: 'insensitive' };
  if (claimed === 'yes') where.promotedClaimId = { not: null };
  if (claimed === 'no')  where.promotedClaimId = null;

  const rows = await prisma.proposition.findMany({
    where,
    orderBy: [{ [field]: dir }, { id: dir }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const items = rows.slice(0, limit).map(r => ({
    id: r.id,
    deliberationId: r.deliberationId,
    authorId: r.authorId,
    text: r.text,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    status: r.status,
    voteUpCount: r.voteUpCount,
    voteDownCount: r.voteDownCount,
    endorseCount: r.endorseCount,
    replyCount: r.replyCount,
    promotedClaimId: r.promotedClaimId,
    createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json(makePage(items, limit), NO_STORE);
}

export async function POST(req: NextRequest, { params }: { params:{ id:string }}) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const body = await req.json().catch(()=>({}));
  const text = String(body?.text || '').trim();
  if (!text) return NextResponse.json({ error:'text required' }, { status:400 });

  const p = await prisma.proposition.create({
    data: {
      deliberationId: params.id,
      authorId: String(userId),
      text,
      mediaType: body?.mediaType ?? 'text',
      mediaUrl: body?.mediaUrl ?? null,
      status: 'PUBLISHED',
    },
  });
  return NextResponse.json({ ok:true, propositionId: p.id }, NO_STORE);
}
