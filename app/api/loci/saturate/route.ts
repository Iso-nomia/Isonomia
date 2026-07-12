export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

const Body = z.object({
  dialogueId: z.string(),
  baseLocus: z.string(),
  fuel: z.number().int().min(1).max(10000).optional().default(1024),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dialogueId, baseLocus, fuel } = parsed.data;

  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: dialogueId },
    select: { id: true, participantId: true },
  });
  const P = designs.find(d => d.participantId === 'Proponent')!;
  const O = designs.find(d => d.participantId === 'Opponent')!;

  // enumerate children
  const kids = await prisma.ludicLocus.findMany({
    where: { dialogueId, path: { startsWith: baseLocus + '.' } },
    select: { path: true },
    orderBy: { path: 'asc' },
  });

  const results: Record<string, 'ok'|'divergent'|'stuck'> = {};
  for (const k of kids) {
    // Run full interaction as-is; if your tests are local, this still detects divergence/stuck per child
    const res = await stepInteraction({ dialogueId, posDesignId: P.id, negDesignId: O.id, maxPairs: fuel });
    results[k.path] =
      res.status === 'CONVERGENT' ? 'ok' :
      res.status === 'DIVERGENT'  ? 'divergent' :
      'stuck';
  }

  const allOk = Object.values(results).every(v => v === 'ok');
  return NextResponse.json({ ok: true, saturated: allOk, results });
}
