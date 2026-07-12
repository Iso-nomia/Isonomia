/**
 * Tests for GET /api/chains/[identifier]/jsonld (PUBLIC_CHAIN_PAGE_SPEC §7/§8).
 *
 *   • public chain → 200 schema.org Collection, one hasPart per node
 *   • private chain → 404 (never expose private structure to machines)
 *   • missing chain → 404
 *   • ?format=aif → 406 (deferred)
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/chains/[identifier]/jsonld/route";
import { prisma } from "@/lib/prismaclient";

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    argumentChain: {
      findUnique: jest.fn(),
    },
  },
}));

function makeChain(overrides: any = {}): any {
  return {
    id: "chain-1",
    deliberationId: "delib-1",
    name: "Test chain",
    description: "desc",
    chainType: "SERIAL",
    createdBy: 166n,
    isPublic: true,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    creator: { id: 166n, name: "Ada", image: null },
    deliberation: { id: "delib-1", title: "Peatland" },
    nodes: [
      {
        id: "node-1",
        nodeOrder: 0,
        addedBy: 166n,
        contributor: { id: 166n, name: "Ada", image: null },
        argument: {
          id: "arg-1",
          text: "Because A",
          authorId: 166n,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          conclusion: { id: "claim-1", text: "Therefore B" },
          premises: [],
          implicitWarrant: null,
          argumentSchemes: [],
          schemeNet: null,
        },
        scope: null,
      },
      {
        id: "node-2",
        nodeOrder: 1,
        addedBy: 166n,
        contributor: { id: 166n, name: "Ada", image: null },
        argument: {
          id: "arg-2",
          text: "Because B",
          authorId: 166n,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          conclusion: { id: "claim-2", text: "Therefore C" },
          premises: [],
          implicitWarrant: null,
          argumentSchemes: [],
          schemeNet: null,
        },
        scope: null,
      },
    ],
    edges: [],
    scopes: [],
    ...overrides,
  };
}

function makeReq(format?: string): NextRequest {
  const url = format
    ? `http://localhost:3000/api/chains/chain-1/jsonld?format=${format}`
    : "http://localhost:3000/api/chains/chain-1/jsonld";
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/chains/[identifier]/jsonld", () => {
  it("public chain → 200 schema.org Collection with one hasPart per node", async () => {
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    const res = await GET(makeReq(), { params: { identifier: "chain-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body["@context"]).toBe("https://schema.org");
    expect(body["@type"]).toBe("Collection");
    expect(body.numberOfItems).toBe(2);
    expect(body.hasPart).toHaveLength(2);
    expect(body.hasPart[0].name).toBe("Therefore B");
    expect(body.hasPart[1].position).toBe(2);
    expect(body.author.name).toBe("Ada");
  });

  it("private chain → 404", async () => {
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: false }),
    );

    const res = await GET(makeReq(), { params: { identifier: "chain-1" } });
    expect(res.status).toBe(404);
  });

  it("missing chain → 404", async () => {
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeReq(), { params: { identifier: "nope" } });
    expect(res.status).toBe(404);
  });

  it("?format=aif → 406 (deferred)", async () => {
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    const res = await GET(makeReq("aif"), { params: { identifier: "chain-1" } });
    expect(res.status).toBe(406);
  });
});
