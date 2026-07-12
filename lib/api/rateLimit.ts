/**
 * API Rate Limiting
 *
 * Redis-based sliding window rate limiting for the public API.
 * Supports different tiers with configurable limits.
 *
 * @module lib/api/rateLimit
 */

import { Redis } from "@upstash/redis";
import { ApiKeyTier } from "@prisma/client";

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate limit configuration per tier
 */
export const TIER_LIMITS: Record<ApiKeyTier, { requests: number; window: number }> = {
  free: { requests: 100, window: 3600 },       // 100 requests per hour
  pro: { requests: 1000, window: 3600 },       // 1,000 requests per hour
  partner: { requests: 10000, window: 3600 },  // 10,000 requests per hour
  unlimited: { requests: Infinity, window: 3600 }, // No limit
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;      // Unix timestamp when the window resets
  retryAfter?: number; // Seconds until retry (only if not allowed)
}

/**
 * Check rate limit for an API key
 */
export async function checkRateLimit(
  keyId: string,
  tier: ApiKeyTier,
  customLimit?: number | null
): Promise<RateLimitResult> {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const maxRequests = customLimit || limits.requests;

  // Unlimited tier bypasses all checks
  if (maxRequests === Infinity) {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % limits.window);
  const key = `ratelimit:api:${keyId}:${windowStart}`;

  try {
    // Increment counter for this window
    const current = await redis.incr(key);

    // Set TTL on first request in window
    if (current === 1) {
      await redis.expire(key, limits.window);
    }

    const remaining = Math.max(0, maxRequests - current);
    const reset = windowStart + limits.window;

    if (current > maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        reset,
        retryAfter: reset - now,
      };
    }

    return {
      allowed: true,
      limit: maxRequests,
      remaining,
      reset,
    };
  } catch (error) {
    // If Redis is unavailable, allow the request but log the error
    console.error("[RateLimit] Redis error:", error);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: now + limits.window,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  keyId: string,
  tier: ApiKeyTier,
  customLimit?: number | null
): Promise<RateLimitResult> {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const maxRequests = customLimit || limits.requests;

  if (maxRequests === Infinity) {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % limits.window);
  const key = `ratelimit:api:${keyId}:${windowStart}`;

  try {
    const current = (await redis.get<number>(key)) || 0;
    const remaining = Math.max(0, maxRequests - current);
    const reset = windowStart + limits.window;

    return {
      allowed: current < maxRequests,
      limit: maxRequests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error("[RateLimit] Redis error:", error);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: now + limits.window,
    };
  }
}

/**
 * Reset rate limit for an API key (admin use)
 */
export async function resetRateLimit(keyId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Delete keys for all possible windows in the last hour
  const keys = [];
  for (let i = 0; i < 2; i++) {
    const windowStart = now - (now % 3600) - i * 3600;
    keys.push(`ratelimit:api:${keyId}:${windowStart}`);
  }

  try {
    await redis.del(...keys);
  } catch (error) {
    console.error("[RateLimit] Failed to reset:", error);
  }
}

/**
 * Build rate limit headers for API responses
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit === Infinity ? "unlimited" : result.limit),
    "X-RateLimit-Remaining": String(result.remaining === Infinity ? "unlimited" : result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };

  if (result.retryAfter !== undefined) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}
