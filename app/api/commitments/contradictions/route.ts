// app/api/commitments/contradictions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deliberationId = req.nextUrl.searchParams.get('deliberationId') ?? '';
  const ownerId = req.nextUrl.searchParams.get('ownerId') ?? '';
  if (!deliberationId || !ownerId) return NextResponse.json({ error:'need deliberationId, ownerId' }, { status:400 });

  const state = await prisma.ludicCommitmentState.findFirst({ where:{ ownerId }});
  const payload = (state?.extJson ?? {}) as any;
  const facts: string[] = payload.facts ?? [];
  const rules: string[] = payload.rules ?? [];

  const pairs: any[] = [];
  for (const f of facts) for (const r of rules) {
    const res = await stepInteraction({ dialogueId: deliberationId, posDesignId: f, negDesignId: r, maxPairs: 2048, compositionMode:'assoc' });
    if (res.status !== 'CONVERGENT') {
      pairs.push({ factId: f, ruleId: r, status: res.status, reason: res.reason, decisiveIndices: res.decisiveIndices ?? [] });
    }
  }
  return NextResponse.json({ ok:true, contradictions: pairs });
}
