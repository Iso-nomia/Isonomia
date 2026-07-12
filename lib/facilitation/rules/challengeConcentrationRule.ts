/**
 * challengeConcentrationRule (v1) — see docs/facilitation/INTERVENTION_RULES.md §2.
 */

import {
  EquityMetricKind,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type { RuleContext, RuleDescriptor, RuleOutput } from "./types";

const DEFAULTS = { shareTopK: 0.6, minAttacks: 5 };

export const challengeConcentrationRule: RuleDescriptor = {
  name: "challengeConcentrationRule",
  version: 1,
  defaultEnabled: true,
  flag: "ff_facilitation_rule_challenge_concentration",
  dedupeWindowSeconds: 900,
  run(ctx: RuleContext): RuleOutput | null {
    const snap = ctx.snapshots[EquityMetricKind.CHALLENGE_CONCENTRATION];
    if (!snap) return null;
    if ((snap.breakdown as { degenerate?: boolean }).degenerate) return null;

    const t = { ...DEFAULTS, ...(ctx.thresholds?.challengeConcentrationRule ?? {}) };
    const windowAttackCount = Number(
      (snap.breakdown as { windowAttackCount?: unknown }).windowAttackCount ?? 0,
    );
    if (!(snap.value > t.shareTopK)) return null;
    if (windowAttackCount < t.minAttacks) return null;

    const priority = snap.value > 0.8 ? 5 : 4;

    return {
      kind: FacilitationInterventionKind.REBALANCE_CHALLENGE,
      targetType: FacilitationInterventionTargetType.ROOM,
      targetId: ctx.deliberationId,
      priority: priority as 4 | 5,
      rationale: {
        headline: `Top ${(snap.breakdown as { topK?: number }).topK ?? "?"} accounts produced ${Math.round(snap.value * 100)}% of challenges in the recent window.`,
        details: {
          share: snap.value,
          topK: (snap.breakdown as { topK?: number }).topK ?? null,
          windowAttackCount,
          thresholds: t,
        },
      },
      suggestedPhrasing:
        "We've heard sharp critique from a few voices. Are there counter-views from elsewhere in the room we should put on the table?",
      triggeredByMetric: EquityMetricKind.CHALLENGE_CONCENTRATION,
      triggeredByMetricSnapshotId: snap.id,
    };
  },
};
