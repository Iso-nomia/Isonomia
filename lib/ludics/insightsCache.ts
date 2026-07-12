import { getOrSet } from "@/lib/redis";
import { computeInsights, computeLocusInsights, type LudicsInsights } from "./computeInsights";

/**
 * Cache TTL for insights: 5 minutes
 * Phase 1: Task 1.6
 */
const INSIGHTS_CACHE_TTL = 300; // seconds

/**
 * Get insights with caching (5 min TTL)
 */
export async function getCachedInsights(
  deliberationId: string
): Promise<LudicsInsights | null> {
  const cacheKey = `ludics:insights:${deliberationId}`;
  
  try {
    return await getOrSet(cacheKey, INSIGHTS_CACHE_TTL, async () => {
      return await computeInsights(deliberationId);
    });
  } catch (error) {
    console.error("[ludics] Cache error, falling back to direct compute:", error);
    return await computeInsights(deliberationId);
  }
}

/**
 * Get locus-filtered insights with caching
 */
export async function getCachedLocusInsights(
  deliberationId: string,
  locusPath: string
): Promise<Partial<LudicsInsights> | null> {
  const cacheKey = `ludics:insights:${deliberationId}:${locusPath}`;
  
  try {
    return await getOrSet(cacheKey, INSIGHTS_CACHE_TTL, async () => {
      return await computeLocusInsights(deliberationId, locusPath);
    });
  } catch (error) {
    console.error("[ludics] Cache error, falling back to direct compute:", error);
    return await computeLocusInsights(deliberationId, locusPath);
  }
}

/**
 * Invalidate insights cache for a deliberation.
 * Call this after new dialogue moves.
 */
export async function invalidateInsightsCache(deliberationId: string): Promise<void> {
  try {
    const { getRedis } = await import("@/lib/redis");
    const redis = getRedis();
    if (!redis) return;

    // Delete main insights key
    await redis.del(`ludics:insights:${deliberationId}`);

    // Delete all locus-specific keys (pattern match)
    const keys = await redis.keys(`ludics:insights:${deliberationId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("[ludics] Failed to invalidate cache:", error);
  }
}
