/**
 * Phase 1c Invariant Tests — Cluster C witnessing reads
 *
 * Verifies:
 *   getWitnessesForMove — T4: anonymous by default, opt-in for identity
 *   getWitnessesForMove — stratum comes from joined LudicMove
 *   getWitnessesForMove — absent LudicMove → stratum null, witnessCount 0
 *   getUnwitnessedExposure — anti-join: moves with witnesses excluded
 *   getUnwitnessedExposure — stratum filter applied
 *   getUnwitnessedExposure — depth computed from locus dots
 *   getUnwitnessedExposure — limit respected
 *   getInstantiation — found via WitnessRecord → instantiated: true, locus returned
 *   getInstantiation — WitnessRecord found but LudicMove deleted → falls through
 *   getInstantiation — not found → instantiated: false
 */

import { getWitnessesForMove } from "@/server/ludics/witnessRecord";
import { getUnwitnessedExposure } from "@/server/ludics/exposure";
import { getInstantiation } from "@/server/ludics/instantiation";

// ─── Mock setup ───────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    ludicMove: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    witnessRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    commitmentLudicMapping: {
      findFirst: jest.fn(),
    },
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  ludicMove: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  witnessRecord: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  commitmentLudicMapping: {
    findFirst: jest.Mock;
  };
};

beforeEach(() => {
  prismaMock.ludicMove.findUnique.mockReset();
  prismaMock.ludicMove.findMany.mockReset();
  prismaMock.ludicMove.findFirst.mockReset();
  prismaMock.witnessRecord.findUnique.mockReset();
  prismaMock.witnessRecord.findMany.mockReset();
  prismaMock.commitmentLudicMapping.findFirst.mockReset();
});

// ─── getWitnessesForMove ──────────────────────────────────────────────────────

describe("getWitnessesForMove", () => {
  const LMIC_MOVE_ID = "lm_test_001";

  const baseRecords = [
    {
      id: "wit_001",
      ludicMoveId: LMIC_MOVE_ID,
      dialogueMoveId: "dm_001",
      participantId: "user_alice",
      canonicalText: '{"text":"foo"}',
      schemeKey: null,
      timestamp: new Date("2024-01-01T00:00:00Z"),
      fossilizedAt: null,
      retractReason: null,
    },
    {
      id: "wit_002",
      ludicMoveId: LMIC_MOVE_ID,
      dialogueMoveId: "dm_002",
      participantId: "user_bob",
      canonicalText: '{"text":"bar"}',
      schemeKey: null,
      timestamp: new Date("2024-01-02T00:00:00Z"),
      fossilizedAt: null,
      retractReason: null,
    },
  ];

  it("returns anonymous shape by default (T4 non-attribution)", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      id: LMIC_MOVE_ID,
      stratumLabel: "walked",
    });
    prismaMock.witnessRecord.findMany.mockResolvedValue(baseRecords);

    const result = await getWitnessesForMove(LMIC_MOVE_ID);

    expect(result.ludicMoveId).toBe(LMIC_MOVE_ID);
    expect(result.witnessCount).toBe(2);
    expect(result.stratum).toBe("walked");
    // T4: participantId must NOT be present in any entry
    for (const entry of result.witnesses) {
      expect(entry).not.toHaveProperty("participantId");
    }
  });

  it("includes participantId when includeIdentity: true", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      id: LMIC_MOVE_ID,
      stratumLabel: "witnessable",
    });
    prismaMock.witnessRecord.findMany.mockResolvedValue(baseRecords);

    const result = await getWitnessesForMove(LMIC_MOVE_ID, { includeIdentity: true });

    expect(result.witnessCount).toBe(2);
    expect(result.witnesses[0].participantId).toBe("user_alice");
    expect(result.witnesses[1].participantId).toBe("user_bob");
  });

  it("returns stratum from joined LudicMove", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      id: LMIC_MOVE_ID,
      stratumLabel: "latent",
    });
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getWitnessesForMove(LMIC_MOVE_ID);

    expect(result.stratum).toBe("latent");
    expect(result.witnessCount).toBe(0);
  });

  it("returns stratum: null and witnessCount: 0 when LudicMove not found", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(null);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getWitnessesForMove("lm_nonexistent");

    expect(result.stratum).toBeNull();
    expect(result.witnessCount).toBe(0);
    expect(result.witnesses).toHaveLength(0);
  });

  it("querying witnesses uses fossilizedAt: null filter", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({ id: LMIC_MOVE_ID, stratumLabel: "walked" });
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    await getWitnessesForMove(LMIC_MOVE_ID);

    expect(prismaMock.witnessRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ludicMoveId: LMIC_MOVE_ID, fossilizedAt: null }),
      }),
    );
  });
});

// ─── getUnwitnessedExposure ───────────────────────────────────────────────────

describe("getUnwitnessedExposure", () => {
  const DELIBERATION_ID = "delib_001";

  it("anti-join: excludes moves with active WitnessRecords", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([
      { id: "lm_1", locus: "⊢A", moveType: "positive" },
      { id: "lm_2", locus: "⊢A.1", moveType: "negative" },
    ]);
    // lm_1 is witnessed; lm_2 is not
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "witnessable", 20);

    expect(result.totalUnwitnessed).toBe(1);
    expect(result.unwitnessed).toHaveLength(1);
    expect(result.unwitnessed[0].ludicMoveId).toBe("lm_2");
  });

  it("returns empty result when all moves are witnessed", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([
      { id: "lm_1", locus: "⊢A", moveType: "positive" },
    ]);
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "witnessable", 20);

    expect(result.totalUnwitnessed).toBe(0);
    expect(result.unwitnessed).toHaveLength(0);
  });

  it("returns empty result when no LudicMoves exist", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "witnessable", 20);

    expect(result.totalUnwitnessed).toBe(0);
    expect(result.unwitnessed).toHaveLength(0);
    // witnessRecord.findMany should not be called when no moves
    expect(prismaMock.witnessRecord.findMany).not.toHaveBeenCalled();
  });

  it("depth is computed from locus dots", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([
      { id: "lm_1", locus: "⊢A", moveType: "positive" },       // depth 0
      { id: "lm_2", locus: "⊢A.1", moveType: "negative" },      // depth 1
      { id: "lm_3", locus: "⊢A.1.2", moveType: "daimon" },   // depth 2
    ]);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "witnessable", 20);

    const depths = result.unwitnessed.map((m) => m.depth);
    expect(depths).toEqual([0, 1, 2]);
  });

  it("respects limit parameter", async () => {
    const moves = Array.from({ length: 10 }, (_, i) => ({
      id: `lm_${i}`,
      locus: `⊢A.${i}`,
      moveType: "negative",
    }));
    prismaMock.ludicMove.findMany.mockResolvedValue(moves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "witnessable", 3);

    expect(result.unwitnessed).toHaveLength(3);
    expect(result.totalUnwitnessed).toBe(10);
  });

  it("stratum is reflected in the result", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([]);

    const result = await getUnwitnessedExposure(DELIBERATION_ID, "latent", 20);

    expect(result.stratum).toBe("latent");
  });
});

// ─── getInstantiation ─────────────────────────────────────────────────────────

describe("getInstantiation", () => {
  const DIALOGUE_MOVE_ID = "dm_test_001";

  it("returns instantiated: true with locus data when WitnessRecord found", async () => {
    prismaMock.witnessRecord.findUnique.mockResolvedValue({ ludicMoveId: "lm_abc" });
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      id: "lm_abc",
      locus: "⊢A.1",
      moveType: "negative",
    });

    const result = await getInstantiation(DIALOGUE_MOVE_ID);

    expect(result.instantiated).toBe(true);
    if (result.instantiated) {
      expect(result.ludicMoveId).toBe("lm_abc");
      expect(result.locus).toBe("⊢A.1");
      expect(result.moveType).toBe("negative");
      expect(result.wouldTriggerDelocation).toBe(false);
    }
  });

  it("falls through to not-found when WitnessRecord has dangling ludicMoveId", async () => {
    prismaMock.witnessRecord.findUnique.mockResolvedValue({ ludicMoveId: "lm_dangling" });
    prismaMock.ludicMove.findUnique.mockResolvedValue(null); // dangling
    prismaMock.commitmentLudicMapping.findFirst.mockResolvedValue(null);
    prismaMock.ludicMove.findFirst.mockResolvedValue(null);

    const result = await getInstantiation(DIALOGUE_MOVE_ID);

    expect(result.instantiated).toBe(false);
  });

  it("returns instantiated: false when no WitnessRecord and no mapping", async () => {
    prismaMock.witnessRecord.findUnique.mockResolvedValue(null);
    prismaMock.commitmentLudicMapping.findFirst.mockResolvedValue(null);
    prismaMock.ludicMove.findFirst.mockResolvedValue(null);

    const result = await getInstantiation(DIALOGUE_MOVE_ID);

    expect(result.instantiated).toBe(false);
    if (!result.instantiated) {
      expect(result.wouldTriggerDelocation).toBe(false);
    }
  });

  it("wouldTriggerDelocation is true when LudicMoves exist in the system", async () => {
    prismaMock.witnessRecord.findUnique.mockResolvedValue(null);
    prismaMock.commitmentLudicMapping.findFirst.mockResolvedValue(null);
    prismaMock.ludicMove.findFirst.mockResolvedValue({ id: "lm_some" }); // moves exist

    const result = await getInstantiation(DIALOGUE_MOVE_ID);

    expect(result.instantiated).toBe(false);
    if (!result.instantiated) {
      expect(result.wouldTriggerDelocation).toBe(true);
    }
  });
});
