/**
 * Standing-depth confidence thresholds — Track AI-EPI Pt. 3 §3.
 *
 * `StandingState` ("tested-survived", "tested-attacked", ...) tells you the
 * structural verdict. `StandingDepth.confidence` tells you how much
 * deliberative pressure that verdict has actually faced. The current
 * thresholds intentionally read conservatively while the platform is
 * cold-start: a single challenger does not yet earn the "moderate"
 * label.
 *
 * Tunable in one place so we don't have to chase magic numbers across
 * the attestation builder, MCP descriptions, and UI badges.
 */

export type StandingConfidence = "thin" | "moderate" | "dense";

export const STANDING_DEPTH_THRESHOLDS = {
  /** ≥ this many distinct challengers OR independent reviewers ⇒ moderate */
  moderate: 2,
  /** ≥ this many distinct challengers AND independent reviewers ⇒ dense */
  dense: { challengers: 5, reviewers: 5 },
} as const;

export function classifyStandingConfidence(input: {
  challengers: number;
  independentReviewers: number;
}): StandingConfidence {
  const { challengers, independentReviewers } = input;
  if (
    challengers >= STANDING_DEPTH_THRESHOLDS.dense.challengers &&
    independentReviewers >= STANDING_DEPTH_THRESHOLDS.dense.reviewers
  ) {
    return "dense";
  }
  if (
    challengers >= STANDING_DEPTH_THRESHOLDS.moderate ||
    independentReviewers >= STANDING_DEPTH_THRESHOLDS.moderate
  ) {
    return "moderate";
  }
  return "thin";
}
