// lib/argumentation/__tests__/afGoldenFixtures.test.ts
//
// Golden-output parity fixtures for the consolidated AF engine
// (`@/lib/argumentation`). These lock the behaviour of grounded / preferred /
// labelling on a fixed set of canonical Dung frameworks so that the Phase 1
// labelling-core refactor cannot silently change results.
//
// Each fixture is expressed against BOTH public representations:
//   • attack-map  — buildAttackGraph + groundedExtension + preferredExtensions
//   • edge-list   — projectToAF + grounded + preferred + labelingFromExtension
//
// Conventions: an "attack" is encoded as a `rebut` edge (the attack-map
// builder treats rebut/undercut as attacks and ignores support).

import {
  buildAttackGraph,
  groundedExtension,
  preferredExtensions,
  projectToAF,
  grounded,
  preferred,
  labelingFromExtension,
  type Edge,
  type AFNode,
  type AFEdge,
} from "@/lib/argumentation";

// ---- helpers ---------------------------------------------------------------

const sortedSet = (s: Set<string>): string[] => [...s].sort();

const sortedFamily = (fam: Set<string>[]): string[][] =>
  fam
    .map(sortedSet)
    .sort((a, b) => a.join("|").localeCompare(b.join("|")));

/** Build the attack-map AF from a node list and attack pairs. */
function attackMapAF(nodes: string[], attacks: Array<[string, string]>) {
  const edges: Edge[] = attacks.map(([from, to]) => ({ from, to, type: "rebut" }));
  return buildAttackGraph(nodes, edges);
}

/** Build the edge-list AF from a node list and attack pairs. */
function edgeListAF(nodes: string[], attacks: Array<[string, string]>) {
  const afNodes: AFNode[] = nodes.map((id) => ({ id }));
  const afEdges: AFEdge[] = attacks.map(([from, to]) => ({ from, to, type: "rebut" }));
  return projectToAF(afNodes, afEdges);
}

// ---- fixtures --------------------------------------------------------------

describe("AF golden fixtures — attack-map representation", () => {
  it("empty framework → empty grounded extension, no preferred sets beyond ∅", () => {
    const map = attackMapAF([], []);
    expect(sortedSet(groundedExtension([], map))).toEqual([]);
    expect(sortedFamily(preferredExtensions([], map))).toEqual([[]]);
  });

  it("single unattacked argument → IN under grounded", () => {
    const nodes = ["a"];
    const map = attackMapAF(nodes, []);
    expect(sortedSet(groundedExtension(nodes, map))).toEqual(["a"]);
    expect(sortedFamily(preferredExtensions(nodes, map))).toEqual([["a"]]);
  });

  it("a → b → grounded {a}, b defeated", () => {
    const nodes = ["a", "b"];
    const map = attackMapAF(nodes, [["a", "b"]]);
    expect(sortedSet(groundedExtension(nodes, map))).toEqual(["a"]);
    expect(sortedFamily(preferredExtensions(nodes, map))).toEqual([["a"]]);
  });

  it("defense chain a → b → c → grounded {a, c}", () => {
    const nodes = ["a", "b", "c"];
    const map = attackMapAF(nodes, [
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(sortedSet(groundedExtension(nodes, map))).toEqual(["a", "c"]);
    expect(sortedFamily(preferredExtensions(nodes, map))).toEqual([["a", "c"]]);
  });

  it("even cycle a ↔ b → grounded ∅, two preferred extensions {a},{b}", () => {
    const nodes = ["a", "b"];
    const map = attackMapAF(nodes, [
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(sortedSet(groundedExtension(nodes, map))).toEqual([]);
    expect(sortedFamily(preferredExtensions(nodes, map))).toEqual([["a"], ["b"]]);
  });

  it("odd cycle a → b → c → a → grounded ∅, only the empty admissible set", () => {
    const nodes = ["a", "b", "c"];
    const map = attackMapAF(nodes, [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ]);
    expect(sortedSet(groundedExtension(nodes, map))).toEqual([]);
    expect(sortedFamily(preferredExtensions(nodes, map))).toEqual([[]]);
  });
});

describe("AF golden fixtures — edge-list representation", () => {
  it("single unattacked argument → grounded {a}", () => {
    const { A, R } = edgeListAF(["a"], []);
    expect(sortedSet(grounded(A, R))).toEqual(["a"]);
    expect(sortedFamily(preferred(A, R))).toEqual([["a"]]);
  });

  it("a → b → grounded {a}; labelling a=IN, b=OUT", () => {
    const { A, R } = edgeListAF(["a", "b"], [["a", "b"]]);
    const g = grounded(A, R);
    expect(sortedSet(g)).toEqual(["a"]);
    const lab = labelingFromExtension(A, R, g);
    expect(sortedSet(lab.IN)).toEqual(["a"]);
    expect(sortedSet(lab.OUT)).toEqual(["b"]);
    expect(sortedSet(lab.UNDEC)).toEqual([]);
  });

  it("defense chain a → b → c → grounded {a, c}; b=OUT", () => {
    const { A, R } = edgeListAF(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
    ]);
    const g = grounded(A, R);
    expect(sortedSet(g)).toEqual(["a", "c"]);
    const lab = labelingFromExtension(A, R, g);
    expect(sortedSet(lab.IN)).toEqual(["a", "c"]);
    expect(sortedSet(lab.OUT)).toEqual(["b"]);
    expect(sortedSet(lab.UNDEC)).toEqual([]);
  });

  it("even cycle a ↔ b → grounded ∅; both UNDEC; two preferred extensions", () => {
    const { A, R } = edgeListAF(["a", "b"], [
      ["a", "b"],
      ["b", "a"],
    ]);
    const g = grounded(A, R);
    expect(sortedSet(g)).toEqual([]);
    const lab = labelingFromExtension(A, R, g);
    expect(sortedSet(lab.UNDEC)).toEqual(["a", "b"]);
    expect(sortedFamily(preferred(A, R))).toEqual([["a"], ["b"]]);
  });

  it("odd cycle a → b → c → a → grounded ∅; all UNDEC; only ∅ admissible", () => {
    const { A, R } = edgeListAF(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ]);
    const g = grounded(A, R);
    expect(sortedSet(g)).toEqual([]);
    const lab = labelingFromExtension(A, R, g);
    expect(sortedSet(lab.UNDEC)).toEqual(["a", "b", "c"]);
    expect(sortedFamily(preferred(A, R))).toEqual([[]]);
  });
});
