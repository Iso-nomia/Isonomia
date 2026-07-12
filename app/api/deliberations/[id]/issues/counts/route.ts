export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/issues/counts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const url = new URL(req.url);

  // Back-compat: ?argumentIds=a,b,c
  const legacy = (url.searchParams.get('argumentIds') ?? '').trim();
  const scope = (url.searchParams.get('scope') ?? (legacy ? 'argument' : 'argument')) as 'argument'|'claim'|'card'|'inference';
  const ids = (legacy || url.searchParams.get('ids') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!ids.length) return NextResponse.json({ ok: true, counts: {} });


  // Direct polymorphic counts helper
  async function directCounts(t: 'claim'|'card'|'inference') {
    const rows = await prisma.issueLink.groupBy({
      by: ['targetId'],
      where: { targetType: t, targetId: { in: ids }, issue: { deliberationId, state: 'open' } },
      _count: { targetId: true },
    });
    const out: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
    for (const r of rows) out[r.targetId] = r._count.targetId;
    return out;
  }

  // Map target ids -> argument ids used in issueLink
  let argIds = ids;

  if (scope === 'claim') {
    // (A) direct claim links
    const direct = await directCounts('claim');
    // (B) legacy via arguments
    const rows = await prisma.argument.findMany({
      where: { deliberationId, claimId: { in: ids } },
      select: { id: true, claimId: true },
    });
    const byClaim = new Map<string, string[]>();
    for (const r of rows) {
      if (!byClaim.has(r.claimId!)) byClaim.set(r.claimId!, []);
      byClaim.get(r.claimId!)!.push(r.id);
    }
    // Replace ids with a synthetic list per claim (we'll aggregate to claim later)
    const allArgIds = rows.map(r => r.id);
    if (!allArgIds.length) return NextResponse.json({ ok:true, counts: Object.fromEntries(ids.map(id=>[id,0])) });
    argIds = allArgIds;

    const links = await prisma.issueLink.groupBy({
      by: ['argumentId'],
      where: { issue: { deliberationId, state: 'open' }, argumentId: { in: argIds } },
      _count: { argumentId: true },
    });

    const counts: Record<string, number> = {};
    for (const claimId of ids) {
      const set = new Set(byClaim.get(claimId) ?? []);
      let n = 0;
      for (const g of links) if (g.argumentId && set.has(g.argumentId)) n += g._count.argumentId;
      counts[claimId] = n + (direct[claimId] ?? 0);
    }
    return NextResponse.json({ ok: true, counts });
  }

  if (scope === 'card') {
    // (A) direct card links
    const direct = await directCounts('card');
    // (B) legacy via card.claimId -> arguments
    const cards = await prisma.deliberationCard.findMany({
      where: { deliberationId, id: { in: ids } },
      select: { id: true, claimId: true },
    });
    const claimIds = cards.map(c => c.claimId).filter(Boolean) as string[];
    if (!claimIds.length) return NextResponse.json({ ok:true, counts: Object.fromEntries(ids.map(id=>[id,0])) });
    const args = await prisma.argument.findMany({
      where: { deliberationId, claimId: { in: claimIds } },
      select: { id: true, claimId: true },
    });
    const byClaim = new Map<string, string[]>();
    for (const r of args) {
      if (!byClaim.has(r.claimId!)) byClaim.set(r.claimId!, []);
      byClaim.get(r.claimId!)!.push(r.id);
    }
    const links = await prisma.issueLink.groupBy({
      by: ['argumentId'],
      where: { issue: { deliberationId, state: 'open' }, argumentId: { in: args.map(a=>a.id) } },
      _count: { argumentId: true },
    });
    const counts: Record<string, number> = {};
    for (const c of cards) {
      const set = new Set(byClaim.get(c.claimId!) ?? []);
      let n = 0;
      for (const g of links) if (g.argumentId && set.has(g.argumentId)) n += g._count.argumentId;
      counts[c.id] = n + (direct[c.id] ?? 0);
    }
    return NextResponse.json({ ok: true, counts });
  }
   if (scope === 'inference') {
    const counts = await directCounts('inference');
    return NextResponse.json({ ok: true, counts });
  }
  // scope === 'argument'
  const links = await prisma.issueLink.groupBy({
    by: ['argumentId'],
    where: { issue: { deliberationId, state: 'open' }, argumentId: { in: argIds } },
    _count: { argumentId: true },
  });

  const counts: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  for (const g of links) if (g.argumentId) counts[g.argumentId] = g._count.argumentId;

  return NextResponse.json({ ok: true, counts });
}
