import Redis from "ioredis";
import { getRedis } from "@/lib/redis";

const redis = getRedis();



//const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
export const TTL_SECONDS = 86400;

export async function getCached(key: string): Promise<string | null> {
  if (redis) {

  return redis.get(key);
  }
  else
  {
    return null;
  }
}

export async function setCached(key: string, value: string): Promise<void> {
  if (redis) {

  await redis.set(key, value, "EX", 86400);
  }
}

export default redis;
