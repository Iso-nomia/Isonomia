import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

// Disable Redis in local dev if REDIS_URL is not set
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : null as any; // Will cause getOrSet to skip redis operations

const memory = new Map<string, string>();

export function setSyncStatus(userId: number, status: string) {
  return redis.set(`fav:sync:${userId}`, status);
}

export async function getOrSet<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  // Use in-memory cache in test or when Redis is unavailable
  if (process.env.NODE_ENV === "test" || !redis) {
    const cached = memory.get(key);
    if (cached) return JSON.parse(cached) as T;
    const result = await fn();
    memory.set(key, JSON.stringify(result));
    return result;
  }
  
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;
  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}

export function getRedis() {
  // Skip redis entirely at build-time or when env vars are missing
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    if (!process.env.REDIS_HOST) return null;   // change to your var names
  }
  if (!process.env.REDIS_HOST) return null;

  // cache the instance so you don’t create many
  globalThis._redis ??= new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASS,
  });
  return globalThis._redis as Redis;
}

export default redis;
