export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const rows = await prisma.roomLogbook.findMany({
    where: { roomId: params.roomId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
  return NextResponse.json({ entries: rows });
}
