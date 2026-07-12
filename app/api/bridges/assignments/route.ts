export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId_required' }, { status: 400 });

  const rows = await prisma.bridgeAssignment.findMany({
    where: { assigneeId: userId, completedAt: null },
    include: { request: true },
    orderBy: { assignedAt: 'desc' },
  });

  return NextResponse.json({ assignments: rows });
}
