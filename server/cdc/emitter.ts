// server/cdc/emitter.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL!);

export type CdcEvent =
  | { type: 'message.created'; roomId: string; id: string; ts: number }
  | { type: 'reaction.added'; roomId: string; id: string; ts: number };

export async function emitCdc(e: CdcEvent) {
  await redis.xadd('cdc:events', '*', 'type', e.type, 'roomId', e.roomId, 'id', e.id, 'ts', String(e.ts));
}
