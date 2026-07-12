// app/api/sheets/by-deliberation/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const items = await prisma.debateSheet.findMany({
    where: { deliberationId },
    select: { id: true, title: true, createdAt: true, rulesetJson: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
