export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { appendActs } from '@/packages/ludics-engine/appendActs';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import type { DialogueAct } from '@/packages/ludics-core/types';

export async function POST(req: NextRequest) {
  try {
    const { deliberationId, textSentences, hypothesis, steps } = await req.json();
    if (!deliberationId || !Array.isArray(textSentences) || !hypothesis) {
      return NextResponse.json({ ok:false, error:'missing fields' }, { status:400 });
    }
    // Create two temporary designs for visualization
    const root = await prisma.ludicLocus.upsert({
      where: { dialogueId_path: { dialogueId: deliberationId, path: '0' } },
      update: {},
      create: { dialogueId: deliberationId, path: '0' },
      select: { id:true }
    });

    const P = await prisma.ludicDesign.create({
      data: { deliberationId, participantId:'Proponent', rootLocusId: root.id }
    });
    const O = await prisma.ludicDesign.create({
      data: { deliberationId, participantId:'Opponent',  rootLocusId: root.id }
    });

    // Seed premises as P-ASSERTs: 0.1, 0.2, ...
    let i = 0;
    for (const s of textSentences) {
      await appendActs(P.id, [
        { kind:'PROPER', polarity:'P', locus:`0.${++i}`, ramification:['1'], expression:s, additive:false, meta:{ from:'T' } } as DialogueAct,
      ], { enforceAlternation:false }, prisma);
    }
    // O asks the hypothesis as a WHY on 0.h
    await appendActs(O.id, [
      { kind:'PROPER', polarity:'O', locus:`0.${++i}`, ramification:[], expression:`why: ${hypothesis}`, additive:false, meta:{ from:'H' } } as DialogueAct,
    ], { enforceAlternation:false }, prisma);

    // Optionally replay ‘steps’ by appending short GROUNDS where derived facts happened
    let j = 0;
    for (const st of (steps ?? [])) {
      if (st?.derived) {
        await appendActs(P.id, [
          { kind:'PROPER', polarity:'P', locus:`0.${i}.${++j}`, ramification:[], expression: st.derived, additive:false, meta:{ rule:st.rule } } as DialogueAct,
        ], { enforceAlternation:false }, prisma);
      }
    }

    const trace = await stepInteraction({ dialogueId: deliberationId, posDesignId: P.id, negDesignId: O.id, phase:'neutral', maxPairs: 2048 });

    return NextResponse.json({ ok:true, posDesignId:P.id, negDesignId:O.id, trace });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'viz_failed' }, { status:500 });
  }
}
