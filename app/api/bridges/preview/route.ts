export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const a = url.searchParams.get('clusterA');
  const b = url.searchParams.get('clusterB');
  const limit = Math.min(80, Math.max(10, Number(url.searchParams.get('limit') ?? 40)));
  if (!a || !b) return NextResponse.json({ pairs: [] });

  // claims in each cluster (via ArgumentCluster -> Argument.claimId)
  const memA = await prisma.argumentCluster.findMany({ where: { clusterId: a }, select: { argumentId: true } });
  const memB = await prisma.argumentCluster.findMany({ where: { clusterId: b }, select: { argumentId: true } });
  const mapA = await prisma.argument.findMany({ where: { id: { in: memA.map(m=>m.argumentId) }, claimId: { not: null } }, select: { claimId: true } });
  const mapB = await prisma.argument.findMany({ where: { id: { in: memB.map(m=>m.argumentId) }, claimId: { not: null } }, select: { claimId: true } });

  const SA = [...new Set(mapA.map(m=>m.claimId!))];
  const SB = [...new Set(mapB.map(m=>m.claimId!))];
  if (!SA.length || !SB.length) return NextResponse.json({ pairs: [] });

  // existing edges to avoid suggesting duplicates
  const existing = await prisma.claimEdge.findMany({
    where: {
      deliberationId: params.id,
      OR: [
        { fromClaimId: { in: SA }, toClaimId: { in: SB } },
        { fromClaimId: { in: SB }, toClaimId: { in: SA } },
      ],
    },
    select: { fromClaimId: true, toClaimId: true },
  });
  const exists = new Set(existing.map(e => `${e.fromClaimId}->${e.toClaimId}`));

  // sample candidate pairs without an edge
  const pairs: Array<{ source: string; target: string }> = [];
  for (let i=0; i<limit*3 && pairs.length < limit; i++) {
    const s = SA[(i*13) % SA.length];
    const t = SB[(i*17) % SB.length];
    if (!exists.has(`${s}->${t}`) && !exists.has(`${t}->${s}`)) {
      pairs.push({ source: s, target: t });
    }
  }

  return NextResponse.json({ pairs });
}
