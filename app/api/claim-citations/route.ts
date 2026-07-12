import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('claimIds') ?? '')
    .split(',').map(s=>s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ ok:true, citations: [] });

  const rows = await prisma.claimCitation.findMany({
    where: { claimId: { in: ids } },
    select: { claimId:true, uri:true },
  });

  // compress: claimId -> [uris...]
  const map = rows.reduce<Record<string,string[]>>((acc, r) => {
    acc[r.claimId] ||= [];
    acc[r.claimId].push(r.uri);
    return acc;
  }, {});
  return NextResponse.json({ ok:true, citations: map });
}
