export const dynamic = "force-dynamic";

// app/api/claims/[id]/ca/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
export async function GET(_req: Request, { params }: { params:{ id:string } }) {
  const items = await prisma.conflictApplication.findMany({
    where: { OR: [{ conflictingClaimId: params.id }, { conflictedClaimId: params.id }] },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ ok:true, items }, { headers: { 'Cache-Control':'no-store' } });
}
