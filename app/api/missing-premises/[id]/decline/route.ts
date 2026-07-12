export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.missingPremise.update({
      where: { id: params.id },
      data: { status: 'declined', decidedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error('[missing-premises:decline]', e);
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
