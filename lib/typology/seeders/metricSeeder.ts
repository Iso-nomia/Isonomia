/**
 * Typology — Metric seeder
 *
 * Maps `METRIC_THRESHOLD_CROSSED` facilitation events to typology axis
 * suggestions when the underlying metric is informative about the
 * disagreement type.
 *
 *   CHALLENGE_CONCENTRATION ↑ → FRAMING (one side does most challenging)
 *   PARTICIPATION_GINI      ↑ → INTEREST (skewed participation; missing voices)
 *
 * Other metrics (RESPONSE_LATENCY_P50, ATTENTION_DEFICIT, FACILITATOR_LOAD)
 * are about session health, not disagreement typology — they emit nothing.
 *
 * Status: B1 scaffold.
 */

import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
} from "../types";
import type { EventSeederDescriptor, SeederOutput } from "./types";

const AXIS_BY_METRIC: Partial<Record<string, DisagreementAxisKey>> = {
  CHALLENGE_CONCENTRATION: DisagreementAxisKey.FRAMING,
  PARTICIPATION_GINI: DisagreementAxisKey.INTEREST,
};

export const metricSeeder: EventSeederDescriptor = {
  name: "metricSeeder",
  version: 1,
  defaultEnabled: true,
  flag: "ff_typology_seeder_metric",
  kind: "event",
  eventTypes: new Set(["METRIC_THRESHOLD_CROSSED"]),
  run: ({ event }) => {
    const payload = (event.payloadJson ?? {}) as Record<string, unknown>;
    const metricKind = typeof payload.metricKind === "string" ? payload.metricKind : null;
    if (!metricKind) return null;
    const axisKey = AXIS_BY_METRIC[metricKind];
    if (!axisKey) return null;

    const out: SeederOutput = {
      // Metric-driven suggestions are session-scoped; no concrete target.
      targetType: null,
      targetId: null,
      suggestedAxisKey: axisKey,
      rationaleText: rationaleFor(metricKind, axisKey, payload),
      priority: 3,
      seedSource: DisagreementTagSeedSource.METRIC_SEED,
      seedReferenceJson: {
        facilitationEventId: event.id,
        metricKind,
        metricSnapshotId: event.metricSnapshotId ?? null,
      },
    };
    return out;
  },
};

function rationaleFor(
  metricKind: string,
  axisKey: DisagreementAxisKey,
  payload: Record<string, unknown>,
): string {
  const value = typeof payload.value === "number" ? payload.value.toFixed(2) : null;
  const valueSuffix = value ? ` (=${value})` : "";
  if (axisKey === DisagreementAxisKey.FRAMING) {
    return `Challenge concentration is high${valueSuffix}; one frame may be dominating the dispute.`;
  }
  if (axisKey === DisagreementAxisKey.INTEREST) {
    return `Participation Gini is high${valueSuffix}; missing voices may indicate an interest-based gap.`;
  }
  return `Metric ${metricKind} crossed threshold${valueSuffix}.`;
}
