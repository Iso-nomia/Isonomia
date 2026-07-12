export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { ArgCQArraySchema } from '@/lib/types/argument';

const Q = z.object({
  type: z.enum(['topic']).optional().default('topic'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({ type: url.searchParams.get('type') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const deliberationId = params.id;

  // 1) clusters (topic)
  const clusters = await prisma.cluster.findMany({
    where: { deliberationId, type: 'topic' },
    select: { id: true, label: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!clusters.length) return NextResponse.json({ items: [] });

  // 2) argument memberships -> map to claims
  const memberships = await prisma.argumentCluster.findMany({
    where: { clusterId: { in: clusters.map(c=>c.id) } },
    select: { clusterId: true, argumentId: true },
  });
  const argIds = [...new Set(memberships.map(m=>m.argumentId))];
  const argToClaimRows = await prisma.argument.findMany({
    where: { id: { in: argIds }, claimId: { not: null } },
    select: { id: true, claimId: true },
  });
  const argToClaim = new Map(argToClaimRows.map(r => [r.id, r.claimId!]));

  const clusterClaims = new Map<string, string[]>();
  for (const c of clusters) clusterClaims.set(c.id, []);
  for (const m of memberships) {
    const cid = argToClaim.get(m.argumentId);
    if (cid) clusterClaims.get(m.clusterId)!.push(cid);
  }

  // 3) metrics per cluster
  const items = [];
  for (const c of clusters) {
    const claimIds = [...new Set(clusterClaims.get(c.id) ?? [])];
    const n = claimIds.length;

    // edges touching cluster claims (internal / external)
    const edges = n
      ? await prisma.claimEdge.findMany({
          where: {
            deliberationId,
            OR: [{ fromClaimId: { in: claimIds } }, { toClaimId: { in: claimIds } }],
          },
          select: { fromClaimId: true, toClaimId: true, type: true, attackType: true },
        })
      : [];

    // internal edges (both endpoints inside)
    let internal = 0;
    let supports = 0;
    let attacks = 0;

    const claimSet = new Set(claimIds);
    for (const e of edges) {
      const isSupport = e.type === 'supports' || e.attackType === 'SUPPORTS';
      const isAttack =
        e.type === 'rebuts' ||
        e.attackType === 'REBUTS' ||
        e.attackType === 'UNDERCUTS' ||
        e.attackType === 'UNDERMINES';

      if (isSupport) supports++;
      if (isAttack) attacks++;

      if (claimSet.has(e.fromClaimId) && claimSet.has(e.toClaimId)) {
        internal++;
      }
    }

    // cohesion: internal density normalized by possible directed pairs
    const possibleDirected = Math.max(1, n * (n - 1));
    const cohesion = internal / possibleDirected;

    const totalTouch = Math.max(1, supports + attacks);
    const contestation = attacks / totalTouch;

    // CQ completeness across cluster claims
    const instances = n
      ? await prisma.schemeInstance.findMany({
          where: { targetType: 'claim', targetId: { in: claimIds } },
          select: { targetId: true, scheme: { select: { key: true, cq: true } } },
        })
      : [];
    const statuses = n
      ? await prisma.cQStatus.findMany({
          where: { targetType: 'claim', targetId: { in: claimIds }, satisfied: true },
          select: { targetId: true, schemeKey: true, cqKey: true },
        })
      : [];

    const sat = new Set(statuses.map(s => `${s.targetId}|${s.schemeKey}|${s.cqKey}`));
    let required = 0;
    let satisfied = 0;
    for (const inst of instances) {
      const schemeKey = inst.scheme?.key ?? '';
      const parsed = ArgCQArraySchema.safeParse(inst.scheme?.cq ?? []);
      const cqs = parsed.success ? parsed.data : [];
      required += cqs.length;
      for (const cq of cqs) {
        const k = `${inst.targetId}|${schemeKey}|${cq.key}`;
        if (sat.has(k)) satisfied++;
      }
    }
    const cqCompleteness = required > 0 ? satisfied / required : 0;

    items.push({
      clusterId: c.id,
      label: c.label ?? '—',
      sizeClaims: n,
      cohesion,
      contestation,
      cqCompleteness,
    });
  }

  return NextResponse.json({ items });
}
