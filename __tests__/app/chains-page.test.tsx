/**
 * RSC test for app/chains/[identifier]/page.tsx (PUBLIC_CHAIN_PAGE_SPEC §8).
 *
 *   • public chain → renders header/PublicChainView + inline JSON-LD script
 *   • private chain (anonymous) → empty state, no JSON-LD script
 *   • ?view=essay → PublicChainView mounts with initialView="essay"
 *   • ?format=jsonld → redirects to the machine representation
 *
 * The page is an async server component; we invoke it directly and inspect the
 * returned React element tree without rendering (the heavy client view is
 * stubbed).
 */

import ChainPage from "@/app/chains/[identifier]/page";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { computeChainExposure } from "@/lib/deliberation/chainExposure";
import { redirect } from "next/navigation";

class RedirectError extends Error {}

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({ get: () => null })),
}));

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

jest.mock("@/lib/deliberation/chainExposure", () => ({
  computeChainExposure: jest.fn(),
}));

jest.mock("@/components/chains/PublicChainView", () => ({
  __esModule: true,
  default: function PublicChainViewStub() {
    return null;
  },
}));

// ─── Tree-walking helpers ───────────────────────────────────────────────────

function* walk(node: any): Generator<any> {
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  yield node;
  if (node.props) yield* walk(node.props.children);
}

function collectText(node: any, acc: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return acc;
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, acc));
    return acc;
  }
  if (node.props) collectText(node.props.children, acc);
  return acc;
}

function findJsonLdScript(tree: any): any | undefined {
  return [...walk(tree)].find(
    (el) =>
      el?.type === "script" && el?.props?.type === "application/ld+json",
  );
}

function findPublicChainView(tree: any): any | undefined {
  return [...walk(tree)].find((el) => el?.props && "initialView" in el.props);
}

// ─── Fixture ────────────────────────────────────────────────────────────────

function makeChain(overrides: any = {}): any {
  return {
    id: "chain-1",
    deliberationId: "delib-1",
    name: "Peatland chain",
    description: "desc",
    purpose: null,
    chainType: "SERIAL",
    rootNodeId: null,
    createdBy: 166n,
    isPublic: true,
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
          conclusion: { id: "claim-1", text: "Therefore B" },
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

function makeProps(identifier: string, searchParams: Record<string, any> = {}) {
  return {
    params: Promise.resolve({ identifier }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (computeChainExposure as jest.Mock).mockResolvedValue({ chains: [] });
});

describe("ChainPage (RSC)", () => {
  it("public chain → renders PublicChainView + inline JSON-LD script", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    const tree = await ChainPage(makeProps("chain-1"));

    expect(findJsonLdScript(tree)).toBeDefined();
    expect(findPublicChainView(tree)).toBeDefined();
  });

  it("private chain (anonymous) → empty state, no JSON-LD script", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: false }),
    );

    const tree = await ChainPage(makeProps("chain-1"));
    const text = collectText(tree).join(" ");

    expect(text).toContain("Chain not found");
    expect(findJsonLdScript(tree)).toBeUndefined();
    expect(findPublicChainView(tree)).toBeUndefined();
  });

  it("?view=essay → PublicChainView mounts with initialView='essay'", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    const tree = await ChainPage(makeProps("chain-1", { view: "essay" }));
    const view = findPublicChainView(tree);

    expect(view).toBeDefined();
    expect(view.props.initialView).toBe("essay");
  });

  it("?format=jsonld → redirects to the machine representation", async () => {
    (getUserFromCookies as jest.Mock).mockResolvedValue(null);
    (prisma.argumentChain.findUnique as jest.Mock).mockResolvedValue(
      makeChain({ isPublic: true }),
    );

    await expect(
      ChainPage(makeProps("chain-1", { format: "jsonld" })),
    ).rejects.toBeInstanceOf(RedirectError);

    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining("/api/chains/chain-1/jsonld?format=jsonld"),
    );
  });
});
