/**
 * ATTENTION_DEFICIT — count of high-weight claims that have gone without a
 * reply for longer than the staleness threshold T (default 1800s = 30min).
 * The breakdown shape is consumed by `staleClaimRule` (roadmap §3.6) which
 * reads `breakdown.staleClaims[]` and prioritizes by claim weight.
 *
 * Staleness reference time = max(replyable.postedAt, replyable.firstReplyAt)
 * so a freshly-replied claim resets the timer.
 *
 * Edge cases (degenerate=true → value=0):
 *  - empty replyables
 *
 * Breakdown:
 *   { thresholdSeconds, totalClaims, staleClaims: [{claimId, staleSeconds, weight}], degenerate? }
 */

import { EquityMetricKind } from "../types";
import type { MetricCalculator, MetricResult, WindowInputs } from "./types";

const VERSION = 1;
const THRESHOLD_SECONDS = 1800;

export const attentionDeficitCalculator: MetricCalculator = {
  kind: EquityMetricKind.ATTENTION_DEFICIT,
  version: VERSION,
  compute(inputs: WindowInputs): MetricResult {
    const now = inputs.windowEnd;
    const stale: { claimId: string; staleSeconds: number; weight: number }[] = [];

    for (const r of inputs.replyables) {
      const lastTouch = r.firstReplyAt ?? r.postedAt;
      const staleSeconds = Math.floor((now.getTime() - lastTouch.getTime()) / 1000);
      if (staleSeconds > THRESHOLD_SECONDS) {
        stale.push({ claimId: r.id, staleSeconds, weight: r.weight ?? 0 });
      }
    }
    stale.sort((a, b) => b.staleSeconds - a.staleSeconds);

    const degenerate = inputs.replyables.length === 0;
    const value = stale.length;
    const breakdown: Record<string, unknown> = {
      thresholdSeconds: THRESHOLD_SECONDS,
      totalClaims: inputs.replyables.length,
      staleClaims: stale,
    };
    if (degenerate) breakdown.degenerate = true;
    return { value, breakdown };
  },
};
