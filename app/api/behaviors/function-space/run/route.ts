// app/api/behaviours/function-space/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { dialogueId, D, Atests = [], Bperp = [], fuel = 2048 } = await req.json().catch(()=>({}));
  if (!dialogueId || !D) return NextResponse.json({ error:'dialogueId, D required' }, { status: 400 });

  const results = [];
  let ok = true;

  for (const a of Atests) {
    // 1) run D against a
    const rDa = await stepInteraction({ dialogueId, posDesignId: D, negDesignId: a, maxPairs: fuel });
    // 2) then check against each b ⊥
    const checks = [];
    for (const bPerp of Bperp) {
      const r = await stepInteraction({ dialogueId, posDesignId: (rDa as any)?.posDesignId ?? D, negDesignId: bPerp, maxPairs: fuel });
      checks.push({ bPerp, status: r.status, reason: r.reason, decisiveIndices: r.decisiveIndices ?? [] });
      if (r.status !== 'CONVERGENT') ok = false;
    }
    results.push({ a, rDa: { status: rDa.status, reason: rDa.reason }, checks });
  }

  return NextResponse.json({ ok, results });
}
