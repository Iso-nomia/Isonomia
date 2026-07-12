/**
 * Phase 6 — Integration tests for GET /api/v3/claims/{moid}/stances.
 *
 * The stances endpoint delegates to the search route (so result-shaping
 * is exercised in the existing v3-search-arguments tests). Here we
 * verify Phase 6's specific contracts:
 *   - missing MOID → 404 with explicit error code
 *   - returns dual { for, against } shape with both lists populated
 *   - honest-empty: empty lists, not 404, when nothing on file
 *   - the underlying search calls receive `conclusion_moid` (for) and
 *     `against` (against) as expected
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

import { GET } from "@/app/api/v3/claims/[moid]/stances/route";

beforeEach(() => {
  Object.values(prismaMock).forEach((model: any) => {
    Object.values(model).forEach((fn: any) => (fn as jest.Mock).mockReset());
  });
  prismaMock.cQStatus.count.mockResolvedValue(0);
  prismaMock.argumentEdge.count.mockResolvedValue(0);
  prismaMock.conflictApplication.count.mockResolvedValue(0);
});

function reqUrl(qs: string = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/v3/claims/m1/stances${qs}`);
}

function ctx(moid: string) {
  return { params: Promise.resolve({ moid }) };
}

function makeArgRow(id: string, conclusionMoid: string) {
  return {
    id,
    text: `argument text for ${id}`,
    createdAt: new Date(),
    conclusion: {
      id: `c_${id}`,
      text: `conclusion for ${id}`,
      moid: conclusionMoid,
      ClaimEvidence: [],
    },
    permalink: { shortCode: `SHORT_${id}`, version: 1, accessCount: 0 },
    argumentSchemes: [],
  };
}

describe("GET /api/v3/claims/{moid}/stances", () => {
  it("404s honestly when the MOID is unknown", async () => {
    prismaMock.claim.findFirst.mockResolvedValueOnce(null);

    const res = await GET(reqUrl(), ctx("missing"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("claim_not_found");
    expect(body.moid).toBe("missing");
  });

  it("returns dual {for, against} lists with the search-result shape", async () => {
    // Top-level claim resolution.
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      moid: "m1",
      text: "Smartphones harm adolescents.",
    });
    // search route's "for" call: conclusion_moid filter
    prismaMock.argument.findMany.mockResolvedValueOnce([
      makeArgRow("aFor", "m1"),
    ]);
    // search route's "against" path resolves the claim again, then runs
    // the structural-contester queries, then fetches the rows.
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      text: "Smartphones harm adolescents.",
    });
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([
      { fromArgumentId: "aAgainst" },
    ]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);
    prismaMock.argument.findMany.mockResolvedValueOnce([
      makeArgRow("aAgainst", "m_other"),
    ]);

    const res = await GET(reqUrl(), ctx("m1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.claim).toEqual({ moid: "m1", text: "Smartphones harm adolescents." });
    expect(body.for).toHaveLength(1);
    expect(body.against).toHaveLength(1);
    expect(body.for[0].argumentId).toBe("aFor");
    expect(body.against[0].argumentId).toBe("aAgainst");
    expect(body.counts).toEqual({ for: 1, against: 1 });
    // Result shape — should carry the substrate fields.
    expect(body.for[0]).toHaveProperty("attestationUrl");
    expect(body.for[0]).toHaveProperty("standingState");
    expect(body.for[0].permalink).toMatch(/\/a\/SHORT_aFor$/);
  });

  it("honest-empty: both sides return [] (not 404) when nothing is on file", async () => {
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      moid: "m1",
      text: "Some claim.",
    });
    // "for" search: no rows.
    prismaMock.argument.findMany.mockResolvedValueOnce([]);
    // "against" path: claim resolves, but no contesters → short-circuit.
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      text: "Some claim.",
    });
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    const res = await GET(reqUrl(), ctx("m1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.for).toEqual([]);
    expect(body.against).toEqual([]);
    expect(body.counts).toEqual({ for: 0, against: 0 });
  });

  it("the for-stance search call pushes conclusion_moid into the prisma where clause", async () => {
    prismaMock.claim.findFirst.mockResolvedValueOnce({
      id: "c1",
      moid: "m1",
      text: "x",
    });
    prismaMock.argument.findMany.mockResolvedValueOnce([]);
    // against-side resolution
    prismaMock.claim.findFirst.mockResolvedValueOnce({ id: "c1", text: "x" });
    prismaMock.argumentEdge.findMany.mockResolvedValueOnce([]);
    prismaMock.conflictApplication.findMany.mockResolvedValueOnce([]);

    await GET(reqUrl(), ctx("m1"));

    // First argument.findMany call is from the "for" search invocation.
    const forCall = prismaMock.argument.findMany.mock.calls[0][0];
    expect(forCall.where.conclusion).toEqual({ moid: "m1" });
  });
});
