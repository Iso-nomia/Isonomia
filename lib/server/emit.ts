// lib/server/emit.ts
import { prisma } from '@/lib/prismaclient';
import ee from '@/lib/server/bus';

export async function emitDurable(e: {
  topic: string;
  roomId?: string; deliberationId?: string; targetType?: string; targetId?: string; payload?: any;
}) {
  // 1) insert outbox (same trx as your main write ideally)
  await prisma.agoraOutbox.create({ data: {
    topic: e.topic, roomId: e.roomId, deliberationId: e.deliberationId,
    targetType: e.targetType, targetId: e.targetId, payload: e.payload ?? {},
  }});
  // 2) best-effort in-process bus for immediate SSE
  ee.emit(e.topic, { type: e.topic, payload: e });
}
