export const dynamic = "force-dynamic";

// app/api/arguments/[id]/ca/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
export async function GET(_req: Request, { params }: { params:{ id:string } }) {
  const items = await prisma.conflictApplication.findMany({
    where: { OR: [{ conflictingArgumentId: params.id }, { conflictedArgumentId: params.id }] },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ ok:true, items }, { headers: { 'Cache-Control':'no-store' } });
}

