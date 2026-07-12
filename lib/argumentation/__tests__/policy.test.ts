// lib/argumentation/__tests__/policy.test.ts
//
// Phase 4b gate: the semantics policy resolves with the right precedence
// (override > stored > default) and dispatches to exact semantics.

import type { DefeatGraph } from "@/lib/argumentation/types";
import { labellingToSets } from "@/lib/argumentation/labelling";
import {
  DEFAULT_SEMANTICS_POLICY,
  isSemanticsPolicy,
  policyLabelling,
  resolveSemanticsPolicy,
} from "@/lib/argumentation/policy";

function graph(args: string[], edges: Array<[string, string]>): DefeatGraph {
  const attacks = new Map<string, Set<string>>();
  for (const a of args) attacks.set(a, new Set());
  for (const [from, to] of edges) {
    if (!attacks.has(from)) attacks.set(from, new Set());
    if (!attacks.has(to)) attacks.set(to, new Set());
    attacks.get(from)!.add(to);
  }
  return { args: [...args], attacks };
}

describe("Phase 4b — semantics policy resolution", () => {
  test("override wins over stored and default", () => {
    expect(
      resolveSemanticsPolicy({ override: "grounded", stored: "stable" })
    ).toBe("grounded");
  });

  test("stored applies when there is no override", () => {
    expect(resolveSemanticsPolicy({ override: null, stored: "stable" })).toBe(
      "stable"
    );
    expect(
      resolveSemanticsPolicy({ override: undefined, stored: "grounded" })
    ).toBe("grounded");
  });

  test("falls back to the engine default for invalid/absent values", () => {
    expect(resolveSemanticsPolicy({})).toBe(DEFAULT_SEMANTICS_POLICY);
    expect(
      resolveSemanticsPolicy({ override: "bogus", stored: "nonsense" })
    ).toBe(DEFAULT_SEMANTICS_POLICY);
    // an invalid override does not shadow a valid stored setting
    expect(resolveSemanticsPolicy({ override: "bogus", stored: "stable" })).toBe(
      "stable"
    );
  });

  test("isSemanticsPolicy guards the union", () => {
    expect(isSemanticsPolicy("preferred")).toBe(true);
    expect(isSemanticsPolicy("semi-stable")).toBe(false);
    expect(isSemanticsPolicy(42)).toBe(false);
  });
});

describe("Phase 4b — policyLabelling dispatch", () => {
  test("grounded leaves an odd cycle undecided", () => {
    const dg = graph(["a", "b", "c"], [["a", "b"], ["b", "c"], ["c", "a"]]);
    const { IN, UNDEC } = labellingToSets(policyLabelling(dg, "grounded"));
    expect(IN.size).toBe(0);
    expect(UNDEC.size).toBe(3);
  });

  test("preferred is skeptical over preferred extensions", () => {
    // a→b, b→a, c→a: skeptical-preferred accepts nothing in the 2-cycle's
    // disputed part but c is unattacked.
    const dg = graph(["a", "b"], [["a", "b"], ["b", "a"]]);
    const { IN, UNDEC } = labellingToSets(policyLabelling(dg, "preferred"));
    // Two preferred extensions {a} and {b}; intersection empty → both UNDEC.
    expect(IN.size).toBe(0);
    expect(UNDEC.size).toBe(2);
  });

  test("stable over an even cycle: intersection of the two stable extensions", () => {
    const dg = graph(["a", "b"], [["a", "b"], ["b", "a"]]);
    const { IN } = labellingToSets(policyLabelling(dg, "stable"));
    // Stable extensions {a}, {b}; skeptical intersection empty.
    expect(IN.size).toBe(0);
  });

  test("stable yields all-UNDEC when no stable extension exists (odd cycle)", () => {
    const dg = graph(["a", "b", "c"], [["a", "b"], ["b", "c"], ["c", "a"]]);
    const { IN, OUT, UNDEC } = labellingToSets(policyLabelling(dg, "stable"));
    expect(IN.size).toBe(0);
    expect(OUT.size).toBe(0);
    expect(UNDEC.size).toBe(3);
  });

  test("grounded and preferred agree on a well-founded graph", () => {
    const dg = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    const g = labellingToSets(policyLabelling(dg, "grounded"));
    const p = labellingToSets(policyLabelling(dg, "preferred"));
    expect([...g.IN].sort()).toEqual(["a", "c"]);
    expect([...p.IN].sort()).toEqual(["a", "c"]);
  });
});
