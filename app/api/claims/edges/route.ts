export const dynamic = "force-dynamic";

// app/api/claims/edges/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('deliberationId');
  
  if (!deliberationId) {
    return NextResponse.json({ error: 'deliberationId required' }, { status: 400 });
  }

  const edges = await prisma.claimEdge.findMany({
    where: { deliberationId },
    select: {
      id: true,
      fromClaimId: true,
      toClaimId: true,
      type: true,
      attackType: true,
      targetScope: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    { edges },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
      },
    }
  );
}
