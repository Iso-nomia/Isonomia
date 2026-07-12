import { PrismaClient } from '@prisma/client';
export type CopyContext = {
  prisma: PrismaClient;
  targetSchema: string;
  roomId: string;
  region: string;
  sourceBucket: string;
  targetBucket: string;
  kmsKeyArn: string;
  conversationId?: bigint;
  realtimeRoomId?: string;
};
export type CopyStep = (ctx: CopyContext) => Promise<void>;
export function qident(name: string) { return `"${name.replace(/"/g,'""')}"`; }
