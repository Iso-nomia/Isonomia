export const dynamic = "force-dynamic";

// API route to fetch multiple arguments by IDs with optional deliberation filter
// app/api/arguments/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const deliberationId = url.searchParams.get('deliberationId') ?? undefined;

  if (!ids.length) return NextResponse.json({ items: [] });

  const rows = await prisma.argument.findMany({
    where: { id: { in: ids }, ...(deliberationId ? { deliberationId } : {}) },
    include: {
      outgoingEdges: {
        where: { type: { in: ['rebut', 'undercut'] } },
        select: { type: true, targetScope: true },
      },
      claim: { select: { id: true } },
    },
  });

  const byId = new Map(rows.map(r => [r.id, r]));
  const items = ids.map(id => {
    const r = byId.get(id);
    return r ? {
      id: r.id,
      text: r.text,
      claimId: r.claim?.id ?? null,
      edgesOut: (r.outgoingEdges ?? []).map(e => ({
        type: e.type as 'rebut'|'undercut',
        targetScope: e.targetScope ?? undefined,
      })),
    } : { id, text: '', claimId: null, edgesOut: [] };
  });

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
