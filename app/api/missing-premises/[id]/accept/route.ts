export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { getCurrentUserId } from '@/lib/serverutils';
import { makeSignature } from '@/lib/dialogue/moves'; // existing helper

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mp = await prisma.missingPremise.update({
      where: { id: params.id },
      data: { status: 'accepted', decidedAt: new Date() },
      select: { id:true, targetType:true, targetId:true, text:true, premiseType:true }
    });

    if (mp.targetType === 'card') {
      if (mp.premiseType === 'warrant') {
        await prisma.deliberationCard.update({
          where: { id: mp.targetId },
          data: { warrantText: mp.text }
        });
      } else {
        const cur = await prisma.deliberationCard.findUnique({ where: { id: mp.targetId }, select: { reasonsText: true }});
        await prisma.deliberationCard.update({
          where: { id: mp.targetId },
          data: { reasonsText: [...(cur?.reasonsText ?? []), mp.text] }
        });
      }
    } else {
      // target is an argument: create an implicit child premise that supports it
      const parent = await prisma.argument.findUnique({ where: { id: mp.targetId }, select: { deliberationId: true, authorId: true }});
      const child = await prisma.argument.create({
        data: {
          deliberationId: parent?.deliberationId ?? '',
          authorId: String(userId),
          text: mp.text,
          isImplicit: true,
        }
      });
      await prisma.argumentEdge.create({
        data: {
          deliberationId: parent?.deliberationId ?? '',
          fromArgumentId: child.id,
          toArgumentId: mp.targetId,
          type: 'support',
          createdById: String(userId),
          targetScope: 'premise'
        }
      });
    }
    if (mp.targetType === 'argument') {
  const parent = await prisma.argument.findUnique({
    where: { id: mp.targetId },
    select: { deliberationId: true, claimId: true }
  });

  // 2.a canonicalize to monological store
  if ((mp.premiseType || '').toLowerCase() === 'warrant' && parent?.claimId) {
    await prisma.claimWarrant.create({
      data: { claimId: parent.claimId, text: mp.text, createdBy: String(userId) }
    }).catch(()=>{});
    await prisma.argumentAnnotation.create({
      data: {
        targetType: 'argument',
        targetId: mp.targetId,
        type: 'monological:warrant',
        text: mp.text,
        source: 'missing',
        offsetStart: 0,
        offsetEnd: Math.min(120, mp.text.length),
      }
    }).catch(()=>{});
  } else {
    // (your existing implicit child + support edge with targetScope 'premise')
    // unchanged
  }

  // 2.b optional: seed a GROUNDS move to kick the dialogue
  try {
    const payload = { expression: mp.text, cqId:'default', locusPath:'0' };
    const signature = makeSignature('GROUNDS','argument', mp.targetId, payload); // same helper you use elsewhere
    await createDialogueMove({
      deliberationId: parent?.deliberationId ?? '',
      targetType: 'argument',
      targetId: mp.targetId,
      kind: 'GROUNDS',
      payload,
      actorId: String(userId),
      signature,
      locusPath: '0',
    });
    (globalThis as any).meshBus?.emit?.('dialogue:moves:refresh', { deliberationId: parent?.deliberationId });
  } catch {}
}

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error('[missing-premises:accept]', e);
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
