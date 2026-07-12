// server/rooms/dao.ts
import { PrismaClient, RoomKind } from '@prisma/client';
const prisma = new PrismaClient();

export async function getRoomById(id: string) {
  return prisma.room.findUnique({ where: { id } });
}

export async function getRoomByConversationId(conversationId: bigint) {
  return prisma.room.findUnique({ where: { conversation_id: conversationId } });
}

export async function getRoomByRealtimeRoomId(realtimeRoomId: string) {
  return prisma.room.findUnique({ where: { realtime_room_id: realtimeRoomId } });
}

export async function upsertRoomForConversation(conversationId: bigint) {
  return prisma.room.upsert({
    where: { conversation_id: conversationId },
    update: {},
    create: { kind: RoomKind.CONVERSATION, conversation_id: conversationId }
  });
}

export async function upsertRoomForRealtime(realtimeRoomId: string) {
  return prisma.room.upsert({
    where: { realtime_room_id: realtimeRoomId },
    update: {},
    create: { kind: RoomKind.REALTIME, realtime_room_id: realtimeRoomId }
  });
}
