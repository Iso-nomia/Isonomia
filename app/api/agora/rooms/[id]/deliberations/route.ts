// app/api/agora/rooms/[id]/deliberations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import {
  listableDeliberationWhere,
  normalizeUserId,
} from '@/lib/deliberations/visibility';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const roomId = params.id;
  const exist = await prisma.agoraRoom.findUnique({ where: { id: roomId }, select: { id: true } });
  if (!exist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));

  // Visibility: only list public deliberations (plus the viewer's own).
  const debates = await prisma.deliberation.findMany({
    where: { AND: [{ agoraRoomId: roomId }, listableDeliberationWhere(userId)] },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    items: debates.map(d => ({
      id: d.id,
      title: d.title ?? `debate:${d.id.slice(0,18)}…`,
      updatedAt: d.updatedAt,
      // A synthetic sheet is always available:
      syntheticSheetId: `delib:${d.id}`,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
