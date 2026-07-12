export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

const Body = z.object({
  dialogueId: z.string().min(5),
  posDesignId: z.string().min(5).optional(),
  negDesignId: z.string().min(5).optional(),
  fuel: z.number().int().min(1).max(10000).optional().default(2048),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });

  const { dialogueId, fuel } = parsed.data;

  // resolve designs if not provided (most callers won't pass explicit ids)
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: dialogueId },
    orderBy: [{ participantId:'asc' }, { id:'asc' }],
    select: { id:true, participantId:true },
  });
  const pos = designs.find(d => d.participantId === 'Proponent') ?? designs[0];
  const neg = designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0];
  if (!pos || !neg) return NextResponse.json({ ok:false, error:'NO_DESIGNS' }, { status: 404 });

  const res = await stepInteraction({
    dialogueId,
    posDesignId: pos.id, negDesignId: neg.id,
    maxPairs: fuel, phase: 'neutral',
  });

  const converges =
    res.status === 'CONVERGENT' ? 'yes' :
    res.status === 'ONGOING'    ? 'no'  :
    res.status === 'STUCK'      ? 'no'  :
    'divergent';

  // pick a decisive index if available
  const decisiveIndex = Array.isArray(res.decisiveIndices) && res.decisiveIndices.length
    ? res.decisiveIndices[res.decisiveIndices.length - 1]
    : undefined;

  return NextResponse.json({ ok:true, converges, decisiveIndex, reason: res.reason, res }, { headers: { 'Cache-Control': 'no-store' } });
}
