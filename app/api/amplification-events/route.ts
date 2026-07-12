export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('deliberationId');
  if (!deliberationId) return NextResponse.json({ error: 'deliberationId required' }, { status: 400 });
  const events = await prisma.amplificationEvent.findMany({
    where: { deliberationId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, eventType: true, reason: true, createdAt: true },
  });
  return NextResponse.json({ events });
}
