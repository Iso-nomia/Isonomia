/**
 * Metric calculator registry. Order is fixed and stable; the snapshot
 * worker iterates it once per cycle. Each calculator pins its own
 * `version` integer (see metrics/types.ts).
 */

import type { MetricCalculator } from "./types";
import { participationGiniCalculator } from "./participationGini";
import { challengeConcentrationCalculator } from "./challengeConcentration";
import { responseLatencyP50Calculator } from "./responseLatencyP50";
import { attentionDeficitCalculator } from "./attentionDeficit";
import { facilitatorLoadCalculator } from "./facilitatorLoad";
import { EquityMetricKind } from "../types";

export const METRIC_REGISTRY: readonly MetricCalculator[] = [
  participationGiniCalculator,
  challengeConcentrationCalculator,
  responseLatencyP50Calculator,
  attentionDeficitCalculator,
  facilitatorLoadCalculator,
];

const BY_KIND: Record<EquityMetricKind, MetricCalculator> = METRIC_REGISTRY.reduce(
  (acc, c) => {
    acc[c.kind] = c;
    return acc;
  },
  {} as Record<EquityMetricKind, MetricCalculator>,
);

export function calculatorFor(kind: EquityMetricKind): MetricCalculator {
  const c = BY_KIND[kind];
  if (!c) throw new Error(`no metric calculator registered for kind=${kind}`);
  return c;
}
