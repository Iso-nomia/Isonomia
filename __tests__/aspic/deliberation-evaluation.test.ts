/**
 * Phase 2.1: lib/aspic/deliberationEvaluation.ts builds an AIF graph for a
 * deliberation from the DB and evaluates it, so the per-argument defeats
 * endpoint can show real data. This test covers the DB→graph mapping (RA/I/CA
 * nodes, premise/conclusion/conflicting/conflicted edges keyed by `RA:<id>`)
 * and the shape of the per-argument defeat extraction.
 */
import { describe, test, expect } from "@jest/globals";

const mockArgFindMany = jest.fn();
const mockConflictFindMany = jest.fn(async () => []);
const mockPAFindMany = jest.fn(async () => []);
const mockArgFindUnique = jest.fn(async ({ where }: any) => ({ id: where.id }));
const mockClaimFindUnique = jest.fn(async () => ({ text: "" }));

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    argument: { findMany: (a: any) => mockArgFindMany(a), findUnique: (a: any) => mockArgFindUnique(a) },
    conflictApplication: { findMany: (a: any) => mockConflictFindMany(a) },
    preferenceApplication: { findMany: (a: any) => mockPAFindMany(a) },
    claim: { findUnique: (a: any) => mockClaimFindUnique(a) },
  },
}));

import { buildDeliberationGraph, getArgumentDefeats } from "@/lib/aspic/deliberationEvaluation";

const argFixture = [
  { id: "argA", text: "A", schemeId: null, conclusionClaimId: "cA", conclusion: { id: "cA", text: "c" }, premises: [{ claim: { id: "pA", text: "p" } }] },
  { id: "argB", text: "B", schemeId: null, conclusionClaimId: "cB", conclusion: { id: "cB", text: "¬c" }, premises: [{ claim: { id: "pB", text: "q" } }] },
];
const conflictFixture = [
  { id: "k1", conflictingArgumentId: "argA", conflictedArgumentId: "argB", conflictingClaimId: null, conflictedClaimId: null, aspicAttackType: "rebutting", legacyAttackType: "REBUTS" },
];

describe("buildDeliberationGraph", () => {
  test("maps DB arguments + conflicts to an RA-keyed AIF graph", async () => {
    mockArgFindMany.mockResolvedValue(argFixture);
    mockConflictFindMany.mockResolvedValue(conflictFixture);

    const g = await buildDeliberationGraph("d1");
    const ids = g.nodes.map((n: any) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["RA:argA", "RA:argB", "I:cA", "I:cB", "I:pA", "I:pB", "CA:k1"]));

    const edgeKeys = g.edges.map((e: any) => `${e.sourceId}|${e.edgeType}|${e.targetId}`);
    expect(edgeKeys).toEqual(
      expect.arrayContaining([
        "RA:argA|conclusion|I:cA",
        "I:pA|premise|RA:argA",
        "RA:argA|conflicting|CA:k1",
        "CA:k1|conflicted|RA:argB",
      ]),
    );
  });

  test("filters conflicts to EFFECTIVE ratification status (DEV_SPEC §4 enforcement)", async () => {
    mockArgFindMany.mockResolvedValue(argFixture);
    mockConflictFindMany.mockResolvedValue([]);

    await buildDeliberationGraph("d1");

    expect(mockConflictFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ratificationStatus: "EFFECTIVE" }),
      }),
    );
  });
});

describe("getArgumentDefeats", () => {
  test("returns defeatsBy/defeatedBy arrays + preference-aware standing", async () => {
    mockArgFindMany.mockResolvedValue(argFixture);
    mockConflictFindMany.mockResolvedValue(conflictFixture);
    mockPAFindMany.mockResolvedValue([]);

    const res = await getArgumentDefeats("d1", "argA");
    expect(Array.isArray(res.defeatsBy)).toBe(true);
    expect(Array.isArray(res.defeatedBy)).toBe(true);
    // Phase 3: standing is the grounded classification, sourced from the
    // (preference-aware) evaluation — not the count-based dialectical taxonomy.
    expect(["in", "out", "undec", "unknown"]).toContain(res.standing.status);
    expect(typeof res.standing.preferenceApplied).toBe("boolean");
  });

  test("an unattacked argument stands `in` (no conflicts)", async () => {
    mockArgFindMany.mockResolvedValue(argFixture);
    mockConflictFindMany.mockResolvedValue([]); // no attacks at all
    mockPAFindMany.mockResolvedValue([]);

    const res = await getArgumentDefeats("d1", "argA");
    expect(res.standing.status).toBe("in");
    expect(res.standing.preferenceApplied).toBe(false);
    expect(res.defeatedBy).toHaveLength(0);
  });
});

// End-to-end through the DB pipeline (buildDeliberationGraph → aifToASPIC →
// computeAspicSemantics): a stored preference flips grounded standing. NOTE the
// conflict must be CLAIM-level so the contrary lands between the conclusion
// texts (c vs ¬c) — an argument-level conflict sets the contrary between RA-ids
// and produces no rebut.
describe("preference flips standing through the full DB pipeline", () => {
  const flipArgs = [
    { id: "argA", text: "A", schemeId: null, conclusionClaimId: "cC", conclusion: { id: "cC", text: "c" }, premises: [{ claim: { id: "pA", text: "p" } }] },
    { id: "argB", text: "B", schemeId: null, conclusionClaimId: "cD", conclusion: { id: "cD", text: "¬c" }, premises: [{ claim: { id: "pB", text: "q" } }] },
  ];
  // Mutual rebut: contrary registered both directions between the conclusions.
  const rebut = [
    { id: "k1", conflictingArgumentId: null, conflictedArgumentId: null, conflictingClaimId: "cC", conflictedClaimId: "cD", aspicAttackType: "rebutting", legacyAttackType: "REBUTS" },
    { id: "k2", conflictingArgumentId: null, conflictedArgumentId: null, conflictingClaimId: "cD", conflictedClaimId: "cC", aspicAttackType: "rebutting", legacyAttackType: "REBUTS" },
  ];

  test("no preference: mutual rebut leaves both undecided; with RA:argA > RA:argB, argA IN / argB OUT", async () => {
    mockArgFindMany.mockResolvedValue(flipArgs);
    mockConflictFindMany.mockResolvedValue(rebut);

    // Baseline — no preferences.
    mockPAFindMany.mockResolvedValue([]);
    const a0 = await getArgumentDefeats("d1", "argA");
    const b0 = await getArgumentDefeats("d1", "argB");
    expect(a0.standing.status).toBe("undec");
    expect(b0.standing.status).toBe("undec");

    // Add a stored preference argA > argB → rule pref RA:argA > RA:argB.
    mockPAFindMany.mockResolvedValue([
      { id: "pa1", preferredArgumentId: "argA", dispreferredArgumentId: "argB", preferredClaimId: null, dispreferredClaimId: null, preferredSchemeId: null, dispreferredSchemeId: null },
    ]);
    const a1 = await getArgumentDefeats("d1", "argA");
    const b1 = await getArgumentDefeats("d1", "argB");
    expect(a1.standing.status).toBe("in");
    expect(a1.standing.preferenceApplied).toBe(true);
    expect(b1.standing.status).toBe("out");
  });
});
