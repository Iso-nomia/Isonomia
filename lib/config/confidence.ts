/**
 * Confidence Constants
 * 
 * Central configuration for confidence/belief values used throughout the Mesh application.
 * These constants ensure consistency in default confidence values, thresholds, and
 * constraint bounds across the deliberation system.
 */

// ============================================================================
// Default Confidence Values
// ============================================================================

/**
 * Default base confidence for arguments when no explicit value is provided.
 * Used in:
 * - Virtual imports (ArgumentImport with null toArgumentId)
 * - Argument backfill operations
 * - Initial argument creation
 * 
 * @default 0.55
 * @rationale Slightly above neutral (0.5) to indicate weak initial support
 */
export const DEFAULT_ARGUMENT_CONFIDENCE = 0.55;

/**
 * Default assumption weight when not explicitly specified.
 * Used in legacy AssumptionUse records.
 * 
 * @default 0.6
 */
export const DEFAULT_ASSUMPTION_WEIGHT = 0.6;

/**
 * Fallback premise base confidence when argument confidence is missing.
 * Used in premise factor calculations.
 * 
 * @default 0.5
 */
export const DEFAULT_PREMISE_BASE = 0.5;

// ============================================================================
// Confidence Bounds
// ============================================================================

/**
 * Minimum confidence value (inclusive).
 * All confidence values are clamped to this lower bound.
 */
export const MIN_CONFIDENCE = 0.0;

/**
 * Maximum confidence value (inclusive).
 * All confidence values are clamped to this upper bound.
 */
export const MAX_CONFIDENCE = 1.0;

/**
 * Minimum confidence for argument creation/backfill.
 * Prevents arguments from starting with extremely low confidence.
 * 
 * @default 0.3
 */
export const MIN_ARGUMENT_CONFIDENCE = 0.3;

/**
 * Maximum confidence cap for backfilled arguments.
 * Even with many approvals, confidence is capped at this value.
 * 
 * @default 0.9
 */
export const MAX_BACKFILL_CONFIDENCE = 0.9;

// ============================================================================
// Thresholds
// ============================================================================

/**
 * NLI neutral similarity threshold.
 * Text overlap above this value is considered neutral relation.
 * 
 * @default 0.4
 */
export const NLI_NEUTRAL_OVERLAP_THRESHOLD = 0.4;

/**
 * NLI neutral confidence score.
 * Assigned when neutral relation is detected.
 * 
 * @default 0.55
 */
export const NLI_NEUTRAL_CONFIDENCE = 0.55;

/**
 * Similarity threshold for divergence warnings.
 * Warnings are issued when similarity falls below this value.
 * 
 * @default 0.55
 */
export const DIVERGENCE_WARNING_THRESHOLD = 0.55;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clamps a confidence value to [MIN_CONFIDENCE, MAX_CONFIDENCE].
 * 
 * @param value - The value to clamp
 * @returns Clamped value in range [0, 1]
 */
export function clampConfidence(value: number): number {
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, value));
}

/**
 * Checks if a confidence value is valid (within [0, 1]).
 * 
 * @param value - The value to validate
 * @returns True if value is in valid range
 */
export function isValidConfidence(value: number): boolean {
  return value >= MIN_CONFIDENCE && value <= MAX_CONFIDENCE;
}

/**
 * Gets default confidence for an argument, with optional override.
 * 
 * @param override - Optional explicit confidence value
 * @returns The confidence value to use
 */
export function getArgumentConfidence(override?: number | null): number {
  if (override == null) return DEFAULT_ARGUMENT_CONFIDENCE;
  return clampConfidence(override);
}
