/**
 * Phase 1d.2 invariant — `getStratumLabel` verify-on-read (B2)
 *
 * Pins the substrate contract from LUDICS_SESSION_1_DEV_SPEC.md §4.1
 * NOTE *[ADDED post-review, Tier 3.10]*: stratumLabel is a stored cache;
 * `getStratumLabel(ludicMoveId)` recomputes the authoritative value from
 * WitnessRecord + tree adjacency and WARNs on mismatch with the stored
 * column.
 */

import { getStratumLabel } from "@/server/ludics/stratum";

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    ludicMove: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    witnessRecord: {
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  ludicMove: { findUnique: jest.Mock; findMany: jest.Mock };
  witnessRecord: { findMany: jest.Mock };
};

const DELIB = "delib_stratum_001";

const moves = [
  { id: "lm_root", deliberationId: DELIB, locus: "⊢A" },
  { id: "lm_a1", deliberationId: DELIB, locus: "⊢A.1" },
  { id: "lm_a2", deliberationId: DELIB, locus: "⊢A.2" },
  { id: "lm_a11", deliberationId: DELIB, locus: "⊢A.1.1" },
];

function moveWithStored(id: string, stratumLabel: string) {
  const m = moves.find((x) => x.id === id)!;
  return { ...m, stratumLabel };
}

beforeEach(() => {
  prismaMock.ludicMove.findUnique.mockReset();
  prismaMock.ludicMove.findMany.mockReset();
  prismaMock.witnessRecord.findMany.mockReset();
});

describe("getStratumLabel — verify-on-read (B2)", () => {
  it("returns null when the move id does not exist", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(null);
    const result = await getStratumLabel("missing");
    expect(result).toBeNull();
  });

  it("returns 'walked' when the move has an active witness", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a1", "walked"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a1" },
    ]);

    const result = await getStratumLabel("lm_a1");
    expect(result).toBe("walked");
  });

  it("returns 'witnessable' for parent of a walked locus", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a1", "witnessable"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    // lm_a11 (⊢A.1.1) is walked → its parent lm_a1 (⊢A.1) is witnessable
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a11" },
    ]);

    const result = await getStratumLabel("lm_a1");
    expect(result).toBe("witnessable");
  });

  it("returns 'witnessable' for child of a walked locus", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a11", "witnessable"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    // lm_a1 is walked → its child lm_a11 is witnessable
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a1" },
    ]);

    const result = await getStratumLabel("lm_a11");
    expect(result).toBe("witnessable");
  });

  it("returns 'latent' when neither the move nor any adjacent move is walked", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a2", "latent"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    // lm_a11 is walked; lm_a2 is a sibling — not adjacent (distance 2 via parent lm_root)
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a11" },
    ]);

    const result = await getStratumLabel("lm_a2");
    expect(result).toBe("latent");
  });

  it("WARNs with a substrate_violation event when stored label is stale", async () => {
    // Stored says "latent" but lm_a1 has an active witness → authoritative is "walked"
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a1", "latent"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a1" },
    ]);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await getStratumLabel("lm_a1");
      expect(result).toBe("walked");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(warnSpy.mock.calls[0][0] as string);
      expect(payload).toMatchObject({
        event: "substrate_violation",
        kind: "stratum_label_drift",
        ludicMoveId: "lm_a1",
        stored: "latent",
        authoritative: "walked",
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT WARN when stored label matches the authoritative value", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(
      moveWithStored("lm_a1", "walked"),
    );
    prismaMock.ludicMove.findMany.mockResolvedValue(
      moves.map((m) => ({ id: m.id, locus: m.locus })),
    );
    prismaMock.witnessRecord.findMany.mockResolvedValue([
      { ludicMoveId: "lm_a1" },
    ]);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await getStratumLabel("lm_a1");
      expect(result).toBe("walked");
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
