/**
 * Phase 10a — HTTP contract for GET /api/v3/claims/{moid}/cited-by.
 *
 * Asserts resolve → 404 mapping → envelope + the stances pointer. The edge
 * model is unit-tested elsewhere; the lib and prisma are mocked here.
 */

import { NextRequest } from "next/server";

const prismaMock: any = { claim: { findFirst: jest.fn() } };
const getClaimCitedBy = jest.fn();

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));
jest.mock("@/lib/citation/citedBy", () => ({
  getClaimCitedBy,
  CITED_BY_DEFAULT_LIMIT: 50,
  CITED_BY_MAX_LIMIT: 200,
}));

import { GET } from "@/app/api/v3/claims/[moid]/cited-by/route";

function call(url: string, moid: string) {
  return GET(new NextRequest(url), { params: Promise.resolve({ moid }) });
}

beforeEach(() => {
  prismaMock.claim.findFirst.mockReset();
  getClaimCitedBy.mockReset();
});

it("404s claim_not_found when the moid does not resolve", async () => {
  prismaMock.claim.findFirst.mockResolvedValue(null);
  const res = await call("http://localhost/api/v3/claims/nope/cited-by", "nope");
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body).toMatchObject({ ok: false, error: "claim_not_found" });
  expect(getClaimCitedBy).not.toHaveBeenCalled();
});

it("wraps the lib result and emits the stances pointer", async () => {
  prismaMock.claim.findFirst.mockResolvedValue({ id: "C" });
  getClaimCitedBy.mockResolvedValue({
    target: { kind: "claim", id: "C", moid: "moid-c", text: "claim", deliberationId: "d1" },
    edges: [],
    counts: {
      total: 1,
      byKind: { supports: 0, contests: 0, "builds-on": 1, reuses: 0 },
      contests: 0,
      crossDeliberation: 0,
      nonPublic: 0,
    },
    truncated: false,
  });
  const res = await call("http://localhost/api/v3/claims/moid-c/cited-by", "moid-c");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.target.kind).toBe("claim");
  expect(body.links.stances).toContain("/api/v3/claims/moid-c/stances");
  expect(getClaimCitedBy).toHaveBeenCalledWith("C", expect.objectContaining({ limit: 50 }));
});
