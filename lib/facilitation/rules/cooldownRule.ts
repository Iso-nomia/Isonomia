/**
 * cooldownRule (v1) — see docs/facilitation/INTERVENTION_RULES.md §5.
 *
 * Snapshot-independent: reads `ctx.pairwiseTurns`. When the driver hasn't
 * been wired to a turn provider, returns no rows. Off by default until
 * calibrated (see RULE_REGISTRY.defaultEnabled = false).
 */

import {
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type { Priority, RuleContext, RuleDescriptor, RuleOutput } from "./types";

const DEFAULTS = { turnCount: 8, windowSeconds: 300 };

export const cooldownRule: RuleDescriptor = {
  name: "cooldownRule",
  version: 1,
  defaultEnabled: false,
  flag: "ff_facilitation_rule_cooldown",
  dedupeWindowSeconds: 900,
  run(ctx: RuleContext): RuleOutput[] | null {
    if (!ctx.pairwiseTurns || ctx.pairwiseTurns.length === 0) return null;
    const t = { ...DEFAULTS, ...(ctx.thresholds?.cooldownRule ?? {}) };
    const out: RuleOutput[] = [];
    for (const turn of ctx.pairwiseTurns) {
      if (turn.turnCount < t.turnCount) continue;
      const priority: Priority = turn.turnCount >= 12 ? 3 : 2;
      // Order pair deterministically for dedupe (the driver matches on
      // ruleName + targetType + targetId; we anchor targetId to the
      // lexicographically-smaller user so swapping a/b doesn't bypass dedupe).
      const [first, second] = [turn.userA, turn.userB].sort();
      out.push({
        kind: FacilitationInterventionKind.COOLDOWN,
        targetType: FacilitationInterventionTargetType.USER,
        targetId: first,
        priority,
        rationale: {
          headline: `Two participants have exchanged ${turn.turnCount} turns in ${Math.round(turn.windowSeconds / 60)} min on this claim.`,
          details: {
            userA: first,
            userB: second,
            claimId: turn.claimId,
            turnCount: turn.turnCount,
            windowSeconds: turn.windowSeconds,
            thresholds: t,
          },
        },
        suggestedPhrasing:
          "This thread is heating up between two voices. Want to take a beat and bring others in?",
        triggeredByMetric: null,
        triggeredByMetricSnapshotId: null,
      });
    }
    return out.length === 0 ? null : out;
  },
};
