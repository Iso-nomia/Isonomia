// lib/confidence/decayConfidence.ts

/**
 * Temporal confidence decay following exponential decay model.
 * 
 * Formula: decayed = base * exp(-lambda * days)
 * Where lambda = ln(2) / halfLife
 * 
 * Default halfLife = 90 days means confidence drops to 50% after 90 days.
 */

export interface DecayConfig {
  halfLife?: number; // Days until confidence drops to 50% (default: 90)
  minConfidence?: number; // Floor for decay (default: 0.1)
}

/**
 * Calculate exponential decay factor for confidence based on time elapsed.
 * 
 * @param daysSinceUpdate - Number of days since last update
 * @param config - Decay configuration
 * @returns Decay multiplier (0-1)
 */
export function calculateDecayFactor(
  daysSinceUpdate: number,
  config: DecayConfig = {}
): number {
  const { halfLife = 90, minConfidence = 0.1 } = config;

  if (daysSinceUpdate <= 0) {
    return 1.0; // No decay for same-day or future dates
  }

  // Lambda = ln(2) / halfLife
  const lambda = Math.log(2) / halfLife;

  // Exponential decay: exp(-lambda * days)
  const decayFactor = Math.exp(-lambda * daysSinceUpdate);

  // Apply floor to prevent confidence from going too low
  return Math.max(decayFactor, minConfidence);
}

/**
 * Apply temporal decay to a confidence value.
 * 
 * @param baseConfidence - Original confidence value (0-1)
 * @param lastUpdatedAt - Date of last update
 * @param config - Decay configuration
 * @returns Decayed confidence value
 */
export function decayConfidence(
  baseConfidence: number,
  lastUpdatedAt: Date,
  config: DecayConfig = {}
): number {
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);

  const decayFactor = calculateDecayFactor(daysSinceUpdate, config);
  const decayedConfidence = baseConfidence * decayFactor;

  // Clamp to [0, 1] range
  return Math.max(0, Math.min(1, decayedConfidence));
}

/**
 * Check if an argument is considered "stale" (needs refresh).
 * 
 * @param lastUpdatedAt - Date of last update
 * @param staleThresholdDays - Days after which argument is stale (default: 30)
 * @returns True if argument is stale
 */
export function isStale(
  lastUpdatedAt: Date,
  staleThresholdDays: number = 30
): boolean {
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate > staleThresholdDays;
}

/**
 * Calculate days since last update for display purposes.
 * 
 * @param lastUpdatedAt - Date of last update
 * @returns Number of days (rounded)
 */
export function daysSinceUpdate(lastUpdatedAt: Date): number {
  const now = new Date();
  const days = (now.getTime() - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(days);
}
