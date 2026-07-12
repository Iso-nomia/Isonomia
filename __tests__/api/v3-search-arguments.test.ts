/**
 * Phase 4.1 — Integration tests for GET /api/v3/search/arguments.
 *
 * Stubs prisma + the hybrid retriever; exercises the route handler's
 * contracts that downstream surfaces (the public search page, MCP, the
 * .well-known manifest) rely on.
 */

import { NextRequest } from "next/server";

const prismaMock: any = {
  argument: { findMany: jest.fn() },
  claim: { findFirst: jest.fn() },
  argumentEdge: { findMany: jest.fn(), count: jest.fn() },
  conflictApplication: { findMany: jest.fn(), count: jest.fn() },
  cQStatus: { count: jest.fn() },
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));
jest.mock("@/lib/argument/hybridSearch", () => ({
  hybridSearchArguments: jest.fn(),
}));
jest.mock("@/lib/citation/citedBy", () => ({ getArgumentCitedBy: jest.fn() }));

import { GET } from "@/app/api/v3/search/arguments/route";
import { hybridSearchArguments } from "@/lib/argument/hybridSearch";
import { getArgumentCitedBy } from "@/lib/citation/citedBy";

const hybridMock = hybridSearchArguments as jest.Mock;
const citedByMock = getArgumentCitedBy as jest.Mock;

beforeEach(() => {
  Object.values(prismaMock).forEach((model: any) => {
    Object.values(model).forEach((fn: any) => (fn as jest.Mock).mockReset());
  });
  hybridMock.mockReset();
  citedByMock.mockReset();

  // Default: no inbound counters per result so fitness math doesn't blow up.
  prismaMock.cQStatus.count.mockResolvedValue(0);
  prismaMock.argumentEdge.count.mockResolvedValue(0);
  prismaMock.conflictApplication.count.mockResolvedValue(0);
});

function reqUrl(qs: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/v3/search/arguments${qs}`);
}

describe("GET /api/v3/search/arguments", () => {
  it("returns honest-empty (count:0, results:[]) when nothing matches", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?q=does-not-exist"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
    expect(body.query.mode).toBe("lexical"); // default for HTTP layer
  });

  it("filters by scheme when scheme= is provided", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([]);
    await GET(reqUrl("?q=foo&scheme=Expert_Opinion"));

    const callArgs = prismaMock.argument.findMany.mock.calls[0][0];
    expect(callArgs.where.argumentSchemes).toEqual({
      some: { scheme: { key: "expert_opinion" } },
    });
  });

  it("against= with no structural contesters short-circuits to honest-empty", async () => {
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      text: "Smartphones harm adolescents.",
    });
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?against=moid_xyz"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
    expect(body.query.againstClaimText).toBe("Smartphones harm adolescents.");
    // No further argument lookup should have been attempted.
    expect(prismaMock.argument.findMany).not.toHaveBeenCalled();
  });

  it("mode=hybrid routes through hybridSearchArguments and preserves RRF order", async () => {
    hybridMock.mockResolvedValueOnce([
      { id: "a2", sparseRank: 1, denseRank: 1, rrfScore: 0.05, denseDistance: 0.1, lexicalCoverage: 1 },
      { id: "a1", sparseRank: 2, denseRank: null, rrfScore: 0.02, denseDistance: null, lexicalCoverage: 1 },
    ]);
    prismaMock.argument.findMany.mockResolvedValueOnce([
      // Returned out-of-order to prove the route re-sorts by RRF rank.
      makeArgRow("a1"),
      makeArgRow("a2"),
    ]);

    const res = await GET(reqUrl("?q=phones&mode=hybrid"));
    const body = await res.json();

    expect(hybridMock).toHaveBeenCalledTimes(1);
    expect(body.query.mode).toBe("hybrid");
    expect(body.results.map((r: any) => r.argumentId)).toEqual(["a2", "a1"]);
    // RRF block surfaces on each result.
    expect(body.results[0].hybrid).toMatchObject({ rrfScore: 0.05, sparseRank: 1, denseRank: 1 });
  });

  it("mode=hybrid with empty hybrid result is honest-empty (no row fetch)", async () => {
    hybridMock.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?q=nothing&mode=hybrid"));
    const body = await res.json();

    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
    expect(prismaMock.argument.findMany).not.toHaveBeenCalled();
  });

  it("sort=dialectical_fitness exposes the fitness formula", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1")]);

    const res = await GET(reqUrl("?q=foo&sort=dialectical_fitness"));
    const body = await res.json();

    expect(body.query.sort).toBe("dialectical_fitness");
    expect(body.fitnessFormula).toBeDefined();
    expect(body.results[0]).toHaveProperty("dialecticalFitness");
    expect(body.results[0]).toHaveProperty("fitnessBreakdown");
  });

  it("attaches attestationUrl + standingState + permalink on every result", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1")]);

    const res = await GET(reqUrl("?q=foo"));
    const body = await res.json();

    const r = body.results[0];
    expect(r.attestationUrl).toMatch(/\/api\/a\/SHORT_a1\/aif\?format=attestation$/);
    expect(r.permalink).toMatch(/\/a\/SHORT_a1$/);
    expect(typeof r.standingState).toBe("string");
  });
  it("include_cited_by=1 attaches a downstream cited-by summary per result", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1")]);
    citedByMock.mockResolvedValue({
      target: { kind: "argument", id: "a1" },
      edges: [
        {
          kind: "contests",
          from: { shortCode: "SHORT_c1", permalinkUrl: "/a/SHORT_c1", text: "a counter", standingState: null },
        },
      ],
      external: [],
      counts: {
        total: 3,
        byKind: { supports: 1, contests: 1, "builds-on": 1, reuses: 0 },
        contests: 1,
        crossDeliberation: 0,
        nonPublic: 0,
        externalUnreviewed: 0,
        externalTrusted: 0,
      },
      truncated: false,
    });

    const res = await GET(reqUrl("?q=foo&include_cited_by=1"));
    const body = await res.json();
    expect(body.query.includeCitedBy).toBe(true);
    const cb = body.results[0].citedBy;
    expect(cb.total).toBe(3);
    expect(cb.contests).toBe(1);
    expect(cb.strongest.kind).toBe("contests"); // contest surfaced as strongest
    expect(cb.strongest.shortCode).toBe("SHORT_c1");
    expect(citedByMock).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ publicOnly: true }),
    );
  });

  it("omits citedBy when include_cited_by is absent", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1")]);
    const res = await GET(reqUrl("?q=foo"));
    const body = await res.json();
    expect(body.results[0]).not.toHaveProperty("citedBy");
    expect(citedByMock).not.toHaveBeenCalled();
  });

  // ── Phase 2 quality filters ────────────────────────────────────

  it("since / until push createdAt range into the DB query", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([]);
    await GET(reqUrl("?q=foo&since=2025-01-01&until=2025-12-31"));
    const callArgs = prismaMock.argument.findMany.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
    expect(callArgs.where.createdAt.lte).toBeInstanceOf(Date);
    expect(callArgs.where.createdAt.gte.toISOString().startsWith("2025-01-01")).toBe(true);
  });

  it("min_evidence filters out arguments without enough provenance-anchored evidence", async () => {
    // Two rows: a1 with 2 evidence-with-sha, a2 with 0.
    prismaMock.argument.findMany.mockResolvedValueOnce([
      makeArgRow("a1", { evidenceShaCount: 2 }),
      makeArgRow("a2", { evidenceShaCount: 0 }),
    ]);
    const res = await GET(reqUrl("?q=foo&min_evidence=1"));
    const body = await res.json();
    expect(body.results.map((r: any) => r.argumentId)).toEqual(["a1"]);
    expect(body.query.minEvidence).toBe(1);
  });

  it("min_cq_satisfied filters by inbound CQ counter", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1"), makeArgRow("a2")]);
    // a1 has 3 satisfied CQs, a2 has 0.
    prismaMock.cQStatus.count
      .mockResolvedValueOnce(3) // a1
      .mockResolvedValueOnce(0); // a2

    const res = await GET(reqUrl("?q=foo&min_cq_satisfied=2"));
    const body = await res.json();
    expect(body.results.map((r: any) => r.argumentId)).toEqual(["a1"]);
    expect(body.query.minCqSatisfied).toBe(2);
  });

  it("tested_only filters out untested arguments", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1"), makeArgRow("a2")]);
    // a1 isTested via 2 CQs answered; a2 has 0 inbound signals.
    prismaMock.cQStatus.count
      .mockResolvedValueOnce(2) // a1 cqAnswered
      .mockResolvedValueOnce(0); // a2 cqAnswered

    const res = await GET(reqUrl("?q=foo&tested_only=1"));
    const body = await res.json();
    expect(body.results.map((r: any) => r.argumentId)).toEqual(["a1"]);
    expect(body.query.testedOnly).toBe(true);
  });

  // ── Phase 5 strongestCounter ──────────────────────────────────

  it("include_strongest_counter=1 attaches the contester block via edge", async () => {
    prismaMock.argument.findMany
      // First call: main result rows.
      .mockResolvedValueOnce([makeArgRow("a1")])
      // Second call: contester rows (Phase 5 fanout).
      .mockResolvedValueOnce([
        {
          id: "counter1",
          createdAt: new Date("2025-06-01"),
          conclusion: { id: "c_counter1", moid: "moid_counter1", text: "Counter conclusion text" },
          permalink: { shortCode: "SHORT_counter1", accessCount: 42 },
        },
      ]);
    // Edge from counter1 → claim c_a1 (the conclusion of a1).
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([
      { fromArgumentId: "counter1", to: { conclusionClaimId: "c_a1" } },
    ]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?q=foo&include_strongest_counter=1"));
    const body = await res.json();

    expect(body.query.includeStrongestCounter).toBe(true);
    expect(body.query.strongestCounterK).toBe(10);
    expect(body.results[0].strongestCounter).toMatchObject({
      argumentId: "counter1",
      shortCode: "SHORT_counter1",
      source: "edge",
      conclusion: { moid: "moid_counter1", text: "Counter conclusion text" },
    });
    expect(body.results[0].strongestCounter.permalink).toMatch(/\/a\/SHORT_counter1$/);
  });

  it("include_strongest_counter=1 returns null when no contester is on file", async () => {
    prismaMock.argument.findMany.mockResolvedValueOnce([makeArgRow("a1")]);
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?q=foo&include_strongest_counter=1"));
    const body = await res.json();

    // Honest-empty: the field is present and explicitly null, not omitted.
    expect(body.results[0]).toHaveProperty("strongestCounter", null);
  });

  it("include_strongest_counter excludes self-counters by MOID", async () => {
    prismaMock.argument.findMany
      .mockResolvedValueOnce([makeArgRow("a1")])
      // Contester row shares the same MOID as a1's conclusion → must be filtered.
      .mockResolvedValueOnce([
        {
          id: "selfish",
          createdAt: new Date(),
          conclusion: { id: "c_a1_dup", moid: "moid_a1", text: "Same conclusion" },
          permalink: { shortCode: "SHORT_selfish", accessCount: 999 },
        },
      ]);
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([
      { fromArgumentId: "selfish", to: { conclusionClaimId: "c_a1" } },
    ]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl("?q=foo&include_strongest_counter=1"));
    const body = await res.json();

    expect(body.results[0].strongestCounter).toBeNull();
  });
});

function makeArgRow(id: string, opts: { evidenceShaCount?: number } = {}) {
  const evidence = Array.from({ length: opts.evidenceShaCount ?? 0 }, (_, i) => ({
    contentSha256: `sha256:${id}-${i}`,
  }));
  return {
    id,
    text: `argument text for ${id}`,
    createdAt: new Date(),
    conclusion: {
      id: `c_${id}`,
      text: `conclusion for ${id}`,
      moid: `moid_${id}`,
      ClaimEvidence: evidence,
    },
    permalink: { shortCode: `SHORT_${id}`, version: 1, accessCount: 0 },
    argumentSchemes: [],
  };
}
