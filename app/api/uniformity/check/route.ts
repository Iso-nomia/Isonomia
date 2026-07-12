export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import { prisma } from '@/lib/prismaclient';
import { normalizeTrace, alphaEquivalent } from '@/packages/ludics-engine/uniformity';

const Body = z.object({
  dialogueId: z.string().min(5),
  posDesignId: z.string().min(10),
  negDesignId: z.string().min(10),
  baseLocus: z.string().min(1),
  childA: z.string().min(1),
  childB: z.string().min(1),
  fuel: z.number().int().min(1).max(10000).optional().default(2048),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { dialogueId, posDesignId, negDesignId, baseLocus, childA, childB, fuel } = parsed.data;

  const [ra, rb] = await Promise.all([
    stepInteraction({ dialogueId, posDesignId, negDesignId, maxPairs: fuel, virtualNegPaths: [childA], focusAt: childA }),
    stepInteraction({ dialogueId, posDesignId, negDesignId, maxPairs: fuel, virtualNegPaths: [childB], focusAt: childB }),
  ]);
 
     // Type guard: keep only pairs that have both act ids
     type PairBoth = { posActId: string; negActId: string; locusPath: string; ts: number };
     const hasBoth = (p: { posActId?: string; negActId?: string; locusPath: string; ts: number }): p is PairBoth =>
       typeof p.posActId === 'string' && typeof p.negActId === 'string';
   
  const allIds = Array.from(new Set([
    ...ra.pairs.flatMap(p => [p.posActId, p.negActId]),
    ...rb.pairs.flatMap(p => [p.posActId, p.negActId]),
  ].filter(Boolean) as string[]));

  const acts = allIds.length
    ? await prisma.ludicAct.findMany({ where: { id: { in: allIds } }, include: { locus: true } })
    : [];
  const byId = new Map(acts.map(a => [a.id, a]));

  const A = normalizeTrace(ra.pairs.filter(hasBoth), byId);
 const B = normalizeTrace(rb.pairs.filter(hasBoth), byId);

  const uniform = alphaEquivalent(A, B, baseLocus);
  return NextResponse.json({
    ok: true,
    uniform,
    counterexample: uniform ? undefined : { childA, childB, a: A.map(p=>p.locusPath), b: B.map(p=>p.locusPath) },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
