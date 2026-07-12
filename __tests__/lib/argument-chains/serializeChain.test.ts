/**
 * Unit tests for serializeChain (PUBLIC_CHAIN_PAGE_SPEC §8).
 *
 * Verifies every BigInt field on a hydrated chain is coerced to a string,
 * that the operation is idempotent (safe on already-serialized input), and
 * that nulls / missing relations don't throw.
 */

import { serializeChain } from "@/lib/chains/serializeChain";

function makeHydratedChain(overrides: any = {}): any {
  return {
    id: "chain-1",
    deliberationId: "delib-1",
    name: "Test chain",
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
          conclusion: { id: "claim-1", text: "B" },
          premises: [],
          implicitWarrant: null,
          argumentSchemes: [],
          schemeNet: null,
        },
        scope: null,
      },
    ],
    edges: [
      {
        id: "edge-1",
        sourceNodeId: "node-1",
        targetNodeId: "node-2",
        edgeType: "SUPPORTS",
        sourceNode: { id: "node-1", addedBy: 166n },
        targetNode: { id: "node-2", addedBy: 200n },
      },
    ],
    scopes: [{ id: "scope-1", scopeType: "ASSUMPTION", createdBy: 166n }],
    ...overrides,
  };
}

describe("serializeChain", () => {
  it("coerces every BigInt field to a string", () => {
    const out = serializeChain(makeHydratedChain()) as any;

    expect(typeof out.createdBy).toBe("string");
    expect(out.createdBy).toBe("166");
    expect(typeof out.creator.id).toBe("string");
    expect(out.nodes[0].addedBy).toBe("166");
    expect(out.nodes[0].contributor.id).toBe("166");
    expect(out.nodes[0].argument.authorId).toBe("166");
    expect(out.edges[0].sourceNode.addedBy).toBe("166");
    expect(out.edges[0].targetNode.addedBy).toBe("200");
    expect(out.scopes[0].createdBy).toBe("166");
  });

  it("leaks no BigInt anywhere (JSON-serializable)", () => {
    const out = serializeChain(makeHydratedChain());
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("is idempotent on already-serialized input", () => {
    const once = serializeChain(makeHydratedChain());
    const twice = serializeChain(once as any) as any;
    expect(twice.createdBy).toBe("166");
    expect(twice.nodes[0].addedBy).toBe("166");
  });

  it("tolerates null argument / contributor / scopes", () => {
    const chain = makeHydratedChain({
      nodes: [
        {
          id: "node-1",
          nodeOrder: 0,
          addedBy: 5n,
          contributor: null,
          argument: null,
          scope: null,
        },
      ],
      scopes: undefined,
    });
    const out = serializeChain(chain) as any;
    expect(out.nodes[0].argument).toBeNull();
    expect(out.nodes[0].addedBy).toBe("5");
    expect(out.scopes).toEqual([]);
  });
});
