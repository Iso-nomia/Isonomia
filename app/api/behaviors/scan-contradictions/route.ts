export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

export async function POST(req: NextRequest) {
  const { deliberationId, fuel = 1024 } = await req.json();
  const designs = await prisma.ludicDesign.findMany({ where: { deliberationId }, select: { id:true, participantId:true }});
  const P = designs.find(d => d.participantId === 'Proponent');
  const O = designs.find(d => d.participantId === 'Opponent');
  if (!P || !O) return NextResponse.json({ ok:false, error:'NO_DESIGNS' }, { status: 404 });

  // Pairwise: for now we just run the assembled P vs O in this dialogue (your store already merges facts/rules into P/O)
  const res = await stepInteraction({ dialogueId: deliberationId, posDesignId: P.id, negDesignId: O.id, maxPairs: fuel });
  const contradictory = res.status === 'DIVERGENT' || res.status === 'STUCK';

  return NextResponse.json({
    ok: true,
    contradictory,
    decisiveIndices: res.decisiveIndices ?? [],
    reason: res.reason,
  });
}
