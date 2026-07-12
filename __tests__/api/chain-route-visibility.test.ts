/**
 * Visibility tests for GET /api/argument-chains/[chainId]
 * (PUBLIC_CHAIN_PAGE_SPEC §4 / §8).
 *
 * Guards the Option-A relaxation against regressing the authed in-app callers:
 *   • anonymous + public  → 200, serialized chain, no BigInt leakage
 *   • anonymous + private → 404 (don't leak existence)
 *   • authed creator + private → 200
 *   • authed non-creator + private → 403
 *   • missing chain → 404
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/argument-chains/[chainId]/route";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

jest.mock("@/lib/serverutils", () => ({
  getUserFromCookies: jest.fn(),
}));

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
    purpose: null,
    chainType: "SERIAL",
    rootNodeId: null,
    createdBy: 166n,
    isPublic: false,
    isEditable: false,
    idempotencyKey: null,
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
          conclusion: { id: "claim-1", text: "B" },
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

function makeReq(): NextRequest {
  return new NextRequest("http://localhost:3000/api/argument-chains/chain-1");
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/argument-chains/[chainId] — visibility", () => {
  it("anonymous + public → 200 with serialized chain (no BigInt leakage)", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    const res = await GET(makeReq(), { params: { chainId: "chain-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.chain.createdBy).toBe("string");
    expect(typeof body.chain.creator.id).toBe("string");
    expect(typeof body.chain.nodes[0].addedBy).toBe("string");
  });

  it("anonymous + private → 404 (don't leak existence)", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: false }),
    );

    const res = await GET(makeReq(), { params: { chainId: "chain-1" } });
    expect(res.status).toBe(404);
  });

  it("authed creator + private → 200", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ userId: "166" });
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: false, createdBy: 166n }),
    );

    const res = await GET(makeReq(), { params: { chainId: "chain-1" } });
    expect(res.status).toBe(200);
  });

  it("authed non-creator + private → 403", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue({ userId: "999" });
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: false, createdBy: 166n }),
    );

    const res = await GET(makeReq(), { params: { chainId: "chain-1" } });
    expect(res.status).toBe(403);
  });

  it("missing chain → 404", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeReq(), { params: { chainId: "nope" } });
    expect(res.status).toBe(404);
  });
});
