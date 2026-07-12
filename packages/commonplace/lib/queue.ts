import { Queue } from "bullmq";
import IORedis from "ioredis";

export function createConnection(redisUrl: string) {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function createQueue(name: string, connection: IORedis) {
  return new Queue(name, { connection });
}
