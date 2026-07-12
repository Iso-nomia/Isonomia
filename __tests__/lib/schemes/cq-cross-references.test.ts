import {
  CQ_CROSS_REFERENCES,
  getCqCrossReferences,
  getSchemeCrossReferences,
  buildOpensGraph,
  findOpensCycles,
  analyzeRecursionTermination,
  type CqCrossReference,
} from "@/lib/schemes/cq-cross-references";

describe("CQ cross-reference catalogue", () => {
  test("every edge is well-formed", () => {
    for (const e of CQ_CROSS_REFERENCES) {
      expect(e.fromScheme).toBeTruthy();
      expect(e.fromCq).toBeTruthy();
      expect(e.refScheme).toBeTruthy();
      expect(["opens", "competes"]).toContain(e.relation);
      expect(e.rationale.length).toBeGreaterThan(0);
    }
  });

  test("the canonical Walton fact is present: PR side-effects opens negative_consequences", () => {
    const refs = getCqCrossReferences("practical_reasoning", "PR.SIDE_EFFECTS");
    expect(refs).toHaveLength(1);
    expect(refs[0].refScheme).toBe("negative_consequences");
    expect(refs[0].relation).toBe("opens");
  });

  test("getSchemeCrossReferences returns all edges for a scheme", () => {
    const refs = getSchemeCrossReferences("practical_reasoning");
    const cqKeys = refs.map((r) => r.fromCq).sort();
    expect(cqKeys).toEqual(["PR.ALTERNATIVES", "PR.SIDE_EFFECTS"]);
  });

  test("unknown (scheme, cq) yields no edges", () => {
    expect(getCqCrossReferences("expert_opinion", "domain_fit")).toEqual([]);
  });
});

describe("opens-graph (the CQ-of-CQ recursion edges)", () => {
  test("only `opens` edges enter the graph; `competes` edges are excluded", () => {
    const g = buildOpensGraph();
    // PR.ALTERNATIVES is a `competes` self-edge — must NOT create a PR self-loop.
    expect(g.get("practical_reasoning")?.has("practical_reasoning")).not.toBe(true);
    // PR.SIDE_EFFECTS is an `opens` edge — must be present.
    expect(g.get("practical_reasoning")?.has("negative_consequences")).toBe(true);
  });

  test("the positive/negative consequences pair forms a 2-cycle", () => {
    const cycles = findOpensCycles();
    const hasPcNcCycle = cycles.some(
      (c) =>
        c.includes("positive_consequences") &&
        c.includes("negative_consequences")
    );
    expect(hasPcNcCycle).toBe(true);
  });
});

describe("Q-017 recursion-termination analysis", () => {
  test("the production catalogue is finite but NOT acyclic (the honest finding)", () => {
    const report = analyzeRecursionTermination();
    expect(report.finite).toBe(true);
    expect(report.acyclic).toBe(false);
    expect(report.guarantee).toBe("visited-set");
    expect(report.cycles.length).toBeGreaterThan(0);
  });

  test("an acyclic edge set reports the acyclic guarantee", () => {
    const acyclicEdges: CqCrossReference[] = [
      {
        fromScheme: "a",
        fromCq: "A.X",
        refScheme: "b",
        relation: "opens",
        rationale: "test",
      },
      {
        fromScheme: "b",
        fromCq: "B.Y",
        refScheme: "c",
        relation: "opens",
        rationale: "test",
      },
    ];
    const report = analyzeRecursionTermination(acyclicEdges);
    expect(report.acyclic).toBe(true);
    expect(report.guarantee).toBe("acyclic");
    expect(report.cycles).toEqual([]);
  });
});
