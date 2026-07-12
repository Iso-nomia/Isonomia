export const dynamic = "force-dynamic";

// app/api/ludics/orthogonal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { stepInteraction } from 'packages/ludics-engine/stepper';

const q = z.object({
  dialogueId: z.string().min(5),
  posDesignId: z.string().optional(),
  negDesignId: z.string().optional(),
  phase: z.enum(['focus-P','focus-O','neutral']).optional().default('neutral'),
});

async function findPair(dialogueId: string, posHint?: string, negHint?: string) {
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: dialogueId },
    orderBy: [{ participantId: 'asc' }, { id: 'asc' }],
    select: { id: true, participantId: true, deliberationId: true },
  });

  const curPos = designs.find(d => d.participantId === 'Proponent') ?? designs[0];
  const curNeg = designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0];

  const posValid = posHint ? await prisma.ludicDesign.findUnique({ where: { id: posHint } })
    .then(d => d && d.deliberationId === dialogueId ? d : null) : null;
  const negValid = negHint ? await prisma.ludicDesign.findUnique({ where: { id: negHint } })
    .then(d => d && d.deliberationId === dialogueId ? d : null) : null;

  const posUse = posValid ?? curPos ?? null;
  const negUse = negValid ?? curNeg ?? null;
  return { posUse, negUse, refreshed: !!((posHint && !posValid) || (negHint && !negValid)) };
}

export async function GET(req: NextRequest) {
  const parsed = q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { dialogueId, posDesignId, negDesignId, phase } = parsed.data;

  try {
    let { posUse, negUse, refreshed } = await findPair(dialogueId, posDesignId, negDesignId);

    if (!posUse || !negUse) {
      // Try to compile designs from dialogue moves, then re-find
      await compileFromMoves(dialogueId).catch(() => {});
      ({ posUse, negUse, refreshed } = await findPair(dialogueId, posDesignId, negDesignId));
      if (!posUse || !negUse) {
        return NextResponse.json({ ok: false, error: 'NO_SUCH_DESIGN' }, { status: 409 });
      }
    }

    const trace = await stepInteraction({
      dialogueId, posDesignId: posUse.id, negDesignId: negUse.id, maxPairs: 10_000, phase,
    });

    const orthogonal = trace.status === 'CONVERGENT';

    // Build acts pack for Narrated Trace
    const ids = Array.from(new Set(trace.pairs.flatMap(p => [p.posActId, p.negActId]))).filter((x): x is string => !!x);
    const rows = await prisma.ludicAct.findMany({
      where: { id: { in: ids } },
      include: { locus: true },
    });

    const acts = Object.fromEntries(rows.map(a => ([
      a.id,
      {
        polarity: (a.polarity ?? 'P') as 'P'|'O',
        locusPath: a.locus?.path ?? '0',
        expression: a.expression ?? undefined,
        meta: a.metaJson ?? undefined,
        isAdditive: a.isAdditive,
      }
    ])));

    return NextResponse.json({
      ok: true,
      orthogonal,
      usedDesigns: { posDesignId: posUse.id, negDesignId: negUse.id, refreshed },
      trace,
      acts,
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes('NO_SUCH_DESIGN')) {
      return NextResponse.json({ ok: false, error: 'NO_SUCH_DESIGN' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'INTERNAL', detail: msg }, { status: 500 });
  }
}
