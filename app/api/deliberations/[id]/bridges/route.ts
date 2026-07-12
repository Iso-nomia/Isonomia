export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/bridges/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { suggestBridges } from '@/lib/topology/bridgeSuggest';
import { getCurrentUserId } from '@/lib/serverutils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rows = await prisma.bridgeRequest.findMany({
    where: { deliberationId: params.id, status: 'open' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, targetClusterId: true, status: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const gaps = await suggestBridges(params.id);
    const created: string[] = [];
    for (const g of gaps) {
      const exist = await prisma.bridgeRequest.findFirst({
        where: { deliberationId: params.id, targetClusterId: g.aId, status: 'open' },
        select: { id: true }
      });
      if (exist) continue;
      const br = await prisma.bridgeRequest.create({
        data: {
          deliberationId: params.id,
          requestedById: String(uid),
          targetClusterId: g.aId,
          status: 'open',
          expiresAt: new Date(Date.now() + 7*24*3600*1000),
        },
      });
      created.push(br.id);
    }
    return NextResponse.json({ ok: true, created });
  } catch (e:any) {
    console.error('[bridges] failed', e);
    return NextResponse.json({ ok:false, error: e?.message ?? 'failed' }, { status: 500 });
  }
}