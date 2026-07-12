export const dynamic = "force-dynamic";

// app/api/claims/[id]/cq/summary/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const claimId = params.id;
  const statuses = await prisma.cQStatus.findMany({
    where: { targetType: 'claim', targetId: claimId },
    select: { schemeKey: true, cqKey: true, satisfied: true },
  });
  const byScheme = new Map<string, { total: number; ok: number; open: string[] }>();
  for (const s of statuses) {
    const key = s.schemeKey;
    if (!byScheme.has(key)) byScheme.set(key, { total: 0, ok: 0, open: [] });
    const row = byScheme.get(key)!;
    row.total++;
    s.satisfied ? row.ok++ : row.open.push(s.cqKey);
  }
  const schemes = [...byScheme.entries()].map(([schemeKey, v]) => ({
    schemeKey, required: v.total, satisfied: v.ok, open: v.open
  }));
  const agg = schemes.reduce((a, s) => (a.required += s.required, a.satisfied += s.satisfied, a), { required:0, satisfied:0 });
  return NextResponse.json({ schemes, ...agg, completeness: agg.required ? agg.satisfied/agg.required : 0 });
}
