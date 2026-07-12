/**
 * Unit tests for the canonical bi-orthogonal closure set-algebra
 * (`behaviourClosure.ts`).
 *
 * These tests exercise the closure operations with an INJECTED stub oracle, so
 * they are pure and need no database. The point is to lock the set-algebra and
 * the D0.2 totality contract; the canonical oracle itself (over
 * `stepInteraction`) is integration-tested separately.
 */

import { describe, it, expect } from "@jest/globals";
import {
  classifyStatus,
  orthogonalSet,
  biorthogonalClosure,
  isBehaviour,
  UndecidedOrthogonalityError,
  type Orthogonality,
  type OrthogonalityOracle,
} from "../behaviourClosure";

/**
 * Build a stub oracle from a symmetric orthogonality table.
 * `table[a]` = the set of ids orthogonal to `a`. Missing pairs default to
 * non-orthogonal; pairs listed in `undecided` return 'undecided'.
 */
function stubOracle(
  table: Record<string, string[]>,
  undecided: Array<[string, string]> = []
): OrthogonalityOracle {
  const undecidedSet = new Set(
    undecided.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
  );
  return async (a, b) => {
    if (undecidedSet.has(`${a}|${b}`)) return "undecided";
    const ab = table[a]?.includes(b) ?? false;
    const ba = table[b]?.includes(a) ?? false;
    return ab || ba ? "orthogonal" : "non-orthogonal";
  };
}

describe("classifyStatus (D0.2 totality)", () => {
  it("maps CONVERGENT to orthogonal", () => {
    expect(classifyStatus("CONVERGENT")).toBe<Orthogonality>("orthogonal");
  });
  it("maps DIVERGENT and STUCK to non-orthogonal", () => {
    expect(classifyStatus("DIVERGENT")).toBe<Orthogonality>("non-orthogonal");
    expect(classifyStatus("STUCK")).toBe<Orthogonality>("non-orthogonal");
  });
  it("maps ONGOING to undecided (never folded into a verdict)", () => {
    expect(classifyStatus("ONGOING")).toBe<Orthogonality>("undecided");
  });
});

describe("orthogonalSet", () => {
  it("returns candidates orthogonal to every member of G", async () => {
    // x ⊥ a, x ⊥ b ; y ⊥ a only
    const ortho = stubOracle({ x: ["a", "b"], y: ["a"] });
    const res = await orthogonalSet(["a", "b"], ["x", "y"], ortho);
    expect(res).toEqual(["x"]);
  });

  it("with empty G, every candidate is vacuously orthogonal", async () => {
    const ortho = stubOracle({});
    const res = await orthogonalSet([], ["x", "y"], ortho);
    expect(res).toEqual(["x", "y"]);
  });

  it("raises on an undecided test (D0.2 — no silent fold)", async () => {
    const ortho = stubOracle({ x: ["a"] }, [["x", "a"]]);
    await expect(orthogonalSet(["a"], ["x"], ortho)).rejects.toBeInstanceOf(
      UndecidedOrthogonalityError
    );
  });
});

describe("biorthogonalClosure", () => {
  it("is extensive: G ⊆ G⊥⊥ (within the universe)", async () => {
    // Self-orthogonal pair {a,b}; universe adds c which is orthogonal to neither.
    const ortho = stubOracle({ a: ["b"], b: ["a"] });
    const universe = ["a", "b", "c"];
    const closure = await biorthogonalClosure(["a", "b"], universe, ortho);
    expect(closure).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("preserves universe ordering and dedupes", async () => {
    const ortho = stubOracle({ a: ["b"], b: ["a"], c: ["d"], d: ["c"] });
    const universe = ["a", "b", "c", "d"];
    const closure = await biorthogonalClosure(["a"], universe, ortho);
    // Result is a subsequence of `universe` (no reordering, no duplicates).
    const idx = closure.map((x) => universe.indexOf(x));
    expect(idx).toEqual([...idx].sort((m, n) => m - n));
    expect(new Set(closure).size).toBe(closure.length);
  });
});

describe("isBehaviour (operational B = B⊥⊥)", () => {
  it("a bi-orthogonally closed set is a behaviour", async () => {
    // G⊥ = {x}, (G⊥)⊥ ∩ universe = {a,b} = G  → behaviour.
    const ortho = stubOracle({ x: ["a", "b"], a: ["x"], b: ["x"] });
    const universe = ["a", "b", "x"];
    expect(await isBehaviour(["a", "b"], universe, ortho)).toBe(true);
  });

  it("a non-closed set is not a behaviour", async () => {
    // {a} is not closed: its bi-orthogonal also pulls in b.
    const ortho = stubOracle({ x: ["a", "b"], a: ["x"], b: ["x"] });
    const universe = ["a", "b", "x"];
    expect(await isBehaviour(["a"], universe, ortho)).toBe(false);
  });
});
