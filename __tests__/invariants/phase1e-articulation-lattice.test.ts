/**
 * Phase 1e invariant tests — Cluster B: Articulation Lattice
 *
 * Tests for:
 *   getArticulationLattice, findMinimalIncarnations,
 *   findEquivalentArticulations, findSubstitutePremises,
 *   compressArticulation, computeArticulationJoin
 *
 * T4 invariant: no participantId in any dialectical-layer response.
 *
 * All Prisma calls are mocked — no DB connection required.
 */

import {
  getArticulationLattice,
  findMinimalIncarnations,
  findEquivalentArticulations,
  findSubstitutePremises,
  compressArticulation,
  computeArticulationJoin,
} from "@/server/ludics/articulationLattice";

// ── Mock setup ────────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    design: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    designInclusion: {
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = jest.requireMock("@/lib/prismaclient").prisma as {
  design: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  designInclusion: {
    findMany: jest.Mock;
  };
};

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeDesign(
  overrides: Partial<{
    id: string;
    behaviourId: string;
    deliberationId: string;
    loci: string[];
    premiseClaimIds: string[];
    biorthoClass: string;
    derivedBy: string | null;
    ludicMoves: { id: string }[];
  }>,
) {
  return {
    id: "des_1",
    behaviourId: "beh_1",
    deliberationId: "del_1",
    loci: ["⊢A"],
    premiseClaimIds: [],
    biorthoClass: "abc123",
    derivedBy: null,
    ludicMoves: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

// ── getArticulationLattice ────────────────────────────────────────────────────

describe("getArticulationLattice", () => {
  it("returns null when behaviour has no designs", async () => {
    prismaMock.design.findMany.mockResolvedValue([]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await getArticulationLattice("beh_1");
    expect(result).toBeNull();
  });

  it("returns incarnations with rank 0 for bottom (no inclusions)", async () => {
    const d1 = makeDesign({ id: "des_1", loci: ["⊢A"] });
    const d2 = makeDesign({ id: "des_2", loci: ["⊢A", "⊢A.1"] });
    prismaMock.design.findMany.mockResolvedValue([d1, d2]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await getArticulationLattice("beh_1");
    expect(result).not.toBeNull();
    // Without inclusions, all have rank 0
    expect(result!.incarnations.every((i) => i.rank === 0)).toBe(true);
    expect(result!.edges).toHaveLength(0);
  });

  it("assigns correct ranks via topological sort with inclusions", async () => {
    // A ≤ B (A is smaller, B is larger)
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"] });
    const dB = makeDesign({ id: "des_B", loci: ["⊢A", "⊢A.1"] });
    prismaMock.design.findMany.mockResolvedValue([dA, dB]);
    prismaMock.designInclusion.findMany.mockResolvedValue([
      { smallerId: "des_A", largerId: "des_B" },
    ]);

    const result = await getArticulationLattice("beh_1");
    expect(result).not.toBeNull();

    const rankA = result!.incarnations.find((i) => i.designId === "des_A")!.rank;
    const rankB = result!.incarnations.find((i) => i.designId === "des_B")!.rank;
    expect(rankA).toBe(0); // bottom
    expect(rankB).toBe(1); // one level above
  });

  it("identifies cone bottoms (fewest loci per cone)", async () => {
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"] });
    const dB = makeDesign({
      id: "des_B",
      loci: ["⊢A", "⊢A.1"],
      derivedBy: "join",
    });
    prismaMock.design.findMany.mockResolvedValue([dA, dB]);
    prismaMock.designInclusion.findMany.mockResolvedValue([
      { smallerId: "des_A", largerId: "des_B" },
    ]);

    const result = await getArticulationLattice("beh_1");
    expect(result!.cones).toHaveLength(1);
    expect(result!.cones[0].bottomIncarnationDesignId).toBe("des_A");
  });

  it("returns edges reflecting inclusion order with coneId", async () => {
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"] });
    const dB = makeDesign({
      id: "des_B",
      loci: ["⊢A", "⊢A.1"],
      derivedBy: "join",
    });
    prismaMock.design.findMany.mockResolvedValue([dA, dB]);
    prismaMock.designInclusion.findMany.mockResolvedValue([
      { smallerId: "des_A", largerId: "des_B" },
    ]);

    const result = await getArticulationLattice("beh_1");
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0]).toMatchObject({ from: "des_A", to: "des_B" });
    expect(typeof result!.edges[0].coneId).toBe("string");
  });

  it("populates equivalenceClasses when representatives === 'raw'", async () => {
    const dA = makeDesign({ id: "des_A", biorthoClass: "class_x" });
    const dB = makeDesign({ id: "des_B", biorthoClass: "class_x" });
    const dC = makeDesign({ id: "des_C", biorthoClass: "class_y" });
    prismaMock.design.findMany.mockResolvedValue([dA, dB, dC]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await getArticulationLattice("beh_1", "raw");
    expect(result!.equivalenceClasses).not.toBeNull();
    const classX = result!.equivalenceClasses!.find((c) => c.biorthoClass === "class_x")!;
    expect(classX.members).toHaveLength(2);
    expect(classX.members).toContain("des_A");
    expect(classX.members).toContain("des_B");
  });

  it("T4 invariant: no participantId in result", async () => {
    const d = makeDesign({ id: "des_1" });
    prismaMock.design.findMany.mockResolvedValue([d]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await getArticulationLattice("beh_1");
    const json = JSON.stringify(result);
    expect(json).not.toContain("participantId");
  });
});

// ── findMinimalIncarnations ───────────────────────────────────────────────────

describe("findMinimalIncarnations", () => {
  it("returns base designs as cone minima when there are no derived designs", async () => {
    const d1 = makeDesign({ id: "des_1" });
    const d2 = makeDesign({ id: "des_2" });
    prismaMock.design.findMany.mockResolvedValue([d1, d2]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await findMinimalIncarnations("beh_1");
    expect(result.incarnations).toHaveLength(2);
    expect(result.coneCount).toBe(2);
  });

  it("excludes derived designs (joins/meets) from the antichain of cone minima", async () => {
    // A and C are base; B is a derived join — only A and C are cone minima.
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_A", loci: ["⊢A"], derivedBy: null }),
      makeDesign({ id: "des_B", loci: ["⊢A", "⊢C"], derivedBy: "join" }),
      makeDesign({ id: "des_C", loci: ["⊢C"], derivedBy: null }),
    ]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await findMinimalIncarnations("beh_1");
    expect(result.coneCount).toBe(2);
    const ids = result.incarnations.map((i) => i.designId).sort();
    expect(ids).toEqual(["des_A", "des_C"]);
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.design.findMany.mockResolvedValue([makeDesign({ id: "des_1" })]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await findMinimalIncarnations("beh_1");
    expect(JSON.stringify(result)).not.toContain("participantId");
  });
});

// ── findEquivalentArticulations ───────────────────────────────────────────────

describe("findEquivalentArticulations", () => {
  it("returns empty when design not found", async () => {
    prismaMock.design.findUnique.mockResolvedValue(null);

    const result = await findEquivalentArticulations("des_x");
    expect(result.equivalents).toHaveLength(0);
  });

  it("returns designs with the same biorthoClass (excluding self)", async () => {
    prismaMock.design.findUnique.mockResolvedValue(
      makeDesign({ id: "des_1", biorthoClass: "class_x", behaviourId: "beh_1" }),
    );
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_2", biorthoClass: "class_x", behaviourId: "beh_1" }),
      makeDesign({ id: "des_3", biorthoClass: "class_x", behaviourId: "beh_1" }),
    ]);

    const result = await findEquivalentArticulations("des_1");
    expect(result.equivalents).toHaveLength(2);
    expect(result.equivalents.map((e) => e.designId)).not.toContain("des_1");
  });

  it("returns empty when no other design shares biorthoClass", async () => {
    prismaMock.design.findUnique.mockResolvedValue(
      makeDesign({ id: "des_1", biorthoClass: "unique_class" }),
    );
    prismaMock.design.findMany.mockResolvedValue([]);

    const result = await findEquivalentArticulations("des_1");
    expect(result.equivalents).toHaveLength(0);
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.design.findUnique.mockResolvedValue(
      makeDesign({ id: "des_1", biorthoClass: "cls" }),
    );
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_2", biorthoClass: "cls" }),
    ]);

    const result = await findEquivalentArticulations("des_1");
    expect(JSON.stringify(result)).not.toContain("participantId");
  });
});

// ── findSubstitutePremises ────────────────────────────────────────────────────

describe("findSubstitutePremises", () => {
  it("returns designs whose premiseClaimIds have no overlap with drop", async () => {
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_1", premiseClaimIds: ["claim_A", "claim_B"] }),
      makeDesign({ id: "des_2", premiseClaimIds: ["claim_C"] }),
      makeDesign({ id: "des_3", premiseClaimIds: [] }),
    ]);

    const result = await findSubstitutePremises("beh_1", ["claim_A"]);
    // des_1 contains claim_A → excluded; des_2 and des_3 do not → included
    expect(result.substitutes.map((s) => s.designId)).toEqual(
      expect.arrayContaining(["des_2", "des_3"]),
    );
    expect(result.substitutes.map((s) => s.designId)).not.toContain("des_1");
    expect(result.unreachable).toBe(false);
  });

  it("unreachable: true when all designs depend on at least one dropped premise", async () => {
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_1", premiseClaimIds: ["claim_A"] }),
      makeDesign({ id: "des_2", premiseClaimIds: ["claim_B"] }),
    ]);

    const result = await findSubstitutePremises("beh_1", ["claim_A", "claim_B"]);
    expect(result.substitutes).toHaveLength(0);
    expect(result.unreachable).toBe(true);
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.design.findMany.mockResolvedValue([
      makeDesign({ id: "des_1", premiseClaimIds: [] }),
    ]);

    const result = await findSubstitutePremises("beh_1", ["claim_Z"]);
    expect(JSON.stringify(result)).not.toContain("participantId");
  });
});

// ── compressArticulation ─────────────────────────────────────────────────────

describe("compressArticulation", () => {
  it("returns same-cone-incomparable for empty input", async () => {
    const result = await compressArticulation([]);
    expect(result.kind).toBe("same-cone-incomparable");
  });

  it("finds the meet (GCB) in a simple diamond lattice", async () => {
    // Lattice:  A (bottom)
    //          / \
    //         B   C
    //          \ /
    //           D (top)
    // meet(B, C) = A
    // Phase 2e: A is the cone base (derivedBy=null); B/C/D are derived
    // designs in the same cone (so all share coneId cone_0).
    const designs = [
      makeDesign({ id: "A", loci: ["⊢A"] }),
      makeDesign({ id: "B", loci: ["⊢A", "⊢A.1"], derivedBy: "extend" }),
      makeDesign({ id: "C", loci: ["⊢A", "⊢A.2"], derivedBy: "extend" }),
      makeDesign({ id: "D", loci: ["⊢A", "⊢A.1", "⊢A.2"], derivedBy: "join" }),
    ];
    const inclusions = [
      { smallerId: "A", largerId: "B" },
      { smallerId: "A", largerId: "C" },
      { smallerId: "B", largerId: "D" },
      { smallerId: "C", largerId: "D" },
    ];

    // findMany is called twice: once for input design lookup, once for all designs
    prismaMock.design.findMany
      .mockResolvedValueOnce([designs[1], designs[2]]) // input designs B, C
      .mockResolvedValueOnce(designs); // all behaviour designs
    prismaMock.designInclusion.findMany.mockResolvedValue(
      inclusions.map((e) => ({ smallerId: e.smallerId, largerId: e.largerId })),
    );

    const result = await compressArticulation(["B", "C"]);
    expect(result.kind).toBe("same-cone-meet");
    if (result.kind !== "same-cone-meet") throw new Error("unreachable");
    expect(result.meet.designId).toBe("A");
    expect(typeof result.coneId).toBe("string");
  });

  it("returns cross-cone-rejected when designs are in different cones (Phase 2e)", async () => {
    // Two designs that are each their own base (derivedBy=null) → different cones.
    // Pre-2e this would have been "same-cone-incomparable"; post-2e the
    // antichain Inc(B) puts distinct bases in disjoint cones, so the meet
    // is undefined at the substrate level and we surface cross-cone-rejected.
    prismaMock.design.findMany
      .mockResolvedValueOnce([
        makeDesign({ id: "X", behaviourId: "beh_1" }),
        makeDesign({ id: "Y", behaviourId: "beh_1" }),
      ])
      .mockResolvedValueOnce([
        makeDesign({ id: "X", behaviourId: "beh_1" }),
        makeDesign({ id: "Y", behaviourId: "beh_1" }),
      ]);
    prismaMock.designInclusion.findMany.mockResolvedValue([]);

    const result = await compressArticulation(["X", "Y"]);
    expect(result.kind).toBe("cross-cone-rejected");
    if (result.kind !== "cross-cone-rejected") throw new Error("unreachable");
    expect(result.coneIds.length).toBe(2);
  });

  it("T4 invariant: no participantId in result", async () => {
    prismaMock.design.findMany
      .mockResolvedValueOnce([makeDesign({ id: "A" }), makeDesign({ id: "B", derivedBy: "extend" })])
      .mockResolvedValueOnce([makeDesign({ id: "A" }), makeDesign({ id: "B", derivedBy: "extend" })]);
    prismaMock.designInclusion.findMany.mockResolvedValue([
      { smallerId: "A", largerId: "B" },
    ]);

    const result = await compressArticulation(["A", "B"]);
    expect(JSON.stringify(result)).not.toContain("participantId");
  });
});

// ── computeArticulationJoin ───────────────────────────────────────────────────

describe("computeArticulationJoin", () => {
  it("returns null for empty input", async () => {
    const result = await computeArticulationJoin([]);
    expect(result).toBeNull();
  });

  it("returns existing design when loci union already exists", async () => {
    // Phase 2e: dBase is the cone base (loci=[] is a subset of every design);
    // dA, dB, dExisting are all derived → share coneId cone_0.
    const dBase = makeDesign({ id: "des_base", loci: [] });
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"], derivedBy: "extend" });
    const dB = makeDesign({ id: "des_B", loci: ["⊢A.1"], derivedBy: "extend" });
    const dExisting = makeDesign({ id: "des_AB", loci: ["⊢A", "⊢A.1"], derivedBy: "join" });

    prismaMock.design.findMany
      .mockResolvedValueOnce([dA, dB]) // input design lookup
      .mockResolvedValueOnce([dBase, dA, dB, dExisting]); // all behaviour designs

    const result = await computeArticulationJoin(["des_A", "des_B"]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("same-cone-join");
    if (result!.kind !== "same-cone-join") throw new Error("unreachable");
    expect(result!.join.designId).toBe("des_AB");
    expect(result!.closureSteps).toBe(0);
    expect(result!.newLoci).toHaveLength(0);
  });

  it("creates a new design when loci union is novel (Phase 2f: closureSteps still 0)", async () => {
    const dBase = makeDesign({ id: "des_base", loci: [] });
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"], derivedBy: "extend" });
    const dB = makeDesign({ id: "des_B", loci: ["⊢A.1"], derivedBy: "extend" });
    const newDesign = makeDesign({ id: "des_new", loci: ["⊢A", "⊢A.1"], derivedBy: "join" });

    prismaMock.design.findMany
      .mockResolvedValueOnce([dA, dB]) // input design lookup
      .mockResolvedValueOnce([dBase, dA, dB]); // all behaviour designs (no existing match)
    prismaMock.design.create.mockResolvedValue(newDesign);

    const result = await computeArticulationJoin(["des_A", "des_B"]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("same-cone-join");
    if (result!.kind !== "same-cone-join") throw new Error("unreachable");
    expect(result!.join.derivedBy).toBe("join");
    // Phase 2f Reading A: literal union, no biorthogonal closure rounds.
    expect(result!.closureSteps).toBe(0);
    expect(prismaMock.design.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ derivedBy: "join" }),
      }),
    );
  });

  it("newLoci = loci not common to ALL input designs", async () => {
    // D1 = [A, B], D2 = [B, C] → union = [A, B, C], intersection = [B]
    // newLoci = [A, C] (not in both designs)
    const dBase = makeDesign({ id: "des_base", loci: [] });
    const dA = makeDesign({ id: "des_1", loci: ["⊢A", "⊢B"], derivedBy: "extend" });
    const dB = makeDesign({ id: "des_2", loci: ["⊢B", "⊢C"], derivedBy: "extend" });
    const newDesign = makeDesign({
      id: "des_join",
      loci: ["⊢A", "⊢B", "⊢C"],
      derivedBy: "join",
    });

    prismaMock.design.findMany
      .mockResolvedValueOnce([dA, dB])
      .mockResolvedValueOnce([dBase, dA, dB]);
    prismaMock.design.create.mockResolvedValue(newDesign);

    const result = await computeArticulationJoin(["des_1", "des_2"]);
    if (result!.kind !== "same-cone-join") throw new Error("unreachable");
    expect(result!.newLoci.sort()).toEqual(["⊢A", "⊢C"]);
  });

  it("T4 invariant: no participantId in result", async () => {
    const dBase = makeDesign({ id: "des_base", loci: [] });
    const dA = makeDesign({ id: "des_A", loci: ["⊢A"], derivedBy: "extend" });
    const dB = makeDesign({ id: "des_B", loci: ["⊢A.1"], derivedBy: "extend" });
    const newDesign = makeDesign({ id: "des_new", loci: ["⊢A", "⊢A.1"], derivedBy: "join" });

    prismaMock.design.findMany
      .mockResolvedValueOnce([dA, dB])
      .mockResolvedValueOnce([dBase, dA, dB]);
    prismaMock.design.create.mockResolvedValue(newDesign);

    const result = await computeArticulationJoin(["des_A", "des_B"]);
    expect(JSON.stringify(result)).not.toContain("participantId");
  });
});
