/**
 * RESPONSE_LATENCY_P50 — median seconds between a replyable item being
 * posted within the window and its first substantive reply. Items posted
 * in-window with no reply yet are counted under `unrepliedCount` but
 * excluded from the percentile sample (their true latency is right-censored).
 *
 * Edge cases (degenerate=true → value=0):
 *  - empty replyables
 *  - no replyable has a reply yet (all right-censored)
 *
 * Breakdown:
 *   { sampleSize, unrepliedCount, p50Seconds, p90Seconds, degenerate? }
 */

import { EquityMetricKind } from "../types";
import type { MetricCalculator, MetricResult, WindowInputs } from "./types";

const VERSION = 1;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export const responseLatencyP50Calculator: MetricCalculator = {
  kind: EquityMetricKind.RESPONSE_LATENCY_P50,
  version: VERSION,
  compute(inputs: WindowInputs): MetricResult {
    const inWindow = inputs.replyables.filter(
      (r) => r.postedAt >= inputs.windowStart && r.postedAt <= inputs.windowEnd,
    );
    const replied = inWindow.filter((r) => r.firstReplyAt != null);
    const latencies = replied
      .map((r) => Math.max(0, ((r.firstReplyAt as Date).getTime() - r.postedAt.getTime()) / 1000))
      .sort((a, b) => a - b);

    const unrepliedCount = inWindow.length - replied.length;
    const degenerate = inWindow.length === 0 || latencies.length === 0;

    const value = degenerate ? 0 : percentile(latencies, 50);
    const breakdown: Record<string, unknown> = {
      sampleSize: latencies.length,
      unrepliedCount,
      p50Seconds: degenerate ? 0 : percentile(latencies, 50),
      p90Seconds: degenerate ? 0 : percentile(latencies, 90),
    };
    if (degenerate) breakdown.degenerate = true;
    return { value, breakdown };
  },
};
