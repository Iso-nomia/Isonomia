// app/api/evidentialdev/seed-rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_req: NextRequest) {
  // 1) Make a room
  const room = await prisma.agoraRoom.create({
    data: { slug: `seed-${Date.now()}`, title: 'Seed Room', summary: 'Dev seed' },
    select: { id: true, slug: true },
  });

  // 2) Call your existing evidential seeder (assumes it returns deliberationId)
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/evidentialdev/seed-evidential`, { method: 'POST' });
  const j = await r.json();
  const deliberationId = j?.deliberationId as string;

  // 3) Link debate → room
  if (deliberationId) {
    await prisma.deliberation.update({ where: { id: deliberationId }, data: { roomId: room.id } });
  }

  return NextResponse.json({
    ok: true, roomId: room.id, deliberationId,
    urls: deliberationId ? {
      sheet: `/api/sheets/delib:${deliberationId}`,
      evidential: `/api/deliberations/${deliberationId}/evidential?mode=product`,
      graph: `/api/deliberations/${deliberationId}/graph?semantics=preferred&confidence=0.6&mode=product`,
      roomDebates: `/api/agora/rooms/${room.id}/deliberations`,
    } : undefined
  }, { headers: { 'Cache-Control':'no-store' } });
}
