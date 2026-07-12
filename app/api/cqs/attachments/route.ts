export const dynamic = "force-dynamic";

// app/api/cqs/attachments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

const Q = z.object({
  targetType: z.enum(['claim', 'argument']),
  targetId: z.string().min(8),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    targetType: url.searchParams.get('targetType'),
    targetId: url.searchParams.get('targetId'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 });
  }
  const { targetId } = parsed.data;

  // 1) GraphEdge meta (created by the “Attach” flow)
  const edges = await prisma.graphEdge.findMany({
    where: { toId: targetId },
    select: { meta: true },
    take: 2000,
  });

  // 2) Also accept explicit attacker ClaimEdges (rebuts/undercuts) to the target
  const claimEdges = await prisma.claimEdge.findMany({
    where: { toClaimId: targetId, OR: [{ type: 'rebuts' }, { attackType: 'UNDERCUTS' }] },
    select: { id: true, createdAt: true },
    take: 2000,
  });

  // 3) Check ConflictApplication.metaJson for CQ context
  const conflicts = await prisma.conflictApplication.findMany({
    where: {
      OR: [
        { conflictedClaimId: targetId },
        { conflictedArgumentId: targetId }
      ]
    },
    select: { metaJson: true },
    take: 2000,
  });

  const attached: Record<string, boolean> = {};

  // Check GraphEdge meta
  for (const e of edges) {
    const m = (e.meta ?? {}) as any;
    const key = m?.schemeKey && m?.cqKey ? `${m.schemeKey}:${m.cqKey}` : null;
    if (key) attached[key] = true;
  }

  // Check ConflictApplication metaJson
  for (const ca of conflicts) {
    const meta = ca.metaJson as any;
    if (meta?.schemeKey && meta?.cqKey) {
      const sig = `${meta.schemeKey}:${meta.cqKey}`;
      attached[sig] = true;
    }
  }

  // If there are generic attacker edges without explicit scheme metadata,
  // you'll still gate via "isAttached overall" if you want (optional):
  if (claimEdges.length > 0 || conflicts.length > 0) attached['__ANY__'] = true;

  return NextResponse.json({ attached });
}
