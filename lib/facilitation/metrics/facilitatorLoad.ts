/**
 * FACILITATOR_LOAD — count of unresolved interventions plus seconds since
 * the facilitator's last apply/dismiss action. Value is the open count;
 * staleness is exposed in `breakdown` so the cockpit can surface it without
 * a second query.
 *
 * Edge cases (degenerate=true → value=0):
 *  - openInterventionCount === 0 AND no prior action recorded
 *
 * Breakdown:
 *   { openInterventions, secondsSinceLastAction, lastActionAt, degenerate? }
 */

import { EquityMetricKind } from "../types";
import type { MetricCalculator, MetricResult, WindowInputs } from "./types";

const VERSION = 1;

export const facilitatorLoadCalculator: MetricCalculator = {
  kind: EquityMetricKind.FACILITATOR_LOAD,
  version: VERSION,
  compute(inputs: WindowInputs): MetricResult {
    const open = inputs.facilitator.openInterventionCount;
    const last = inputs.facilitator.lastActionAt;
    const secondsSinceLastAction =
      last == null ? null : Math.max(0, Math.floor((inputs.windowEnd.getTime() - last.getTime()) / 1000));

    const degenerate = open === 0 && last == null;
    const value = open;
    const breakdown: Record<string, unknown> = {
      openInterventions: open,
      secondsSinceLastAction,
      lastActionAt: last == null ? null : last.toISOString(),
    };
    if (degenerate) breakdown.degenerate = true;
    return { value, breakdown };
  },
};
