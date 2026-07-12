export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/dialectic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import type { Edge, NodeID } from '@/lib/argumentation';
import {
  buildAttackGraph,
  toDefeatGraphFromAttackMap,
  labellingToSets,
  policyLabelling,
  resolveSemanticsPolicy,
} from '@/lib/argumentation';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const url = new URL(req.url);
  // `lens` is an optional per-request override; otherwise the stored
  // per-deliberation policy (Deliberation.argumentSemantics) applies (Phase 4b).
  const lensOverride = url.searchParams.get('lens');

  /* ---------------- A) Build AF from arguments + defeating edges ---------------- */
  const [args, edgeRows, delibSetting] = await Promise.all([
    prisma.argument.findMany({ where: { deliberationId }, select: { id: true } }),
    prisma.argumentEdge.findMany({
      where: { deliberationId, type: { in: ['rebut', 'undercut'] } },
      select: { fromArgumentId: true, toArgumentId: true, type: true },
    }),
    prisma.deliberation
      .findUnique({ where: { id: deliberationId }, select: { argumentSemantics: true } })
      .catch(() => null),
  ]);

  const policy = resolveSemanticsPolicy({
    override: lensOverride,
    stored: delibSetting?.argumentSemantics ?? null,
  });

  const nodes: NodeID[] = args.map(a => a.id);
  const edges: Edge[] = edgeRows.map(e => ({ from: e.fromArgumentId, to: e.toArgumentId, type: e.type as Edge['type'] }));

  const attackMap = buildAttackGraph(nodes, edges);

  /* ---------------- B) Label nodes: IN / OUT / UNDEC ---------------- */
  const status: Record<string, 'IN'|'OUT'|'UNDEC'> = {};
  for (const n of nodes) status[n] = 'UNDEC';

  if (nodes.length) {
    const dg = toDefeatGraphFromAttackMap(nodes, attackMap);
    const { IN, OUT } = labellingToSets(policyLabelling(dg, policy));
    for (const n of nodes) status[n] = IN.has(n) ? 'IN' : OUT.has(n) ? 'OUT' : 'UNDEC';
  }

  /* ---------------- C) Per-target WHY stats (compat with old UI) ---------------- */
  const moves = await prisma.dialogueMove.findMany({
    where: { deliberationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, targetType: true, targetId: true, kind: true, payload: true, createdAt: true },
  });

  const byTarget = new Map<string, typeof moves>();
  for (const m of moves) {
    if (!m.targetType || !m.targetId) continue;
    const k = `${m.targetType}:${m.targetId}`;
    (byTarget.get(k) ?? byTarget.set(k, []).get(k)!).push(m);
  }

  const stats: Record<string, {
    openWhy: number;
    resolved: number;
    avgHoursToGrounds: number | null;
    lastWhyAt?: string;
    lastResponseAt?: string;
    dialScore: number;
  }> = {};

  for (const [k, list] of byTarget) {
    list.sort((a, b) => +a.createdAt - +b.createdAt);
    const openStack: any[] = [];
    let resolved = 0; const latencies: number[] = [];
    let lastWhyAt: string | undefined, lastRespAt: string | undefined;

    for (const m of list) {
      if (m.kind === 'WHY') { openStack.push(m); lastWhyAt = m.createdAt.toISOString(); }
      if (m.kind === 'GROUNDS' || m.kind === 'RETRACT' || (m.kind === 'ASSERT' && (m.payload as any)?.as === 'CONCEDE')) {
        const w = openStack.pop(); lastRespAt = m.createdAt.toISOString();
        if (w) { resolved++; latencies.push((+m.createdAt - +w.createdAt) / 36e5); }
      }
    }

    const openWhy = openStack.length;
    const avg = latencies.length ? (latencies.reduce((a,b)=>a+b,0)/latencies.length) : null;
    const dialScore = resolved / Math.max(1, resolved + openWhy);

    stats[k] = {
      openWhy, resolved,
      avgHoursToGrounds: avg ? Number(avg.toFixed(2)) : null,
      lastWhyAt, lastResponseAt: lastRespAt,
      dialScore: Number(dialScore.toFixed(3)),
    };
  }

  return NextResponse.json(
    { ok: true, lens: policy, status, stats, now: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
