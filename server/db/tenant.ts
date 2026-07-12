// server/db/tenant.ts
import { PrismaClient } from '@prisma/client';
import { LRUCache as LRU } from 'lru-cache';
import { getRoomById } from '@/server/rooms/dao';

type Entry = { prisma: PrismaClient; url: string; lastUsed: number };
const cache = new LRU<string, Entry>({ max: 500, ttl: 5 * 60 * 1000 }); // 5 min TTL

let globalPrisma: PrismaClient | null = null;
export function getGlobalPrisma() {
  if (!globalPrisma) globalPrisma = new PrismaClient();
  return globalPrisma;
}

/**
 * Returns a prisma client for the given room.
 * Falls back to the global client if not sharded.
 */
export async function getPrismaForRoom(roomId: string) {
  const room = await getRoomById(roomId);
  if (!room?.isSharded || !room.shardUrl) return getGlobalPrisma();

  const key = `${roomId}:${room.shardUrl}`;
  const existing = cache.get(key);
  if (existing) { existing.lastUsed = Date.now(); return existing.prisma; }

  const client = new PrismaClient({ datasources: { db: { url: room.shardUrl } } });
  cache.set(key, { prisma: client, url: room.shardUrl, lastUsed: Date.now() });
  return client;
}
