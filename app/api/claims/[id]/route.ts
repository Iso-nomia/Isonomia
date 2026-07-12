// app/api/claims/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = decodeURIComponent(params.id || '');
  if (!claimId) {
    return NextResponse.json({ error: 'Missing claim id' }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      text: true,
      createdAt: true,
      createdById: true,
      deliberationId: true,
      _count: {
        select: {
          arguments: true,
        },
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  // Find the top argument (if any) for diagram viewing
  const topArg = await prisma.argument.findFirst({
    where: { claimId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    {
      ok: true,
      claim: {
        ...claim,
        topArgumentId: topArg?.id || null,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}