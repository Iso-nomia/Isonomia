import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const sheets = await prisma.debateSheet.findMany({
    select: { id:true, title:true, createdAt:true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return NextResponse.json({ items: sheets }, { headers: { 'Cache-Control':'no-store' }});
}
