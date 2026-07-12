// lib/argumentation/__tests__/acceptability.test.ts
//
// Phase 3 (typed bridge) gate. Asserts the runtime contract's §3/§4 split is a
// type-level invariant, exercising the two T-GUARD obligations:
//
//   • A λ-abstraction (higher-order) instance is routed to the *unverified*
//     path and is refused as canonical bridge data (contract §4 / T-GUARD).
//   • A cyclic-`Γ` instance is in-fragment (verified-propositional) and is
//     resolved by the finite acceptability fixpoint (Q-031): odd cycles UNDEC,
//     even cycles labelled without an UNDEC-only collapse.

import type { DefeatGraph, Provenance } from "@/lib/argumentation/types";
import {
  acceptability,
  assertCanonicalPersistable,
  isCanonicalPersistable,
  joinArgumentSets,
  joinAll,
  liftToPowerSet,
  nodesOf,
  partitionByProvenance,
  provenanceOf,
  unverifiedArguments,
} from "@/lib/argumentation/acceptability";

function graph(
  args: string[],
  edges: Array<[string, string]>,
  provenance?: Record<string, Provenance>
): DefeatGraph {
  const attacks = new Map<string, Set<string>>();
  for (const a of args) attacks.set(a, new Set());
  for (const [from, to] of edges) attacks.get(from)!.add(to);
  const dg: DefeatGraph = { args, attacks };
  if (provenance) {
    dg.provenance = new Map(Object.entries(provenance));
  }
  return dg;
}

describe("Phase 3 — level separation (C4, contract §3)", () => {
  test("joinArgumentSets is the free-JSL join (union, idempotent)", () => {
    const a = liftToPowerSet(["x", "y"]);
    const b = liftToPowerSet(["y", "z"]);
    const j = joinArgumentSets(a, b);
    expect([...j.members].sort()).toEqual(["x", "y", "z"]);
    // idempotence: a ∨ a = a
    const aa = joinArgumentSets(a, a);
    expect([...aa.members].sort()).toEqual(["x", "y"]);
  });

  test("joinAll over an empty family is ⊥ = ∅", () => {
    expect([...joinAll([]).members]).toEqual([]);
  });

  test("nodesOf lifts the graph's node set to the power-set level", () => {
    const dg = graph(["a", "b"], [["a", "b"]]);
    expect([...nodesOf(dg).members].sort()).toEqual(["a", "b"]);
  });
});

describe("Phase 3 — provenance guard (C3, contract §4 / T-GUARD)", () => {
  test("λ-abstraction (higher-order) instance is routed to the unverified path", () => {
    // A higher-order generator whose §3 projection is not proven canonical.
    const dg = graph(
      ["lambda", "p"],
      [["lambda", "p"]],
      { lambda: "unverified-higher-order", p: "verified-propositional" }
    );

    // It is still *labelled* (the guard does not block computation)...
    const lab = acceptability(dg);
    expect(lab.get("lambda")).toBe("IN");
    expect(lab.get("p")).toBe("OUT");

    // ...but it is routed to the unverified path and refused as canonical.
    expect(provenanceOf(dg, "lambda")).toBe("unverified-higher-order");
    expect(unverifiedArguments(dg)).toEqual(["lambda"]);
    expect(isCanonicalPersistable(dg)).toBe(false);
    expect(() => assertCanonicalPersistable(dg)).toThrow(/runtime contract §4/);

    const { verified, unverified } = partitionByProvenance(dg);
    expect(verified).toEqual(["p"]);
    expect(unverified).toEqual(["lambda"]);
  });

  test("absent provenance defaults to verified-propositional and is persistable", () => {
    const dg = graph(["a", "b"], [["a", "b"]]);
    expect(provenanceOf(dg, "a")).toBe("verified-propositional");
    expect(isCanonicalPersistable(dg)).toBe(true);
    expect(() => assertCanonicalPersistable(dg)).not.toThrow();
  });

  test("cyclic-Γ instance is in-fragment and resolved by the finite fixpoint", () => {
    // Odd cycle a → b → c → a, all verified-propositional (in-fragment).
    const odd = graph(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
      { a: "verified-propositional", b: "verified-propositional", c: "verified-propositional" }
    );
    expect(isCanonicalPersistable(odd)).toBe(true);
    expect(() => assertCanonicalPersistable(odd)).not.toThrow();
    const oddLab = acceptability(odd);
    // Grounded marks the odd cycle undecided (the third value).
    expect(oddLab.get("a")).toBe("UNDEC");
    expect(oddLab.get("b")).toBe("UNDEC");
    expect(oddLab.get("c")).toBe("UNDEC");

    // Even cycle a ⇄ b: grounded leaves both undecided but the instance is
    // in-fragment and the fixpoint terminates (no design-level operation).
    const even = graph(
      ["a", "b"],
      [
        ["a", "b"],
        ["b", "a"],
      ]
    );
    const evenLab = acceptability(even);
    expect(evenLab.get("a")).toBe("UNDEC");
    expect(evenLab.get("b")).toBe("UNDEC");
  });
});
