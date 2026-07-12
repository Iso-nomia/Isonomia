// server/jobs/copy/index.ts
import { CopyContext } from './types';
import { copyConversationDbRows } from './plan.conversation';
import { copyRealtimeDbRows } from './plan.realtime';
import { copyConversationMedia, copyRealtimeMedia } from './media';

export * from './types';



// DB dispatcher (already existed)
export async function copyRoomDb(ctx: CopyContext) {
  if (ctx.conversationId) return copyConversationDbRows(ctx);
  if (ctx.realtimeRoomId) return copyRealtimeDbRows(ctx);
  throw new Error('copyRoomDb: provide conversationId or realtimeRoomId');
}

// 📦 NEW: media dispatcher
export async function copyRoomMedia(ctx: CopyContext) {
  if (ctx.conversationId) return copyConversationMedia(ctx);
  if (ctx.realtimeRoomId) return copyRealtimeMedia(ctx);
  throw new Error('copyRoomMedia: provide conversationId or realtimeRoomId');
}

// (optional named exports if you want direct access)
export { copyConversationMedia, copyRealtimeMedia };
