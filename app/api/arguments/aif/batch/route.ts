// app/api/arguments/aif/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { TargetType } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const ids = (u.searchParams.get('ids') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!ids.length) return NextResponse.json({ items: [] }, NO_STORE);

  // Base rows
  const args = await prisma.argument.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, deliberationId: true, authorId: true, createdAt: true, text: true, mediaType: true,
      schemeId: true, conclusionClaimId: true, implicitWarrant: true,
      premises: { select: { claimId: true, isImplicit: true } },
    },
  });
  const byId = new Map(args.map(a => [a.id, a]));

  const schemeIds = Array.from(new Set(args.map(a => a.schemeId).filter(Boolean) as string[]));
  const claimIds = Array.from(new Set(args.flatMap(a => [
    ...(a.conclusionClaimId ? [a.conclusionClaimId] : []),
    ...a.premises.map(p => p.claimId),
  ])));

  const [schemes, claims, atkCounts, cqAll] = await Promise.all([
    schemeIds.length
      ? prisma.argumentScheme.findMany({
          where: { id: { in: schemeIds } },
          select: { id: true, key: true, name: true, slotHints: true, cqs: { select: { cqKey: true } } },
        })
      : Promise.resolve([]),
    claimIds.length
      ? prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id: true, text: true } })
      : Promise.resolve([]),
    prisma.argumentEdge.groupBy({
      by: ['toArgumentId','attackType'],
      where: { toArgumentId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.cQStatus.findMany({
      where: {
        OR: [
          { argumentId: { in: ids } },
          { targetType: 'argument' as TargetType, targetId: { in: ids } },
        ],
      },
      select: { argumentId: true, targetId: true, cqKey: true, status: true },
    }),
  ]);

  const schemeById = new Map(schemes.map(s => [s.id, s]));
  const textById = new Map(claims.map(c => [c.id, c.text ?? '']));
  const atkBy = new Map<string, { REBUTS: number; UNDERCUTS: number; UNDERMINES: number }>();
  for (const g of atkCounts) {
    const id = g.toArgumentId as string;
    const t = String(g.attackType || '').toUpperCase() as 'REBUTS'|'UNDERCUTS'|'UNDERMINES';
    const bucket = atkBy.get(id) ?? { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
    bucket[t] += g._count._all;
    atkBy.set(id, bucket);
  }
  const satisfiedBy = new Map<string, number>();
  for (const s of cqAll) {
    const id = (s as any).argumentId ?? (s as any).targetId;
    if (!id || s.status !== 'answered' || !s.cqKey) continue;
    const key = `${id}:${s.cqKey}`;
    // de-dup by cqKey per arg
    if (!(satisfiedBy as any)[key]) {
      satisfiedBy.set(id, (satisfiedBy.get(id) ?? 0) + 1);
      (satisfiedBy as any)[key] = true;
    }
  }

  const items = ids.map(id => {
    const a = byId.get(id);
    if (!a) return { id }; // keep order; nonexistent ids get a stub
    const scheme = a.schemeId ? schemeById.get(a.schemeId) : null;
    const required = scheme?.cqs?.length ?? 0;
    const satisfied = satisfiedBy.get(a.id) ?? 0;
    return {
      id: a.id,
      deliberationId: a.deliberationId,
      authorId: a.authorId,
      createdAt: a.createdAt.toISOString(),
      text: a.text,
      mediaType: a.mediaType,
      aif: {
        scheme: scheme ? { id: scheme.id, key: scheme.key, name: scheme.name, slotHints: scheme.slotHints ?? null } : null,
        conclusion: a.conclusionClaimId ? { id: a.conclusionClaimId, text: textById.get(a.conclusionClaimId) ?? '' } : null,
        premises: a.premises.map(p => ({ id: p.claimId, text: textById.get(p.claimId) ?? '', isImplicit: p.isImplicit ?? false })),
        implicitWarrant: (a.implicitWarrant as any) ?? null,
        attacks: atkBy.get(a.id) ?? { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 },
        cq: { required, satisfied },
      },
    };
  });

  return NextResponse.json({ items }, NO_STORE);
}
