// app/api/rooms/[id]/decentralise/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { decentraliseQueue } from '@/server/jobs/queues';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // TODO: authz check: ensure requester is room admin
  const body = await req.json();
  const { region = process.env.AWS_REGION || 'us-east-1', kind, conversationId, realtimeRoomId, sourceBucket = process.env.GLOBAL_MEDIA_BUCKET } = body;
  if (!kind || (kind !== 'CONVERSATION' && kind !== 'REALTIME')) {
    return NextResponse.json({ error: 'kind must be CONVERSATION or REALTIME' }, { status: 400 });
  }

  // Ensure room exists
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const job = await decentraliseQueue.add('copy', {
    roomId: params.id,
    kind,
    conversationId,
    realtimeRoomId,
    region,
    sourceBucket
  }, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } });

  return NextResponse.json({ jobId: job.id });
}
