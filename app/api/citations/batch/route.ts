export const dynamic = "force-dynamic";

// app/api/citations/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetType = (url.searchParams.get('targetType') || '').trim();
  const ids = (url.searchParams.get('targetIds') || '')
    .split(',').map(s=>s.trim()).filter(Boolean);
  if (!targetType || !ids.length) return NextResponse.json({ items: [] });

  const rows = await prisma.citation.findMany({
    where: { targetType, targetId: { in: ids } },
    orderBy: { createdAt: 'asc' },
    include: { source: true },
  });

  const items = rows.map(r => ({
    id: r.id,
    targetId: r.targetId,
    locator: r.locator,
    quote: r.quote,
    note: r.note,
    relevance: r.relevance,
    createdAt: r.createdAt.toISOString(),
    source: r.source,
  }));
  return NextResponse.json({ items });
}

