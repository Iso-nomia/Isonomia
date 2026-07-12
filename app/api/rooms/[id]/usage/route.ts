// app/api/rooms/[id]/usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { measureRoom } from '@/server/jobs/usageMeter';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room?.mediaBucket) return NextResponse.json({ error: 'Room not found or not sharded' }, { status: 404 });
  const usage = await measureRoom(prisma, room.id, room.mediaBucket, process.env.AWS_REGION || 'us-east-1');
  return NextResponse.json({ roomId: room.id, ...usage });
}
