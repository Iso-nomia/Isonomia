export const dynamic = "force-dynamic";

// API route to get the status of branches in a dialogue (deliberation)
// app/api/dialogues/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

export async function GET(_req: NextRequest, { params }: { params:{ id: string } }) {
  const deliberationId = params.id;

  // 1) Collect latest terminating events per (targetType,targetId,locusPath)
  const lastTerm = await prisma.$queryRawUnsafe<{
    targetType: string; targetId: string; locusPath: string; kind: string; createdAt: Date;
  }[]>(`
    SELECT dm."targetType", dm."targetId",
      COALESCE((dm.payload->>'locusPath')::text, '0') as "locusPath",
      dm.kind, dm."createdAt"
    FROM "DialogueMove" dm
    WHERE dm."deliberationId" = $1
      AND (dm.kind = 'CLOSE' OR (dm.kind='ASSERT' AND dm.payload->>'as' = 'CONCEDE'))
  `,[deliberationId]);

  const closedKey = new Set(lastTerm.map(r => `${r.targetType}:${r.targetId}:${r.locusPath}`));

  // 2) Ask stepper for loci where † is legal now (closable branches)
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    orderBy: [{ participantId:'asc' }, { id:'asc' }],
    select: { id:true, participantId:true },
  });
  const pos = designs.find(d => d.participantId==='Proponent') ?? designs[0];
  const neg = designs.find(d => d.participantId==='Opponent')  ?? designs[1] ?? designs[0];

  let closable: string[] = [];
  if (pos && neg) {
    const trace = await stepInteraction({
      dialogueId: deliberationId,
      posDesignId: pos.id, negDesignId: neg.id, phase:'neutral', maxPairs: 256
    }).catch(() => null);
    closable = (trace?.daimonHints ?? []).map((h:any) => h.locusPath);
  }

  return NextResponse.json({
    ok: true,
    branches: closable.map(lp => ({ locusPath: lp, status: closedKey.has(`claim:${'*'}:${lp}`) ? 'closed' : 'open' })),
    // optionally add turn holders / summary counts here
  }, { headers: { 'Cache-Control':'no-store' }});
}
