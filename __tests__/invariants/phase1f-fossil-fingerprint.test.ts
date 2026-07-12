/**
 * Phase 1f invariant tests — fossil record + briefing fingerprint.
 *
 * Covers:
 *   - getFossilRecord: correct fossil entry shape, T4 invariant, limit, includeActive
 *   - computeBriefingFingerprint: material field extraction, hash stability, null readout
 *   - checkBriefingFingerprint: staleness rules R1–R5, no-change (stale: false)
 *   - evaluateStalenessRules: unit tests for each rule
 */

import { getFossilRecord } from "@/server/ludics/fossilRecord";
import {
  computeBriefingFingerprint,
  checkBriefingFingerprint,
  evaluateStalenessRules,
  type MaterialFields,
} from "@/server/ludics/briefingFingerprint";

// ── Mock prisma ──────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    witnessRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock("@/lib/prismaclient");

// ── Mock syntheticReadout ────────────────────────────────────────────────────

jest.mock("@/lib/deliberation/syntheticReadout", () => ({
  computeSyntheticReadout: jest.fn(),
}));

const { computeSyntheticReadout } = jest.requireMock(
  "@/lib/deliberation/syntheticReadout",
);

// ── Mock cqPrioritizer ───────────────────────────────────────────────────────

jest.mock("@/lib/deliberation/cqPrioritizer", () => ({
  derivePrioritizedOpenCqs: jest.fn(),
}));

const { derivePrioritizedOpenCqs } = jest.requireMock(
  "@/lib/deliberation/cqPrioritizer",
);

// ── Mock deliberationSchema ──────────────────────────────────────────────────

jest.mock("@/server/ludics/deliberationSchema", () => ({
  getDeliberationSchema: jest.fn(),
}));

const { getDeliberationSchema } = jest.requireMock(
  "@/server/ludics/deliberationSchema",
);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DELIBERATION_ID = "delib-test-1f";

function makeFossilRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "wr-fossil-1",
    ludicMoveId: "lm-fossil-1",
    dialogueMoveId: "dm-fossil-1",
    participantId: "user-secret",
    canonicalText: "Some claim text",
    schemeKey: null,
    timestamp: new Date("2025-01-01T10:00:00Z"),
    fossilizedAt: new Date("2025-01-02T10:00:00Z"),
    retractLayer: "argument_superseded",
    retractReason: null,
    ludicMove: { locus: "⊢A.1" },
    ...overrides,
  };
}

function makeReadout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topology: {
      hubs: {
        set: [{ argumentId: "arg-hub-1", score: 95 }],
        shape: "single-dominant",
        topScore: 95,
        coequalThreshold: 19,
      },
    },
    frontier: {
      loadBearingnessRanking: [
        "arg-1", "arg-2", "arg-3", "arg-4", "arg-5",
        "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
      ],
    },
    refusalSurface: {
      cannotConcludeBecause: [
        { conclusionClaimId: "claim-A" },
        { conclusionClaimId: "claim-B" },
      ],
    },
    ...overrides,
  };
}

function makeCqs(
  ids: string[],
): Array<{ id: string; targetArgumentId: string; targetsHub: boolean }> {
  return ids.map((id) => ({
    id,
    targetArgumentId: id.split("::")[0],
    targetsHub: false,
  }));
}

function makeSchema(witnessableLoci = 5, latentLoci = 3) {
  return {
    witnessingSummary: {
      walkedLoci: 10,
      witnessableLoci,
      latentLoci,
      coverageRatio: 0.5,
    },
    openExposurePoints: witnessableLoci + latentLoci,
  };
}

// ── Helpers for test isolation ────────────────────────────────────────────────

function resetFingerprintCache() {
  // Force a fresh state by computing with a unique deliberation id
  // The module-level cache cannot be cleared from tests, but we can use
  // unique deliberation ids per test to avoid cross-contamination.
}

// ── getFossilRecord ──────────────────────────────────────────────────────────

describe("getFossilRecord", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns fossil entries with correct shape", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([makeFossilRow()]);
    prisma.witnessRecord.count.mockResolvedValue(1);

    const result = await getFossilRecord({ deliberationId: DELIBERATION_ID });

    expect(result.fossils).toHaveLength(1);
    const fossil = result.fossils[0];
    expect(fossil.witnessId).toBe("wr-fossil-1");
    expect(fossil.ludicMoveId).toBe("lm-fossil-1");
    expect(fossil.locus).toBe("⊢A.1");
    expect(fossil.retractedAt).toBe("2025-01-02T10:00:00.000Z");
    expect(fossil.retractLayer).toBe("argument_superseded");
    expect(fossil.dialogueMoveId).toBe("dm-fossil-1");
    expect(fossil.canonicalText).toBe("Some claim text");
    expect(result.totalFossils).toBe(1);
  });

  it("T4 invariant: participantId is absent by default", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([makeFossilRow()]);
    prisma.witnessRecord.count.mockResolvedValue(1);

    const result = await getFossilRecord({ deliberationId: DELIBERATION_ID });
    expect(result.fossils[0]).not.toHaveProperty("participantId");
  });

  it("includes participantId when includeIdentity: true", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([makeFossilRow()]);
    prisma.witnessRecord.count.mockResolvedValue(1);

    const result = await getFossilRecord({
      deliberationId: DELIBERATION_ID,
      includeIdentity: true,
    });
    expect(result.fossils[0].participantId).toBe("user-secret");
  });

  it("respects limit (capped at 200)", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([]);
    prisma.witnessRecord.count.mockResolvedValue(0);

    await getFossilRecord({ deliberationId: DELIBERATION_ID, limit: 300 });

    const call = prisma.witnessRecord.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(call.take).toBe(200);
  });

  it("returns activeCount when includeActive: true", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([]);
    prisma.witnessRecord.count
      .mockResolvedValueOnce(0) // totalFossils
      .mockResolvedValueOnce(7); // activeCount

    const result = await getFossilRecord({
      deliberationId: DELIBERATION_ID,
      includeActive: true,
    });
    expect(result.activeCount).toBe(7);
  });

  it("omits activeCount when includeActive: false (default)", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([]);
    prisma.witnessRecord.count.mockResolvedValue(0);

    const result = await getFossilRecord({ deliberationId: DELIBERATION_ID });
    expect(result.activeCount).toBeUndefined();
  });

  it("accepts ludicMoveId as scope instead of deliberationId", async () => {
    prisma.witnessRecord.findMany.mockResolvedValue([]);
    prisma.witnessRecord.count.mockResolvedValue(0);

    const result = await getFossilRecord({ ludicMoveId: "lm-specific" });
    expect(result.fossils).toHaveLength(0);
    expect(result.totalFossils).toBe(0);
  });
});

// ── computeBriefingFingerprint ───────────────────────────────────────────────

describe("computeBriefingFingerprint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when readout is null", async () => {
    computeSyntheticReadout.mockResolvedValue(null);

    const result = await computeBriefingFingerprint("delib-null-readout");
    expect(result).toBeNull();
  });

  it("returns contentHash, computedAt, and materialFields", async () => {
    const delib = `delib-fp-basic-${Date.now()}`;
    computeSyntheticReadout.mockResolvedValue(makeReadout());
    derivePrioritizedOpenCqs.mockReturnValue(makeCqs(["arg-1::CQ1", "arg-2::CQ2"]));
    getDeliberationSchema.mockResolvedValue(makeSchema(5, 3));

    const result = await computeBriefingFingerprint(delib);
    expect(result).not.toBeNull();
    expect(result!.contentHash).toMatch(/^sha256:/);
    expect(result!.computedAt).toBeTruthy();
    expect(result!.materialFields.hubSet).toEqual(["arg-hub-1"]);
    expect(result!.materialFields.hubShape).toBe("single-dominant");
    expect(result!.materialFields.loadBearingRankingTop10).toHaveLength(10);
    expect(result!.materialFields.refusalCount).toBe(2);
    expect(result!.materialFields.prioritizedCqTop15).toEqual(["arg-1::CQ1", "arg-2::CQ2"]);
    expect(result!.materialFields.openExposurePoints).toBe(8); // 5 + 3
  });

  it("hash is deterministic for the same material fields", async () => {
    const delib = `delib-fp-deterministic-${Date.now()}`;
    const readout = makeReadout();
    computeSyntheticReadout.mockResolvedValue(readout);
    derivePrioritizedOpenCqs.mockReturnValue(makeCqs(["arg-1::CQ1"]));
    getDeliberationSchema.mockResolvedValue(makeSchema(5, 0));

    const r1 = await computeBriefingFingerprint(delib);
    const r2 = await computeBriefingFingerprint(delib);
    expect(r1!.contentHash).toBe(r2!.contentHash);
  });

  it("openExposurePoints falls back to 0 when schema throws", async () => {
    const delib = `delib-fp-schema-error-${Date.now()}`;
    computeSyntheticReadout.mockResolvedValue(makeReadout());
    derivePrioritizedOpenCqs.mockReturnValue([]);
    getDeliberationSchema.mockRejectedValue(new Error("Schema not found"));

    const result = await computeBriefingFingerprint(delib);
    expect(result!.materialFields.openExposurePoints).toBe(0);
  });
});

// ── checkBriefingFingerprint ─────────────────────────────────────────────────

describe("checkBriefingFingerprint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns stale: false when hash matches current fingerprint", async () => {
    const delib = `delib-chk-nochange-${Date.now()}`;
    computeSyntheticReadout.mockResolvedValue(makeReadout());
    derivePrioritizedOpenCqs.mockReturnValue(makeCqs(["arg-1::CQ1"]));
    getDeliberationSchema.mockResolvedValue(makeSchema(3, 1));

    const computed = await computeBriefingFingerprint(delib);
    expect(computed).not.toBeNull();

    // Same readout — same hash
    computeSyntheticReadout.mockResolvedValue(makeReadout());
    derivePrioritizedOpenCqs.mockReturnValue(makeCqs(["arg-1::CQ1"]));
    getDeliberationSchema.mockResolvedValue(makeSchema(3, 1));

    const result = await checkBriefingFingerprint(delib, computed!.contentHash);
    expect(result.stale).toBe(false);
  });

  it("returns stale: R1 for unknown/expired hash", async () => {
    const delib = `delib-chk-unknown-${Date.now()}`;
    computeSyntheticReadout.mockResolvedValue(makeReadout());
    derivePrioritizedOpenCqs.mockReturnValue([]);
    getDeliberationSchema.mockResolvedValue(makeSchema(0, 0));

    const result = await checkBriefingFingerprint(delib, "sha256:nonexistent");
    expect(result.stale).toBe("R1");
  });

  it("returns stale: R1 when readout is null", async () => {
    computeSyntheticReadout.mockResolvedValue(null);
    const result = await checkBriefingFingerprint("delib-chk-null", "sha256:any");
    expect(result.stale).toBe("R1");
  });
});

// ── evaluateStalenessRules ───────────────────────────────────────────────────

describe("evaluateStalenessRules", () => {
  function baseFields(): MaterialFields {
    return {
      hubSet: ["arg-hub-1"],
      hubShape: "single-dominant",
      loadBearingRankingTop10: [
        "arg-1", "arg-2", "arg-3", "arg-4", "arg-5",
        "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
      ],
      openExposurePoints: 20,
      refusalCount: 2,
      prioritizedCqTop15: ["arg-1::CQ1", "arg-2::CQ2"],
      refusalConclusionIds: ["claim-A", "claim-B"],
    };
  }

  it("returns null when nothing changed", () => {
    const prev = baseFields();
    const curr = baseFields();
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });

  it("R1: fires when hubSet changes", () => {
    const prev = baseFields();
    const curr = { ...baseFields(), hubSet: ["arg-hub-2"] };
    expect(evaluateStalenessRules(prev, curr)).toBe("R1");
  });

  it("R1: fires when hubShape changes", () => {
    const prev = baseFields();
    const curr = { ...baseFields(), hubShape: "co-equal-cluster" };
    expect(evaluateStalenessRules(prev, curr)).toBe("R1");
  });

  it("R2: fires when a new refusal conclusion is added", () => {
    const prev = baseFields();
    const curr = {
      ...baseFields(),
      refusalConclusionIds: ["claim-A", "claim-B", "claim-NEW"],
      refusalCount: 3,
    };
    expect(evaluateStalenessRules(prev, curr)).toBe("R2");
  });

  it("R3: fires when top-5 loadBearingRanking shifts by 1 position", () => {
    const prev = baseFields();
    const curr = {
      ...baseFields(),
      loadBearingRankingTop10: [
        "arg-2", "arg-1", "arg-3", "arg-4", "arg-5", // swapped positions
        "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
      ],
    };
    expect(evaluateStalenessRules(prev, curr)).toBe("R3");
  });

  it("R3: does not fire when only positions 6–10 changed", () => {
    const prev = baseFields();
    const curr = {
      ...baseFields(),
      loadBearingRankingTop10: [
        "arg-1", "arg-2", "arg-3", "arg-4", "arg-5",
        "arg-9", "arg-7", "arg-8", "arg-6", "arg-10", // only positions 6–10 shuffled
      ],
    };
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });

  it("R4: fires when a new hub-targeting CQ enters top-15", () => {
    const prev = baseFields();
    // prev has hubSet = ["arg-hub-1"]; new CQ targets the hub
    const curr = {
      ...baseFields(),
      prioritizedCqTop15: ["arg-1::CQ1", "arg-hub-1::CQ_HUB"], // arg-hub-1::CQ_HUB is new
    };
    expect(evaluateStalenessRules(prev, curr)).toBe("R4");
  });

  it("R4: does not fire when new CQ in top-15 does not target a hub", () => {
    const prev = baseFields();
    const curr = {
      ...baseFields(),
      prioritizedCqTop15: ["arg-1::CQ1", "arg-nonhub::CQ2"], // arg-nonhub is not a hub
    };
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });

  it("R5: fires when openExposurePoints increases by ≥10", () => {
    const prev = baseFields();
    const curr = { ...baseFields(), openExposurePoints: 30 }; // 30 - 20 = 10
    expect(evaluateStalenessRules(prev, curr)).toBe("R5");
  });

  it("R5: does not fire when increase is < 10", () => {
    const prev = baseFields();
    const curr = { ...baseFields(), openExposurePoints: 29 }; // 29 - 20 = 9
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });

  it("R5: does not fire when openExposurePoints decreased", () => {
    const prev = baseFields();
    const curr = { ...baseFields(), openExposurePoints: 5 };
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });

  it("rules fire in R1–R5 priority order", () => {
    // Both R1 and R5 conditions satisfied — R1 should win
    const prev = baseFields();
    const curr = {
      ...baseFields(),
      hubSet: ["arg-hub-X"], // R1
      openExposurePoints: 35, // R5
    };
    expect(evaluateStalenessRules(prev, curr)).toBe("R1");
  });
});
