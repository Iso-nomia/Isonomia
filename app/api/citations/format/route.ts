export const dynamic = "force-dynamic";

// app/api/citations/format/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { formatCasualWeb, formatMLA } from '@/lib/citations/formatters';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const style = (url.searchParams.get('style') ?? 'casual') as 'casual'|'mla';
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
  if (!ids.length) return NextResponse.json({ items: [] });

  const rows = await prisma.source.findMany({ where: { id: { in: ids } }});
  const format = style === 'mla' ? formatMLA : formatCasualWeb;
  const items = rows.map(s => ({ id: s.id, text: format(s as any) }));
  return NextResponse.json({ items });
}
