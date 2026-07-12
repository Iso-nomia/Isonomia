/**
 * Unit tests for the pure scope resolver — PART 5 (CHAIN_SEMANTICS_OVER_MCP_SPEC.md
 * §4.1–4.4, §9). Verifies scope-forest validation, per-node status/role
 * reconciliation, mode-coercion targets, and the two honesty guards
 * (containment / status conflict) without any database.
 */

import {
  resolveChainScopes,
  MAX_SCOPE_DEPTH,
  SCOPE_TYPES,
  EPISTEMIC_STATUSES,
  DIALECTICAL_ROLES,
  type ScopeInput,
  type ScopeLinkInput,
  type ScopeSupportEdge,
} from "@/lib/argument-chains/chainScopes";

function run(
  scopes: ScopeInput[] | undefined,
  links: ScopeLinkInput[],
  supportEdges: ScopeSupportEdge[] = [],
) {
  return resolveChainScopes({ scopes, links, supportEdges });
}

describe("resolveChainScopes — exports", () => {
  it("publishes the substrate enum vocabularies", () => {
    expect(SCOPE_TYPES).toContain("HYPOTHETICAL");
    expect(SCOPE_TYPES).toContain("COUNTERFACTUAL");
    expect(EPISTEMIC_STATUSES).toContain("ASSERTED");
    expect(EPISTEMIC_STATUSES).toContain("HYPOTHETICAL");
    expect(DIALECTICAL_ROLES).toContain("THESIS");
    expect(MAX_SCOPE_DEPTH).toBe(4);
  });
});

describe("resolveChainScopes — backward-compat (actual world)", () => {
  it("with no scopes, every link is ASSERTED, scopeless, role null", () => {
    const res = run(undefined, [{}, {}]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resolvedScopes).toHaveLength(0);
    expect(res.links).toEqual([
      { scopeIndex: null, epistemicStatus: "ASSERTED", dialecticalRole: null, coercedMode: null },
      { scopeIndex: null, epistemicStatus: "ASSERTED", dialecticalRole: null, coercedMode: null },
    ]);
    expect(res.warnings).toHaveLength(0);
  });

  it("a serial support spine with no scopes never leaks", () => {
    const res = run(undefined, [{}, {}, {}], [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
    expect(res.ok).toBe(true);
  });

  it("carries an explicit dialecticalRole in the actual world", () => {
    const res = run(undefined, [{ dialecticalRole: "THESIS" }, { dialecticalRole: "ANTITHESIS" }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0].dialecticalRole).toBe("THESIS");
    expect(res.links[1].dialecticalRole).toBe("ANTITHESIS");
    // Roles are orthogonal: both still ASSERTED.
    expect(res.links.every((l) => l.epistemicStatus === "ASSERTED")).toBe(true);
  });
});

describe("resolveChainScopes — status/mode reconciliation (§4.4)", () => {
  it("a HYPOTHETICAL scope defaults nodes to HYPOTHETICAL and coerces mode", () => {
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "If the tax passes" }],
      [{ scope: 0 }, { scope: 0 }],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0]).toMatchObject({
      scopeIndex: 0,
      epistemicStatus: "HYPOTHETICAL",
      coercedMode: "HYPOTHETICAL",
    });
    expect(res.links[1].epistemicStatus).toBe("HYPOTHETICAL");
  });

  it("a COUNTERFACTUAL scope defaults to COUNTERFACTUAL and coerces mode", () => {
    const res = run(
      [{ scopeType: "COUNTERFACTUAL", assumption: "Had we invested earlier" }],
      [{ scope: 0 }],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0].epistemicStatus).toBe("COUNTERFACTUAL");
    expect(res.links[0].coercedMode).toBe("COUNTERFACTUAL");
  });

  it("a CONDITIONAL scope defaults to CONDITIONAL and leaves mode as supplied", () => {
    const res = run([{ scopeType: "CONDITIONAL", assumption: "If X then" }], [{ scope: 0 }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0].epistemicStatus).toBe("CONDITIONAL");
    expect(res.links[0].coercedMode).toBeNull();
  });

  it("OPPONENT defaults to HYPOTHETICAL+coerce; MODAL defaults HYPOTHETICAL but leaves mode", () => {
    const res = run(
      [
        { scopeType: "OPPONENT", assumption: "On their own assumptions" },
        { scopeType: "MODAL", assumption: "Necessarily" },
      ],
      [{ scope: 0 }, { scope: 1 }],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0]).toMatchObject({ epistemicStatus: "HYPOTHETICAL", coercedMode: "HYPOTHETICAL" });
    expect(res.links[1]).toMatchObject({ epistemicStatus: "HYPOTHETICAL", coercedMode: null });
  });

  it("a permissive explicit status (QUESTIONED) in a hard scope leaves mode uncoerced", () => {
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      [{ scope: 0, epistemicStatus: "QUESTIONED" }],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.links[0].epistemicStatus).toBe("QUESTIONED");
    expect(res.links[0].coercedMode).toBeNull();
  });

  it("rejects ASSERTED inside a COUNTERFACTUAL scope (SCOPE_STATUS_CONFLICT)", () => {
    const res = run(
      [{ scopeType: "COUNTERFACTUAL", assumption: "Had X" }],
      [{ scope: 0, epistemicStatus: "ASSERTED" }],
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_STATUS_CONFLICT");
    expect(res.linkIndex).toBe(0);
  });

  it("rejects a hard status that contradicts its hard scope (HYPOTHETICAL in COUNTERFACTUAL)", () => {
    const res = run(
      [{ scopeType: "COUNTERFACTUAL", assumption: "Had X" }],
      [{ scope: 0, epistemicStatus: "HYPOTHETICAL" }],
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_STATUS_CONFLICT");
  });
});

describe("resolveChainScopes — nesting & depth (§4.2)", () => {
  it("computes depth: a child of a root scope sits at depth 1", () => {
    const res = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "A" },
        { scopeType: "HYPOTHETICAL", assumption: "B", parentScope: 0 },
      ],
      [{ scope: 0 }, { scope: 1 }],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resolvedScopes[0]).toMatchObject({ parentIndex: null, depth: 0 });
    expect(res.resolvedScopes[1]).toMatchObject({ parentIndex: 0, depth: 1 });
  });

  it("rejects an out-of-range parentScope (SCOPE_INVALID_INDEX)", () => {
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "A", parentScope: 5 }],
      [{ scope: 0 }],
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_INVALID_INDEX");
  });

  it("rejects a self-parent and a 2-cycle (SCOPE_CYCLE_DETECTED)", () => {
    const self = run([{ scopeType: "HYPOTHETICAL", assumption: "A", parentScope: 0 }], [{ scope: 0 }]);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.code).toBe("SCOPE_CYCLE_DETECTED");

    const cycle = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "A", parentScope: 1 },
        { scopeType: "HYPOTHETICAL", assumption: "B", parentScope: 0 },
      ],
      [{ scope: 0 }, { scope: 1 }],
    );
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.code).toBe("SCOPE_CYCLE_DETECTED");
  });

  it("rejects nesting deeper than the v1 cap (SCOPE_TOO_DEEP at depth 5)", () => {
    // Chain of 6 scopes 0←1←2←3←4←5 → scope 5 is depth 5 (> cap 4).
    const scopes: ScopeInput[] = [];
    for (let i = 0; i < 6; i++) {
      scopes.push({
        scopeType: "HYPOTHETICAL",
        assumption: `S${i}`,
        ...(i > 0 ? { parentScope: i - 1 } : {}),
      });
    }
    const res = run(
      scopes,
      scopes.map((_, i) => ({ scope: i })),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_TOO_DEEP");
  });

  it("allows exactly the cap depth (4)", () => {
    const scopes: ScopeInput[] = [];
    for (let i = 0; i < 5; i++) {
      scopes.push({
        scopeType: "HYPOTHETICAL",
        assumption: `S${i}`,
        ...(i > 0 ? { parentScope: i - 1 } : {}),
      });
    }
    const res = run(
      scopes,
      scopes.map((_, i) => ({ scope: i })),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resolvedScopes[4].depth).toBe(4);
  });
});

describe("resolveChainScopes — containment / leak (§4.2)", () => {
  it("allows reasoning from the actual world INTO a scope", () => {
    // link 0 asserted, link 1 in scope 0; edge 0→1 (asserted premise feeds scope).
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      [{}, { scope: 0 }],
      [{ from: 0, to: 1 }],
    );
    expect(res.ok).toBe(true);
  });

  it("allows reasoning into a DESCENDANT scope", () => {
    const res = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "A" },
        { scopeType: "HYPOTHETICAL", assumption: "B", parentScope: 0 },
      ],
      [{ scope: 0 }, { scope: 1 }],
      [{ from: 0, to: 1 }], // link in A supports link in B (descendant) — OK
    );
    expect(res.ok).toBe(true);
  });

  it("rejects a conclusion drawn inside a scope leaking into the actual world (SCOPE_LEAK)", () => {
    // link 0 inside scope 0; link 1 in actual world threads link 0's conclusion.
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      [{ scope: 0 }, {}],
      [{ from: 0, to: 1 }],
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_LEAK");
    expect(res.linkIndex).toBe(1);
  });

  it("rejects a leak into a sibling / unrelated scope", () => {
    const res = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "A" },
        { scopeType: "HYPOTHETICAL", assumption: "B" },
      ],
      [{ scope: 0 }, { scope: 1 }],
      [{ from: 0, to: 1 }], // A's conclusion used in unrelated B → leak
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_LEAK");
  });

  it("rejects a leak from a deep scope up to its ancestor", () => {
    const res = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "A" },
        { scopeType: "HYPOTHETICAL", assumption: "B", parentScope: 0 },
      ],
      [{ scope: 1 }, { scope: 0 }],
      [{ from: 0, to: 1 }], // child(B)'s conclusion used in parent(A) → leak
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_LEAK");
  });

  it("attack edges are NOT passed as support edges, so they never trigger leaks", () => {
    // The route filters to support edges before calling; here we simply omit the
    // attack edge from supportEdges and confirm no leak is raised.
    const res = run(
      [{ scopeType: "HYPOTHETICAL", assumption: "Suppose" }],
      [{ scope: 0 }, {}],
      [], // no support edge between them
    );
    expect(res.ok).toBe(true);
  });
});

describe("resolveChainScopes — indices & advisories", () => {
  it("rejects an out-of-range link scope index (SCOPE_INVALID_INDEX)", () => {
    const res = run([{ scopeType: "HYPOTHETICAL", assumption: "A" }], [{ scope: 3 }]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SCOPE_INVALID_INDEX");
    expect(res.linkIndex).toBe(0);
  });

  it("warns scope_empty for a declared scope with no links", () => {
    const res = run(
      [
        { scopeType: "HYPOTHETICAL", assumption: "Used" },
        { scopeType: "HYPOTHETICAL", assumption: "Unused" },
      ],
      [{ scope: 0 }, {}],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "scope_empty" })]),
    );
    // Only scope 1 is empty.
    expect(res.warnings.filter((w) => w.code === "scope_empty")).toHaveLength(1);
  });
});
