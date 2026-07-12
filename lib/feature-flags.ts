// lib/feature-flags.ts

/**
 * Feature Flags Configuration
 * 
 * This module provides centralized feature flag management for the Mesh application.
 * Feature flags enable gradual rollout of new features and A/B testing.
 * 
 * Usage:
 * ```typescript
 * import { featureFlags } from "@/lib/feature-flags";
 * 
 * if (featureFlags.ENABLE_MULTI_SCHEME) {
 *   // Use multi-scheme features
 * }
 * ```
 */

/**
 * Environment-based feature flags
 * These can be controlled via environment variables
 */
export const featureFlags = {
  /**
   * Enable multi-scheme arguments (Phase 1)
   * 
   * When enabled, arguments can use multiple argumentation schemes simultaneously.
   * Allows setting primary, supporting, presupposed, and implicit schemes with
   * different confidence levels and explicitness indicators.
   * 
   * Default: true (enabled by default for new feature rollout)
   * Environment: NEXT_PUBLIC_ENABLE_MULTI_SCHEME
   */
  ENABLE_MULTI_SCHEME: process.env.NEXT_PUBLIC_ENABLE_MULTI_SCHEME !== "false",

  /**
   * Enable ArgumentNet visualization (Phase 2)
   * 
   * When enabled, shows interactive visualizations of argument networks
   * with scheme dependencies and relationships.
   * 
   * Default: false (not yet implemented)
   * Environment: NEXT_PUBLIC_ENABLE_ARGUMENT_NET
   */
  ENABLE_ARGUMENT_NET: process.env.NEXT_PUBLIC_ENABLE_ARGUMENT_NET !== "false",

  /**
   * Enable scheme pattern suggestions (Phase 3)
   * 
   * When enabled, suggests common scheme combinations based on historical patterns.
   * Uses SchemeNetPattern data for intelligent recommendations.
   * 
   * Default: false (not yet implemented)
   * Environment: NEXT_PUBLIC_ENABLE_SCHEME_PATTERNS
   */
  ENABLE_SCHEME_PATTERNS: process.env.NEXT_PUBLIC_ENABLE_SCHEME_PATTERNS === "true",
} as const;

/**
 * User-level feature flag overrides
 * These can be used for per-user feature enablement (future enhancement)
 */
export interface UserFeatureFlags {
  userId: string;
  enabledFeatures: Set<keyof typeof featureFlags>;
}

/**
 * Check if a feature is enabled for the current environment
 * 
 * @param feature - The feature flag to check
 * @returns true if the feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature];
}

/**
 * Get all enabled features
 * 
 * @returns Array of enabled feature names
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);
}

/**
 * Feature flag metadata for documentation and debugging
 */
export const featureFlagMetadata = {
  ENABLE_MULTI_SCHEME: {
    name: "Multi-Scheme Arguments",
    description: "Allow arguments to use multiple argumentation schemes",
    phase: "Phase 1",
    status: "in-development",
    rolloutDate: "2024-01",
  },
  ENABLE_ARGUMENT_NET: {
    name: "ArgumentNet Visualization",
    description: "Interactive argument network visualizations",
    phase: "Phase 2",
    status: "planned",
    rolloutDate: "TBD",
  },
  ENABLE_SCHEME_PATTERNS: {
    name: "Scheme Pattern Suggestions",
    description: "AI-powered scheme combination suggestions",
    phase: "Phase 3",
    status: "planned",
    rolloutDate: "TBD",
  },
} as const;

/**
 * Development helper: Log all feature flags
 * Only runs in development mode
 */
if (process.env.NODE_ENV === "development") {
  console.log("[Feature Flags]", {
    enabled: getEnabledFeatures(),
    all: featureFlags,
  });
}
