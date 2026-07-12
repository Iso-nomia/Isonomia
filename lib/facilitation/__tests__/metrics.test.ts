import { EquityMetricKind } from "../types";
import type { WindowInputs } from "../metrics/types";
import { participationGiniCalculator } from "../metrics/participationGini";
import { challengeConcentrationCalculator } from "../metrics/challengeConcentration";
import { responseLatencyP50Calculator } from "../metrics/responseLatencyP50";
import { attentionDeficitCalculator } from "../metrics/attentionDeficit";
import { facilitatorLoadCalculator } from "../metrics/facilitatorLoad";
import { METRIC_REGISTRY, calculatorFor } from "../metrics";

const NOW = new Date("2026-04-23T12:00:00Z");
const WINDOW_START = new Date(NOW.getTime() - 600_000);

function baseInputs(overrides: Partial<WindowInputs> = {}): WindowInputs {
  return {
    windowStart: WINDOW_START,
    windowEnd: NOW,
    enrolledAuthIds: [],
    contributions: [],
    challenges: [],
    replyables: [],
    facilitator: { openInterventionCount: 0, lastActionAt: null },
    ...overrides,
  };
}

describe("participationGiniCalculator", () => {
  it("returns 0 with degenerate flag when no contributions", () => {
    const r = participationGiniCalculator.compute(baseInputs());
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("returns 0 when distribution is perfectly even", () => {
    const r = participationGiniCalculator.compute(
      baseInputs({
        enrolledAuthIds: ["a", "b", "c", "d"],
        contributions: ["a", "b", "c", "d"].map((id) => ({
          authorId: id,
          createdAt: NOW,
          source: "argument" as const,
        })),
      }),
    );
    expect(r.value).toBeCloseTo(0, 6);
    expect((r.breakdown as any).totalContributions).toBe(4);
    expect((r.breakdown as any).silentEnrolled).toBe(0);
  });

  it("approaches 1 when one author dominates and others are silent", () => {
    const r = participationGiniCalculator.compute(
      baseInputs({
        enrolledAuthIds: ["a", "b", "c", "d", "e"],
        contributions: Array.from({ length: 20 }).map(() => ({
          authorId: "a",
          createdAt: NOW,
          source: "argument" as const,
        })),
      }),
    );
    // 1 out of 5 holds everything → Gini = 4/5 = 0.8
    expect(r.value).toBeCloseTo(0.8, 6);
    expect((r.breakdown as any).silentEnrolled).toBe(4);
    expect((r.breakdown as any).totalSpeakers).toBe(1);
  });

  it("counts silent enrolled correctly when partial speakers", () => {
    const r = participationGiniCalculator.compute(
      baseInputs({
        enrolledAuthIds: ["a", "b", "c", "d"],
        contributions: [
          { authorId: "a", createdAt: NOW, source: "argument" },
          { authorId: "b", createdAt: NOW, source: "argument" },
        ],
      }),
    );
    expect((r.breakdown as any).silentEnrolled).toBe(2);
    expect(r.value).toBeGreaterThan(0);
  });
});

describe("challengeConcentrationCalculator", () => {
  it("degenerate with zero challenges", () => {
    const r = challengeConcentrationCalculator.compute(baseInputs());
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("degenerate with single challenger", () => {
    const r = challengeConcentrationCalculator.compute(
      baseInputs({
        challenges: Array.from({ length: 5 }).map(() => ({
          authorId: "a",
          createdAt: NOW,
          source: "conflict" as const,
        })),
      }),
    );
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("computes top-K share correctly", () => {
    // 5 authors, top 1 (ceil(0.2*5)=1) holds 7/10
    const challenges = [
      ...Array.from({ length: 7 }).map(() => "a"),
      "b",
      "c",
      "d",
    ].map((authorId) => ({ authorId, createdAt: NOW, source: "conflict" as const }));
    const r = challengeConcentrationCalculator.compute(baseInputs({ challenges }));
    expect((r.breakdown as any).topK).toBe(1);
    expect(r.value).toBeCloseTo(0.7, 6);
    expect((r.breakdown as any).windowAttackCount).toBe(10);
    expect((r.breakdown as any).uniqueChallengers).toBe(4);
  });
});

describe("responseLatencyP50Calculator", () => {
  it("degenerate when no replyables", () => {
    const r = responseLatencyP50Calculator.compute(baseInputs());
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("computes p50 / p90 from sorted latencies", () => {
    // latencies: 10, 20, 30, 40, 100 seconds
    const lat = [10, 20, 30, 40, 100];
    const replyables = lat.map((seconds, i) => ({
      id: `c_${i}`,
      postedAt: WINDOW_START,
      firstReplyAt: new Date(WINDOW_START.getTime() + seconds * 1000),
    }));
    const r = responseLatencyP50Calculator.compute(baseInputs({ replyables }));
    expect((r.breakdown as any).sampleSize).toBe(5);
    expect((r.breakdown as any).p50Seconds).toBeCloseTo(30, 6);
    // p90 = interp between idx 3 (40) and idx 4 (100) at frac 0.6 → 76
    expect((r.breakdown as any).p90Seconds).toBeCloseTo(76, 6);
  });

  it("counts unreplied items in breakdown but excludes from sample", () => {
    const replyables = [
      { id: "c_a", postedAt: WINDOW_START, firstReplyAt: new Date(WINDOW_START.getTime() + 30_000) },
      { id: "c_b", postedAt: WINDOW_START, firstReplyAt: null },
      { id: "c_c", postedAt: WINDOW_START, firstReplyAt: null },
    ];
    const r = responseLatencyP50Calculator.compute(baseInputs({ replyables }));
    expect((r.breakdown as any).sampleSize).toBe(1);
    expect((r.breakdown as any).unrepliedCount).toBe(2);
  });

  it("excludes items posted outside the window", () => {
    const before = new Date(WINDOW_START.getTime() - 60_000);
    const r = responseLatencyP50Calculator.compute(
      baseInputs({
        replyables: [
          { id: "c_old", postedAt: before, firstReplyAt: new Date(before.getTime() + 1000) },
        ],
      }),
    );
    expect((r.breakdown as any).sampleSize).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });
});

describe("attentionDeficitCalculator", () => {
  it("degenerate when no replyables", () => {
    const r = attentionDeficitCalculator.compute(baseInputs());
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("flags claims older than 1800s with no reply", () => {
    const stale = new Date(NOW.getTime() - 2000_000); // ~33 min
    const fresh = new Date(NOW.getTime() - 60_000); // 1 min
    const r = attentionDeficitCalculator.compute(
      baseInputs({
        replyables: [
          { id: "c_stale", postedAt: stale, firstReplyAt: null, weight: 5 },
          { id: "c_fresh", postedAt: fresh, firstReplyAt: null, weight: 3 },
        ],
      }),
    );
    expect(r.value).toBe(1);
    const stales = (r.breakdown as any).staleClaims as Array<{ claimId: string }>;
    expect(stales).toHaveLength(1);
    expect(stales[0].claimId).toBe("c_stale");
  });

  it("uses firstReplyAt as the reset clock", () => {
    const oldPost = new Date(NOW.getTime() - 5000_000);
    const recentReply = new Date(NOW.getTime() - 60_000);
    const r = attentionDeficitCalculator.compute(
      baseInputs({
        replyables: [
          { id: "c", postedAt: oldPost, firstReplyAt: recentReply, weight: 4 },
        ],
      }),
    );
    expect(r.value).toBe(0);
  });

  it("sorts staleClaims by staleSeconds desc", () => {
    const t = (offsetMs: number) => new Date(NOW.getTime() - offsetMs);
    const r = attentionDeficitCalculator.compute(
      baseInputs({
        replyables: [
          { id: "c_lo", postedAt: t(2_000_000), firstReplyAt: null },
          { id: "c_hi", postedAt: t(5_000_000), firstReplyAt: null },
          { id: "c_mid", postedAt: t(3_000_000), firstReplyAt: null },
        ],
      }),
    );
    const ids = ((r.breakdown as any).staleClaims as { claimId: string }[]).map((s) => s.claimId);
    expect(ids).toEqual(["c_hi", "c_mid", "c_lo"]);
  });
});

describe("facilitatorLoadCalculator", () => {
  it("degenerate with zero open and no prior action", () => {
    const r = facilitatorLoadCalculator.compute(baseInputs());
    expect(r.value).toBe(0);
    expect((r.breakdown as any).degenerate).toBe(true);
  });

  it("reports open intervention count", () => {
    const r = facilitatorLoadCalculator.compute(
      baseInputs({ facilitator: { openInterventionCount: 3, lastActionAt: null } }),
    );
    expect(r.value).toBe(3);
    expect((r.breakdown as any).openInterventions).toBe(3);
    expect((r.breakdown as any).secondsSinceLastAction).toBeNull();
  });

  it("computes secondsSinceLastAction correctly", () => {
    const last = new Date(NOW.getTime() - 120_000);
    const r = facilitatorLoadCalculator.compute(
      baseInputs({ facilitator: { openInterventionCount: 1, lastActionAt: last } }),
    );
    expect((r.breakdown as any).secondsSinceLastAction).toBe(120);
  });
});

describe("registry", () => {
  it("contains all 5 calculators in stable order", () => {
    expect(METRIC_REGISTRY.map((c) => c.kind)).toEqual([
      EquityMetricKind.PARTICIPATION_GINI,
      EquityMetricKind.CHALLENGE_CONCENTRATION,
      EquityMetricKind.RESPONSE_LATENCY_P50,
      EquityMetricKind.ATTENTION_DEFICIT,
      EquityMetricKind.FACILITATOR_LOAD,
    ]);
  });

  it("calculatorFor resolves known kinds", () => {
    expect(calculatorFor(EquityMetricKind.PARTICIPATION_GINI).version).toBe(1);
  });

  it("calculatorFor throws on unknown kind", () => {
    expect(() => calculatorFor("BOGUS" as EquityMetricKind)).toThrow();
  });
});
