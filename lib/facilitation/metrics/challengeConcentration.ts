/**
 * CHALLENGE_CONCENTRATION — share of challenges originating from the
 * top-K authors, where K = max(1, ceil(0.2 * uniqueChallengers)). Aligns
 * with `challengeConcentrationRule` which fires when this share exceeds
 * 0.60 with at least 5 challenges in window (roadmap §3.6).
 *
 * Edge cases (degenerate=true → value=0):
 *  - empty challenges
 *  - single challenger
 *
 * Breakdown:
 *   { topK, windowAttackCount, totalChallenges, perAuthorTop5,
 *     uniqueChallengers, degenerate? }
 */

import { EquityMetricKind } from "../types";
import type { MetricCalculator, MetricResult, WindowInputs } from "./types";

const VERSION = 1;

export const challengeConcentrationCalculator: MetricCalculator = {
  kind: EquityMetricKind.CHALLENGE_CONCENTRATION,
  version: VERSION,
  compute(inputs: WindowInputs): MetricResult {
    const counts = new Map<string, number>();
    for (const c of inputs.challenges) {
      counts.set(c.authorId, (counts.get(c.authorId) ?? 0) + 1);
    }
    const total = inputs.challenges.length;
    const unique = counts.size;
    const degenerate = total === 0 || unique <= 1;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const topK = Math.max(1, Math.ceil(0.2 * unique));
    const topShare = sorted.slice(0, topK).reduce((s, [, n]) => s + n, 0);
    const value = degenerate || total === 0 ? 0 : topShare / total;

    const top5 = sorted.slice(0, 5).reduce<Record<string, number>>((acc, [id, n]) => {
      acc[id] = n;
      return acc;
    }, {});

    const breakdown: Record<string, unknown> = {
      topK,
      windowAttackCount: total,
      totalChallenges: total,
      uniqueChallengers: unique,
      perAuthorTop5: top5,
    };
    if (degenerate) breakdown.degenerate = true;
    return { value, breakdown };
  },
};
