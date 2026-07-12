export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { targetType, targetId, text, premiseType } = body as {
      targetType: 'argument'|'card';
      targetId: string;
      text: string;
      premiseType?: 'premise'|'warrant';
    };
    if (!targetType || !targetId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const mp = await prisma.missingPremise.create({
      data: {
        deliberationId: (await (targetType === 'argument'
          ? prisma.argument.findUnique({ where: { id: targetId }, select: { deliberationId: true } })
          : prisma.deliberationCard.findUnique({ where: { id: targetId }, select: { deliberationId: true } })
        ))?.deliberationId ?? '',
        targetType,
        targetId,
        proposedById: String(userId),
        text: text.trim(),
        premiseType: premiseType ?? 'premise',
      }
    });
    return NextResponse.json({ ok: true, missingPremise: mp });
  } catch (e:any) {
    console.error('[missing-premises:create]', e);
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
