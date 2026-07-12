// server/jobs/queues.ts
import { Queue } from 'bullmq';
export const decentraliseQueue = new Queue('decentralise', { connection: { url: process.env.REDIS_URL! } });
