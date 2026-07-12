// app/api/agora/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import {
  listableDeliberationWhere,
  normalizeUserId,
} from '@/lib/deliberations/visibility';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));

  const rooms = await prisma.agoraRoom.findMany({
    select: { id: true, slug: true, title: true, summary: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  // Visibility: per-room deliberation counts exclude non-public deliberations
  // the viewer is not a member of, so counts don't leak hidden activity.
  const counts = await prisma.deliberation.groupBy({
    by: ['agoraRoomId'],
    _count: { agoraRoomId: true },
    where: {
      AND: [
        { agoraRoomId: { in: rooms.map(r => r.id) } },
        listableDeliberationWhere(userId),
      ],
    },
  });

  const countBy = new Map(counts.map(c => [c.agoraRoomId!, c._count.agoraRoomId]));
  return NextResponse.json({
    items: rooms.map(r => ({
      ...r,
      nDeliberations: countBy.get(r.id) ?? 0,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
