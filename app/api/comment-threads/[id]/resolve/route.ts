export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const thread = await prisma.commentThread.update({
      where: { id: params.id },
      data: { resolved: true },
      select: { id: true, resolved: true },
    });
    return NextResponse.json(thread);
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'resolve_failed' }, { status: 400 });
  }
}
