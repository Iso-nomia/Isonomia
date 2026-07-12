/**
 * evidenceGapRule (v1) — see docs/facilitation/INTERVENTION_RULES.md §3.
 *
 * Snapshot-independent: scans `ctx.highWeightClaims` directly. When the
 * driver hasn't been wired to a claim provider, the rule returns no rows.
 */

import {
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type { Priority, RuleContext, RuleDescriptor, RuleOutput } from "./types";

const DEFAULTS = { minSupport: 3 };

export const evidenceGapRule: RuleDescriptor = {
  name: "evidenceGapRule",
  version: 1,
  defaultEnabled: true,
  flag: "ff_facilitation_rule_evidence_gap",
  dedupeWindowSeconds: 1800,
  run(ctx: RuleContext): RuleOutput[] | null {
    if (!ctx.highWeightClaims || ctx.highWeightClaims.length === 0) return null;
    const t = { ...DEFAULTS, ...(ctx.thresholds?.evidenceGapRule ?? {}) };
    const out: RuleOutput[] = [];
    for (const claim of ctx.highWeightClaims) {
      if (claim.authorIsInstitutional) continue;
      if (claim.supportCount < t.minSupport) continue;
      if (claim.citationCount > 0) continue;
      const priority: Priority = claim.supportCount >= 6 ? 4 : 3;
      out.push({
        kind: FacilitationInterventionKind.PROMPT_EVIDENCE,
        targetType: FacilitationInterventionTargetType.CLAIM,
        targetId: claim.id,
        priority,
        rationale: {
          headline: `Claim has ${claim.supportCount} supports but no citations yet.`,
          details: {
            claimId: claim.id,
            supportCount: claim.supportCount,
            citationCount: claim.citationCount,
            thresholds: t,
          },
        },
        suggestedPhrasing: `**${claim.text}** is gaining support — what evidence would let us check it?`,
        triggeredByMetric: null,
        triggeredByMetricSnapshotId: null,
      });
    }
    return out.length === 0 ? null : out;
  },
};
