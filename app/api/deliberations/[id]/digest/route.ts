export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/digest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { since as startTimer, addServerTiming } from '@/lib/server/timing';
import { ArgCQArraySchema } from '@/lib/types/argument';

const Query = z.object({
  limit: z.coerce.number().int().positive().max(20).default(5),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = startTimer();
  const url = new URL(req.url);
  const parsed = Query.safeParse({ limit: url.searchParams.get('limit') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { limit } = parsed.data;

  const deliberationId = params.id;

  // Claims in this deliberation
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true, text: true },
  });
  const claimIds = claims.map(c => c.id);
  const textById = new Map(claims.map(c => [c.id, c.text]));

  // ---- Top by approvals / contested warrants from claim_stats (preferred) ----
  // If you haven't added the model, add it per the schema patch below.
  const stats = await prisma.claimStats.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { claimId: true, approvalsCount: true, undercutsCount: true },
  }).catch(() => [] as any[]);

  // Fallback if claim_stats not present: zero everything
  const approvalsBy = new Map<string, number>(stats.map(s => [s.claimId, s.approvalsCount ?? 0]));
  const undercutsBy = new Map<string, number>(stats.map(s => [s.claimId, s.undercutsCount ?? 0]));

  const topClaims = [...approvalsBy.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, approvals]) => ({ id, text: textById.get(id) ?? '', approvals }));

  const mostContestedWarrants = [...undercutsBy.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, undercuts]) => ({ id, text: textById.get(id) ?? '', undercuts }));

  // ---- Missing CQs per claim ----
  // Get attached scheme instances for these claims, and their scheme CQs
  const instances = await prisma.schemeInstance.findMany({
    where: { targetType: 'claim', targetId: { in: claimIds } },
    select: {
      targetId: true,
      scheme: { select: { key: true, cq: true } },
    },
  });

  // All CQ statuses for these claims
  const statuses = await prisma.cQStatus.findMany({
    where: { targetType: 'claim', targetId: { in: claimIds } },
    select: { targetId: true, schemeKey: true, cqKey: true, satisfied: true },
  });

  const statusMap = new Map<string, Map<string, Map<string, boolean>>>(); // claim -> scheme -> cq -> sat
  for (const s of statuses) {
    const byClaim = statusMap.get(s.targetId) ?? new Map();
    const byScheme = byClaim.get(s.schemeKey) ?? new Map();
    byScheme.set(s.cqKey, !!s.satisfied);
    byClaim.set(s.schemeKey, byScheme);
    statusMap.set(s.targetId, byClaim);
  }

  const missingAgg = new Map<string, { missing: number; byScheme: Array<{ schemeKey: string; missing: number; total: number }> }>();

  for (const inst of instances) {
    const claimId = inst.targetId;
    const schemeKey = inst.scheme?.key ?? 'scheme';
    const parsedCqs = ArgCQArraySchema.safeParse(inst.scheme?.cq ?? []);
    const cqs = parsedCqs.success ? parsedCqs.data : [];
    const total = cqs.length;
    const byScheme = statusMap.get(claimId)?.get(schemeKey) ?? new Map();

    let satisfied = 0;
    for (const cq of cqs) if (byScheme.get(cq.key)) satisfied += 1;
    const missing = Math.max(0, total - satisfied);

    if (!missingAgg.has(claimId)) missingAgg.set(claimId, { missing: 0, byScheme: [] });
    const entry = missingAgg.get(claimId)!;
    entry.missing += missing;
    entry.byScheme.push({ schemeKey, missing, total });
  }

  const missingCQs = [...missingAgg.entries()]
    .filter(([, v]) => v.missing > 0)
    .sort((a, b) => b[1].missing - a[1].missing)
    .slice(0, limit)
    .map(([claimId, v]) => ({
      id: claimId,
      text: textById.get(claimId) ?? '',
      missing: v.missing,
      byScheme: v.byScheme,
    }));

  const body = { topClaims, mostContestedWarrants, missingCQs };
  const res = NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  addServerTiming(res, [{ name: 'total', durMs: t() }]);
  return res;
}
