/**
 * Phase 1d Invariant Tests — Cluster F + A structural reads
 *
 * Verifies:
 *   getDeliberationSchema — locusCount, witnessingSummary, openExposurePoints
 *   getDeliberationSchema — designTree shape, depth computation
 *   getDeliberationSchema — empty deliberation (no LudicMoves) returns zero counts
 *   getDeliberationSchema — walked loci derived from WitnessRecord, not stratumLabel
 *   getBehaviourAtLocus — returns incarnations with correct stratum + fitness
 *   getBehaviourAtLocus — bottom = design with fewest loci
 *   getBehaviourAtLocus — returns null when no Behaviour at locus
 *   computeExposureMap — strata partitioned correctly from witnessRecord + stratumLabel
 *   computeExposureMap — topology hubSet = loci with ≥ 2 children
 *   computeExposureMap — loadBearingRanking ordered by subtree size
 *   computeExposureMap — cascade field included only when includeCascade: true
 *   computeExposureMap — empty deliberation returns zero strata
 *   T4 invariant — no participantId in any response field
 */

import { getDeliberationSchema } from "@/server/ludics/deliberationSchema";
import { getBehaviourAtLocus } from "@/server/ludics/behaviourAtLocus";
import { computeExposureMap } from "@/server/ludics/exposureMap";

// ─── Mock setup ───────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    ludicMove: {
      findMany: jest.fn(),
    },
    witnessRecord: {
      findMany: jest.fn(),
    },
    design: {
      findMany: jest.fn(),
    },
    behaviour: {
      findUnique: jest.fn(),
    },
    designInclusion: {
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  ludicMove: { findMany: jest.Mock };
  witnessRecord: { findMany: jest.Mock };
  design: { findMany: jest.Mock };
  behaviour: { findUnique: jest.Mock };
  designInclusion: { findMany: jest.Mock };
};

beforeEach(() => {
  prismaMock.ludicMove.findMany.mockReset();
  prismaMock.witnessRecord.findMany.mockReset();
  prismaMock.design.findMany.mockReset();
  prismaMock.behaviour.findUnique.mockReset();
  prismaMock.designInclusion.findMany.mockReset();
  // Default: no inclusion edges (each base is its own cone)
  prismaMock.designInclusion.findMany.mockResolvedValue([]);
});

// ─── getDeliberationSchema ────────────────────────────────────────────────────

describe("getDeliberationSchema", () => {
  const DELIB_ID = "delib_schema_001";

  const baseMoves = [
    { id: "lm_1", locus: "⊢A", moveType: "positive", stratumLabel: "walked" },
    { id: "lm_2", locus: "⊢A.1", moveType: "negative", stratumLabel: "witnessable" },
    { id: "lm_3", locus: "⊢A.2", moveType: "negative", stratumLabel: "witnessable" },
    { id: "lm_4", locus: "⊢A.1.1", moveType: "daimon", stratumLabel: "latent" },
  ];

  it("returns correct locus count and stratum counts", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    // lm_1 is witnessed (walked), lm_2 and lm_3 are witnessable, lm_4 is latent
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await getDeliberationSchema(DELIB_ID, false);

    expect(result).not.toBeNull();
    expect(result!.locusCount).toBe(4);
    expect(result!.witnessingSummary.walkedLoci).toBe(1);
    expect(result!.witnessingSummary.witnessableLoci).toBe(2);
    expect(result!.witnessingSummary.latentLoci).toBe(1);
    expect(result!.witnessingSummary.coverageRatio).toBeCloseTo(0.25);
    expect(result!.openExposurePoints).toBe(3);
  });

  it("walked loci come from WitnessRecord, not stratumLabel", async () => {
    // lm_1 has stratumLabel "walked" but no WitnessRecord → should NOT be counted as walked
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]); // no witnesses

    const result = await getDeliberationSchema(DELIB_ID, false);

    expect(result!.witnessingSummary.walkedLoci).toBe(0);
    expect(result!.openExposurePoints).toBe(4);
  });

  it("returns zero counts for empty deliberation", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([]);

    const result = await getDeliberationSchema(DELIB_ID, false);

    expect(result).not.toBeNull();
    expect(result!.locusCount).toBe(0);
    expect(result!.witnessingSummary.walkedLoci).toBe(0);
    expect(result!.openExposurePoints).toBe(0);
    expect(result!.witnessingSummary.coverageRatio).toBe(0);
  });

  it("builds designTree with correct parent-child structure", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getDeliberationSchema(DELIB_ID, true);

    expect(result!.designTree).not.toBeNull();
    const tree = result!.designTree!;
    // Root should be ⊢A
    expect(tree).toHaveLength(1);
    expect(tree[0].locus).toBe("⊢A");
    expect(tree[0].depth).toBe(0);
    // ⊢A should have 2 children: ⊢A.1 and ⊢A.2
    expect(tree[0].children).toHaveLength(2);
    const childLoci = tree[0].children.map((c: any) => c.locus).sort();
    expect(childLoci).toEqual(["⊢A.1", "⊢A.2"]);
    // ⊢A.1 should have 1 child: ⊢A.1.1
    const childA1 = tree[0].children.find((c: any) => c.locus === "⊢A.1");
    expect(childA1!.children).toHaveLength(1);
    expect(childA1!.children[0].locus).toBe("⊢A.1.1");
    expect(childA1!.children[0].depth).toBe(2);
  });

  it("returns null designTree when includeDesignTree: false", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getDeliberationSchema(DELIB_ID, false);

    expect(result!.designTree).toBeNull();
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await getDeliberationSchema(DELIB_ID, true);

    const json = JSON.stringify(result);
    expect(json).not.toContain("participantId");
  });
});

// ─── getBehaviourAtLocus ──────────────────────────────────────────────────────

describe("getBehaviourAtLocus", () => {
  const DELIB_ID = "delib_bal_001";
  const LOCUS = "⊢A";

  it("returns null when no Behaviour exists at the locus", async () => {
    prismaMock.behaviour.findUnique.mockResolvedValue(null);

    const result = await getBehaviourAtLocus(DELIB_ID, LOCUS);

    expect(result).toBeNull();
  });

  it("returns incarnations with correct stratum derived from witnesses", async () => {
    prismaMock.behaviour.findUnique.mockResolvedValue({ id: "beh_001" });
    prismaMock.design.findMany.mockResolvedValue([
      { id: "des_001", loci: ["⊢A", "⊢A.1"], derivedBy: null, argumentId: null },
      { id: "des_002", loci: ["⊢A"], derivedBy: null, argumentId: null },
    ]);
    prismaMock.ludicMove.findMany.mockResolvedValue([
      { id: "lm_1", designId: "des_001", stratumLabel: "walked" },
      { id: "lm_2", designId: "des_001", stratumLabel: "witnessable" },
      { id: "lm_3", designId: "des_002", stratumLabel: "latent" },
    ]);
    // lm_1 is witnessed → des_001 is "walked"
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await getBehaviourAtLocus(DELIB_ID, LOCUS);

    expect(result).not.toBeNull();
    expect(result!.behaviourId).toBe("beh_001");
    expect(result!.incarnationCount).toBe(2);

    const des1 = result!.incarnations.find((i) => i.designId === "des_001")!;
    expect(des1.stratum).toBe("walked");
    expect(des1.fitness).toBeCloseTo(0.5); // 1/2 moves witnessed

    const des2 = result!.incarnations.find((i) => i.designId === "des_002")!;
    expect(des2.stratum).toBe("latent");
    expect(des2.fitness).toBe(0);
  });

  it("cones expose per-cone minima (Phase 2e antichain)", async () => {
    prismaMock.behaviour.findUnique.mockResolvedValue({ id: "beh_001" });
    prismaMock.design.findMany.mockResolvedValue([
      { id: "des_small", loci: ["⊢A"], derivedBy: null, argumentId: null },
      { id: "des_large", loci: ["⊢A", "⊢A.1", "⊢A.2"], derivedBy: "join", argumentId: null },
    ]);
    prismaMock.ludicMove.findMany.mockResolvedValue([]);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getBehaviourAtLocus(DELIB_ID, LOCUS);

    expect(result!.cones).toHaveLength(1);
    expect(result!.cones[0].bottomIncarnationDesignId).toBe("des_small");
    const small = result!.incarnations.find((i) => i.designId === "des_small")!;
    expect(small.isConeBottom).toBe(true);
    const large = result!.incarnations.find((i) => i.designId === "des_large")!;
    expect(large.isConeBottom).toBe(false);
  });

  it("returns empty incarnations list when no Designs exist", async () => {
    prismaMock.behaviour.findUnique.mockResolvedValue({ id: "beh_002" });
    prismaMock.design.findMany.mockResolvedValue([]);

    const result = await getBehaviourAtLocus(DELIB_ID, LOCUS);

    expect(result).not.toBeNull();
    expect(result!.incarnationCount).toBe(0);
    expect(result!.cones).toEqual([]);
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.behaviour.findUnique.mockResolvedValue({ id: "beh_001" });
    prismaMock.design.findMany.mockResolvedValue([{ id: "des_001", loci: ["⊢A"], derivedBy: null, argumentId: null }]);
    prismaMock.ludicMove.findMany.mockResolvedValue([]);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await getBehaviourAtLocus(DELIB_ID, LOCUS);

    const json = JSON.stringify(result);
    expect(json).not.toContain("participantId");
  });
});

// ─── computeExposureMap ───────────────────────────────────────────────────────

describe("computeExposureMap", () => {
  const DELIB_ID = "delib_em_001";

  const baseMoves = [
    { id: "lm_1", locus: "⊢A", moveType: "positive", stratumLabel: "walked" },
    { id: "lm_2", locus: "⊢A.1", moveType: "negative", stratumLabel: "witnessable" },
    { id: "lm_3", locus: "⊢A.2", moveType: "negative", stratumLabel: "witnessable" },
    { id: "lm_4", locus: "⊢A.1.1", moveType: "daimon", stratumLabel: "latent" },
  ];

  it("partitions moves into strata based on witnesses", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    // lm_1 has a witness → walked; lm_2 is witnessable, lm_4 is latent
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await computeExposureMap(DELIB_ID, { stratifyDepth: 1, includeTopology: false });

    // lm_1 is walked
    expect(result.strata.walked.map((n) => n.id)).toContain("lm_1");
    // lm_2 and lm_3 are witnessable (stored label + within depth 1 of lm_1)
    const witnessableIds = result.strata.witnessable.map((n) => n.id);
    expect(witnessableIds).toContain("lm_2");
    expect(witnessableIds).toContain("lm_3");
    // lm_4 is latent (depth 2, stored label "latent")
    expect(result.strata.latent.map((n) => n.id)).toContain("lm_4");
  });

  it("topology hubSet = loci with ≥ 2 children", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await computeExposureMap(DELIB_ID, { includeTopology: true });

    expect(result.topology).not.toBeNull();
    // ⊢A has 2 children (⊢A.1 and ⊢A.2) → lm_1 should be in hubSet
    expect(result.topology!.hubSet).toContain("lm_1");
    // ⊢A.1 has 1 child (⊢A.1.1) → lm_2 should NOT be in hubSet
    expect(result.topology!.hubSet).not.toContain("lm_2");
  });

  it("loadBearingRanking ordered by subtree size descending", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await computeExposureMap(DELIB_ID, { includeTopology: true });

    // ⊢A has subtree size 4 (all nodes), ⊢A.1 has size 2, ⊢A.2 has size 1, ⊢A.1.1 has size 1
    const ranking = result.topology!.loadBearingRanking;
    expect(ranking[0]).toBe("lm_1"); // ⊢A — largest subtree
    // lm_2 (⊢A.1, size 2) should come before lm_3 and lm_4 (size 1)
    expect(ranking.indexOf("lm_2")).toBeLessThan(ranking.indexOf("lm_3"));
  });

  it("cascade field is absent by default", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await computeExposureMap(DELIB_ID, { includeCascade: false });

    for (const stratum of Object.values(result.strata)) {
      for (const node of stratum as any[]) {
        expect(node).not.toHaveProperty("cascade");
      }
    }
  });

  it("cascade field is present on non-walked nodes when includeCascade: true", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    // lm_1 is walked
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await computeExposureMap(DELIB_ID, {
      includeCascade: true,
      includeTopology: false,
    });

    // lm_2 (⊢A.1) should have cascade = [lm_4] (its child ⊢A.1.1)
    const lm2 = result.strata.witnessable.find((n) => n.id === "lm_2");
    expect(lm2).toBeDefined();
    expect(lm2!.cascade).toContain("lm_4");

    // lm_3 (⊢A.2) has no children → empty cascade
    const lm3 = result.strata.witnessable.find((n) => n.id === "lm_3");
    expect(lm3!.cascade).toHaveLength(0);
  });

  it("returns empty strata for deliberation with no LudicMoves", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue([]);

    const result = await computeExposureMap(DELIB_ID, { includeTopology: true });

    expect(result.strata.walked).toHaveLength(0);
    expect(result.strata.witnessable).toHaveLength(0);
    expect(result.strata.latent).toHaveLength(0);
    expect(result.topology!.totalNodes).toBe(0);
    expect(result.topology!.hubSet).toHaveLength(0);
  });

  it("T4 invariant: no participantId in any ExposureNode", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([{ ludicMoveId: "lm_1" }]);

    const result = await computeExposureMap(DELIB_ID, {
      includeCascade: true,
      includeTopology: true,
    });

    const json = JSON.stringify(result);
    expect(json).not.toContain("participantId");
  });

  it("topology is null when includeTopology: false", async () => {
    prismaMock.ludicMove.findMany.mockResolvedValue(baseMoves);
    prismaMock.witnessRecord.findMany.mockResolvedValue([]);

    const result = await computeExposureMap(DELIB_ID, { includeTopology: false });

    expect(result.topology).toBeNull();
  });
});
