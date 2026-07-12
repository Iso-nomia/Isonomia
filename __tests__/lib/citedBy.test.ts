/**
 * Phase 10a — unit tests for the cited-by edge model (lib/citation/citedBy.ts).
 *
 * Asserts the contracts the routes + UI depend on:
 *   - four typed relations classified correctly (supports/contests/builds-on/reuses)
 *   - self-citations excluded
 *   - honest-empty is a first-class result (not null, not an error)
 *   - `counts.contests` surfaced at top level (M-1 honesty)
 *   - non-public citers counted but not linked; publicOnly drops them
 *   - cross-deliberation flag + count
 *   - hydration is one query per citer type (no N+1)
 *   - claim cited-by omits "produces" (concluding) arguments
 */

const prismaMock: any = {
  argument: { findUnique: jest.fn(), findMany: jest.fn() },
  claim: { findUnique: jest.fn(), findMany: jest.fn() },
  argumentEdge: { findMany: jest.fn(), count: jest.fn() },
  conflictApplication: { findMany: jest.fn(), count: jest.fn() },
  argumentPremise: { findMany: jest.fn() },
  argumentImport: { findMany: jest.fn() },
  argumentCitation: { findMany: jest.fn() },
  externalCitation: { findMany: jest.fn() },
  cQStatus: { count: jest.fn() },
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));
jest.mock("@/lib/citations/argumentAttestation", () => ({
  computeStandingState: jest.fn(() => "untested-supported"),
}));

import { getArgumentCitedBy, getClaimCitedBy } from "@/lib/citation/citedBy";

const T = new Date("2026-01-01T00:00:00.000Z");

/** Reset every mock to an "empty source" default; tests override per-case. */
function resetAll() {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model as any)) (fn as jest.Mock).mockReset();
  }
  prismaMock.argumentEdge.findMany.mockResolvedValue([]);
  prismaMock.conflictApplication.findMany.mockResolvedValue([]);
  prismaMock.argumentPremise.findMany.mockResolvedValue([]);
  prismaMock.argumentImport.findMany.mockResolvedValue([]);
  prismaMock.argumentCitation.findMany.mockResolvedValue([]);
  prismaMock.argument.findMany.mockResolvedValue([]);
  prismaMock.claim.findMany.mockResolvedValue([]);
  prismaMock.externalCitation.findMany.mockResolvedValue([]);
  prismaMock.argumentEdge.count.mockResolvedValue(0);
  prismaMock.conflictApplication.count.mockResolvedValue(0);
  prismaMock.cQStatus.count.mockResolvedValue(0);
}

beforeEach(resetAll);

/** A public argument citer row (as the hydrate findMany would return it). */
function argRow(id: string, over: Partial<any> = {}) {
  return {
    id,
    text: `arg ${id}`,
    deliberationId: "dT",
    authorKind: "HUMAN",
    permalink: { shortCode: `SC_${id}` },
    ...over,
  };
}

function targetArg(over: Partial<any> = {}) {
  prismaMock.argument.findUnique.mockResolvedValue({
    id: "X",
    text: "target conclusion",
    deliberationId: "dT",
    conclusionClaimId: "Xc",
    permalink: { shortCode: "SC_X" },
    ...over,
  });
}

describe("getArgumentCitedBy", () => {
  it("returns null when the target argument does not exist", async () => {
    prismaMock.argument.findUnique.mockResolvedValue(null);
    expect(await getArgumentCitedBy("nope")).toBeNull();
  });

  it("classifies all four relations and surfaces contests at top level", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "a1", type: "support", attackSubtype: null, createdAt: T },
      { fromArgumentId: "a2", type: "rebut", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argumentPremise.findMany.mockResolvedValue([
      { argumentId: "a3", argument: { createdAt: T } },
    ]);
    prismaMock.argumentImport.findMany.mockResolvedValue([
      { toArgumentId: "a4", toDeliberationId: "d2", kind: "quote", createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([
      argRow("a1"),
      argRow("a2"),
      argRow("a3"),
      argRow("a4", { deliberationId: "d2" }),
    ]);

    const res = await getArgumentCitedBy("X");
    expect(res).not.toBeNull();
    expect(res!.counts.total).toBe(4);
    expect(res!.counts.byKind).toEqual({
      supports: 1,
      contests: 1,
      "builds-on": 1,
      reuses: 1,
    });
    expect(res!.counts.contests).toBe(1); // top-level honesty field
    const kinds = res!.edges.map((e) => e.kind).sort();
    expect(kinds).toEqual(["builds-on", "contests", "reuses", "supports"]);
  });

  it("treats concede as non-adversarial (supports), not a contest", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "a1", type: "concede", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([argRow("a1")]);
    const res = await getArgumentCitedBy("X");
    expect(res!.counts.byKind.supports).toBe(1);
    expect(res!.counts.contests).toBe(0);
  });

  it("honest-empty: no incoming edges → [] and total 0 (not null)", async () => {
    targetArg();
    const res = await getArgumentCitedBy("X");
    expect(res).not.toBeNull();
    expect(res!.edges).toEqual([]);
    expect(res!.counts.total).toBe(0);
    expect(res!.counts.contests).toBe(0);
  });

  it("excludes self-citations (self support edge and self-premise)", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "X", type: "support", attackSubtype: null, createdAt: T },
      { fromArgumentId: "a1", type: "support", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([argRow("a1")]);
    const res = await getArgumentCitedBy("X");
    expect(res!.counts.total).toBe(1);
    expect(res!.edges[0].from.id).toBe("a1");
  });

  it("counts a non-public citer but leaves it unlinked; publicOnly drops it", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "a1", type: "support", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([
      argRow("a1", { permalink: null }), // no permalink → non-public
    ]);

    const open = await getArgumentCitedBy("X");
    expect(open!.counts.total).toBe(1);
    expect(open!.counts.nonPublic).toBe(1);
    expect(open!.edges[0].from.shortCode).toBeNull();
    expect(open!.edges[0].from.permalinkUrl).toBeNull();

    const strict = await getArgumentCitedBy("X", { publicOnly: true });
    expect(strict!.counts.total).toBe(0);
    expect(strict!.edges).toEqual([]);
  });

  it("flags cross-deliberation citers and counts them", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "a1", type: "support", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([
      argRow("a1", { deliberationId: "OTHER" }),
    ]);
    const res = await getArgumentCitedBy("X");
    expect(res!.edges[0].crossDeliberation).toBe(true);
    expect(res!.counts.crossDeliberation).toBe(1);
  });

  it("hydrates with one findMany per citer type regardless of citer count (no N+1)", async () => {
    targetArg();
    const edges = Array.from({ length: 6 }, (_, i) => ({
      fromArgumentId: `a${i}`,
      type: "support",
      attackSubtype: null,
      createdAt: T,
    }));
    prismaMock.argumentEdge.findMany.mockResolvedValue(edges);
    prismaMock.argument.findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => argRow(`a${i}`)),
    );
    const res = await getArgumentCitedBy("X");
    expect(res!.counts.total).toBe(6);
    // one hydrate call for the argument citers — not one per citer
    expect(prismaMock.argument.findMany).toHaveBeenCalledTimes(1);
  });

  it("folds ArgumentCitation rows, classified by ArgCitationType", async () => {
    targetArg();
    prismaMock.argumentCitation.findMany.mockResolvedValue([
      { citingArgumentId: "a1", citationType: "SUPPORT", createdAt: T },
      { citingArgumentId: "a2", citationType: "EXTENSION", createdAt: T },
      { citingArgumentId: "a3", citationType: "REBUTTAL", createdAt: T },
      { citingArgumentId: "a4", citationType: "CONTRAST", createdAt: T },
      { citingArgumentId: "X", citationType: "SUPPORT", createdAt: T }, // self → excluded
    ]);
    prismaMock.argument.findMany.mockResolvedValue([
      argRow("a1"),
      argRow("a2"),
      argRow("a3"),
      argRow("a4"),
    ]);
    const res = await getArgumentCitedBy("X");
    expect(res!.counts.total).toBe(4); // self-citation excluded
    expect(res!.counts.byKind).toEqual({
      supports: 1, // SUPPORT
      "builds-on": 1, // EXTENSION
      contests: 2, // REBUTTAL + CONTRAST (fail-safe)
      reuses: 0,
    });
    // fetched from the citedArgumentId side
    expect(prismaMock.argumentCitation.findMany.mock.calls[0][0].where).toEqual({
      citedArgumentId: "X",
    });
  });

  it("folds external citations: unreviewed displayed but NOT in total; trusted counted (D2)", async () => {
    targetArg();
    prismaMock.externalCitation.findMany.mockResolvedValue([
      {
        id: "x1",
        sourceUrl: "https://blog.example/post",
        sourceDomain: "blog.example",
        title: "A post",
        trustState: "unreviewed",
        verifiedAt: T,
        createdAt: T,
      },
      {
        id: "x2",
        sourceUrl: "https://journal.example/a",
        sourceDomain: "journal.example",
        title: null,
        trustState: "trusted",
        verifiedAt: T,
        createdAt: T,
      },
    ]);
    const res = await getArgumentCitedBy("X");
    // No internal edges; one trusted external is in the headline, unreviewed is not.
    expect(res!.counts.total).toBe(1);
    expect(res!.counts.externalTrusted).toBe(1);
    expect(res!.counts.externalUnreviewed).toBe(1);
    expect(res!.external.map((e) => e.id).sort()).toEqual(["x1", "x2"]);
  });

  it("excludes hidden external citations from the query (moderation)", async () => {
    targetArg();
    await getArgumentCitedBy("X");
    const where = prismaMock.externalCitation.findMany.mock.calls[0][0].where;
    expect(where.trustState).toEqual({ not: "hidden" });
    expect(where).toMatchObject({ targetType: "argument", targetId: "X" });
  });

  it("drops stale edges whose citer no longer hydrates, without throwing", async () => {
    targetArg();
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "ghost", type: "support", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([]); // citer gone
    const res = await getArgumentCitedBy("X");
    expect(res!.counts.total).toBe(0);
    expect(res!.edges).toEqual([]);
  });
});

describe("getClaimCitedBy", () => {
  it("returns null when the claim does not exist", async () => {
    prismaMock.claim.findUnique.mockResolvedValue(null);
    expect(await getClaimCitedBy("nope")).toBeNull();
  });

  it("returns premise-users as builds-on and edge-attacks as contests; omits producers", async () => {
    prismaMock.claim.findUnique.mockResolvedValue({
      id: "C",
      moid: "moid-c",
      text: "the claim",
      deliberationId: "dT",
    });
    prismaMock.argumentPremise.findMany.mockResolvedValue([
      { argumentId: "b1", argument: { createdAt: T } },
    ]);
    prismaMock.argumentEdge.findMany.mockResolvedValue([
      { fromArgumentId: "b2", type: "rebut", attackSubtype: null, createdAt: T },
    ]);
    prismaMock.argument.findMany.mockResolvedValue([argRow("b1"), argRow("b2")]);

    const res = await getClaimCitedBy("C");
    expect(res!.target.kind).toBe("claim");
    expect(res!.target.moid).toBe("moid-c");
    expect(res!.counts.byKind["builds-on"]).toBe(1);
    expect(res!.counts.byKind.contests).toBe(1);
    // "produces" (arguments concluding to C) is never queried → never present
    expect(res!.counts.byKind.supports).toBe(0);
    expect(res!.counts.byKind.reuses).toBe(0);
  });
});
