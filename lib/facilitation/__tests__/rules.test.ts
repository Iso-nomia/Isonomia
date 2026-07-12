import {
  EquityMetricKind,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
} from "../types";
import type {
  ClaimSummary,
  MetricSnapshot,
  PairwiseTurn,
  RuleContext,
} from "../rules/types";
import { unheardSpeakerRule } from "../rules/unheardSpeakerRule";
import { challengeConcentrationRule } from "../rules/challengeConcentrationRule";
import { evidenceGapRule } from "../rules/evidenceGapRule";
import { staleClaimRule } from "../rules/staleClaimRule";
import { cooldownRule } from "../rules/cooldownRule";
import { enabledRules, RULE_REGISTRY } from "../rules";

const NOW = new Date("2026-04-01T12:00:00Z");

function snap(
  kind: EquityMetricKind,
  value: number,
  breakdown: Record<string, unknown>,
): MetricSnapshot {
  return {
    id: `snap_${kind}`,
    metricKind: kind,
    metricVersion: 1,
    value,
    windowStart: new Date(NOW.getTime() - 600_000),
    windowEnd: NOW,
    breakdown,
    isFinal: false,
  };
}

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    sessionId: "sess_1",
    deliberationId: "delib_1",
    now: NOW,
    enrolledAuthIds: ["auth_a", "auth_b", "auth_c", "auth_d"],
    snapshots: {},
    openInterventions: [],
    ...overrides,
  };
}

describe("unheardSpeakerRule", () => {
  it("does not fire when snapshot missing", () => {
    expect(unheardSpeakerRule.run(ctx())).toBeNull();
  });

  it("fires above gini threshold and silentEnrolled threshold", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.71, {
            silentEnrolled: 5,
            totalContributions: 47,
          }),
        },
      }),
    );
    expect(r).not.toBeNull();
    expect((r as any).kind).toBe(FacilitationInterventionKind.ELICIT_UNHEARD);
    expect((r as any).priority).toBe(4);
    expect((r as any).targetType).toBe(FacilitationInterventionTargetType.ROOM);
  });

  it("priority 5 above 0.80", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.85, {
            silentEnrolled: 4,
          }),
        },
      }),
    );
    expect((r as any).priority).toBe(5);
  });

  it("targets a CLAIM when high-weight claims provided", () => {
    const claim: ClaimSummary = {
      id: "c_1",
      text: "weekend bus service",
      weight: 5,
      supportCount: 2,
      citationCount: 0,
      authorAuthId: "auth_x",
      lastActivityAt: null,
    };
    const r = unheardSpeakerRule.run(
      ctx({
        highWeightClaims: [claim],
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.71, {
            silentEnrolled: 4,
          }),
        },
      }),
    );
    expect((r as any).targetType).toBe(FacilitationInterventionTargetType.CLAIM);
    expect((r as any).targetId).toBe("c_1");
    expect((r as any).suggestedPhrasing).toContain("weekend bus service");
  });

  it("does NOT fire at exact gini threshold (>, not ≥)", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.65, {
            silentEnrolled: 5,
          }),
        },
      }),
    );
    expect(r).toBeNull();
  });

  it("respects degenerate snapshot guard", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.9, {
            silentEnrolled: 5,
            degenerate: true,
          }),
        },
      }),
    );
    expect(r).toBeNull();
  });

  it("does not fire when silentEnrolled below threshold", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.9, {
            silentEnrolled: 2,
          }),
        },
      }),
    );
    expect(r).toBeNull();
  });
});

describe("challengeConcentrationRule", () => {
  it("fires above thresholds", () => {
    const r = challengeConcentrationRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.CHALLENGE_CONCENTRATION]: snap(
            EquityMetricKind.CHALLENGE_CONCENTRATION,
            0.71,
            { topK: 2, windowAttackCount: 22 },
          ),
        },
      }),
    );
    expect((r as any).kind).toBe(FacilitationInterventionKind.REBALANCE_CHALLENGE);
    expect((r as any).priority).toBe(4);
    expect((r as any).targetType).toBe(FacilitationInterventionTargetType.ROOM);
  });

  it("priority 5 above 0.80", () => {
    const r = challengeConcentrationRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.CHALLENGE_CONCENTRATION]: snap(
            EquityMetricKind.CHALLENGE_CONCENTRATION,
            0.82,
            { topK: 1, windowAttackCount: 10 },
          ),
        },
      }),
    );
    expect((r as any).priority).toBe(5);
  });

  it("does not fire below minAttacks", () => {
    const r = challengeConcentrationRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.CHALLENGE_CONCENTRATION]: snap(
            EquityMetricKind.CHALLENGE_CONCENTRATION,
            0.95,
            { topK: 1, windowAttackCount: 2 },
          ),
        },
      }),
    );
    expect(r).toBeNull();
  });
});

describe("evidenceGapRule", () => {
  const baseClaim: ClaimSummary = {
    id: "c_1",
    text: "the policy reduces fare evasion",
    weight: 4,
    supportCount: 4,
    citationCount: 0,
    authorAuthId: "auth_x",
    lastActivityAt: null,
  };

  it("fires for supported claim with no citations", () => {
    const r = evidenceGapRule.run(ctx({ highWeightClaims: [baseClaim] })) as any[];
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe(FacilitationInterventionKind.PROMPT_EVIDENCE);
    expect(r[0].priority).toBe(3);
    expect(r[0].triggeredByMetric).toBeNull();
  });

  it("priority 4 when supportCount ≥ 6", () => {
    const r = evidenceGapRule.run(
      ctx({ highWeightClaims: [{ ...baseClaim, supportCount: 6 }] }),
    ) as any[];
    expect(r[0].priority).toBe(4);
  });

  it("suppresses institutional authors", () => {
    const r = evidenceGapRule.run(
      ctx({ highWeightClaims: [{ ...baseClaim, authorIsInstitutional: true }] }),
    );
    expect(r).toBeNull();
  });

  it("does not fire when claim has any citation", () => {
    const r = evidenceGapRule.run(
      ctx({ highWeightClaims: [{ ...baseClaim, citationCount: 1 }] }),
    );
    expect(r).toBeNull();
  });

  it("returns null when no claims provided", () => {
    expect(evidenceGapRule.run(ctx())).toBeNull();
  });
});

describe("staleClaimRule", () => {
  it("does not fire when ATTENTION_DEFICIT snapshot missing", () => {
    expect(staleClaimRule.run(ctx())).toBeNull();
  });

  it("emits one row per stale claim with weight-mapped priority", () => {
    const claims: ClaimSummary[] = [
      { id: "c_high", text: "high", weight: 7, supportCount: 5, citationCount: 1, authorAuthId: "x", lastActivityAt: null },
      { id: "c_med", text: "med", weight: 4, supportCount: 5, citationCount: 1, authorAuthId: "x", lastActivityAt: null },
      { id: "c_low", text: "low", weight: 1, supportCount: 5, citationCount: 1, authorAuthId: "x", lastActivityAt: null },
    ];
    const r = staleClaimRule.run(
      ctx({
        highWeightClaims: claims,
        snapshots: {
          [EquityMetricKind.ATTENTION_DEFICIT]: snap(EquityMetricKind.ATTENTION_DEFICIT, 0, {
            staleClaims: [
              { claimId: "c_high", staleSeconds: 1500 },
              { claimId: "c_med", staleSeconds: 1300 },
              { claimId: "c_low", staleSeconds: 1250 },
            ],
          }),
        },
      }),
    ) as any[];
    expect(r).toHaveLength(3);
    const byId = Object.fromEntries(r.map((row) => [row.targetId, row]));
    expect(byId.c_high.priority).toBe(4);
    expect(byId.c_med.priority).toBe(3);
    expect(byId.c_low.priority).toBe(2);
  });

  it("works with legacy staleClaimIds shape", () => {
    const r = staleClaimRule.run(
      ctx({
        snapshots: {
          [EquityMetricKind.ATTENTION_DEFICIT]: snap(EquityMetricKind.ATTENTION_DEFICIT, 0, {
            staleClaimIds: ["c_a", "c_b"],
          }),
        },
      }),
    ) as any[];
    expect(r).toHaveLength(2);
    expect(r[0].targetId).toBe("c_a");
  });
});

describe("cooldownRule", () => {
  it("returns null when no turns provided", () => {
    expect(cooldownRule.run(ctx())).toBeNull();
  });

  it("fires above turnCount threshold", () => {
    const turn: PairwiseTurn = {
      userA: "auth_b",
      userB: "auth_a",
      claimId: "c_14",
      turnCount: 9,
      windowSeconds: 300,
    };
    const r = cooldownRule.run(ctx({ pairwiseTurns: [turn] })) as any[];
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe(FacilitationInterventionKind.COOLDOWN);
    // dedupe-stable target: lexicographically smaller user
    expect(r[0].targetId).toBe("auth_a");
    expect(r[0].priority).toBe(2);
  });

  it("priority 3 when turnCount ≥ 12", () => {
    const r = cooldownRule.run(
      ctx({
        pairwiseTurns: [{ userA: "auth_a", userB: "auth_b", claimId: "c_1", turnCount: 12, windowSeconds: 300 }],
      }),
    ) as any[];
    expect(r[0].priority).toBe(3);
  });

  it("ignores below-threshold pair", () => {
    const r = cooldownRule.run(
      ctx({
        pairwiseTurns: [{ userA: "a", userB: "b", claimId: "c", turnCount: 5, windowSeconds: 300 }],
      }),
    );
    expect(r).toBeNull();
  });
});

describe("registry", () => {
  it("includes all five rules", () => {
    expect(RULE_REGISTRY.map((r) => r.name)).toEqual([
      "unheardSpeakerRule",
      "challengeConcentrationRule",
      "evidenceGapRule",
      "staleClaimRule",
      "cooldownRule",
    ]);
  });

  it("respects defaultEnabled", () => {
    const names = enabledRules({}).map((r) => r.name);
    expect(names).toContain("unheardSpeakerRule");
    expect(names).not.toContain("cooldownRule");
  });

  it("feature flag overrides default", () => {
    const names = enabledRules({ ff_facilitation_rule_cooldown: true, ff_facilitation_rule_unheard_speaker: false }).map((r) => r.name);
    expect(names).toContain("cooldownRule");
    expect(names).not.toContain("unheardSpeakerRule");
  });
});

describe("threshold overrides", () => {
  it("overrides unheardSpeakerRule.gini", () => {
    const r = unheardSpeakerRule.run(
      ctx({
        thresholds: { unheardSpeakerRule: { gini: 0.5 } },
        snapshots: {
          [EquityMetricKind.PARTICIPATION_GINI]: snap(EquityMetricKind.PARTICIPATION_GINI, 0.55, {
            silentEnrolled: 5,
          }),
        },
      }),
    );
    expect(r).not.toBeNull();
  });
});
