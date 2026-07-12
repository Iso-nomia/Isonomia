/**
 * Phase 10a — HTTP contract for GET /api/v3/arguments/{identifier}/cited-by.
 *
 * The edge model is unit-tested in __tests__/lib/citedBy.test.ts; here we only
 * assert the route's job: resolve → 404 mapping → envelope + links + param
 * forwarding. The lib and the permalink resolver are mocked.
 */

import { NextRequest } from "next/server";

const resolvePermalink = jest.fn();
const getArgumentCitedBy = jest.fn();

jest.mock("@/lib/citations/permalinkService", () => ({ resolvePermalink }));
jest.mock("@/lib/citation/citedBy", () => ({
  getArgumentCitedBy,
  CITED_BY_DEFAULT_LIMIT: 50,
  CITED_BY_MAX_LIMIT: 200,
}));

import { GET } from "@/app/api/v3/arguments/[identifier]/cited-by/route";

function call(url: string, identifier: string) {
  return GET(new NextRequest(url), { params: Promise.resolve({ identifier }) });
}

beforeEach(() => {
  resolvePermalink.mockReset();
  getArgumentCitedBy.mockReset();
});

function sampleResult() {
  return {
    target: {
      kind: "argument",
      id: "arg1",
      shortCode: "SC1",
      conclusionMoid: "moid-1",
      text: "conclusion",
      deliberationId: "d1",
    },
    edges: [],
    counts: {
      total: 2,
      byKind: { supports: 1, contests: 1, "builds-on": 0, reuses: 0 },
      contests: 1,
      crossDeliberation: 0,
      nonPublic: 0,
    },
    truncated: false,
  };
}

it("404s argument_not_found when the permalink does not resolve", async () => {
  resolvePermalink.mockResolvedValue(null);
  const res = await call("http://localhost/api/v3/arguments/nope/cited-by", "nope");
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body).toMatchObject({ ok: false, error: "argument_not_found" });
  expect(getArgumentCitedBy).not.toHaveBeenCalled();
});

it("404s when the argument row is gone (lib returns null)", async () => {
  resolvePermalink.mockResolvedValue({ argumentId: "arg1", version: 1 });
  getArgumentCitedBy.mockResolvedValue(null);
  const res = await call("http://localhost/api/v3/arguments/SC1/cited-by", "SC1");
  expect(res.status).toBe(404);
});

it("wraps the lib result and derives counterSearch + self links", async () => {
  resolvePermalink.mockResolvedValue({ argumentId: "arg1", version: 1 });
  getArgumentCitedBy.mockResolvedValue(sampleResult());
  const res = await call("http://localhost/api/v3/arguments/SC1/cited-by", "SC1");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.counts.contests).toBe(1);
  expect(body.links.self).toContain("/a/SC1");
  expect(body.links.counterSearch).toContain("against=moid-1");
});

it("forwards limit/sort/public_only/include_standing to the lib", async () => {
  resolvePermalink.mockResolvedValue({ argumentId: "arg1", version: 1 });
  getArgumentCitedBy.mockResolvedValue(sampleResult());
  await call(
    "http://localhost/api/v3/arguments/SC1/cited-by?limit=5&sort=stance&public_only=1&include_standing=true",
    "SC1",
  );
  expect(getArgumentCitedBy).toHaveBeenCalledWith("arg1", {
    limit: 5,
    sort: "stance",
    publicOnly: true,
    includeStanding: true,
  });
});

it("clamps limit to the max and defaults sort to recent", async () => {
  resolvePermalink.mockResolvedValue({ argumentId: "arg1", version: 1 });
  getArgumentCitedBy.mockResolvedValue(sampleResult());
  await call("http://localhost/api/v3/arguments/SC1/cited-by?limit=9999", "SC1");
  expect(getArgumentCitedBy).toHaveBeenCalledWith(
    "arg1",
    expect.objectContaining({ limit: 200, sort: "recent" }),
  );
});
