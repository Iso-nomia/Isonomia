export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { stableExtensions } from 'packages/af/semantics';
import { z } from 'zod';

const zQ = z.object({ deliberationId: z.string() });

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = zQ.safeParse(q);
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { deliberationId } = parsed.data;

  // Universe: all claims in the deliberation (cap to 100 for naïve solver)
  const claims = await prisma.claim.findMany({
    where: { deliberationId }, select: { id: true }, take: 100
  });
  const ids = claims.map(c => c.id);

  // Attacks = rebuts + (optionally) undercuts/undermines as attacks
  const edges = await prisma.claimEdge.findMany({
    where: { deliberationId, OR: [{ type: 'rebuts' as any }, { attackType: 'REBUTS' as any }, { attackType: 'UNDERCUTS' as any }, { attackType: 'UNDERMINES' as any }] },
    select: { fromClaimId: true, toClaimId: true }
  });
  const attacks = edges.map(e => [e.fromClaimId, e.toClaimId] as [string,string]);

  const exts = stableExtensions(ids, attacks);
  return NextResponse.json({ ok:true, count: exts.length, extensions: exts.slice(0, 20) });
}
