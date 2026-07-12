// lib/argumentation/__tests__/semantics.test.ts
//
// Phase 1 property tests for the exact labelling-based semantics core.
// Encodes the worked cases of the Q-031 cyclic-defeat verdict plus the
// standard inclusion relationships between semantics.

import {
  toDefeatGraphFromEdgeList,
  groundedExtensionDG,
  completeExtensions,
  preferredExtensionsDG,
  stableExtensions,
  semiStableExtensions,
  groundedLabelling,
  labellingToSets,
  type DefeatGraph,
} from "@/lib/argumentation";

const set = (s: Set<string>): string[] => [...s].sort();
const family = (fam: Set<string>[]): string[][] =>
  fam.map(set).sort((a, b) => a.join("|").localeCompare(b.join("|")));

function af(nodes: string[], attacks: Array<[string, string]>): DefeatGraph {
  return toDefeatGraphFromEdgeList(nodes, attacks);
}

const isSubset = (a: string[], b: string[]): boolean => a.every((x) => b.includes(x));

describe("Phase 1 — exact semantics core", () => {
  describe("Q-031 worked cases", () => {
    it("even cycle a ↔ b: grounded all-UNDEC, exactly two stable extensions {a},{b}", () => {
      const dg = af(["a", "b"], [
        ["a", "b"],
        ["b", "a"],
      ]);
      expect(set(groundedExtensionDG(dg))).toEqual([]);
      const lab = labellingToSets(groundedLabelling(dg));
      expect(set(lab.UNDEC)).toEqual(["a", "b"]);

      expect(family(stableExtensions(dg))).toEqual([["a"], ["b"]]);
      expect(family(preferredExtensionsDG(dg))).toEqual([["a"], ["b"]]);
    });

    it("odd cycle a → b → c → a: grounded all-UNDEC, NO stable extension", () => {
      const dg = af(["a", "b", "c"], [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ]);
      expect(set(groundedExtensionDG(dg))).toEqual([]);
      const lab = labellingToSets(groundedLabelling(dg));
      expect(set(lab.UNDEC)).toEqual(["a", "b", "c"]);

      expect(stableExtensions(dg)).toEqual([]); // no stable extension
      // only the empty set is admissible/complete here
      expect(family(completeExtensions(dg))).toEqual([[]]);
      expect(family(preferredExtensionsDG(dg))).toEqual([[]]);
    });
  });

  describe("inclusion relationships (generic AFs)", () => {
    const fixtures: Array<{ name: string; dg: DefeatGraph }> = [
      { name: "single", dg: af(["a"], []) },
      { name: "a→b", dg: af(["a", "b"], [["a", "b"]]) },
      { name: "defense chain", dg: af(["a", "b", "c"], [["a", "b"], ["b", "c"]]) },
      { name: "even cycle", dg: af(["a", "b"], [["a", "b"], ["b", "a"]]) },
      { name: "odd cycle", dg: af(["a", "b", "c"], [["a", "b"], ["b", "c"], ["c", "a"]]) },
      {
        name: "two independent 2-cycles",
        dg: af(["a", "b", "c", "d"], [
          ["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"],
        ]),
      },
    ];

    it.each(fixtures)("grounded ⊆ every preferred extension ($name)", ({ dg }) => {
      const g = set(groundedExtensionDG(dg));
      for (const p of preferredExtensionsDG(dg)) {
        expect(isSubset(g, set(p))).toBe(true);
      }
    });

    it.each(fixtures)("every stable extension is preferred ($name)", ({ dg }) => {
      const prefs = family(preferredExtensionsDG(dg));
      for (const s of stableExtensions(dg)) {
        expect(prefs).toContainEqual(set(s));
      }
    });

    it.each(fixtures)("every semi-stable extension is preferred ($name)", ({ dg }) => {
      const prefs = family(preferredExtensionsDG(dg));
      for (const s of semiStableExtensions(dg)) {
        expect(prefs).toContainEqual(set(s));
      }
    });

    it.each(fixtures)("every preferred extension is complete ($name)", ({ dg }) => {
      const complete = family(completeExtensions(dg));
      for (const p of preferredExtensionsDG(dg)) {
        expect(complete).toContainEqual(set(p));
      }
    });
  });

  describe("exactness past the old 18-node ceiling", () => {
    it("a chain of 25 independent unattacked args → single preferred = all of them", () => {
      const nodes = Array.from({ length: 25 }, (_, i) => `n${i}`);
      const dg = af(nodes, []);
      const prefs = preferredExtensionsDG(dg);
      expect(prefs).toHaveLength(1);
      expect(set(prefs[0])).toEqual(set(new Set(nodes)));
      // grounded already decides everything → stable == preferred == { all }
      expect(family(stableExtensions(dg))).toEqual([set(new Set(nodes))]);
    });

    it("10 independent 2-cycles → 2^10 stable extensions (exact, no ceiling)", () => {
      const nodes: string[] = [];
      const attacks: Array<[string, string]> = [];
      for (let i = 0; i < 10; i++) {
        const x = `x${i}`;
        const y = `y${i}`;
        nodes.push(x, y);
        attacks.push([x, y], [y, x]);
      }
      const dg = af(nodes, attacks);
      expect(stableExtensions(dg)).toHaveLength(1 << 10);
      expect(preferredExtensionsDG(dg)).toHaveLength(1 << 10);
    });
  });
});
