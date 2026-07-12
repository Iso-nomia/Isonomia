/**
 * PARTICIPATION_GINI — Gini coefficient over per-author contribution counts
 * within the window. Silent enrolled participants are folded in as zero-count
 * authors so the metric reflects unequal voice across the *intended* set.
 *
 * Edge cases (degenerate=true → value=0):
 *  - empty contributions
 *  - single author across enrolled + observed
 *
 * Breakdown:
 *   { totalContributions, perAuthor: {authorId: count}[truncated to top 5],
 *     silentEnrolled, totalSpeakers, degenerate? }
 */

import { EquityMetricKind } from "../types";
import type { MetricCalculator, MetricResult, WindowInputs } from "./types";

const VERSION = 1;

function gini(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i += 1) {
    weighted += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return weighted / (n * sum);
}

export const participationGiniCalculator: MetricCalculator = {
  kind: EquityMetricKind.PARTICIPATION_GINI,
  version: VERSION,
  compute(inputs: WindowInputs): MetricResult {
    const counts = new Map<string, number>();
    for (const id of inputs.enrolledAuthIds) counts.set(id, 0);
    for (const c of inputs.contributions) {
      counts.set(c.authorId, (counts.get(c.authorId) ?? 0) + 1);
    }
    const totalContributions = inputs.contributions.length;
    const speakers = Array.from(counts.entries()).filter(([, n]) => n > 0).length;
    const silentEnrolled = inputs.enrolledAuthIds.filter(
      (id) => (counts.get(id) ?? 0) === 0,
    ).length;

    const values = Array.from(counts.values());
    const degenerate = totalContributions === 0 || values.length <= 1;
    const value = degenerate ? 0 : gini(values);

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce<Record<string, number>>((acc, [id, n]) => {
        acc[id] = n;
        return acc;
      }, {});

    const breakdown: Record<string, unknown> = {
      totalContributions,
      totalSpeakers: speakers,
      silentEnrolled,
      perAuthorTop5: top,
    };
    if (degenerate) breakdown.degenerate = true;
    return { value, breakdown };
  },
};
