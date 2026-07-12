import {
  resolveChainTopology,
  resolveChainAttacks,
  isSupportEdgeType,
  type TopologyEdgeInput,
  type ResolvedEdge,
  type AttackLinkInput,
} from "@/lib/argument-chains/chainTopology";

describe("resolveChainTopology — edge resolution", () => {
  it("synthesizes a serial SUPPORTS spine when edges are omitted", () => {
    const r = resolveChainTopology(3, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("SERIAL");
    expect(r.resolvedEdges).toEqual([
      { from: 0, to: 1, edgeType: "SUPPORTS", strength: 1.0 },
      { from: 1, to: 2, edgeType: "SUPPORTS", strength: 1.0 },
    ]);
    expect(r.supportEdgeCount).toBe(2);
    expect(r.attackEdgeCount).toBe(0);
    expect(r.rootIndex).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it("synthesizes no edges for a single-link chain", () => {
    const r = resolveChainTopology(1, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolvedEdges).toEqual([]);
    expect(r.derivedChainType).toBe("SERIAL");
  });

  it("defaults edgeType and strength on a declared edge", () => {
    const r = resolveChainTopology(2, [{ from: 0, to: 1 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolvedEdges[0]).toEqual({
      from: 0,
      to: 1,
      edgeType: "SUPPORTS",
      strength: 1.0,
      description: undefined,
    });
  });

  it("dedups duplicate directed pairs (first wins)", () => {
    const edges: TopologyEdgeInput[] = [
      { from: 0, to: 1, strength: 0.5 },
      { from: 0, to: 1, strength: 0.9 },
    ];
    const r = resolveChainTopology(2, edges);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolvedEdges).toHaveLength(1);
    expect(r.resolvedEdges[0].strength).toBe(0.5);
  });
});

describe("resolveChainTopology — type derivation", () => {
  it("derives SERIAL for a linear spine", () => {
    const r = resolveChainTopology(3, [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
    expect(r.ok && r.derivedChainType).toBe("SERIAL");
  });

  it("derives CONVERGENT for fan-in (A→C, B→C)", () => {
    const r = resolveChainTopology(3, [
      { from: 0, to: 2 },
      { from: 1, to: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("CONVERGENT");
  });

  it("derives DIVERGENT for a single fan-out node (A→B, A→C)", () => {
    const r = resolveChainTopology(3, [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("DIVERGENT");
  });

  it("derives TREE for multiple fan-out nodes (A→B, A→C, B→D, B→E)", () => {
    const r = resolveChainTopology(5, [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 1, to: 4 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("TREE");
  });

  it("derives GRAPH when both fan-in and fan-out occur", () => {
    // 0→2, 1→2 (fan-in at 2) and 2→3, 2→4 (fan-out at 2)
    const r = resolveChainTopology(5, [
      { from: 0, to: 2 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 2, to: 4 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("GRAPH");
  });

  it("excludes attack edges from the derived support topology", () => {
    // A serial support spine plus a REBUTS edge pointing backward.
    const r = resolveChainTopology(3, [
      { from: 0, to: 1, edgeType: "SUPPORTS" },
      { from: 1, to: 2, edgeType: "SUPPORTS" },
      { from: 2, to: 0, edgeType: "REBUTS" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.derivedChainType).toBe("SERIAL");
    expect(r.supportEdgeCount).toBe(2);
    expect(r.attackEdgeCount).toBe(1);
  });
});

describe("resolveChainTopology — validation failures", () => {
  it("rejects an out-of-range index", () => {
    const r = resolveChainTopology(2, [{ from: 0, to: 5 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
  });

  it("rejects a self-loop", () => {
    const r = resolveChainTopology(2, [{ from: 1, to: 1 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
  });

  it("rejects a support cycle", () => {
    const r = resolveChainTopology(3, [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 0 },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_CYCLE_DETECTED");
  });

  it("allows an attack edge to form a cycle (only support must be acyclic)", () => {
    const r = resolveChainTopology(3, [
      { from: 0, to: 1, edgeType: "SUPPORTS" },
      { from: 1, to: 2, edgeType: "SUPPORTS" },
      { from: 2, to: 1, edgeType: "UNDERCUTS" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects when expectChainType disagrees with the wires", () => {
    const r = resolveChainTopology(
      3,
      [
        { from: 0, to: 2 },
        { from: 1, to: 2 },
      ],
      "SERIAL",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_TYPE_MISMATCH");
    expect(r.derivedChainType).toBe("CONVERGENT");
  });

  it("passes when expectChainType matches the wires", () => {
    const r = resolveChainTopology(
      3,
      [
        { from: 0, to: 2 },
        { from: 1, to: 2 },
      ],
      "CONVERGENT",
    );
    expect(r.ok).toBe(true);
  });
});

describe("resolveChainTopology — warnings", () => {
  it("warns when the support sub-graph has multiple roots", () => {
    // Two disjoint roots (0 and 1) both feeding 2.
    const r = resolveChainTopology(3, [
      { from: 0, to: 2 },
      { from: 1, to: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.code)).toContain("chain_multiple_roots");
  });
});

describe("isSupportEdgeType", () => {
  it("treats SUPPORTS/ENABLES/PRESUPPOSES as support", () => {
    expect(isSupportEdgeType("SUPPORTS")).toBe(true);
    expect(isSupportEdgeType("ENABLES")).toBe(true);
    expect(isSupportEdgeType("PRESUPPOSES")).toBe(true);
  });

  it("treats attack edge types as non-support", () => {
    expect(isSupportEdgeType("REBUTS")).toBe(false);
    expect(isSupportEdgeType("UNDERCUTS")).toBe(false);
    expect(isSupportEdgeType("UNDERMINES")).toBe(false);
    expect(isSupportEdgeType("REFUTES")).toBe(false);
  });
});

// ─── Recursive attacks (PART 4 §4.2, Steps 3–4) ──────────────────────────────

/** Build the materialised support edge set for a serial spine of `n` links. */
function serialEdges(n: number): ResolvedEdge[] {
  const r = resolveChainTopology(n, undefined);
  if (!r.ok) throw new Error("serial spine should resolve");
  return r.resolvedEdges;
}

function attacks(
  n: number,
  edges: ResolvedEdge[],
  links: Array<AttackLinkInput | undefined>,
) {
  return resolveChainAttacks(n, edges, links);
}

describe("resolveChainAttacks — no attacks (backward-compat)", () => {
  it("returns an empty register when no link declares an attack", () => {
    const r = attacks(3, serialEdges(3), [undefined, undefined, undefined]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("ignores links with empty attack declarations", () => {
    const r = attacks(2, serialEdges(2), [{}, {}]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks).toEqual([]);
  });
});

describe("resolveChainAttacks — node attacks", () => {
  it("resolves a REBUTS node attack by default", () => {
    const r = attacks(3, serialEdges(3), [
      undefined,
      undefined,
      { attacksNode: 1 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks).toEqual([
      {
        attackerIndex: 2,
        targetType: "NODE",
        targetNodeIndex: 1,
        targetEdge: null,
        edgeType: "REBUTS",
      },
    ]);
  });

  it("honours an explicit UNDERMINES attackType", () => {
    const r = attacks(3, serialEdges(3), [
      undefined,
      undefined,
      { attacksNode: 0, attackType: "UNDERMINES" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks[0].edgeType).toBe("UNDERMINES");
    expect(r.attacks[0].targetNodeIndex).toBe(0);
  });

  it("rejects a node attack on an out-of-range index", () => {
    const r = attacks(2, serialEdges(2), [undefined, { attacksNode: 5 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
    expect(r.linkIndex).toBe(1);
  });

  it("rejects a node attacking itself", () => {
    const r = attacks(2, serialEdges(2), [undefined, { attacksNode: 1 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
  });
});

describe("resolveChainAttacks — edge attacks (the headline)", () => {
  it("resolves an UNDERCUTS attack on a declared support edge", () => {
    // 0→2 and 1→2 support edges; link 3 undercuts the 0→2 inference.
    const edges: ResolvedEdge[] = [
      { from: 0, to: 2, edgeType: "SUPPORTS", strength: 1 },
      { from: 1, to: 2, edgeType: "SUPPORTS", strength: 1 },
    ];
    const r = attacks(4, edges, [
      undefined,
      undefined,
      undefined,
      { attacksEdge: { from: 0, to: 2 } },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks).toEqual([
      {
        attackerIndex: 3,
        targetType: "EDGE",
        targetNodeIndex: null,
        targetEdge: { from: 0, to: 2 },
        edgeType: "UNDERCUTS",
      },
    ]);
  });

  it("rejects an edge attack on a pair with no declared edge", () => {
    const r = attacks(3, serialEdges(3), [
      undefined,
      undefined,
      { attacksEdge: { from: 0, to: 2 } },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_ATTACK_TARGET_NOT_FOUND");
    expect(r.linkIndex).toBe(2);
  });

  it("rejects an edge attack whose indices are out of range", () => {
    const r = attacks(2, serialEdges(2), [
      undefined,
      { attacksEdge: { from: 0, to: 9 } },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
  });

  it("rejects a depth-2 attack on an attack edge (CHAIN_ATTACK_ON_ATTACK)", () => {
    // 0→1 is itself a REBUTS attack edge; undercutting it is 2nd-order.
    const edges: ResolvedEdge[] = [
      { from: 0, to: 1, edgeType: "REBUTS", strength: 1 },
    ];
    const r = attacks(3, edges, [
      undefined,
      undefined,
      { attacksEdge: { from: 0, to: 1 } },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_ATTACK_ON_ATTACK");
    expect(r.linkIndex).toBe(2);
  });
});

describe("resolveChainAttacks — mutual exclusivity", () => {
  it("rejects a link declaring both attacksNode and attacksEdge", () => {
    const r = attacks(3, serialEdges(3), [
      undefined,
      undefined,
      { attacksNode: 0, attacksEdge: { from: 0, to: 1 } },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CHAIN_EDGE_INVALID_INDEX");
    expect(r.linkIndex).toBe(2);
  });

  it("resolves multiple attacks across distinct links", () => {
    const edges: ResolvedEdge[] = [
      { from: 0, to: 1, edgeType: "SUPPORTS", strength: 1 },
    ];
    const r = attacks(4, edges, [
      undefined,
      undefined,
      { attacksNode: 1 },
      { attacksEdge: { from: 0, to: 1 } },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attacks).toHaveLength(2);
    expect(r.attacks[0].targetType).toBe("NODE");
    expect(r.attacks[1].targetType).toBe("EDGE");
  });
});
