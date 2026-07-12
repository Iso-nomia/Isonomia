import { Queue } from "bullmq";
import redis from "./redis";
import IORedis from 'ioredis';
import { getRedis } from "./redis";
export const runtime = 'nodejs';        // <-- prevents Edge bundling if imported elsewhere

// const res = await fetch(
//   `${process.env.UPSTASH_REDIS_REST_URL}/get/foo`,
//   { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
// );
const redisUrl = process.env.UPSTASH_REDIS_URL!;
if (!redisUrl) {
  throw new Error('UPSTASH_REDIS_URL missing – set it in Vercel & .env.local');
}
export const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

//const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
export const reembedQueue       = new Queue('reembed',       { connection });

// Phase 3.1: Source Trust Infrastructure queues
export const sourceVerificationQueue = new Queue('source-verification', { connection });
export const sourceArchivingQueue = new Queue('source-archiving', { connection });

// Phase 3.3: Cross-Platform Intelligence queues
export const sourceUsageQueue = new Queue('source-usage', { connection });

// Phase 3.4: Discovery & Exploration queues
export const knowledgeGraphQueue = new Queue('knowledge-graph', { connection });

// Deferred Ludics Compile (roadmap Design A): debounced background recompile of
// a deliberation's derived Ludics/AIF view after MCP dialogue moves (which are
// record-only). Enqueued fire-and-forget from the routes' MCP branch via
// lib/ludics/compileQueue.ts; drained by workers/ludics/compileWorker.ts.
export const ludicsCompileQueue = new Queue('ludics-compile', { connection });


/** one reusable ioredis connection */
