export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { emitBus } from '@/lib/server/bus';

const Create = z.object({
  deliberationId: z.string().min(1),
  subjectType: z.enum(['option','view','claim']),
  subjectId: z.string().min(1),
  method: z.enum(['approval','rcv']),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), rvViewIndex: z.number().optional() })).min(2),
  closesAt: z.string().datetime(),
  quorumMinCount: z.number().int().optional(),
  quorumMinPct: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const s = await prisma.voteSession.create({
    data: {
      deliberationId: parsed.data.deliberationId,
      subjectType: parsed.data.subjectType,
      subjectId: parsed.data.subjectId,
      method: parsed.data.method,
      optionsJson: parsed.data.options,
      closesAt: new Date(parsed.data.closesAt),
      quorumMinCount: parsed.data.quorumMinCount ?? null,
      quorumMinPct: parsed.data.quorumMinPct ?? null,
    },
  });

  emitBus('votes:changed', { deliberationId: s.deliberationId, sessionId: s.id });
  return NextResponse.json({ ok: true, session: s });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('deliberationId') ?? '';
  if (!deliberationId) return NextResponse.json({ items: [] });
  const rows = await prisma.voteSession.findMany({
    where: { deliberationId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ items: rows });
}
