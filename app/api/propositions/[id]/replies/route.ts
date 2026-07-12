export const dynamic = "force-dynamic";

//app/api/propositions/[id]/replies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { PaginationQuery, makePage } from '@/lib/server/pagination';
import { z } from 'zod';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

const Query = PaginationQuery; // cursor + limit

export async function GET(req: NextRequest, { params }: { params:{ id:string } }) {
  const u = new URL(req.url);
  const parsed = Query.safeParse({
    cursor: u.searchParams.get('cursor') ?? undefined,
    limit: u.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
  const { cursor, limit } = parsed.data;

  const rows = await prisma.propositionReply.findMany({
    where: { propositionId: params.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id:true, authorId:true, text:true, createdAt:true },
  });

  const items = rows.slice(0, limit).map(r => ({
    id: r.id, authorId: r.authorId, text: r.text, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json(makePage(items, limit), NO_STORE);
}

export async function POST(req: NextRequest, { params }: { params:{ id:string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...NO_STORE });

  const b = await req.json().catch(()=>({}));
  const text = String(b?.text || '').trim();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400, ...NO_STORE });

  const created = await prisma.$transaction(async (tx) => {
    const r = await tx.propositionReply.create({
      data: { propositionId: params.id, authorId: String(userId), text },
      select: { id:true, authorId:true, text:true, createdAt:true }
    });
    await tx.proposition.update({ where: { id: params.id }, data: { replyCount: { increment: 1 } } });
    return r;
  });

  return NextResponse.json({ ok:true, reply: { ...created, createdAt: created.createdAt.toISOString() } }, NO_STORE);
}
