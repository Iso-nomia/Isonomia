/**
 * unheardSpeakerRule (v1) — see docs/facilitation/INTERVENTION_RULES.md §1.
 */

import {
  EquityMetricKind,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type { RuleContext, RuleDescriptor, RuleOutput } from "./types";

const DEFAULTS = { gini: 0.65, minSilent: 3 };

export const unheardSpeakerRule: RuleDescriptor = {
  name: "unheardSpeakerRule",
  version: 1,
  defaultEnabled: true,
  flag: "ff_facilitation_rule_unheard_speaker",
  dedupeWindowSeconds: 600,
  run(ctx: RuleContext): RuleOutput | null {
    const snap = ctx.snapshots[EquityMetricKind.PARTICIPATION_GINI];
    if (!snap) return null;
    if ((snap.breakdown as { degenerate?: boolean }).degenerate) return null;

    const t = { ...DEFAULTS, ...(ctx.thresholds?.unheardSpeakerRule ?? {}) };
    const silentEnrolled = Number(
      (snap.breakdown as { silentEnrolled?: unknown }).silentEnrolled ?? 0,
    );
    if (!(snap.value > t.gini)) return null;
    if (silentEnrolled < t.minSilent) return null;

    // Pick top high-weight claim if available, else target the room.
    const claim = ctx.highWeightClaims?.[0];
    const target = claim
      ? { type: FacilitationInterventionTargetType.CLAIM, id: claim.id }
      : { type: FacilitationInterventionTargetType.ROOM, id: ctx.deliberationId };

    const priority = snap.value > 0.8 ? 5 : 4;
    const claimSummary = claim?.text ?? "the active discussion";

    return {
      kind: FacilitationInterventionKind.ELICIT_UNHEARD,
      targetType: target.type,
      targetId: target.id,
      priority: priority as 4 | 5,
      rationale: {
        headline: `${silentEnrolled} enrolled participants haven't contributed in the recent window.`,
        details: {
          gini: snap.value,
          silentEnrolled,
          totalContributions: (snap.breakdown as { totalContributions?: number }).totalContributions ?? null,
          thresholds: t,
        },
      },
      suggestedPhrasing: `We haven't heard from everyone yet on **${claimSummary}** — what would this look like from your week-to-week experience?`,
      triggeredByMetric: EquityMetricKind.PARTICIPATION_GINI,
      triggeredByMetricSnapshotId: snap.id,
    };
  },
};
