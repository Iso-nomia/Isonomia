export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const idsRaw = url.searchParams.get('ids') || '';
  const ids = [...new Set(idsRaw.split(',').map(decodeURIComponent).map(s => s.trim()).filter(Boolean))];
  if (!ids.length) return NextResponse.json({ claims: [] });

  const claims = await prisma.claim.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      text: true,
      _count: {
        select: {
          arguments: true,
        },
      },
    },
  });

  // Fetch top argument + scheme for each claim
  const claimData = await Promise.all(
    claims.map(async (claim) => {
      const topArg = await prisma.argument.findFirst({
        where: { claimId: claim.id },
        select: {
          id: true,
          schemeId: true,
          scheme: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Count attacks on arguments related to this claim
      const attackCounts = await prisma.argumentEdge.groupBy({
        by: ['attackType'],
        where: {
          toArgumentId: topArg?.id,
        },
        _count: { _all: true },
      });

      const attacks = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
      for (const g of attackCounts) {
        const k = String(g.attackType || '').toUpperCase() as keyof typeof attacks;
        if (k in attacks) attacks[k] += g._count._all;
      }

      return {
        ...claim,
        topArgumentId: topArg?.id ?? null,
        scheme: topArg?.scheme ?? null,
        attacks,
      };
    })
  );

  // keep client-friendly order (as requested), fall back to found set
  const byId = new Map(claimData.map(c => [c.id, c]));
  const items = ids.map(id => byId.get(id)).filter(Boolean);
  
  return NextResponse.json({ claims: items }, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=20, stale-while-revalidate=60' }
  });
}
