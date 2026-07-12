/**
 * Feature Flags for Deliberation Panel V3 Migration
 * 
 * Strategy: Incremental rollout with instant rollback capability
 * Each flag controls a specific refactored component or feature
 */

export const DELIBERATION_FEATURES = {
  // Main V3 panel toggle (future use)
  USE_V3_PANEL: false,
  
  // Component extraction flags (Week 1-2)
  USE_EXTRACTED_SECTION_CARD: false,
  USE_EXTRACTED_STICKY_HEADER: false,
  USE_EXTRACTED_CHIP_BAR: false,
  
  // Nested tabs architecture (Week 2)
  USE_NESTED_TABS: false,
  
  // Hook extraction flags (Week 3)
  USE_EXTRACTED_HOOKS: false,
  
  // Tab extraction flags (Week 4-5)
  USE_EXTRACTED_DEBATE_TAB: false,
  USE_EXTRACTED_ARGUMENTS_TAB: false,
  USE_EXTRACTED_DIALOGUE_TAB: false,
  
  // Phase 1-4 integration flags (Week 8-9)
  SHOW_SCHEME_INDICATORS: true,      // Already working from Phase 1
  ENABLE_NET_ANALYZER: true,         // Already working from Phase 4
  SHOW_SCHEME_BADGES: false,         // New: badges on argument cards
  ENABLE_ANALYZE_NET_BUTTON: false,  // New: "Analyze Net" button
  
  // Performance optimizations (Week 6-7)
  ENABLE_CODE_SPLITTING: false,
  ENABLE_LIST_VIRTUALIZATION: false,
  
  // New features (Week 8+)
  ENABLE_SMART_SIDEBAR: false,
  ENABLE_ACTIVITY_STREAM: false,
} as const;

export type DeliberationFeatureFlag = keyof typeof DELIBERATION_FEATURES;

/**
 * Check if a feature flag is enabled
 * Priority: 1. Environment variable, 2. Default value
 */
export function isFeatureEnabled(flag: DeliberationFeatureFlag): boolean {
  // Check environment variable (allows runtime override)
  if (typeof window !== "undefined") {
    // Client-side: Check window object for runtime overrides (debugging)
    const windowFlag = (window as any).__MESH_FEATURES__?.[flag];
    if (windowFlag !== undefined) {
      return windowFlag === true;
    }
  }
  
  // Server-side or default: Check process.env
  const envFlag = process.env[`NEXT_PUBLIC_FEATURE_${flag}`];
  if (envFlag !== undefined) {
    return envFlag === "true" || envFlag === "1";
  }
  
  // Fall back to default
  return DELIBERATION_FEATURES[flag];
}

/**
 * Get all enabled features (for debugging)
 */
export function getEnabledFeatures(): DeliberationFeatureFlag[] {
  return (Object.keys(DELIBERATION_FEATURES) as DeliberationFeatureFlag[])
    .filter(flag => isFeatureEnabled(flag));
}

/**
 * Runtime feature toggle (for debugging in browser console)
 * Usage: window.toggleFeature('USE_NESTED_TABS', true)
 */
if (typeof window !== "undefined") {
  (window as any).__MESH_FEATURES__ = {};
  (window as any).toggleFeature = (flag: DeliberationFeatureFlag, value: boolean) => {
    (window as any).__MESH_FEATURES__[flag] = value;
    console.log(`🚩 Feature "${flag}" set to:`, value);
    console.log("⚠️  Refresh page to apply changes");
  };
  (window as any).listFeatures = () => {
    console.table(DELIBERATION_FEATURES);
    console.log("Enabled:", getEnabledFeatures());
  };
}

/**
 * Helper for conditional rendering based on feature flags
 */
export function withFeature<T>(
  flag: DeliberationFeatureFlag,
  newComponent: T,
  fallbackComponent: T
): T {
  return isFeatureEnabled(flag) ? newComponent : fallbackComponent;
}
