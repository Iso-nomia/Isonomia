/**
 * staleClaimRule (v1) — see docs/facilitation/INTERVENTION_RULES.md §4.
 *
 * Reads ATTENTION_DEFICIT snapshot's `breakdown.staleClaimIds[]` and emits
 * one recommendation per stale claim. Claim weights are looked up from
 * `ctx.highWeightClaims` when available; missing weight defaults to 1.
 */

import {
  EquityMetricKind,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type { Priority, RuleContext, RuleDescriptor, RuleOutput } from "./types";

const DEFAULTS = { minStale: 1, staleAfterSeconds: 1200 };

interface StaleEntry {
  claimId: string;
  staleSeconds: number;
}

function priorityForWeight(weight: number): Priority {
  if (weight >= 6) return 4;
  if (weight >= 3) return 3;
  return 2;
}

export const staleClaimRule: RuleDescriptor = {
  name: "staleClaimRule",
  version: 1,
  defaultEnabled: true,
  flag: "ff_facilitation_rule_stale_claim",
  dedupeWindowSeconds: 1200,
  run(ctx: RuleContext): RuleOutput[] | null {
    const snap = ctx.snapshots[EquityMetricKind.ATTENTION_DEFICIT];
    if (!snap) return null;
    if ((snap.breakdown as { degenerate?: boolean }).degenerate) return null;

    const t = { ...DEFAULTS, ...(ctx.thresholds?.staleClaimRule ?? {}) };
    const breakdown = snap.breakdown as {
      staleClaims?: StaleEntry[];
      staleClaimIds?: string[];
    };
    const stale: StaleEntry[] =
      breakdown.staleClaims ??
      (breakdown.staleClaimIds ?? []).map((id) => ({ claimId: id, staleSeconds: t.staleAfterSeconds }));

    if (stale.length < t.minStale) return null;

    const claimsById = new Map(
      (ctx.highWeightClaims ?? []).map((c) => [c.id, c] as const),
    );

    const out: RuleOutput[] = stale.map((entry) => {
      const claim = claimsById.get(entry.claimId);
      const weight = claim?.weight ?? 1;
      const text = claim?.text ?? "this claim";
      return {
        kind: FacilitationInterventionKind.INVITE_RESPONSE,
        targetType: FacilitationInterventionTargetType.CLAIM,
        targetId: entry.claimId,
        priority: priorityForWeight(weight),
        rationale: {
          headline:
            weight >= 6
              ? `High-weight claim has had no reply for ${Math.round(entry.staleSeconds / 60)} minutes.`
              : `Claim has had no reply for ${Math.round(entry.staleSeconds / 60)} minutes.`,
          details: {
            claimId: entry.claimId,
            weight,
            staleSeconds: entry.staleSeconds,
            thresholds: t,
          },
        },
        suggestedPhrasing: `**${text}** has been quiet for a while — does anyone want to push back, refine, or build on it?`,
        triggeredByMetric: EquityMetricKind.ATTENTION_DEFICIT,
        triggeredByMetricSnapshotId: snap.id,
      };
    });

    return out;
  },
};
