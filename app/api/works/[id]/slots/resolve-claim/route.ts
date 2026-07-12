// app/api/works/[id]/slots/resolve-claim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }:{ params:{ id:string }}) {
  const slotKey = req.nextUrl.searchParams.get('slotKey') || '';
  if (!slotKey) return NextResponse.json({ ok:false, error:'slotKey_required' }, { status:400 });

  const uri = `/works/${params.id}#slot=${slotKey}`;

  // Find a claimCitation we created on promote pointing back to this slot
  const cite = await prisma.claimCitation.findFirst({
    where: { uri },
    select: { claimId: true },
    orderBy: { id: 'asc' }
  });

  return NextResponse.json({ ok:true, claimId: cite?.claimId ?? null });
}
