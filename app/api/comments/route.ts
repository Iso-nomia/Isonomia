export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await prisma.comment.delete({
      where: { id: params.id },
      select: { id: true, threadId: true },
    });
    return NextResponse.json(deleted);
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'delete_failed' }, { status: 400 });
  }
}
