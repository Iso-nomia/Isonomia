export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('deliberationId');
  if (!deliberationId) return NextResponse.json({ error: 'deliberationId required' }, { status: 400 });

  const [claims, edges] = await Promise.all([
   prisma.claim.findMany({ 
     where: { deliberationId }, 
     select: { id: true, text: true, moid: true, createdAt: true, createdById: true },
     orderBy: { createdAt: 'desc' }
   }),
    prisma.claimEdge.findMany({ where: { deliberationId }, select: { fromClaimId: true, type: true } }),
  ]);


   // CQ completeness in one shot
   const claimIds = claims.map(c => c.id);
   const statuses = await prisma.cQStatus.findMany({
     where: { targetType: 'claim', targetId: { in: claimIds } },
     select: { targetId: true, satisfied: true },
   });
   const cqById: Record<string, { required: number; satisfied: number }> = {};
   for (const s of statuses) {
     const k = s.targetId;
     (cqById[k] ??= { required: 0, satisfied: 0 }).required += 1;
  if (s.satisfied) cqById[k].satisfied += 1;
 }


  const counts: Record<string, { supports: number; rebuts: number }> = {};
  for (const c of claims) counts[c.id] = { supports: 0, rebuts: 0 };
  for (const e of edges) {
    if (!counts[e.fromClaimId]) counts[e.fromClaimId] = { supports: 0, rebuts: 0 };
    if (e.type === 'supports') counts[e.fromClaimId].supports++;
    else counts[e.fromClaimId].rebuts++;
  }

  return NextResponse.json({
claims: claims.map((c) => ({
     id: c.id,
     text: c.text,
     moid: c.moid,
     createdAt: c.createdAt,
     createdById: c.createdById,
     counts: counts[c.id] ?? { supports: 0, rebuts: 0 },
     cq: cqById[c.id] ?? { required: 0, satisfied: 0 },
   })),  });
}
