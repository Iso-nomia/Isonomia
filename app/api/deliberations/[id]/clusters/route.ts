export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Q = z.object({
  type: z.enum(['topic','affinity']).optional().default('topic'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({ type: url.searchParams.get('type') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { type } = parsed.data;

  const clusters = await prisma.cluster.findMany({
    where: { deliberationId: params.id, type },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true },
  });

  // sizes
  const sizes = await prisma.argumentCluster.groupBy({
    by: ['clusterId'],
    _count: { argumentId: true },
    where: { clusterId: { in: clusters.map(c=>c.id) } },
  });
  const sizeMap = new Map(sizes.map(s => [s.clusterId, s._count.argumentId]));

  return NextResponse.json({
    items: clusters.map(c => ({ id: c.id, label: c.label ?? '—', size: sizeMap.get(c.id) ?? 0 })),
  });
}
