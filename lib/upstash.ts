/**
 * lib/upstash.ts
 *
 * Shared singleton for the Upstash Redis REST client.
 *
 * Why a separate file from `lib/redis.ts`?
 *   - `lib/redis.ts` exports a TCP `ioredis` connection used by BullMQ workers
 *     (long-lived process, node runtime only).
 *   - This file exports the HTTP REST client from `@upstash/redis`, which is
 *     safe in Edge / serverless route handlers and is the substrate for
 *     `@upstash/ratelimit`.
 *
 * Both clients hit the same underlying Upstash database — they just use
 * different transport (TCP vs HTTPS REST). Key prefixes keep workloads
 * separated:
 *   - `bullmq:*`    → queues (ioredis, lib/redis.ts → lib/queue.ts)
 *   - `rl:*`        → rate limiters (this file → lib/rateLimit.ts)
 *   - `fp:*`        → fingerprint L2 cache (B12, v2)
 *   - `cache:*`     → generic getOrSet (lib/redis.ts)
 *
 * Required env (already present in .env.example):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
import { Redis } from "@upstash/redis";

declare global {
  // eslint-disable-next-line no-var
  var __upstashRedis: Redis | undefined;
}

function build(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash REST credentials missing. Set UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN in your environment (see .env.example).",
    );
  }
  return new Redis({ url, token });
}

/**
 * Cached `@upstash/redis` REST client. Safe to call from route handlers and
 * Edge runtimes. Reuses one instance per Node process / Edge isolate.
 */
export function getUpstashRedis(): Redis {
  if (!globalThis.__upstashRedis) {
    globalThis.__upstashRedis = build();
  }
  return globalThis.__upstashRedis;
}

/**
 * Returns the REST client when credentials are configured, otherwise `null`.
 * Use this in code paths that must degrade gracefully in dev / CI without
 * Upstash (the simple `rateLimit` helper in `lib/rateLimit.ts` uses this).
 */
export function tryGetUpstashRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return getUpstashRedis();
}
