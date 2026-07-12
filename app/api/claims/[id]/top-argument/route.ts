// API route to get the top argument for a claim
//app/api/claims/[id]/top-argument/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = decodeURIComponent(params.id || '');
  if (!claimId) return NextResponse.json({ error: 'Missing claim id' }, { status: 400 });

  // Heuristic: choose the argument with the most approvals; tie-break by recency
  const args = await prisma.argument.findMany({
    where: { claimId },
    select: { id:true, createdAt:true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (!args.length) return NextResponse.json({ top: null });

  const approvals = await prisma.argumentApproval.groupBy({
    by: ['argumentId'],
    where: { argumentId: { in: args.map(a => a.id) } },
    _count: { argumentId: true },
  }).catch(() => []);

  const countBy = new Map<string, number>(approvals.map(a => [a.argumentId, a._count.argumentId]));
  const sorted = [...args].sort((a, b) => (countBy.get(b.id) ?? 0) - (countBy.get(a.id) ?? 0) || (+b.createdAt - +a.createdAt));
  return NextResponse.json({ top: { id: sorted[0].id } }, { headers: { 'Cache-Control': 'no-store' } });
}
