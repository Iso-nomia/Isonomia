export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/moves/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { z } from 'zod';

const WHY_TTL_HOURS = 24;

const qSchema = z.object({
  targetType: z.enum(['argument','claim','card']).optional(),
  targetId: z.string().optional(),
  kind: z.enum(['ASSERT','WHY','GROUNDS','RETRACT']).optional(),
  cursor: z.string().optional(),       // ISO or id — here we’ll use ISO createdAt
  limit: z.coerce.number().min(1).max(500).default(100),  
});

type Move = {
  id: string;
  deliberationId: string;
  targetType: 'argument'|'claim'|'card';
  targetId: string;
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT';
  payload: any | null;
  actorId: string | null;
  createdAt: string; // ISO
};

function computeUnresolvedWhy(moves: Move[]) {
  // Group by target
  const byTarget: Record<string, Move[]> = {};
  for (const m of moves) (byTarget[`${m.targetType}:${m.targetId}`] ||= []).push(m);

  const unresolved: Record<string, Move> = {};
  const ttlMs = WHY_TTL_HOURS * 3600 * 1000;

  for (const [k, arr0] of Object.entries(byTarget)) {
    const arr = [...arr0].sort((a,b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    let lastWhy: Move | null = null;

    for (const m of arr) {
      if (m.kind === 'WHY') {
        lastWhy = m; continue;
      }
      // Answers that clear a WHY:
      const isConcede = m.kind === 'ASSERT' && m.payload && m.payload.as === 'CONCEDE';
      if (m.kind === 'GROUNDS' || m.kind === 'RETRACT' || isConcede) {
        lastWhy = null; continue;
      }
    }

    if (lastWhy) {
      // TTL decoration (optional for UI)
      const age = Date.now() - +new Date(lastWhy.createdAt);
      (lastWhy as any).ttlExpired = age > ttlMs;
      unresolved[k] = lastWhy;
    }
  }
  return unresolved;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {

     // 👇 sanity guard for bad segments
   if (!params?.id || params.id === 'undefined' || params.id === 'null') {
     return NextResponse.json({ ok:false, error:'INVALID_DELIBERATION_ID' }, { status: 400 });
   }
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = qSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { targetType, targetId, kind, cursor, limit } = parsed.data;

  // Base filter
  const where: any = { deliberationId: params.id };
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (kind) where.kind = kind;
  if (cursor) where.createdAt = { gt: new Date(cursor) };

  const rows = await prisma.dialogueMove.findMany({
    where, orderBy: { createdAt: 'asc' }, take: limit,
    select: { id:true, deliberationId:true, targetType:true, targetId:true, kind:true, payload:true, actorId:true, createdAt:true },
  });

  const items: Move[] = rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    targetType: r.targetType as "argument" | "claim" | "card",
    kind: r.kind as "ASSERT" | "WHY" | "GROUNDS" | "RETRACT"
  }));
  const unresolvedByTarget = computeUnresolvedWhy(items);

  // Counts (for this page of results)
  const byKind: Record<string, number> = { ASSERT:0, WHY:0, GROUNDS:0, RETRACT:0 };
  for (const m of items) byKind[m.kind]++;

  const nextCursor = items.length ? items[items.length - 1].createdAt : null;

  return NextResponse.json({
    ok: true,
    items,
    counts: { total: items.length, byKind },
    unresolvedByTarget,
    nextCursor,
  });
}
